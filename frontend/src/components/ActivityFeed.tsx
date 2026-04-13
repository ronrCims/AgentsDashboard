import type { ActivityEntry } from '../api/types';
import { getAgentHex, formatTime } from '../lib/agentColors';
import { useStore } from '../store';

// Map workspace IDs to colors
const WS_COLORS: Record<string, string> = {
  agent1: 'blue',
  agent2: 'green',
  agent3: 'orange',
};

export function ActivityFeed() {
  const activities = useStore((s) => s.activities);

  if (activities.length === 0) {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-surface-border)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }} className="text-sm">
          No activity yet. Assign a task to get started.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-surface-border)' }}
    >
      <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--color-surface-border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Activity
        </h3>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {activities.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const wsColor = entry.workspace_id ? WS_COLORS[entry.workspace_id] || 'blue' : 'blue';
  const hex = getAgentHex(wsColor);

  return (
    <div
      className="flex items-start gap-2 px-4 py-2 text-sm border-b last:border-b-0 transition-colors"
      style={{ borderColor: 'var(--color-surface-border)' }}
    >
      <span
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: hex }}
      />
      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {formatTime(entry.timestamp)}
      </span>
      {entry.tt_number && (
        <span className="text-xs font-semibold shrink-0" style={{ color: hex }}>
          TT{entry.tt_number}
        </span>
      )}
      <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
        {entry.message}
      </span>
    </div>
  );
}
