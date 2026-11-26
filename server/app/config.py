"""Settings come from environment variables or server/.env."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    llm_provider: str = "groq"                  # groq | anthropic | mock
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    llm_timeout_seconds: float = 60.0
    max_answer_tokens: int = 1500

    # One question usually takes two requests (ask for data, then answer).
    rate_limit_per_minute: int = 20
    rate_limit_per_day: int = 300
    daily_request_cap: int = 2000
    max_tool_rounds: int = 4
    trust_proxy: bool = False


settings = Settings()
