from __future__ import annotations

from typing import Any, TypeVar

from sqlmodel import Session, select

ModelT = TypeVar("ModelT")


def get_owned_record(
    db: Session,
    model: type[ModelT],
    record_id: int | None,
    user_id: int,
) -> ModelT | None:
    if record_id is None:
        return None

    return db.exec(
        select(model).where(model.id == record_id, model.user_id == user_id)
    ).first()


def require_owned_record(
    db: Session,
    model: type[ModelT],
    record_id: int | None,
    user_id: int,
    missing_message: str,
) -> ModelT:
    record = get_owned_record(db, model, record_id, user_id)
    if not record:
        raise ValueError(missing_message)
    return record


def owned_records(model: Any, user_id: int):
    return select(model).where(model.user_id == user_id)
