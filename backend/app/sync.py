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

    def pending_events(self, db: Session, user_id: int) -> list[SyncEvent]:
        return list(
            db.exec(
                select(SyncEvent).where(
                    SyncEvent.user_id == user_id,
                    SyncEvent.synced.is_(False),
                )
            ).all()
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
