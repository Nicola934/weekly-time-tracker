from collections.abc import Generator
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from backend.app.database import get_session
from backend.app.main import app
from backend.app.main import delete_session as delete_session_endpoint
from backend.app.main import delete_session_legacy
from backend.app.main import missed_session as missed_session_endpoint
from backend.app.behavior import BehaviorService
from backend.app.models import (
    MissedReasonCategory,
    Session as WorkSession,
    SessionStatus,
    Task,
    UserAccount,
)
from backend.app.schemas import SessionMissedRequest, SessionStartRequest
from backend.app.tracker import TrackerService


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _override_session(engine):
    def _get_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    return _get_session


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    app.dependency_overrides[get_session] = _override_session(engine)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _create_task(db: Session) -> Task:
    user = _create_user(db)
    task = Task(
        title="Execution Block",
        objective="Finish the narrow fix pass",
        long_term_goal="Backend",
        priority=4,
        user_id=user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _create_user(db: Session) -> UserAccount:
    user = UserAccount(
        name="Operator",
        email=f"operator-{datetime.now().timestamp()}@example.com",
        password_hash="hash",
        password_salt="salt",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "name": "Operator",
            "email": email,
            "password": "password-123",
        },
    )
    assert response.status_code == 200
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _create_task_via_api(client: TestClient, headers: dict[str, str], title: str = "Execution Block") -> dict:
    response = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": title,
            "objective": "Finish the narrow fix pass",
            "category": "Backend",
            "long_term_goal": "Reliable serialization",
            "priority": 4,
            "estimated_hours": 1.5,
        },
    )
    assert response.status_code == 200
    return response.json()


def _schedule_payload(task_id: int, start_time: datetime, end_time: datetime) -> dict:
    return {
        "task_id": task_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "reminder_offset_minutes": 10,
        "timezone": "Africa/Johannesburg",
        "notes": "Focus block",
        "goal_context": "Release integrity",
    }


def test_start_session_allows_a_start_within_the_one_hour_prestart_window() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Finish the narrow fix pass",
            long_term_goal="Backend",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        session = WorkSession(
            task_id=task.id,
            planned_start=datetime(2026, 3, 26, 10, 0, 0),
            planned_end=datetime(2026, 3, 26, 11, 0, 0),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        started = TrackerService().start_session(
            db,
            SessionStartRequest(
                task_id=task.id,
                session_id=session.id,
                actual_start=datetime(2026, 3, 26, 9, 15, 0),
                timezone="Africa/Johannesburg",
            ),
            user.id,
        )

        assert started.status == SessionStatus.active
        assert started.start_delta_minutes == -45
        assert started.actual_start == datetime(2026, 3, 26, 9, 15, 0)


def test_start_session_rejects_a_start_more_than_one_hour_early() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Finish the narrow fix pass",
            long_term_goal="Backend",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        session = WorkSession(
            task_id=task.id,
            planned_start=datetime(2026, 3, 26, 10, 0, 0),
            planned_end=datetime(2026, 3, 26, 11, 0, 0),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        with pytest.raises(ValueError, match="within 60 minutes"):
            TrackerService().start_session(
                db,
                SessionStartRequest(
                    task_id=task.id,
                    session_id=session.id,
                    actual_start=datetime(2026, 3, 26, 8, 59, 0),
                    timezone="Africa/Johannesburg",
                ),
                user.id,
            )


def test_delete_session_allows_future_planned_and_rejects_active_sessions() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Finish the narrow fix pass",
            long_term_goal="Backend",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        now = datetime.now().replace(microsecond=0)

        future_session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=2),
            planned_end=now + timedelta(hours=3),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        active_session = WorkSession(
            task_id=task.id,
            planned_start=now - timedelta(minutes=5),
            planned_end=now + timedelta(minutes=55),
            actual_start=now - timedelta(minutes=3),
            status=SessionStatus.active,
            user_id=user.id,
        )
        db.add(future_session)
        db.add(active_session)
        db.commit()
        db.refresh(future_session)
        db.refresh(active_session)

        deleted = TrackerService().delete_session(db, future_session.id, user.id)
        assert deleted["session_id"] == future_session.id
        assert db.get(WorkSession, future_session.id) is None

        with pytest.raises(ValueError, match="Active sessions cannot be deleted"):
            TrackerService().delete_session(db, active_session.id, user.id)


def test_delete_session_legacy_alias_uses_the_same_delete_logic() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Finish the narrow fix pass",
            long_term_goal="Backend",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=2),
            planned_end=now + timedelta(hours=3),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        deleted = delete_session_legacy(session.id, db, user)

        assert deleted["deleted"] is True
        assert deleted["session_id"] == session.id
        assert db.get(WorkSession, session.id) is None


def test_delete_session_endpoint_keeps_the_canonical_route_behavior() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Finish the narrow fix pass",
            long_term_goal="Backend",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=4),
            planned_end=now + timedelta(hours=5),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        deleted = delete_session_endpoint(session.id, db, user)

        assert deleted["deleted"] is True
        assert deleted["session_id"] == session.id
        assert db.get(WorkSession, session.id) is None


def test_record_missed_session_allows_skip_inside_the_prestart_window() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Finish the narrow fix pass",
            long_term_goal="Backend",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(minutes=20),
            planned_end=now + timedelta(minutes=80),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        habit = BehaviorService().record_missed_session(
            db,
            SessionMissedRequest(
                session_id=session.id,
                reason_category=MissedReasonCategory.unknown,
                custom_reason="Skipped from notification",
                time_lost_minutes=30,
            ),
            user.id,
        )

        db.refresh(session)
        assert habit.session_id == session.id
        assert session.status == SessionStatus.missed
        assert session.objective_locked is True


def test_record_missed_session_rejects_skips_before_the_prestart_window() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Finish the narrow fix pass",
            long_term_goal="Backend",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=2),
            planned_end=now + timedelta(hours=3),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        with pytest.raises(ValueError, match="within the start window"):
            BehaviorService().record_missed_session(
                db,
                SessionMissedRequest(
                    session_id=session.id,
                    reason_category=MissedReasonCategory.unknown,
                    custom_reason="Skipped from notification",
                    time_lost_minutes=30,
                ),
                user.id,
            )


def test_create_task_endpoint_returns_canonical_task_payload(client: TestClient) -> None:
    headers = _auth_headers(client, f"task-{datetime.now().timestamp()}@example.com")

    response = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Serialize task payload",
            "objective": "Return canonical task JSON",
            "category": "Backend",
            "long_term_goal": "Release integrity",
            "priority": 2,
            "estimated_hours": 2,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] > 0
    assert body["title"] == "Serialize task payload"
    assert body["objective"] == "Return canonical task JSON"
    assert body["created_at"]


def test_schedule_endpoint_returns_session_id_and_canonical_embedded_session(
    client: TestClient,
) -> None:
    headers = _auth_headers(client, f"schedule-{datetime.now().timestamp()}@example.com")
    task = _create_task_via_api(client, headers, title="Schedule serialization")
    now = datetime.now().replace(microsecond=0)
    start_time = now + timedelta(hours=2)
    end_time = start_time + timedelta(hours=1)

    response = client.post(
        "/schedule",
        headers=headers,
        json=_schedule_payload(task["id"], start_time, end_time),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] > 0
    assert body["session"]["id"] == body["session_id"]
    assert body["session"]["status"] == "planned"
    assert body["session"]["task_id"] == task["id"]


def test_start_and_end_endpoints_return_canonical_session_payloads(client: TestClient) -> None:
    headers = _auth_headers(client, f"transitions-{datetime.now().timestamp()}@example.com")
    task = _create_task_via_api(client, headers, title="Transition serialization")
    now = datetime.now().replace(microsecond=0)
    start_time = now + timedelta(minutes=30)
    end_time = start_time + timedelta(hours=1)

    schedule_response = client.post(
        "/schedule",
        headers=headers,
        json=_schedule_payload(task["id"], start_time, end_time),
    )
    assert schedule_response.status_code == 200
    session_id = schedule_response.json()["session_id"]

    start_response = client.post(
        "/sessions/start",
        headers=headers,
        json={
            "task_id": task["id"],
            "session_id": session_id,
            "actual_start": now.isoformat(),
            "timezone": "Africa/Johannesburg",
        },
    )
    assert start_response.status_code == 200
    started = start_response.json()
    assert started["id"] == session_id
    assert started["status"] == "active"
    assert started["actual_start"] == now.isoformat()

    end_response = client.post(
        "/sessions/end",
        headers=headers,
        json={
            "session_id": session_id,
            "actual_end": (now + timedelta(minutes=55)).isoformat(),
            "objective_completed": True,
            "completion_percent": 100,
            "output_notes": "Wrapped the release fix",
            "reflection_notes": "Canonical payload returned",
        },
    )
    assert end_response.status_code == 200
    ended = end_response.json()
    assert ended["id"] == session_id
    assert ended["status"] == "completed"
    assert ended["objective_completed"] is True


def test_missed_session_endpoint_returns_canonical_session_payload(client: TestClient) -> None:
    headers = _auth_headers(client, f"missed-{datetime.now().timestamp()}@example.com")
    task = _create_task_via_api(client, headers, title="Missed serialization")
    now = datetime.now().replace(microsecond=0)
    start_time = now + timedelta(minutes=10)
    end_time = start_time + timedelta(hours=1)

    schedule_response = client.post(
        "/schedule",
        headers=headers,
        json=_schedule_payload(task["id"], start_time, end_time),
    )
    assert schedule_response.status_code == 200
    session_id = schedule_response.json()["session_id"]

    response = client.post(
        "/sessions/missed",
        headers=headers,
        json={
            "session_id": session_id,
            "reason_category": "Unknown",
            "custom_reason": "Skipped from notification",
            "time_lost_minutes": 45,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == session_id
    assert body["status"] == "missed"
    assert body["objective_locked"] is True


def test_missed_session_endpoint_returns_canonical_session_object() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Execution Block",
            objective="Return canonical missed session payload",
            long_term_goal="Backend integrity",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(minutes=10),
            planned_end=now + timedelta(minutes=70),
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        returned = missed_session_endpoint(
            SessionMissedRequest(
                session_id=session.id,
                reason_category=MissedReasonCategory.unknown,
                custom_reason="Skipped from notification",
                time_lost_minutes=45,
            ),
            db,
            user,
        )

        db.refresh(session)
        assert returned["id"] == session.id
        assert returned["task_id"] == task.id
        assert returned["status"] == SessionStatus.missed.value
        assert session.status == SessionStatus.missed
