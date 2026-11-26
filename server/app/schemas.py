"""What the app may send. Limits keep requests small and cheap."""
from datetime import date
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.prompt import TOOL_NAMES

MAX_TOTAL_CHARS = 60_000
LIMITS = {"user": 2_000, "assistant": 8_000, "tool": 16_000}


class ToolCall(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=200)
    name: str = Field(max_length=64)
    arguments: Dict[str, Any] = Field(default_factory=dict)


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant", "tool"]
    content: str = ""
    tool_calls: Optional[List[ToolCall]] = Field(default=None, max_length=8)
    tool_call_id: Optional[str] = Field(default=None, max_length=200)
    name: Optional[str] = Field(default=None, max_length=64)
    # Claude's original reply blocks, echoed back unchanged while it is still using tools.
    provider_data: Optional[List[Dict[str, Any]]] = Field(default=None, max_length=32)

    @model_validator(mode="after")
    def check(self):
        if len(self.content) > LIMITS[self.role]:
            raise ValueError("Message is too long.")
        if self.role == "tool" and (not self.tool_call_id or self.name not in TOOL_NAMES):
            raise ValueError("Unknown tool result.")
        if self.role != "assistant" and (self.tool_calls or self.provider_data):
            raise ValueError("Only the assistant can call tools.")
        if self.tool_calls and any(call.name not in TOOL_NAMES for call in self.tool_calls):
            raise ValueError("Unknown tool.")
        return self


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The phone's local date, so "this month" means what the user means.
    today: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    messages: List[Message] = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def check(self):
        date.fromisoformat(self.today)  # rejects dates such as 2026-02-30
        if self.messages[0].role != "user" or self.messages[-1].role not in ("user", "tool"):
            raise ValueError("A conversation must start with a question and await a reply.")
        size = sum(len(m.model_dump_json()) for m in self.messages)
        if size > MAX_TOTAL_CHARS:
            raise ValueError("The conversation is too long. Start a new chat.")
        # Every tool call needs its result, and every result its call.
        pending = set()
        for message in self.messages:
            if message.role == "tool":
                if message.tool_call_id not in pending:
                    raise ValueError("Tool result without a matching call.")
                pending.remove(message.tool_call_id)
                continue
            if pending:
                raise ValueError("Missing tool result.")
            pending = {call.id for call in (message.tool_calls or [])}
        if pending:
            raise ValueError("Missing tool result.")
        return self
