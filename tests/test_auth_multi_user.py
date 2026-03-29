from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from backend.app.database import get_session
from backend.app.main import app
from backend.app.models import Task


def _override_session(engine):
    def _get_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    return _get_session


def test_auth_registration_claims_legacy_data_and_scopes_tasks_per_user() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as db:
        legacy_task = Task(
            title="Legacy task",
            objective="Migrate shared data",
            category="Legacy",
            long_term_goal="Preserve prior records",
            priority=3,
        )
        db.add(legacy_task)
        db.commit()

    app.dependency_overrides[get_session] = _override_session(engine)
    client = TestClient(app)

    try:
        register_first = client.post(
            "/auth/register",
            json={
                "name": "Alice",
                "email": "alice@example.com",
                "password": "password-123",
            },
        )
        assert register_first.status_code == 200
        first_body = register_first.json()
        first_token = first_body["token"]

        register_second = client.post(
            "/auth/register",
            json={
                "name": "Bob",
                "email": "bob@example.com",
                "password": "password-456",
            },
        )
        assert register_second.status_code == 200
        second_token = register_second.json()["token"]

        first_tasks = client.get(
            "/tasks",
            headers={"Authorization": f"Bearer {first_token}"},
        )
        second_tasks = client.get(
            "/tasks",
            headers={"Authorization": f"Bearer {second_token}"},
        )

        assert first_tasks.status_code == 200
        assert second_tasks.status_code == 200
        assert [item["title"] for item in first_tasks.json()] == ["Legacy task"]
        assert second_tasks.json() == []

        create_first_task = client.post(
            "/tasks",
            headers={"Authorization": f"Bearer {first_token}"},
            json={
                "title": "Alice task",
                "objective": "Own isolated data",
                "category": "Focus",
                "long_term_goal": "Separate users cleanly",
                "priority": 2,
                "estimated_hours": 1,
            },
        )
        assert create_first_task.status_code == 200

        first_tasks_after_create = client.get(
            "/tasks",
            headers={"Authorization": f"Bearer {first_token}"},
        )
        second_tasks_after_create = client.get(
            "/tasks",
            headers={"Authorization": f"Bearer {second_token}"},
        )

        assert [item["title"] for item in first_tasks_after_create.json()] == [
            "Alice task",
            "Legacy task",
        ]
        assert second_tasks_after_create.json() == []
    finally:
        app.dependency_overrides.clear()
