"""One reply from the language model, in a provider-neutral shape."""
import json
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings
from app.prompt import TOOLS
from app.schemas import Message


class Busy(Exception):
    """The provider is rate limiting us."""


class ProviderError(Exception):
    """The provider failed. The message must never contain user data."""


@dataclass
class Reply:
    content: str = ""
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    provider_data: Optional[List[Dict[str, Any]]] = None
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""


def generate(messages: List[Message], system: str, allow_tools: bool) -> Reply:
    providers = {"groq": _groq, "anthropic": _anthropic, "mock": _mock}
    if settings.llm_provider not in providers:
        raise ProviderError("Unknown LLM_PROVIDER.")
    return providers[settings.llm_provider](messages, system, allow_tools)


# --------------------------------------------------------------------------- Groq / OpenAI-style
def _openai_message(m: Message) -> Dict[str, Any]:
    if m.role == "tool":
        return {"role": "tool", "tool_call_id": m.tool_call_id, "content": m.content}
    data: Dict[str, Any] = {"role": m.role, "content": m.content}
    if m.tool_calls:
        data["tool_calls"] = [
            {"id": c.id, "type": "function", "function": {"name": c.name, "arguments": json.dumps(c.arguments)}}
            for c in m.tool_calls
        ]
    return data


def _arguments(raw: str) -> Dict[str, Any]:
    try:
        value = json.loads(raw or "{}")
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def _groq(messages: List[Message], system: str, allow_tools: bool) -> Reply:
    if not settings.groq_api_key:
        raise ProviderError("GROQ_API_KEY is not set.")
    payload: Dict[str, Any] = {
        "model": settings.groq_model,
        "messages": [{"role": "system", "content": system}] + [_openai_message(m) for m in messages],
        "tools": [{"type": "function", "function": tool} for tool in TOOLS],
        "tool_choice": "auto" if allow_tools else "none",
        "max_tokens": settings.max_answer_tokens,
        "temperature": 0,
    }
    if "gpt-oss" in settings.groq_model:
        payload["reasoning_effort"] = "low"

    for attempt in (1, 2, 3):
        try:
            response = httpx.post(
                f"{settings.groq_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json=payload,
                timeout=settings.llm_timeout_seconds,
            )
        except httpx.HTTPError as err:
            raise ProviderError(type(err).__name__)
        if response.status_code != 429:
            break
        if attempt == 3:
            raise Busy()
        try:
            wait = float(response.headers.get("retry-after", ""))
        except ValueError:
            wait = 2.0 * attempt
        if wait > 10:
            raise Busy()
        time.sleep(wait)

    if response.status_code >= 400:
        raise ProviderError(f"HTTP {response.status_code}")
    data = response.json()
    message = data["choices"][0]["message"]
    usage = data.get("usage") or {}
    calls = [
        {"id": c["id"], "name": c["function"]["name"], "arguments": _arguments(c["function"].get("arguments"))}
        for c in (message.get("tool_calls") or [])
    ]
    return Reply(
        content=message.get("content") or "",
        tool_calls=calls if allow_tools else [],
        input_tokens=usage.get("prompt_tokens", 0),
        output_tokens=usage.get("completion_tokens", 0),
        model=settings.groq_model,
    )


# --------------------------------------------------------------------------- Claude
def _anthropic_messages(messages: List[Message]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for m in messages:
        if m.role == "tool":
            block = {"type": "tool_result", "tool_use_id": m.tool_call_id, "content": m.content}
            # All results for one reply belong in a single user message.
            if result and result[-1]["role"] == "user" and isinstance(result[-1]["content"], list):
                result[-1]["content"].append(block)
            else:
                result.append({"role": "user", "content": [block]})
        elif m.role == "assistant" and m.provider_data:
            result.append({"role": "assistant", "content": m.provider_data})
        elif m.role == "assistant" and m.tool_calls:
            blocks: List[Dict[str, Any]] = [{"type": "text", "text": m.content}] if m.content else []
            blocks += [{"type": "tool_use", "id": c.id, "name": c.name, "input": c.arguments} for c in m.tool_calls]
            result.append({"role": "assistant", "content": blocks})
        else:
            result.append({"role": m.role, "content": m.content})
    return result


def _anthropic(messages: List[Message], system: str, allow_tools: bool) -> Reply:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None, timeout=settings.llm_timeout_seconds)
    try:
        response = client.beta.messages.create(
            model=settings.anthropic_model,
            # Thinking counts toward max_tokens, so leave room beyond the visible answer.
            max_tokens=16000,
            system=system,
            messages=_anthropic_messages(messages),
            tools=[
                {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]} for t in TOOLS
            ],
            tool_choice={"type": "auto" if allow_tools else "none"},
            # If a safety check declines the request, let the API retry it on a fallback model.
            betas=["server-side-fallback-2026-07-01"],
            extra_body={"fallbacks": "default", "output_config": {"effort": "low"}},
        )
    except anthropic.RateLimitError:
        raise Busy()
    except anthropic.APIStatusError as err:
        raise ProviderError(f"HTTP {err.status_code}")
    except anthropic.APIConnectionError:
        raise ProviderError("Connection failed")

    if response.stop_reason == "refusal":
        return Reply(content="Sorry, I can't help with that.", model=settings.anthropic_model)
    text = "".join(block.text for block in response.content if block.type == "text")
    calls = [
        {"id": b.id, "name": b.name, "arguments": b.input if isinstance(b.input, dict) else {}}
        for b in response.content
        if b.type == "tool_use"
    ]
    if response.stop_reason != "tool_use" or not allow_tools:
        calls = []
    return Reply(
        content=text,
        tool_calls=calls,
        provider_data=[b.model_dump(mode="json", exclude_none=True) for b in response.content] if calls else None,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        model=response.model,
    )


# --------------------------------------------------------------------------- test double
def _mock(messages: List[Message], system: str, allow_tools: bool) -> Reply:
    """No model and no key: picks a tool by keyword, so the app can be tried end to end."""
    last = messages[-1]
    if last.role == "user" and allow_tools:
        text = last.content.lower()
        name = "spending_summary"
        for word, tool in (
            ("budget", "budget_status"), ("bill", "upcoming_payments"), ("due", "upcoming_payments"),
            ("goal", "savings_goals"), ("trend", "monthly_trend"), ("save", "monthly_trend"),
            ("show", "find_transactions"),
        ):
            if word in text:
                name = tool
                break
        return Reply(tool_calls=[{"id": f"mock-{len(messages)}", "name": name, "arguments": {}}], model="mock")
    return Reply(content="**Test mode:** here is what your phone returned. No AI model was used.", model="mock")
