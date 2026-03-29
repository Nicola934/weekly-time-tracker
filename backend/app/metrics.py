from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, select

from .models import Session as WorkSession, SessionQualityLabel, SessionStatus
from .schemas import MetricsResponse


def minutes_between(start: datetime | None, end: datetime | None) -> float:
    if not start or not end:
        return 0
    return max((end - start).total_seconds() / 60, 0)


def calculate_signal(planned_minutes: float, actual_minutes: float) -> float:
    if planned_minutes <= 0:
        return 0
    return round((actual_minutes / planned_minutes) * 100, 2)


def calculate_performance(completion_percents: list[float]) -> float:
    if not completion_percents:
        return 0
    return round(sum(completion_percents) / len(completion_percents), 2)


def calculate_lateness(planned_start: datetime, actual_start: datetime | None) -> float:
    if not actual_start:
        return 0
    return round(max((actual_start - planned_start).total_seconds() / 60, 0), 2)


def calculate_start_delta(
    planned_start: datetime,
    actual_start: datetime | None,
) -> float | None:
    if not actual_start:
        return None
    return round((actual_start - planned_start).total_seconds() / 60, 2)


def calculate_average_start_delta(sessions: list[WorkSession]) -> float:
    deltas = [
        delta
        for item in sessions
        for delta in [calculate_start_delta(item.planned_start, item.actual_start)]
        if delta is not None
    ]
    if not deltas:
        return 0
    return round(sum(deltas) / len(deltas), 2)


def calculate_session_quality(
    session: WorkSession,
) -> tuple[float, SessionQualityLabel]:
    if session.status == SessionStatus.missed:
        return 0, SessionQualityLabel.failed

    objective_points = 60 if session.objective_completed else 20
    start_delta = calculate_start_delta(session.planned_start, session.actual_start)

    if start_delta is None:
        punctuality_points = 0
    elif start_delta <= 0:
        punctuality_points = 20
    else:
        punctuality_points = max(20 - min(start_delta, 20), 0)

    planned_minutes = minutes_between(session.planned_start, session.planned_end)
    actual_minutes = minutes_between(session.actual_start, session.actual_end)
    if planned_minutes <= 0:
        time_points = 20
    else:
        time_ratio = actual_minutes / planned_minutes
        time_alignment = max(1 - abs(1 - time_ratio), 0)
        time_points = min(time_alignment * 20, 20)

    score = round(objective_points + punctuality_points + time_points, 2)
    if session.objective_completed and score >= 80:
        return score, SessionQualityLabel.strong
    if score >= 55:
        return score, SessionQualityLabel.partial
    return score, SessionQualityLabel.failed


class MetricsService:
    def compute_metrics(
        self,
        db: Session,
        period_start: datetime,
        period_end: datetime,
        user_id: int,
    ) -> MetricsResponse:
        sessions = list(
            db.exec(
                select(WorkSession).where(
                    WorkSession.user_id == user_id,
                    WorkSession.planned_start >= period_start,
                    WorkSession.planned_end <= period_end,
                )
            ).all()
        )

        planned_minutes = sum(
            minutes_between(item.planned_start, item.planned_end) for item in sessions
        )
        actual_minutes = sum(
            minutes_between(item.actual_start, item.actual_end) for item in sessions
        )

        closed_sessions = [
            item
            for item in sessions
            if item.actual_end is not None or item.status == SessionStatus.missed
        ]
        completion_values = [
            (
                item.quality_score
                if item.quality_score > 0
                else calculate_session_quality(item)[0]
            )
            for item in closed_sessions
        ]

        started_sessions = [item for item in sessions if item.actual_start is not None]
        lateness_values = [
            calculate_lateness(item.planned_start, item.actual_start)
            for item in started_sessions
        ]

        punctual_sessions = sum(1 for late in lateness_values if late == 0)
        punctuality_rate = (
            round((punctual_sessions / len(started_sessions)) * 100, 2)
            if started_sessions
            else 0
        )
        average_lateness = (
            round(sum(lateness_values) / len(lateness_values), 2)
            if lateness_values
            else 0
        )

        signal = calculate_signal(planned_minutes, actual_minutes)
        performance = calculate_performance(completion_values)
        discipline = round(
            (signal * 0.4) + (performance * 0.3) + (punctuality_rate * 0.3),
            2,
        )

        return MetricsResponse(
            signal_percent=signal,
            performance_percent=performance,
            punctuality_rate=punctuality_rate,
            average_lateness_minutes=average_lateness,
            average_start_delta_minutes=calculate_average_start_delta(started_sessions),
            discipline_score=discipline,
        )
