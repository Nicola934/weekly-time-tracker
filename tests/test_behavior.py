from datetime import datetime, timedelta

from sqlmodel import Session, SQLModel, create_engine

from backend.app.behavior import BehaviorService
from backend.app.models import (
    MissedReasonCategory,
    Session as WorkSession,
    SessionStatus,
    Task,
    UserAccount,
)
from backend.app.schemas import SessionMissedRequest


def test_record_missed_session_and_aggregate_patterns() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    service = BehaviorService()
    now = datetime.now().replace(microsecond=0)

    with Session(engine) as db:
        user = UserAccount(
            name="Operator",
            email=f"behavior-{now.timestamp()}@example.com",
            password_hash="hash",
            password_salt="salt",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        task = Task(
            title="Focus Block",
            objective="Finish task",
            long_term_goal="Goal",
            priority=5,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        session = WorkSession(
            task_id=task.id,
            planned_start=now - timedelta(hours=1),
            planned_end=now,
            status=SessionStatus.planned,
            user_id=user.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        service.record_missed_session(
            db,
            SessionMissedRequest(
                session_id=session.id,
                reason_category=MissedReasonCategory.youtube,
                time_lost_minutes=30,
            ),
            user.id,
        )

        patterns = service.weekly_patterns(
            db,
            now - timedelta(days=7),
            now + timedelta(days=1),
            user.id,
        )
        assert patterns[0].category == "YouTube"
        assert patterns[0].minutes_lost == 30

        risks = service.identify_behavior_risks(
            db,
            now - timedelta(days=7),
            now + timedelta(days=1),
            user.id,
        )
        assert any("You frequently miss sessions due to YouTube." == item for item in risks)
