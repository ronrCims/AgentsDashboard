"""
Spark Agent Hub — Task Lifecycle State Machine
Defines allowed transitions and guard conditions.
"""

from models import Task, TaskStage, AutonomyLevel, StageTransition
from datetime import datetime


# ── Transition Table ───────────────────────────────────────────────
# Maps (from_stage, to_stage) to a guard function name.
# Guard returns (allowed: bool, reason: str)

TRANSITIONS: dict[tuple[str, str], str] = {
    # Happy path
    ("queued", "understanding"): "guard_always",
    ("understanding", "planning"): "guard_always",
    ("planning", "preparing_env"): "guard_plan_approved",
    ("preparing_env", "implementing"): "guard_always",
    ("implementing", "building"): "guard_always",
    ("building", "testing"): "guard_build_succeeded",
    ("testing", "review"): "guard_tests_passed",
    ("review", "completed"): "guard_always",

    # Retry loops
    ("building", "implementing"): "guard_always",  # build failed, go back
    ("testing", "implementing"): "guard_always",   # test failed, go back

    # Pause/resume from any active stage
    ("understanding", "paused"): "guard_always",
    ("planning", "paused"): "guard_always",
    ("preparing_env", "paused"): "guard_always",
    ("implementing", "paused"): "guard_always",
    ("building", "paused"): "guard_always",
    ("testing", "paused"): "guard_always",
    ("review", "paused"): "guard_always",

    # Failure from any active stage
    ("understanding", "failed"): "guard_always",
    ("planning", "failed"): "guard_always",
    ("preparing_env", "failed"): "guard_always",
    ("implementing", "failed"): "guard_always",
    ("building", "failed"): "guard_always",
    ("testing", "failed"): "guard_always",
    ("review", "failed"): "guard_always",
}

# ── Guard Functions ────────────────────────────────────────────────

def guard_always(task: Task) -> tuple[bool, str]:
    return True, ""


def guard_plan_approved(task: Task) -> tuple[bool, str]:
    if task.autonomy == AutonomyLevel.full_auto:
        return True, "full_auto: no approval needed"
    # Check if there's an approval message after the planning stage started
    for msg in reversed(task.guidance_messages):
        if "approv" in msg.content.lower() or "proceed" in msg.content.lower():
            return True, f"approved by {msg.sender}"
    return False, "plan not yet approved — waiting for approval"


def guard_build_succeeded(task: Task) -> tuple[bool, str]:
    if task.build_result is None:
        return False, "no build result available"
    if task.build_result.success:
        return True, "build succeeded"
    return False, f"build failed with {len(task.build_result.errors)} error(s)"


def guard_tests_passed(task: Task) -> tuple[bool, str]:
    if task.test_result is None:
        return False, "no test result available"
    if task.test_result.failed == 0:
        return True, f"all {task.test_result.passed} tests passed"
    return False, f"{task.test_result.failed} test(s) failed"


GUARDS = {
    "guard_always": guard_always,
    "guard_plan_approved": guard_plan_approved,
    "guard_build_succeeded": guard_build_succeeded,
    "guard_tests_passed": guard_tests_passed,
}


# ── State Machine ──────────────────────────────────────────────────

def can_transition(task: Task, target_stage: TaskStage) -> tuple[bool, str]:
    """Check if a task can transition to the target stage."""
    key = (task.stage.value, target_stage.value)
    if key not in TRANSITIONS:
        return False, f"transition {task.stage.value} -> {target_stage.value} not allowed"

    guard_name = TRANSITIONS[key]
    guard_fn = GUARDS.get(guard_name, guard_always)
    return guard_fn(task)


def do_transition(task: Task, target_stage: TaskStage, reason: str = "") -> tuple[bool, str]:
    """Execute a state transition. Modifies the task in place."""
    allowed, guard_reason = can_transition(task, target_stage)
    if not allowed:
        return False, guard_reason

    transition = StageTransition(
        from_stage=task.stage.value,
        to_stage=target_stage.value,
        timestamp=datetime.now().isoformat(),
        reason=reason or guard_reason,
    )
    task.stage_history.append(transition)
    task.stage = target_stage
    task.updated_at = datetime.now().isoformat()

    return True, f"transitioned to {target_stage.value}"
