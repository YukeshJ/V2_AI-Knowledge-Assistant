from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "knowledge_assistant"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    admin_username: str = "admin"
    admin_password: str = "admin123"

    upload_dir: str = "uploads"
    vector_dir: str = "vector_store"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    default_top_k: int = 5
    chunk_size: int = 800
    chunk_overlap: int = 120

    ollama_url: str = "http://127.0.0.1:11434"

    ollama_model: str = "gemma4:e2b"


    online_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    skip_rag_init: bool = False
    testing_mode: bool = False
    rate_limit_window_seconds: int = 60
    rate_limit_max_requests: int = 120

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / settings.upload_dir
VECTOR_DIR = BASE_DIR / settings.vector_dir

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_DIR.mkdir(parents=True, exist_ok=True)
