from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from sqlmodel import Session, select

from .behavior import BehaviorService
from .metrics import MetricsService, calculate_lateness, calculate_session_quality, minutes_between
from .models import Session as WorkSession, SessionStatus, Task, WeeklyProgressMemory
from .notifier import resolve_task_category
from .schemas import AdvisoryResponse, HabitPattern, NarrativeWeeklyFeedback


def _pluralize(count: int, singular: str, plural: str | None = None) -> str:
    if count == 1:
        return singular
    return plural or f"{singular}s"


def _oxford_join(items: list[str]) -> str:
    values = [item.strip() for item in items if item and item.strip()]
    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    if len(values) == 2:
        return f"{values[0]} and {values[1]}"
    return f"{', '.join(values[:-1])}, and {values[-1]}"


def _format_minutes(value: float) -> str:
    total_minutes = max(int(round(value)), 0)
    hours, minutes = divmod(total_minutes, 60)
    if hours and minutes:
        return f"{hours}h {minutes:02d}m"
    if hours:
        return f"{hours} {_pluralize(hours, 'hour')}"
    return f"{minutes} {_pluralize(minutes, 'minute')}"


def _time_bucket(value: datetime) -> str:
    hour = value.hour
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "late evening"


def _time_bucket_phrase(bucket: str) -> str:
    if bucket == "late evening":
        return "later in the evening"
    return f"in the {bucket}"


def _start_of_day(value: datetime) -> datetime:
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_week(value: datetime) -> datetime:
    start = _start_of_day(value)
    return start - timedelta(days=start.weekday())


class AdvisorService:
    def __init__(self) -> None:
        self.metrics = MetricsService()
        self.behavior = BehaviorService()

    def generate(
        self,
        db: Session,
        period_start: datetime,
        period_end: datetime,
    ) -> AdvisoryResponse:
        metrics = self.metrics.compute_metrics(db, period_start, period_end)
        tasks = {
            task.id: task
            for task in db.exec(select(Task)).all()
        }
        sessions = list(
            db.exec(
                select(WorkSession).where(
                    WorkSession.planned_start >= period_start,
                    WorkSession.planned_end <= period_end,
                )
            ).all()
        )
        habits = self.behavior.weekly_patterns(db, period_start, period_end)
        current_memory = self._build_progress_memory_snapshot(sessions)
        previous_memory = self._load_previous_memory(db, period_start)
        if previous_memory is None:
            previous_sessions = list(
                db.exec(
                    select(WorkSession).where(
                        WorkSession.planned_start >= period_start - timedelta(days=7),
                        WorkSession.planned_end <= period_end - timedelta(days=7),
                    )
                ).all()
            )
            previous_memory = (
                self._build_progress_memory_snapshot(previous_sessions)
                if previous_sessions
                else None
            )
        comparison_notes = self._build_week_over_week_notes(
            current_memory=current_memory,
            previous_memory=previous_memory,
        )
        weekly_feedback = self._build_weekly_feedback(
            sessions=sessions,
            tasks=tasks,
            habits=habits,
            comparison_notes=comparison_notes,
        )
        reflection_summary = self._build_reflection_summary(sessions)

        focus_areas = [
            weekly_feedback.insight,
        ]
        if metrics.signal_percent < 75:
            focus_areas.append(
                "Your schedule is overloaded. Cut planned volume and protect fewer focus blocks."
            )
        if metrics.average_lateness_minutes > 5:
            focus_areas.append(
                "You start too late. Add a hard 10-minute reset before every critical session."
            )
        if metrics.performance_percent < 70:
            focus_areas.append(
                "Your session targets are too large. Reduce each block to one finishable objective."
            )
        if reflection_summary["top_failure_reason"]:
            focus_areas.append(
                f"The main failure pattern was {reflection_summary['top_failure_reason'].lower()}. Attack that directly next week."
            )

        schedule_improvements = [weekly_feedback.advice]
        missed_sessions = [
            item for item in sessions if item.status == SessionStatus.missed
        ]
        if missed_sessions:
            top_bucket, bucket_count = self._top_time_bucket(missed_sessions)
            if top_bucket and bucket_count >= 2:
                schedule_improvements.append(
                    f"Stop placing high-risk work {_time_bucket_phrase(top_bucket)}. Move it earlier."
                )
        if not missed_sessions:
            schedule_improvements.append(
                "Keep the current schedule shape for the blocks you protected."
            )
        schedule_improvements.append(
            "Hold one recovery block next week so one miss does not spill across multiple days."
        )
        schedule_improvements.extend(comparison_notes)

        habit_alerts = []
        repeated_missed_category = self._top_category(missed_sessions, tasks)
        if habits:
            top_habit = habits[0]
            habit_alerts.append(
                f"{top_habit.category} took {top_habit.count} planned {_pluralize(top_habit.count, 'session')} and cost {top_habit.minutes_lost} {_pluralize(top_habit.minutes_lost, 'minute')}."
            )
        if repeated_missed_category and repeated_missed_category["count"] >= 2:
            habit_alerts.append(
                f"Most missed blocks sat inside {repeated_missed_category['category']}."
            )
        if missed_sessions:
            top_bucket, bucket_count = self._top_time_bucket(missed_sessions)
            if top_bucket and bucket_count >= 2:
                habit_alerts.append(self._miss_bucket_observation(top_bucket))
        if reflection_summary["top_distraction_category"]:
            habit_alerts.append(
                f"Top distraction this week was {reflection_summary['top_distraction_category']} ({reflection_summary['top_distraction_count']} {_pluralize(reflection_summary['top_distraction_count'], 'time')})."
            )

        summary = [
            weekly_feedback.wins,
            weekly_feedback.gaps,
            weekly_feedback.patterns,
            *comparison_notes,
        ]

        return AdvisoryResponse(
            summary=list(dict.fromkeys(summary)),
            focus_areas=list(dict.fromkeys(focus_areas)),
            schedule_improvements=list(dict.fromkeys(schedule_improvements)),
            habit_alerts=list(dict.fromkeys(habit_alerts)),
            weekly_feedback=weekly_feedback,
        )

    def _build_weekly_feedback(
        self,
        sessions: list[WorkSession],
        tasks: dict[int | None, Task],
        habits: list[HabitPattern],
        comparison_notes: list[str] | None = None,
    ) -> NarrativeWeeklyFeedback:
        completed_sessions = [
            item for item in sessions if item.actual_end is not None
        ]
        successful_sessions = [
            item for item in completed_sessions if self._is_objective_closed(item)
        ]
        partial_sessions = [
            item for item in completed_sessions if not self._is_objective_closed(item)
        ]
        missed_sessions = [
            item for item in sessions if item.status == SessionStatus.missed
        ]
        late_sessions = [
            item for item in completed_sessions if self._lateness_minutes(item) > 5
        ]

        top_win = self._top_group(successful_sessions, tasks)
        top_completed = self._top_group(completed_sessions, tasks)
        top_missed = self._top_group(missed_sessions, tasks)
        top_partial = self._top_group(partial_sessions, tasks)
        repeated_missed_category = self._top_category(missed_sessions, tasks)
        missed_bucket, missed_bucket_count = self._top_time_bucket(missed_sessions)
        late_bucket, late_bucket_count = self._top_time_bucket(late_sessions)
        top_habit = habits[0] if habits else None
        reflection_summary = self._build_reflection_summary(sessions)
        total_logged_minutes = sum(
            minutes_between(item.actual_start, item.actual_end) for item in completed_sessions
        )
        performance_state = self._performance_state(
            total_sessions=len(sessions),
            successful_sessions=len(successful_sessions),
            missed_sessions=len(missed_sessions),
            partial_sessions=len(partial_sessions),
        )

        if top_win:
            wins = (
                f"{self._wins_lead(performance_state)} You closed {len(successful_sessions)} session "
                f"{_pluralize(len(successful_sessions), 'objective')} across "
                f"{len(completed_sessions)} completed {_pluralize(len(completed_sessions), 'session')}. "
                f"The strongest follow-through was {self._describe_group(top_win)}. You completed "
                f"{top_win['count']} planned {_pluralize(top_win['count'], 'session')} there and logged "
                f"{_format_minutes(top_win['minutes'])}."
            )
        elif top_completed:
            wins = (
                f"{self._wins_lead(performance_state)} You completed {len(completed_sessions)} planned "
                f"{_pluralize(len(completed_sessions), 'session')} and logged "
                f"{_format_minutes(total_logged_minutes)}. The most stable area was "
                f"{self._describe_group(top_completed)}, even though the objective did not close cleanly."
            )
        else:
            wins = "There was no clear win this week. Planned work did not turn into a closed objective."

        gap_sentences: list[str] = []
        if missed_sessions:
            if performance_state == "BREAKDOWN":
                gap_sentences.append(
                    f"You lost control of {len(missed_sessions)} planned {_pluralize(len(missed_sessions), 'session')}."
                )
            else:
                gap_sentences.append(
                    f"You missed {len(missed_sessions)} planned {_pluralize(len(missed_sessions), 'session')}."
                )
            if top_missed:
                gap_sentences.append(
                    f"The biggest gap was {self._describe_group(top_missed)}."
                )
        if partial_sessions:
            if top_partial:
                gap_sentences.append(
                    f"{len(partial_sessions)} completed {_pluralize(len(partial_sessions), 'session')} ended without closing the objective, especially {self._describe_group(top_partial)}."
                )
            else:
                gap_sentences.append(
                    f"{len(partial_sessions)} completed {_pluralize(len(partial_sessions), 'session')} ended without closing the objective."
                )

        if gap_sentences:
            gaps = " ".join(gap_sentences)
        else:
            gaps = "Misses stayed low and most completed blocks ended with real closure."

        patterns = self._build_patterns(
            performance_state=performance_state,
            repeated_missed_category=repeated_missed_category,
            missed_bucket=missed_bucket,
            missed_bucket_count=missed_bucket_count,
            late_bucket=late_bucket,
            late_bucket_count=late_bucket_count,
            top_habit=top_habit,
            top_missed=top_missed,
            reflection_summary=reflection_summary,
            comparison_notes=comparison_notes or [],
        )
        insight = self._build_insight(
            top_win=top_win,
            top_missed=top_missed,
            top_partial=top_partial,
            top_habit=top_habit,
            late_sessions=late_sessions,
            missed_bucket=missed_bucket,
            missed_bucket_count=missed_bucket_count,
        )
        advice = self._build_advice(
            performance_state=performance_state,
            top_win=top_win,
            top_missed=top_missed,
            top_partial=top_partial,
            top_habit=top_habit,
            late_sessions=late_sessions,
            missed_bucket=missed_bucket,
        )
        narrative = " ".join([wins, gaps, patterns, insight, advice])

        return NarrativeWeeklyFeedback(
            wins=wins,
            gaps=gaps,
            patterns=patterns,
            insight=insight,
            advice=advice,
            narrative=narrative,
        )

    def _wins_lead(self, performance_state: str) -> str:
        if performance_state == "STRONG":
            return "You executed with control this week."
        if performance_state == "BREAKDOWN":
            return "You still created one real point of progress."
        return "You did produce real progress this week."

    def _performance_state(
        self,
        total_sessions: int,
        successful_sessions: int,
        missed_sessions: int,
        partial_sessions: int,
    ) -> str:
        if total_sessions <= 0:
            return "UNSTABLE"

        successful_rate = successful_sessions / total_sessions
        missed_rate = missed_sessions / total_sessions
        unresolved_rate = (missed_sessions + partial_sessions) / total_sessions

        if successful_rate >= 0.65 and missed_sessions <= 1 and unresolved_rate <= 0.35:
            return "STRONG"
        if (
            missed_sessions >= 3
            or missed_rate >= 0.4
            or (missed_sessions >= 2 and partial_sessions >= 2)
            or (successful_rate <= 0.25 and unresolved_rate >= 0.6)
        ):
            return "BREAKDOWN"
        return "UNSTABLE"

    def _build_patterns(
        self,
        performance_state: str,
        repeated_missed_category: dict[str, str | int] | None,
        missed_bucket: str | None,
        missed_bucket_count: int,
        late_bucket: str | None,
        late_bucket_count: int,
        top_habit: HabitPattern | None,
        top_missed: dict[str, str | int | float] | None,
        reflection_summary: dict[str, str | int | None],
        comparison_notes: list[str],
    ) -> str:
        notes: list[str] = []
        include_identity_feedback = self._should_use_identity_feedback(
            performance_state=performance_state,
            top_habit=top_habit,
            top_missed=top_missed,
        )

        if missed_bucket and missed_bucket_count >= 2:
            notes.append(self._miss_bucket_observation(missed_bucket))
        if (
            repeated_missed_category
            and repeated_missed_category["count"] >= 2
            and not include_identity_feedback
        ):
            notes.append(
                f"Most of the missed work sat inside {repeated_missed_category['category']}."
            )
        if late_bucket and late_bucket_count >= 2:
            notes.append(
                f"You start late {_time_bucket_phrase(late_bucket)}, so those sessions begin compromised."
            )
        if top_habit:
            notes.append(self._habit_pattern_phrase(top_habit))
            if include_identity_feedback:
                notes.append(self._identity_feedback(top_missed, top_habit))
            notes.append(self._habit_psychology_phrase(top_habit))
        elif missed_bucket and missed_bucket_count >= 2:
            notes.append("This is not a planning issue. It is a focus protection problem.")
        elif late_bucket and late_bucket_count >= 2:
            notes.append("You are entering critical sessions unprepared to execute.")

        if reflection_summary.get("top_failure_reason"):
            notes.append(
                f"Most incomplete sessions broke down because of {str(reflection_summary['top_failure_reason']).lower()}."
            )
        if reflection_summary.get("top_distraction_category"):
            notes.append(
                f"Top distraction this week was {reflection_summary['top_distraction_category']}."
            )
        notes.extend(comparison_notes)

        if not notes:
            if performance_state == "STRONG":
                return "You protected the week well. The blocks you kept turned into real output."
            return "Your plan was not the problem. The vulnerable blocks were not protected."

        return " ".join(list(dict.fromkeys(notes))[:4])

    def _build_insight(
        self,
        top_win: dict[str, str | int | float] | None,
        top_missed: dict[str, str | int | float] | None,
        top_partial: dict[str, str | int | float] | None,
        top_habit: HabitPattern | None,
        late_sessions: list[WorkSession],
        missed_bucket: str | None,
        missed_bucket_count: int,
    ) -> str:
        if top_missed and top_habit:
            return (
                f"You planned to advance {self._group_focus_label(top_missed)}, but those sessions were replaced by "
                f"{self._habit_outcome_label(top_habit)}, which directly slowed progress on {self._group_outcome_label(top_missed)}."
            )
        if top_missed and missed_bucket and missed_bucket_count >= 2:
            return (
                f"You planned to advance {self._group_focus_label(top_missed)}, but you kept losing those {_time_bucket_phrase(missed_bucket)} blocks, "
                f"which directly slowed progress on {self._group_outcome_label(top_missed)}."
            )
        if top_missed:
            return (
                f"You planned to advance {self._group_focus_label(top_missed)}, but you missed those blocks, "
                f"which directly slowed progress on {self._group_outcome_label(top_missed)}."
            )
        if top_partial and late_sessions:
            return (
                f"You planned to close {self._group_focus_label(top_partial)}, but you started late and left the block unfinished, "
                f"which turned scheduled time into weak progress."
            )
        if top_partial:
            return (
                f"You planned to close {self._group_focus_label(top_partial)}, but the session ended without closure, "
                f"which left progress open at the end of the week."
            )
        if top_win:
            return (
                f"You planned to advance {self._group_focus_label(top_win)}, protected the block, and converted that time into real progress."
            )
        return (
            "You planned meaningful work, but the blocks kept slipping or staying open, which left the week short on real progress."
        )

    def _build_advice(
        self,
        performance_state: str,
        top_win: dict[str, str | int | float] | None,
        top_missed: dict[str, str | int | float] | None,
        top_partial: dict[str, str | int | float] | None,
        top_habit: HabitPattern | None,
        late_sessions: list[WorkSession],
        missed_bucket: str | None,
    ) -> str:
        actions: list[str] = []

        if top_missed and missed_bucket in {"afternoon", "evening", "late evening"}:
            actions.append(
                f"Move {self._group_focus_label(top_missed)} to the morning and lock it as non-negotiable."
            )
        elif top_missed:
            actions.append(
                f"Keep {self._group_focus_label(top_missed)} in a shorter protected block until you can close it cleanly."
            )
        elif top_partial:
            actions.append(
                f"Cut {self._group_focus_label(top_partial)} down to one finishable objective per session."
            )
        elif top_win:
            actions.append(
                f"Keep {self._group_focus_label(top_win)} in the same protected slot next week."
            )

        if top_habit:
            actions.append(self._habit_advice(top_habit))
        if late_sessions:
            actions.append("Start a hard 10-minute reset before every critical block.")
        if performance_state == "BREAKDOWN":
            actions.append(
                "Hold one recovery block this week so one miss does not contaminate the next day."
            )
        if not actions:
            actions.append(
                "Define one finishable objective for every high-priority session and do not leave the block open-ended."
            )

        return " ".join(list(dict.fromkeys(actions))[:3])

    def _task_title(self, tasks: dict[int | None, Task], task_id: int) -> str:
        task = tasks.get(task_id)
        if task and task.title.strip():
            return task.title.strip()
        return f"Task {task_id}"

    def _task_category(self, tasks: dict[int | None, Task], task_id: int) -> str:
        return resolve_task_category(tasks.get(task_id))

    def _objective_text(self, session: WorkSession, tasks: dict[int | None, Task]) -> str:
        if session.objective and session.objective.strip():
            return session.objective.strip()
        task = tasks.get(session.task_id)
        if task and task.objective and task.objective.strip():
            return task.objective.strip()
        return self._task_title(tasks, session.task_id)

    def _lateness_minutes(self, session: WorkSession) -> float:
        if session.start_delta_minutes is not None and session.start_delta_minutes > 0:
            return float(session.start_delta_minutes)
        return calculate_lateness(session.planned_start, session.actual_start)

    def _is_objective_closed(self, session: WorkSession) -> bool:
        return bool(session.objective_completed)

    def _build_reflection_summary(
        self,
        sessions: list[WorkSession],
    ) -> dict[str, str | int | None]:
        failure_counts: dict[str, int] = defaultdict(int)
        distraction_counts: dict[str, int] = defaultdict(int)

        for item in sessions:
            if item.objective_completed:
                continue
            if item.failure_reason:
                label = (
                    item.failure_reason.value
                    if hasattr(item.failure_reason, "value")
                    else str(item.failure_reason)
                )
                failure_counts[label] += 1
            if item.distraction_category and item.distraction_category.strip():
                distraction_counts[item.distraction_category.strip()] += 1

        top_failure_reason, top_failure_reason_count = (
            max(
                failure_counts.items(),
                key=lambda entry: (entry[1], entry[0].lower()),
            )
            if failure_counts
            else (None, 0)
        )
        top_distraction_category, top_distraction_count = (
            max(
                distraction_counts.items(),
                key=lambda entry: (entry[1], entry[0].lower()),
            )
            if distraction_counts
            else (None, 0)
        )
        return {
            "top_failure_reason": top_failure_reason,
            "top_failure_reason_count": top_failure_reason_count,
            "top_distraction_category": top_distraction_category,
            "top_distraction_count": top_distraction_count,
        }

    def _build_progress_memory_snapshot(
        self,
        sessions: list[WorkSession],
    ) -> dict[str, str | int | float | None]:
        objective_sessions = list(sessions)
        completed_objectives = sum(1 for item in objective_sessions if item.objective_completed)
        missed_sessions = [item for item in sessions if item.status == SessionStatus.missed]
        closed_sessions = [
            item
            for item in sessions
            if item.actual_end is not None or item.status == SessionStatus.missed
        ]
        reflection_summary = self._build_reflection_summary(sessions)
        average_quality = (
            round(
                sum(
                    float(item.quality_score or calculate_session_quality(item)[0])
                    for item in closed_sessions
                ) / len(closed_sessions),
                2,
            )
            if closed_sessions
            else 0
        )
        top_bucket, bucket_count = self._top_time_bucket(missed_sessions)
        return {
            "objective_completion_rate": round(
                (completed_objectives / len(objective_sessions)) * 100,
                2,
            )
            if objective_sessions
            else 0,
            "missed_sessions": len(missed_sessions),
            "average_quality_score": average_quality,
            "top_failure_reason": reflection_summary["top_failure_reason"],
            "top_distraction_category": reflection_summary["top_distraction_category"],
            "weakest_time_bucket": top_bucket if bucket_count >= 2 else None,
        }

    def _load_previous_memory(
        self,
        db: Session,
        period_start: datetime,
    ) -> dict[str, str | int | float | None] | None:
        previous_week_start = _start_of_week(period_start) - timedelta(days=7)
        memory = db.exec(
            select(WeeklyProgressMemory).where(
                WeeklyProgressMemory.week_start == previous_week_start
            )
        ).first()
        if not memory:
            return None
        return {
            "objective_completion_rate": memory.objective_completion_rate,
            "missed_sessions": memory.missed_sessions,
            "average_quality_score": memory.average_quality_score,
            "top_failure_reason": memory.top_failure_reason,
            "top_distraction_category": memory.top_distraction_category,
            "weakest_time_bucket": memory.weakest_time_bucket,
        }

    def _build_week_over_week_notes(
        self,
        current_memory: dict[str, str | int | float | None],
        previous_memory: dict[str, str | int | float | None] | None,
    ) -> list[str]:
        if not previous_memory:
            return []

        notes: list[str] = []
        previous_completion_rate = float(previous_memory.get("objective_completion_rate") or 0)
        current_completion_rate = float(current_memory.get("objective_completion_rate") or 0)
        if previous_completion_rate > 0 or current_completion_rate > 0:
            if round(previous_completion_rate, 2) != round(current_completion_rate, 2):
                notes.append(
                    f"You improved completion rate from {round(previous_completion_rate)}% to {round(current_completion_rate)}%."
                    if current_completion_rate > previous_completion_rate
                    else f"Completion rate fell from {round(previous_completion_rate)}% to {round(current_completion_rate)}%."
                )

        weakest_previous_bucket = previous_memory.get("weakest_time_bucket")
        weakest_current_bucket = current_memory.get("weakest_time_bucket")
        if weakest_previous_bucket and weakest_previous_bucket == weakest_current_bucket:
            notes.append(
                f"This is the second week your {weakest_current_bucket} sessions broke down."
            )

        return notes[:2]

    def _top_group(
        self,
        sessions: list[WorkSession],
        tasks: dict[int | None, Task],
    ) -> dict[str, str | int | float] | None:
        grouped: dict[tuple[str, str], dict[str, str | int | float]] = {}
        for item in sessions:
            category = self._task_category(tasks, item.task_id)
            objective = self._objective_text(item, tasks)
            key = (category, objective)
            entry = grouped.setdefault(
                key,
                {
                    "category": category,
                    "objective": objective,
                    "count": 0,
                    "minutes": 0.0,
                },
            )
            entry["count"] = int(entry["count"]) + 1
            entry["minutes"] = float(entry["minutes"]) + minutes_between(
                item.actual_start,
                item.actual_end,
            )

        if not grouped:
            return None

        return max(
            grouped.values(),
            key=lambda item: (
                int(item["count"]),
                float(item["minutes"]),
                str(item["category"]).lower(),
                str(item["objective"]).lower(),
            ),
        )

    def _top_category(
        self,
        sessions: list[WorkSession],
        tasks: dict[int | None, Task],
    ) -> dict[str, str | int] | None:
        grouped: dict[str, int] = defaultdict(int)
        for item in sessions:
            grouped[self._task_category(tasks, item.task_id)] += 1

        if not grouped:
            return None

        category, count = max(
            grouped.items(),
            key=lambda entry: (entry[1], entry[0].lower()),
        )
        return {"category": category, "count": count}

    def _top_time_bucket(self, sessions: list[WorkSession]) -> tuple[str | None, int]:
        grouped: dict[str, int] = defaultdict(int)
        for item in sessions:
            grouped[_time_bucket(item.planned_start)] += 1

        if not grouped:
            return None, 0

        bucket, count = max(
            grouped.items(),
            key=lambda entry: (entry[1], entry[0]),
        )
        return bucket, count

    def _describe_group(self, group: dict[str, str | int | float]) -> str:
        objective = str(group["objective"]).strip()
        category = str(group["category"]).strip()
        if objective and category and category != "Uncategorized":
            return f'on "{objective}" under {category}'
        if objective:
            return f'on "{objective}"'
        return f"in {category}"

    def _group_focus_label(self, group: dict[str, str | int | float]) -> str:
        objective = str(group["objective"]).strip()
        category = str(group["category"]).strip()
        if objective and category and category != "Uncategorized":
            return f'"{objective}" work under {category}'
        if objective:
            return f'"{objective}"'
        return f"{category} work"

    def _group_outcome_label(self, group: dict[str, str | int | float]) -> str:
        objective = str(group["objective"]).strip()
        category = str(group["category"]).strip()
        if objective:
            return f'"{objective}"'
        if category and category != "Uncategorized":
            return category
        return "that objective"

    def _miss_bucket_observation(self, bucket: str) -> str:
        mapping = {
            "morning": "You lose control early in the day.",
            "afternoon": "You consistently lose control of your afternoon sessions.",
            "evening": "Your evening sessions keep slipping.",
            "late evening": "Late-evening work keeps collapsing.",
        }
        return mapping.get(bucket, f"Misses cluster {_time_bucket_phrase(bucket)}.")

    def _habit_pattern_phrase(self, habit: HabitPattern) -> str:
        if habit.category in {"Social media", "YouTube", "Distraction"}:
            return (
                f"{habit.category} kept taking planned work and cost {habit.minutes_lost} "
                f"{_pluralize(habit.minutes_lost, 'minute')}."
            )
        return (
            f"{habit.category} kept replacing planned work and cost {habit.minutes_lost} "
            f"{_pluralize(habit.minutes_lost, 'minute')}."
        )

    def _habit_psychology_phrase(self, habit: HabitPattern) -> str:
        if habit.category in {"Social media", "YouTube", "Distraction"}:
            return "You are choosing low-friction activity over high-effort work during critical sessions."
        if habit.category == "Other work":
            return "You keep letting reactive work outrank the objective you already scheduled."
        if habit.category == "Resting":
            return "Your energy is breaking before the critical block starts."
        return "Your blocks are too easy to hijack once resistance shows up."

    def _habit_outcome_label(self, habit: HabitPattern) -> str:
        if habit.category in {"Social media", "YouTube", "Distraction"}:
            return f"low-value activity such as {self._habit_display_name(habit)}"
        return self._habit_display_name(habit)

    def _habit_advice(self, habit: HabitPattern) -> str:
        if habit.category == "Social media":
            return "Eliminate social media completely during high-priority sessions."
        if habit.category == "YouTube":
            return "Eliminate YouTube completely during high-priority sessions."
        if habit.category == "Distraction":
            return "Remove open-ended distractions completely during high-priority sessions."
        if habit.category == "Other work":
            return "Do not let other work enter the block. Capture it and return after the session."
        if habit.category == "Resting":
            return "Put recovery before the block and do not schedule critical work when you are already depleted."
        return f"Set a hard boundary so {self._habit_display_name(habit)} cannot take the block."

    def _should_use_identity_feedback(
        self,
        performance_state: str,
        top_habit: HabitPattern | None,
        top_missed: dict[str, str | int | float] | None,
    ) -> bool:
        if performance_state != "BREAKDOWN" or not top_habit or not top_missed:
            return False
        return int(top_missed["count"]) >= 2

    def _identity_feedback(
        self,
        top_missed: dict[str, str | int | float] | None,
        top_habit: HabitPattern | None,
    ) -> str:
        if not top_missed or not top_habit:
            return ""

        category = str(top_missed["category"]).strip()
        objective = str(top_missed["objective"]).strip()
        if category and category != "Uncategorized" and objective:
            return (
                f'Your system says you value {category}, but your behavior kept giving "{objective}" away to '
                f"{self._habit_display_name(top_habit)}."
            )
        if objective:
            return (
                f'You marked "{objective}" as important, but your behavior kept giving that block away to '
                f"{self._habit_display_name(top_habit)}."
            )
        return ""

    def _habit_display_name(self, habit: HabitPattern) -> str:
        mapping = {
            "Social media": "social media",
            "Resting": "resting",
            "Other work": "other work",
            "Distraction": "distraction",
            "YouTube": "YouTube",
            "Unknown": "unknown activity",
        }
        return mapping.get(habit.category, habit.category)
