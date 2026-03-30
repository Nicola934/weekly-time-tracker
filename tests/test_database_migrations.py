from contextlib import AbstractContextManager
from types import SimpleNamespace

from backend.app import database


class _FakeConnection:
    def __init__(self, dialect_name: str) -> None:
        self.dialect = SimpleNamespace(name=dialect_name)
        self.commands: list[str] = []

    def exec_driver_sql(self, sql: str):
        self.commands.append(sql)
        if sql.startswith("PRAGMA table_info"):
            return SimpleNamespace(fetchall=lambda: [])
        return SimpleNamespace(fetchall=lambda: [])


class _FakeBegin(AbstractContextManager):
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> _FakeConnection:
        return self.connection

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


def test_ensure_column_uses_postgres_safe_add_column(monkeypatch) -> None:
    connection = _FakeConnection("postgresql")
    monkeypatch.setattr(
        database,
        "engine",
        SimpleNamespace(begin=lambda: _FakeBegin(connection)),
    )

    database._ensure_column("task", "user_id", "INTEGER")

    assert connection.commands == [
        'ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "user_id" INTEGER'
    ]


def test_backfill_session_objective_uses_sql_string_literals(monkeypatch) -> None:
    connection = _FakeConnection("postgresql")
    monkeypatch.setattr(
        database,
        "engine",
        SimpleNamespace(begin=lambda: _FakeBegin(connection)),
    )

    database._backfill_session_objective()

    assert len(connection.commands) == 1
    sql = connection.commands[0]
    assert 'NULLIF(TRIM("scheduleblock"."notes"), \'\')' in sql
    assert 'NULLIF(TRIM("task"."objective"), \'\')' in sql
    assert 'NULLIF(TRIM("output_notes"), \'\')' in sql
    assert 'TRIM("objective") = \'\'' in sql
    assert '""' not in sql
