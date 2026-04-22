from __future__ import annotations

from sqlmodel import Session, select

from .models import SyncEvent


class SyncService:
    def enqueue(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        action: str,
        user_id: int,
    ) -> SyncEvent:
        event = SyncEvent(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    def pending_events(
        self,
        db: Session,
        user_id: int,
        after_event_id: int | None = None,
    ) -> list[SyncEvent]:
        statement = select(SyncEvent).where(
            SyncEvent.user_id == user_id,
            SyncEvent.synced.is_(False),
        )
        if after_event_id is not None:
            statement = statement.where(SyncEvent.id > after_event_id)

        return list(
            db.exec(statement.order_by(SyncEvent.id)).all()
        )

    def mark_synced(self, db: Session, event_id: int, user_id: int) -> SyncEvent | None:
        event = db.exec(
            select(SyncEvent).where(SyncEvent.id == event_id, SyncEvent.user_id == user_id)
        ).first()
        if not event:
            return None
        event.synced = True
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
