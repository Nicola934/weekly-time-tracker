from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime

from sqlmodel import Session, select

from .models import (
    AuthToken,
    GoalContextConfig,
    MissedHabit,
    NotificationConfig,
    ScheduleBlock,
    Session as WorkSession,
    SyncEvent,
    Task,
    UserAccount,
    WeeklyProgressMemory,
)
from .schemas import AuthSessionResponse, UserLoginRequest, UserRegisterRequest, UserResponse


def _normalize_email(value: str) -> str:
    return str(value or "").strip().casefold()


def _normalize_name(value: str) -> str:
    return str(value or "").strip()


def _hash_password(password: str, salt: bytes) -> str:
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        str(password or "").encode("utf-8"),
        salt,
        120_000,
    )
    return base64.urlsafe_b64encode(derived).decode("ascii")


def _encode_salt(salt: bytes) -> str:
    return base64.urlsafe_b64encode(salt).decode("ascii")


def _decode_salt(value: str) -> bytes:
    return base64.urlsafe_b64decode(value.encode("ascii"))


def _hash_token(token: str) -> str:
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def _serialize_user(user: UserAccount) -> UserResponse:
    return UserResponse(id=user.id, name=user.name, email=user.email)


def _claim_legacy_records(db: Session, user_id: int) -> None:
    for model in (
        Task,
        ScheduleBlock,
        WorkSession,
        MissedHabit,
        NotificationConfig,
        GoalContextConfig,
        SyncEvent,
        WeeklyProgressMemory,
    ):
        items = db.exec(select(model).where(model.user_id.is_(None))).all()
        for item in items:
            item.user_id = user_id
            db.add(item)

    db.commit()


def register_user(db: Session, payload: UserRegisterRequest) -> AuthSessionResponse:
    email = _normalize_email(payload.email)
    name = _normalize_name(payload.name)
    password = str(payload.password or "")

    if not name:
        raise ValueError("Name is required")
    if not email:
        raise ValueError("Email is required")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if db.exec(select(UserAccount).where(UserAccount.email == email)).first():
        raise ValueError("An account with this email already exists")

    first_user = db.exec(select(UserAccount)).first() is None
    salt = secrets.token_bytes(16)
    user = UserAccount(
        name=name,
        email=email,
        password_hash=_hash_password(password, salt),
        password_salt=_encode_salt(salt),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if first_user:
        _claim_legacy_records(db, user.id)

    return create_session_for_user(db, user)


def login_user(db: Session, payload: UserLoginRequest) -> AuthSessionResponse:
    email = _normalize_email(payload.email)
    password = str(payload.password or "")
    user = db.exec(select(UserAccount).where(UserAccount.email == email)).first()
    if not user:
        raise ValueError("Invalid email or password")

    expected_hash = _hash_password(password, _decode_salt(user.password_salt))
    if not secrets.compare_digest(expected_hash, user.password_hash):
        raise ValueError("Invalid email or password")

    return create_session_for_user(db, user)


def create_session_for_user(db: Session, user: UserAccount) -> AuthSessionResponse:
    token = secrets.token_urlsafe(32)
    auth_token = AuthToken(
        user_id=user.id,
        token_hash=_hash_token(token),
    )
    db.add(auth_token)
    db.commit()
    return AuthSessionResponse(token=token, user=_serialize_user(user))


def get_user_for_token(db: Session, token: str | None) -> UserAccount | None:
    normalized = str(token or "").strip()
    if not normalized:
        return None

    auth_token = db.exec(
        select(AuthToken).where(AuthToken.token_hash == _hash_token(normalized))
    ).first()
    if not auth_token:
        return None

    auth_token.last_used_at = datetime.now(UTC)
    db.add(auth_token)
    db.commit()
    return db.get(UserAccount, auth_token.user_id)
