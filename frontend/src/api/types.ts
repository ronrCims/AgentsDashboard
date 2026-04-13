// Pipeline stages matching the spec's flow
export const PIPELINE_STAGES = [
  'queued', 'understanding', 'planning', 'preparing_env',
  'implementing', 'building', 'testing', 'review', 'completed',
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number] | 'paused' | 'failed';

export type WorkspaceStatus =
  | 'available' | 'claimed' | 'switching' | 'ready'
  | 'implementing' | 'building' | 'testing' | 'review';

export type TaskType = 'merge' | 'bugfix' | 'feature' | 'investigation' | 'version' | 'debug';
export type AutonomyLevel = 'full_auto' | 'checkpoint' | 'supervised' | 'report_only';

export interface Workspace {
  id: string;
  path: string;
  display_name: string;
  color: string;
  color_hex: string;
  status: WorkspaceStatus;
  vcs_type: 'svn' | 'git' | 'unknown';
  current_branch: string | null;
  task_tt: string | null;
  last_activity: string | null;
  session_id: string | null;
}

export interface StageTransition {
  from_stage: string;
  to_stage: string;
  timestamp: string;
  reason: string;
}

export interface GuidanceMessage {
  timestamp: string;
  sender: string;
  content: string;
}

export interface BuildResult {
  success: boolean;
  errors: { project: string; file: string; line: number; code: string; message: string }[];
  warnings: { project: string; file: string; line: number; code: string; message: string }[];
  duration_seconds: number;
  output: string;
}

export interface TestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_seconds: number;
  failures: { test_name: string; message: string }[];
}

export interface LoadedDoc {
  name: string;
  doc_type: 'rag' | 'feature';
  path: string;
  size_chars: number;
}

export interface Task {
  tt_number: string;
  title: string;
  task_type: TaskType;
  stage: PipelineStage;
  autonomy: AutonomyLevel;
  workspace_id: string | null;
  monday_item_id: string | null;
  created_at: string;
  updated_at: string;
  stage_history: StageTransition[];
  context_loaded: LoadedDoc[];
  build_result: BuildResult | null;
  test_result: TestResult | null;
  guidance_messages: GuidanceMessage[];
  error_log: string[];
}

export interface MondayTask {
  tt_number: string;
  name: string;
  status: string;
  engineer: string;
  priority: string;
  task_type: string;
  system: string;
  customer: string;
  territory: string;
  sw_rev: string;
  due_date: string;
  team: string;
  qa: string;
  monday_id: string;
  group: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  workspace_id: string | null;
  tt_number: string | null;
  message: string;
  stage: string | null;
  event_type: string;
}

// P3: Workspace detail with clean state
export interface WorkspaceDetail extends Workspace {
  path_exists: boolean;
  is_clean: boolean | null;
  modified_count: number;
  modified_files: string[];
}

// P3: Branch lists from SVN
export interface RtmBranch {
  name: string;
  url: string;
}

export interface BranchList {
  current: string;          // trunk URL
  work: string[];           // feature branch names
  rtm_roots: RtmBranch[];   // Build_XXXX
  rtm_clients: RtmBranch[]; // Build_XXXX_Customer_...
}

export interface SwitchQueuedResponse {
  queued: boolean;
  workspace_id: string;
  target_url: string;
}

export interface SwitchProgressEvent {
  workspace_id: string;
  line: string;
  lines_seen: number;
}

export interface HubInfo {
  msbuild_available: boolean;
  msbuild_path: string;
  tools_dir: string;
  tools_available: boolean;
  monday_available: boolean;
  workspaces: Record<string, string>;
  workspaces_exist: Record<string, boolean>;
}
