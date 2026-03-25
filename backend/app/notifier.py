from __future__ import annotations

from sqlmodel import Session, select

from .models import NotificationConfig
from .schemas import NotificationConfigUpdate


class NotificationConfigService:
    def get_or_create(self, db: Session) -> NotificationConfig:
        config = db.exec(select(NotificationConfig)).first()
        if config:
            return config

        config = NotificationConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    def update(self, db: Session, payload: NotificationConfigUpdate) -> NotificationConfig:
        config = self.get_or_create(db)
        for key, value in payload.model_dump().items():
            setattr(config, key, value)
        db.add(config)
        db.commit()
        db.refresh(config)
        return config
