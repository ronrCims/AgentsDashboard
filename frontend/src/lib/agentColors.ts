export const AGENT_COLORS: Record<string, { color: string; hex: string; emoji: string }> = {
  blue:   { color: 'blue',   hex: '#4a9eff', emoji: '\u{1F535}' },
  green:  { color: 'green',  hex: '#4ade80', emoji: '\u{1F7E2}' },
  orange: { color: 'orange', hex: '#fb923c', emoji: '\u{1F7E0}' },
  purple: { color: 'purple', hex: '#a78bfa', emoji: '\u{1F7E3}' },
  red:    { color: 'red',    hex: '#f87171', emoji: '\u{1F534}' },
};

export function getAgentColor(color: string) {
  return AGENT_COLORS[color] || AGENT_COLORS.blue;
}

export function getAgentHex(color: string): string {
  return getAgentColor(color).hex;
}

// Pipeline stage labels for display
export const STAGE_LABELS: Record<string, string> = {
  queued: 'QUEUED',
  understanding: 'UNDERSTAND',
  planning: 'PLANNING',
  preparing_env: 'PREPARING',
  implementing: 'IMPLEMENTING',
  building: 'BUILDING',
  testing: 'TESTING',
  review: 'REVIEW',
  completed: 'COMPLETE',
  paused: 'PAUSED',
  failed: 'FAILED',
};

export const STAGE_ORDER = [
  'queued', 'understanding', 'planning', 'preparing_env',
  'implementing', 'building', 'testing', 'review', 'completed',
];

export function getStageIndex(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : -1;
}

export function getStageProgress(stage: string): number {
  const idx = getStageIndex(stage);
  if (idx < 0) return 0;
  return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
}

// Format relative time
export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Format time as HH:MM
export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Truncate branch name for display
export function shortBranch(branch: string | null): string {
  if (!branch) return '';
  // Remove SVN prefix
  const cleaned = branch
    .replace(/^\^\/AOI\/Versions\/SPARK\/3\.0\//, '')
    .replace(/^Release\/!RTM\//, '');
  // Truncate if too long
  return cleaned.length > 25 ? cleaned.slice(0, 22) + '...' : cleaned;
}
