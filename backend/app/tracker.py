from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, select

from .metrics import calculate_lateness
from .models import ScheduleBlock, Session as WorkSession, SessionStatus
from .schemas import SessionEndRequest, SessionStartRequest


class TrackerService:
    def start_session(self, db: Session, payload: SessionStartRequest) -> WorkSession:
        session = None
        if payload.session_id:
            session = db.get(WorkSession, payload.session_id)
        elif payload.schedule_block_id:
            session = db.exec(
                select(WorkSession).where(WorkSession.schedule_block_id == payload.schedule_block_id)
            ).first()

        if session:
            session.actual_start = payload.actual_start or datetime.utcnow()
            session.status = SessionStatus.active
            session.timezone = payload.timezone
            db.add(session)
            db.commit()
            db.refresh(session)
            return session

        planned_start = payload.actual_start or datetime.utcnow()
        planned_end = planned_start
        if payload.schedule_block_id:
            block = db.get(ScheduleBlock, payload.schedule_block_id)
            if not block:
                raise ValueError("Schedule block not found")
            planned_start = block.start_time
            planned_end = block.end_time
        session = WorkSession(
            task_id=payload.task_id,
            schedule_block_id=payload.schedule_block_id,
            planned_start=planned_start,
            planned_end=planned_end,
            actual_start=payload.actual_start or datetime.utcnow(),
            status=SessionStatus.active,
            timezone=payload.timezone,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def end_session(self, db: Session, payload: SessionEndRequest) -> WorkSession:
        session = db.get(WorkSession, payload.session_id)
        if not session:
            raise ValueError("Session not found")
        session.actual_end = payload.actual_end or datetime.utcnow()
        session.completion_percent = payload.completion_percent
        session.output_notes = payload.output_notes
        session.status = SessionStatus.completed
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def list_sessions(self, db: Session) -> list[WorkSession]:
        return list(db.exec(select(WorkSession).order_by(WorkSession.planned_start)).all())

    def punctuality_snapshot(self, session: WorkSession) -> dict[str, float | str]:
        lateness = calculate_lateness(session.planned_start, session.actual_start)
        state = "on-time" if lateness == 0 else "late"
        return {"status": state, "lateness_minutes": lateness}
