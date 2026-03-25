from __future__ import annotations

from sqlmodel import Session, select

from .models import NotificationConfig
from .schemas import NotificationConfigUpdate


class NotificationConfigService:
    def get_or_create(self, db: Session) -> NotificationConfig:
        config = db.exec(select(NotificationConfig)).first()
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

        if config:
            return config

=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
=======
        if config:
            return config
>>>>>>> theirs
        config = NotificationConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
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
=======
>>>>>>> theirs
        return config

    def update(self, db: Session, payload: NotificationConfigUpdate) -> NotificationConfig:
        config = self.get_or_create(db)
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

        for key, value in payload.model_dump().items():
            setattr(config, key, value)

        db.add(config)
        db.commit()
        db.refresh(config)

        return config
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
        for key, value in payload.model_dump().items():
            setattr(config, key, value)
        db.add(config)
        db.commit()
        db.refresh(config)
        return config
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
