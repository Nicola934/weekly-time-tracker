import os
from collections.abc import Generator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

DB_PATH = Path(__file__).resolve().parents[2] / "backend.db"


def _database_url() -> str:
    configured = str(os.getenv("DATABASE_URL", "")).strip()
    if not configured:
        return f"sqlite:///{DB_PATH}"
    if configured.startswith("postgres://"):
        return configured.replace("postgres://", "postgresql://", 1)
    return configured


def _engine_kwargs(database_url: str) -> dict:
    kwargs = {
        "echo": str(os.getenv("SQL_ECHO", "")).strip().lower() == "true",
    }
    if database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True
    return kwargs


DATABASE_URL = _database_url()
engine = create_engine(DATABASE_URL, **_engine_kwargs(DATABASE_URL))


def _ensure_column(table_name: str, column_name: str, definition: str) -> None:
    with engine.begin() as connection:
        if connection.dialect.name == "sqlite":
            columns = {
                row[1]
                for row in connection.exec_driver_sql(
                    f'PRAGMA table_info("{table_name}")'
                ).fetchall()
            }
            if column_name in columns:
                return

            connection.exec_driver_sql(
                f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {definition}'
            )
            return

        connection.exec_driver_sql(
            f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{column_name}" {definition}'
        )


def _backfill_session_objective() -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            UPDATE "session"
            SET "objective" = COALESCE(
                (
                    SELECT NULLIF(TRIM("scheduleblock"."notes"), "")
                    FROM "scheduleblock"
                    WHERE "scheduleblock"."id" = "session"."schedule_block_id"
                ),
                (
                    SELECT NULLIF(TRIM("task"."objective"), "")
                    FROM "task"
                    WHERE "task"."id" = "session"."task_id"
                ),
                NULLIF(TRIM("output_notes"), "")
            )
            WHERE "objective" IS NULL OR TRIM("objective") = ""
            """
        )


def _backfill_session_objective_completed() -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            UPDATE "session"
            SET "objective_completed" = 0
            WHERE "objective_completed" IS NULL
            """
        )


def _backfill_session_quality_label() -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            UPDATE "session"
            SET "quality_label" = CASE
                WHEN "quality_label" IS NULL OR TRIM("quality_label") = '' THEN 'failed'
                WHEN LOWER(TRIM("quality_label")) = 'strong' THEN 'strong'
                WHEN LOWER(TRIM("quality_label")) = 'partial' THEN 'partial'
                WHEN LOWER(TRIM("quality_label")) = 'failed' THEN 'failed'
                ELSE LOWER(TRIM("quality_label"))
            END
            """
        )


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)

    _ensure_column("task", "category", "TEXT DEFAULT ''")
    _ensure_column("task", "user_id", "INTEGER")
    _ensure_column("scheduleblock", "user_id", "INTEGER")
    _ensure_column("session", "reminder_offset_minutes", "INTEGER")
    _ensure_column("session", "user_id", "INTEGER")
    _ensure_column("session", "objective", "TEXT")
    _ensure_column("session", "goal_context", "TEXT")
    _ensure_column("session", "objective_completed", "BOOLEAN DEFAULT 0")
    _ensure_column("session", "objective_locked", "BOOLEAN DEFAULT 0")
    _ensure_column("session", "reflection_notes", "TEXT DEFAULT ''")
    _ensure_column("session", "failure_reason", "TEXT")
    _ensure_column("session", "failure_reason_detail", "TEXT")
    _ensure_column("session", "distraction_category", "TEXT")
    _ensure_column("session", "start_delta_minutes", "REAL")
    _ensure_column("session", "quality_score", "REAL DEFAULT 0")
    _ensure_column("session", "quality_label", "TEXT DEFAULT 'failed'")
    _ensure_column("missedhabit", "user_id", "INTEGER")
    _ensure_column("notificationconfig", "user_id", "INTEGER")
    _ensure_column("goalcontextconfig", "user_id", "INTEGER")
    _ensure_column("syncevent", "user_id", "INTEGER")
    _ensure_column("weeklyprogressmemory", "user_id", "INTEGER")
    _backfill_session_objective()
    _backfill_session_objective_completed()
    _backfill_session_quality_label()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
