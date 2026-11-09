import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings, _BACKEND_DIR

def _resolve_database_url(raw_url: str) -> str:
    if raw_url.startswith("sqlite:///./"):
        rel_path = raw_url[len("sqlite:///./"):]
        abs_path = os.path.join(_BACKEND_DIR, rel_path).replace("\\", "/")
        return f"sqlite:///{abs_path}"
    return raw_url

_EFFECTIVE_DATABASE_URL = _resolve_database_url(settings.DATABASE_URL)

engine = create_engine(
    _EFFECTIVE_DATABASE_URL,
    connect_args={"check_same_thread": False} if _EFFECTIVE_DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
