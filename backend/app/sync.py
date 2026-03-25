from __future__ import annotations

from sqlmodel import Session, select

from .models import SyncEvent


class SyncService:
    def enqueue(self, db: Session, entity_type: str, entity_id: int, action: str) -> SyncEvent:
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
        event = SyncEvent(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
        )

        db.add(event)
        db.commit()
        db.refresh(event)

        return event

    def pending_events(self, db: Session) -> list[SyncEvent]:
        return list(
            db.exec(
                select(SyncEvent).where(SyncEvent.synced.is_(False))
            ).all()
        )

    def mark_synced(self, db: Session, event_id: int) -> SyncEvent | None:
        event = db.get(SyncEvent, event_id)

        if not event:
            return None

        event.synced = True

        db.add(event)
        db.commit()
        db.refresh(event)

        return event
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
        event = SyncEvent(entity_type=entity_type, entity_id=entity_id, action=action)
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    def pending_events(self, db: Session) -> list[SyncEvent]:
        return list(db.exec(select(SyncEvent).where(SyncEvent.synced.is_(False))).all())

    def mark_synced(self, db: Session, event_id: int) -> SyncEvent | None:
        event = db.get(SyncEvent, event_id)
        if not event:
            return None
        event.synced = True
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
