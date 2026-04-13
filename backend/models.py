"""
Spark Agent Hub — Data Models
Pydantic v2 models for all API and storage shapes.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────

class WorkspaceStatus(str, Enum):
    available = "available"
    claimed = "claimed"
    switching = "switching"
    ready = "ready"
    implementing = "implementing"
    building = "building"
    testing = "testing"
    review = "review"


class VCSType(str, Enum):
    svn = "svn"
    git = "git"
    unknown = "unknown"


class TaskStage(str, Enum):
    queued = "queued"
    understanding = "understanding"
    planning = "planning"
    preparing_env = "preparing_env"
    implementing = "implementing"
    building = "building"
    testing = "testing"
    review = "review"
    completed = "completed"
    paused = "paused"
    failed = "failed"


class AutonomyLevel(str, Enum):
    full_auto = "full_auto"      # Merge to RTM
    checkpoint = "checkpoint"     # Bug fix / reopen
    supervised = "supervised"     # New feature
    report_only = "report_only"  # Investigation


class TaskType(str, Enum):
    merge = "merge"
    bugfix = "bugfix"
    feature = "feature"
    investigation = "investigation"
    version = "version"
    debug = "debug"


# ── Workspace ──────────────────────────────────────────────────────

class Workspace(BaseModel):
    id: str
    # Dual repos: spark (AOI) + vscan90
    spark_path: str
    vscan_path: str
    display_name: str
    color: str = "blue"
    color_hex: str = "#4a9eff"
    status: WorkspaceStatus = WorkspaceStatus.available
    vcs_type: VCSType = VCSType.unknown
    # Branch state for each repo
    current_branch: Optional[str] = None   # spark branch
    vscan_branch: Optional[str] = None     # vscan90 branch
    task_tt: Optional[str] = None
    last_activity: Optional[str] = None
    session_id: Optional[str] = None

    @property
    def path(self) -> str:
        """Primary path alias (spark repo) for backward compat."""
        return self.spark_path


# ── Task ───────────────────────────────────────────────────────────

class StageTransition(BaseModel):
    from_stage: str
    to_stage: str
    timestamp: str
    reason: str = ""


class BuildError(BaseModel):
    project: str = ""
    file: str = ""
    line: int = 0
    code: str = ""
    message: str = ""


class BuildWarning(BaseModel):
    project: str = ""
    file: str = ""
    line: int = 0
    code: str = ""
    message: str = ""


class BuildResult(BaseModel):
    success: bool
    errors: list[BuildError] = []
    warnings: list[BuildWarning] = []
    duration_seconds: float = 0.0
    output: str = ""


class TestFailure(BaseModel):
    test_name: str
    message: str = ""
    stack_trace: str = ""


class TestResult(BaseModel):
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    duration_seconds: float = 0.0
    failures: list[TestFailure] = []


class LoadedDoc(BaseModel):
    name: str
    doc_type: str  # "rag" or "feature"
    path: str = ""
    size_chars: int = 0


class GuidanceMessage(BaseModel):
    timestamp: str
    sender: str  # "Ron" or "system"
    content: str


class Task(BaseModel):
    tt_number: str
    title: str = ""
    task_type: TaskType = TaskType.bugfix
    stage: TaskStage = TaskStage.queued
    autonomy: AutonomyLevel = AutonomyLevel.checkpoint
    workspace_id: Optional[str] = None
    monday_item_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    stage_history: list[StageTransition] = []
    context_loaded: list[LoadedDoc] = []
    build_result: Optional[BuildResult] = None
    test_result: Optional[TestResult] = None
    guidance_messages: list[GuidanceMessage] = []
    error_log: list[str] = []


# ── Activity ───────────────────────────────────────────────────────

class ActivityEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(int(datetime.now().timestamp() * 1000)))
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    workspace_id: Optional[str] = None
    tt_number: Optional[str] = None
    message: str = ""
    stage: Optional[str] = None
    event_type: str = "info"  # stage_change, build_result, approval_needed, task_assigned, task_completed, error, info


# ── API Request/Response Models ────────────────────────────────────

class CreateTaskRequest(BaseModel):
    tt_number: str
    workspace_id: Optional[str] = None
    autonomy: AutonomyLevel = AutonomyLevel.checkpoint
    task_type: TaskType = TaskType.bugfix


class ApproveRequest(BaseModel):
    proceed: bool = True
    feedback: Optional[str] = None


class MessageRequest(BaseModel):
    content: str


class SwitchBranchRequest(BaseModel):
    target_branch: str
