import { useState } from 'react';
import type { MondayTask } from '../api/types';
import { useStore } from '../store';

export function TaskQueue() {
  const mondayTasks = useStore((s) => s.mondayTasks);
  const mondayLoading = useStore((s) => s.mondayLoading);
  const refreshMonday = useStore((s) => s.refreshMonday);
  const [filterType, setFilterType] = useState('');
  const [filterSystem, setFilterSystem] = useState('');

  // Extract unique values for filters
  const types = [...new Set(mondayTasks.map((t) => t.task_type).filter(Boolean))];
  const systems = [...new Set(mondayTasks.map((t) => t.system).filter(Boolean))];

  // Apply filters
  let filtered = mondayTasks;
  if (filterType) filtered = filtered.filter((t) => t.task_type === filterType);
  if (filterSystem) filtered = filtered.filter((t) => t.system === filterSystem);

  // Sort by priority (lower = higher)
  filtered = [...filtered].sort((a, b) => {
    const pa = parseFloat(a.priority) || 999;
    const pb = parseFloat(b.priority) || 999;
    return pa - pb;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 items-center">
        <h2 className="text-lg font-semibold flex-1">Monday Task Queue</h2>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'var(--color-surface-input)',
            border: '1px solid var(--color-surface-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterSystem}
          onChange={(e) => setFilterSystem(e.target.value)}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'var(--color-surface-input)',
            border: '1px solid var(--color-surface-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <option value="">All systems</option>
          {systems.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={refreshMonday}
          disabled={mondayLoading}
          className="text-xs px-3 py-1.5 rounded cursor-pointer transition-colors"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            opacity: mondayLoading ? 0.5 : 1,
          }}
        >
          {mondayLoading ? 'Loading...' : 'Pull Monday'}
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--color-surface-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-hover)' }}>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Pri</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>TT</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Name</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Type</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>System</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Status</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  {mondayTasks.length === 0
                    ? 'Click "Pull Monday" to load tasks'
                    : 'No tasks match filters'}
                </td>
              </tr>
            ) : (
              filtered.map((task) => (
                <TaskRow key={task.monday_id} task={task} />
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Showing {filtered.length} of {mondayTasks.length} tasks
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: MondayTask }) {
  const priority = parseFloat(task.priority) || null;

  return (
    <tr
      className="border-t transition-colors hover:bg-[var(--color-surface-hover)]"
      style={{ borderColor: 'var(--color-surface-border)' }}
    >
      <td className="px-3 py-2 font-mono text-xs" style={{ color: priorityColor(priority) }}>
        {priority || '-'}
      </td>
      <td className="px-3 py-2 font-semibold text-xs" style={{ color: 'var(--color-status-info)' }}>
        {task.tt_number}
      </td>
      <td className="px-3 py-2 max-w-xs truncate text-xs" style={{ color: 'var(--color-text-primary)' }}>
        {task.name}
      </td>
      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {task.task_type || '-'}
      </td>
      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {task.system || '-'}
      </td>
      <td className="px-3 py-2 text-xs">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
        {task.due_date || '-'}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'Not started': 'var(--color-text-muted)',
    'In Development': 'var(--color-agent-blue)',
    'Follow-Up': 'var(--color-status-warning)',
    'Done': 'var(--color-status-success)',
    'Released': 'var(--color-status-success)',
    'In Testing': 'var(--color-agent-purple)',
  };
  const color = colorMap[status] || 'var(--color-text-secondary)';

  return (
    <span className="text-xs" style={{ color }}>
      {status || '-'}
    </span>
  );
}

function priorityColor(priority: number | null): string {
  if (!priority) return 'var(--color-text-muted)';
  if (priority <= 1) return 'var(--color-status-error)';
  if (priority <= 2) return 'var(--color-status-warning)';
  if (priority <= 3) return 'var(--color-status-info)';
  return 'var(--color-text-muted)';
}
