"""A small relay between the Fime app and a language model.

It stores nothing about conversations: no questions, answers or amounts are written anywhere.
"""
import logging
import threading
import time
from collections import defaultdict, deque
from datetime import date
from typing import Deque, Dict

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from app import llm
from app.config import BASE_DIR, settings
from app.prompt import SYSTEM_PROMPT, date_context
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
    limit = settings.max_audio_bytes if request.url.path == "/v1/transcribe" else MAX_BODY_BYTES
    if not length.isdigit() or int(length) > limit:
        return JSONResponse({"detail": "Request is too large."}, status_code=413)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, _error: RequestValidationError):
    # The default response would echo the user's data back.
    return JSONResponse({"detail": "That message couldn't be processed. Try starting a new chat."}, status_code=422)


@app.get("/privacy")
def privacy():
    """The app's privacy policy, linked from its Play Store listing."""
    return FileResponse(BASE_DIR / "static" / "privacy.html")


@app.get("/terms")
def terms():
    return FileResponse(BASE_DIR / "static" / "terms.html")


@app.get("/health")
def health():
    return {"status": "ok"}


def enforce_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if settings.trust_proxy:
        ip = request.headers.get("x-forwarded-for", ip).split(",")[0].strip()
    if not limiter.check(ip):
        raise HTTPException(status_code=429, detail="You've reached the question limit. Please try again later.")


@app.post("/v1/transcribe")
async def transcribe(request: Request):
    """The request body is the recording itself. It stays in memory and is never saved."""
    enforce_limit(request)
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in llm.AUDIO_TYPES:
        raise HTTPException(status_code=415, detail="That kind of recording isn't supported.")
    audio = bytearray()
    # Counted while reading, in case the declared length was missing or wrong.
    async for chunk in request.stream():
        audio.extend(chunk)
        if len(audio) > settings.max_audio_bytes:
            raise HTTPException(status_code=413, detail="That recording is too long.")
    if not audio:
        raise HTTPException(status_code=422, detail="The recording was empty.")

    started = time.time()
    try:
        text = await run_in_threadpool(llm.transcribe, bytes(audio), content_type)
    except llm.Busy:
        raise HTTPException(status_code=429, detail="The assistant is busy. Please try again in a few seconds.")
    except llm.ProviderError as error:
        log.error("Transcription failed: %s", error)
        raise HTTPException(status_code=502, detail="I couldn't understand the recording. Please try again.")
    log.info("transcribed bytes=%d ms=%d", len(audio), (time.time() - started) * 1000)
    return {"text": text[:2000]}


@app.post("/v1/chat")
def chat(body: ChatRequest, request: Request):
    enforce_limit(request)

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
            f"{SYSTEM_PROMPT}\n{date_context(date.fromisoformat(body.today))}",
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
