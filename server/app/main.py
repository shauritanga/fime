"""A small relay between the Fime app and a language model.

It stores nothing about conversations: no questions, answers or amounts are written anywhere.
"""
import logging
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app import llm
from app.config import settings
from app.prompt import SYSTEM_PROMPT
from app.schemas import ChatRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("fime-assistant")
MAX_BODY_BYTES = 200_000

app = FastAPI(title="Fime Assistant", docs_url=None, redoc_url=None, openapi_url=None)


class Limiter:
    """In-memory limits per visitor and overall (one worker process)."""

    def __init__(self):
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, ip: str) -> bool:
        now = time.monotonic()
        rules = (
            (f"m:{ip}", 60, settings.rate_limit_per_minute),
            (f"d:{ip}", 86400, settings.rate_limit_per_day),
            ("all", 86400, settings.daily_request_cap),
        )
        with self._lock:
            for key, window, limit in rules:
                hits = self._hits[key]
                while hits and now - hits[0] > window:
                    hits.popleft()
                if len(hits) >= limit:
                    return False
            for key, _, _ in rules:
                self._hits[key].append(now)
            return True

    def reset(self):
        with self._lock:
            self._hits.clear()


limiter = Limiter()


@app.middleware("http")
async def limit_body(request: Request, call_next):
    length = request.headers.get("content-length", "0")
    if not length.isdigit() or int(length) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "Request is too large."}, status_code=413)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, _error: RequestValidationError):
    # The default response would echo the user's data back.
    return JSONResponse({"detail": "That message couldn't be processed. Try starting a new chat."}, status_code=422)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/v1/chat")
def chat(body: ChatRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    if settings.trust_proxy:
        ip = request.headers.get("x-forwarded-for", ip).split(",")[0].strip()
    if not limiter.check(ip):
        raise HTTPException(status_code=429, detail="You've reached the question limit. Please try again later.")

    # How many times the model has already asked for data since the latest question.
    rounds = 0
    for message in reversed(body.messages):
        if message.role == "user":
            break
        if message.role == "assistant" and message.tool_calls:
            rounds += 1

    started = time.time()
    try:
        reply = llm.generate(
            body.messages,
            f"{SYSTEM_PROMPT}\nToday's date is {body.today}.",
            allow_tools=rounds < settings.max_tool_rounds,
        )
    except llm.Busy:
        raise HTTPException(status_code=429, detail="The assistant is busy. Please try again in a few seconds.")
    except llm.ProviderError as error:
        log.error("Provider failed: %s", error)
        raise HTTPException(status_code=502, detail="The assistant couldn't answer. Please try again.")

    log.info(
        "model=%s tools=%d tokens=%d/%d ms=%d",
        reply.model, len(reply.tool_calls), reply.input_tokens, reply.output_tokens, (time.time() - started) * 1000,
    )
    if not reply.tool_calls and not reply.content.strip():
        raise HTTPException(status_code=502, detail="The assistant couldn't answer. Please try again.")
    return {"content": reply.content, "tool_calls": reply.tool_calls, "provider_data": reply.provider_data}
