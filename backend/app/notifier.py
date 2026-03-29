from __future__ import annotations

import json
from typing import Any

from sqlmodel import Session, select

from .models import GoalContextConfig, NotificationConfig, Task
from .schemas import (
    GoalContextSettingsResponse,
    GoalContextSettingsUpdate,
    NotificationConfigUpdate,
)


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def resolve_task_category(task: Task | None) -> str:
    category = normalize_text(task.category if task else "")
    if category:
        return category

    legacy_category = normalize_text(task.long_term_goal if task else "")
    return legacy_category or "Uncategorized"


def resolve_task_default_goal(task: Task | None) -> str | None:
    if not task:
        return None

    category = normalize_text(task.category)
    goal = normalize_text(task.long_term_goal)
    if not category or not goal:
        return None
    if goal.casefold() == category.casefold():
        return None
    return goal


def normalize_category_goals(payload: dict[str, list[str]] | None) -> dict[str, list[str]]:
    normalized: dict[str, list[str]] = {}
    if not payload:
        return normalized

    for raw_category, raw_goals in payload.items():
        category = normalize_text(raw_category)
        if not category:
            continue

        goals: list[str] = []
        seen: set[str] = set()
        for raw_goal in raw_goals or []:
            goal = normalize_text(raw_goal)
            if not goal:
                continue

            key = goal.casefold()
            if key in seen:
                continue
            seen.add(key)
            goals.append(goal)

        if goals:
            normalized[category] = goals

    return normalized


def find_category_goals(
    category_goals: dict[str, list[str]],
    category: str | None,
) -> list[str]:
    normalized_category = normalize_text(category)
    if not normalized_category:
        return []

    for existing_category, goals in category_goals.items():
        if normalize_text(existing_category).casefold() == normalized_category.casefold():
            return list(goals)

    return []


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


class GoalContextService:
    def get_or_create(self, db: Session) -> GoalContextConfig:
        config = db.exec(select(GoalContextConfig)).first()
        if config:
            return config

        config = GoalContextConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    def _load_category_goals(self, config: GoalContextConfig) -> dict[str, list[str]]:
        try:
            raw_value = json.loads(config.category_goals_json or "{}")
        except json.JSONDecodeError:
            raw_value = {}

        if not isinstance(raw_value, dict):
            return {}

        return normalize_category_goals(raw_value)

    def _build_goal_context_response(
        self,
        config: GoalContextConfig,
    ) -> GoalContextSettingsResponse:
        category_goals = self._load_category_goals(config)
        categories = list(category_goals)
        goals: list[str] = []
        seen_goals: set[str] = set()

        for category in categories:
            for goal in category_goals.get(category, []):
                goal_key = goal.casefold()
                if goal_key in seen_goals:
                    continue

                seen_goals.add(goal_key)
                goals.append(goal)

        return GoalContextSettingsResponse(
            category_goals=category_goals,
            categories=categories,
            goals=goals,
            updated_at=getattr(config, "updated_at", None),
        )

    def get_category_goals(self, db: Session) -> GoalContextSettingsResponse:
        config = self.get_or_create(db)
        return self._build_goal_context_response(config)

    def update(
        self,
        db: Session,
        payload: GoalContextSettingsUpdate,
    ) -> GoalContextSettingsResponse:
        config = self.get_or_create(db)
        normalized = normalize_category_goals(payload.category_goals)
        config.category_goals_json = json.dumps(normalized)
        db.add(config)
        db.commit()
        db.refresh(config)
        return self._build_goal_context_response(config)

    def register_goal(
        self,
        db: Session,
        category: str | None,
        goal: str | None,
    ) -> GoalContextSettingsResponse:
        normalized_category = normalize_text(category)
        normalized_goal = normalize_text(goal)
        if not normalized_category or not normalized_goal:
            return self.get_category_goals(db)

        config = self.get_or_create(db)
        category_goals = self._load_category_goals(config)
        existing = find_category_goals(category_goals, normalized_category)
        existing_keys = {item.casefold() for item in existing}

        if normalized_goal.casefold() not in existing_keys:
            if existing:
                for key in list(category_goals):
                    if key.casefold() == normalized_category.casefold():
                        category_goals[key] = [*existing, normalized_goal]
                        break
            else:
                category_goals[normalized_category] = [normalized_goal]

            config.category_goals_json = json.dumps(category_goals)
            db.add(config)
            db.commit()
            db.refresh(config)

        return self._build_goal_context_response(config)

    def fallback_goal_for_category(self, db: Session, category: str | None) -> str | None:
        category_goals = self.get_category_goals(db).category_goals
        goals = find_category_goals(category_goals, category)
        return goals[0] if goals else None
