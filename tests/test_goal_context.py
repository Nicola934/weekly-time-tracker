from sqlmodel import Session, SQLModel, create_engine

from backend.app.models import Task
from backend.app.notifier import (
    GoalContextService,
    resolve_task_category,
    resolve_task_default_goal,
)

TEST_USER_ID = 1


def test_goal_context_service_registers_and_deduplicates_category_goals() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as db:
        service = GoalContextService()
        service.register_goal(
            db,
            "Lionyx-E Automation Systems",
            "Generate R300 000 recurring revenue",
            TEST_USER_ID,
        )
        service.register_goal(
            db,
            "lionyx-e automation systems",
            "Generate R300 000 recurring revenue",
            TEST_USER_ID,
        )
        response = service.register_goal(
            db,
            "Lionyx-E Automation Systems",
            "Launch Tenant Arrears Tracking system",
            TEST_USER_ID,
        )

    assert response.category_goals == {
        "Lionyx-E Automation Systems": [
            "Generate R300 000 recurring revenue",
            "Launch Tenant Arrears Tracking system",
        ]
    }


def test_goal_context_helpers_preserve_legacy_long_term_goal_behavior() -> None:
    explicit_task = Task(
        title="Architecture",
        objective="Design the platform",
        category="Lionyx-E Automation Systems",
        long_term_goal="Launch Tenant Arrears Tracking system",
        priority=4,
    )
    legacy_task = Task(
        title="Legacy Task",
        objective="Keep old behavior stable",
        long_term_goal="Reporting",
        priority=3,
    )

    assert resolve_task_category(explicit_task) == "Lionyx-E Automation Systems"
    assert (
        resolve_task_default_goal(explicit_task)
        == "Launch Tenant Arrears Tracking system"
    )
    assert resolve_task_category(legacy_task) == "Reporting"
    assert resolve_task_default_goal(legacy_task) is None
