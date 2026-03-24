from collections.abc import Generator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

DB_PATH = Path(__file__).resolve().parents[2] / "backend.db"
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
