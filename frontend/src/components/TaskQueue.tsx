import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MondayTask } from '../api/types';
import { useStore } from '../store';
import { createTask } from '../api/client';

export function TaskQueue() {
  const mondayTasks = useStore((s) => s.mondayTasks);
  const mondayLoading = useStore((s) => s.mondayLoading);
  const refreshMonday = useStore((s) => s.refreshMonday);
  const refreshTasks = useStore((s) => s.refreshTasks);
  const refreshWorkspaces = useStore((s) => s.refreshWorkspaces);
  const workspaces = useStore((s) => s.workspaces);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSystem, setFilterSystem] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // "Analyze" quick-action state
  const [analyzeTask, setAnalyzeTask] = useState<MondayTask | null>(null);

  // Extract unique values for filter dropdowns
  const types = [...new Set(mondayTasks.map((t) => t.task_type).filter(Boolean))].sort();
  const systems = [...new Set(mondayTasks.map((t) => t.system).filter(Boolean))].sort();
  const statuses = [...new Set(mondayTasks.map((t) => t.status).filter(Boolean))].sort();

  // Apply search + filters
  const q = search.trim().toLowerCase();
  let filtered = mondayTasks;
  if (q) {
    filtered = filtered.filter((t) =>
      t.tt_number?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.system?.toLowerCase().includes(q) ||
      t.customer?.toLowerCase().includes(q) ||
      t.engineer?.toLowerCase().includes(q)
    );
  }
  if (filterType) filtered = filtered.filter((t) => t.task_type === filterType);
  if (filterSystem) filtered = filtered.filter((t) => t.system === filterSystem);
  if (filterStatus) filtered = filtered.filter((t) => t.status === filterStatus);

  // Sort by priority (lower = higher priority)
  filtered = [...filtered].sort((a, b) => {
    const pa = parseFloat(a.priority) || 999;
    const pb = parseFloat(b.priority) || 999;
    return pa - pb;
  });

  const hasFilters = q || filterType || filterSystem || filterStatus;

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex gap-3 items-center">
        <h2 className="text-lg font-semibold flex-1">Monday Task Queue</h2>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length}/{mondayTasks.length}
        </span>
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

      {/* Search + filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Search TT, name, system, customer, engineer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded outline-none flex-1"
          style={{
            minWidth: '220px',
            background: 'var(--color-surface-input)',
            border: '1px solid var(--color-surface-border)',
            color: 'var(--color-text-primary)',
          }}
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs px-2 py-1.5 rounded"
          style={{
            background: 'var(--color-surface-input)',
            border: '1px solid var(--color-surface-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs px-2 py-1.5 rounded"
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
          className="text-xs px-2 py-1.5 rounded"
          style={{
            background: 'var(--color-surface-input)',
            border: '1px solid var(--color-surface-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <option value="">All systems</option>
          {systems.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterSystem(''); setFilterStatus(''); }}
            className="text-xs px-2 py-1.5 rounded"
            style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-hover)', border: '1px solid var(--color-surface-border)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--color-surface-border)' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-hover)' }}>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)', width: '40px' }}>Pri</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)', width: '64px' }}>TT</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Name</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)', width: '80px' }}>Type</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)', width: '100px' }}>System</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)', width: '120px' }}>Status</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)', width: '72px' }}>Due</th>
                <th className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)', width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    {mondayTasks.length === 0
                      ? 'Click "Pull Monday" to load tasks'
                      : 'No tasks match filters'}
                  </td>
                </tr>
              ) : (
                filtered.map((task) => (
                  <TaskRow
                    key={task.monday_id}
                    task={task}
                    onAnalyze={() => setAnalyzeTask(task)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analyze modal */}
      {analyzeTask && (
        <AnalyzeModal
          task={analyzeTask}
          workspaces={workspaces}
          onClose={() => setAnalyzeTask(null)}
          onDone={async () => {
            setAnalyzeTask(null);
            await Promise.all([refreshTasks(), refreshWorkspaces()]);
          }}
        />
      )}
    </div>
  );
}

// ── Task Row ──────────────────────────────────────────────────────

function TaskRow({ task, onAnalyze }: { task: MondayTask; onAnalyze: () => void }) {
  const priority = parseFloat(task.priority) || null;

  return (
    <tr
      className="border-t"
      style={{ borderColor: 'var(--color-surface-border)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
    >
      <td className="px-3 py-2 font-mono text-xs" style={{ color: priorityColor(priority) }}>
        {priority || '—'}
      </td>
      <td className="px-3 py-2 font-semibold text-xs" style={{ color: 'var(--color-status-info)' }}>
        {task.tt_number ? `TT${task.tt_number}` : '—'}
      </td>
      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-primary)', maxWidth: '300px' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.name}>
          {task.name}
        </div>
        {task.customer && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '1px' }}>
            {task.customer}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {task.task_type || '—'}
      </td>
      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {task.system || '—'}
      </td>
      <td className="px-3 py-2 text-xs">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
        {task.due_date || '—'}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={onAnalyze}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{
            background: 'rgba(167,139,250,0.15)',
            color: '#a78bfa',
            border: '1px solid rgba(167,139,250,0.3)',
          }}
          title="Start an investigation task for this TT"
        >
          Analyze
        </button>
      </td>
    </tr>
  );
}

// ── Status Badge ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'Not started': 'var(--color-text-muted)',
    'In Development': 'var(--color-agent-blue)',
    'Follow-Up': 'var(--color-status-warning)',
    'Done': 'var(--color-status-success)',
    'Released': 'var(--color-status-success)',
    'In Testing': 'var(--color-agent-purple)',
    'Re open': 'var(--color-status-error)',
    'Stuck': 'var(--color-status-error)',
    'In review': 'var(--color-status-warning)',
  };
  const color = colorMap[status] || 'var(--color-text-secondary)';
  return <span style={{ color }}>{status || '—'}</span>;
}

// ── Priority Color ────────────────────────────────────────────────

function priorityColor(priority: number | null): string {
  if (!priority) return 'var(--color-text-muted)';
  if (priority <= 1) return 'var(--color-status-error)';
  if (priority <= 2) return 'var(--color-status-warning)';
  if (priority <= 3) return 'var(--color-status-info)';
  return 'var(--color-text-muted)';
}

// ── Analyze Modal ─────────────────────────────────────────────────

interface AnalyzeModalProps {
  task: MondayTask;
  workspaces: { id: string; display_name: string; status: string; color: string; color_hex: string }[];
  onClose: () => void;
  onDone: () => Promise<void>;
}

const AGENT_HEX: Record<string, string> = {
  blue: '#4a9eff', green: '#4ade80', orange: '#fb923c', purple: '#a78bfa', red: '#f87171',
};

function AnalyzeModal({ task, workspaces, onClose, onDone }: AnalyzeModalProps) {
  const available = workspaces.filter((w) => w.status === 'available');
  const [selectedWs, setSelectedWs] = useState(available[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doAnalyze() {
    if (!task.tt_number) { setError('No TT number'); return; }
    setLoading(true);
    setError(null);
    try {
      await createTask(task.tt_number, {
        workspace_id: selectedWs || undefined,
        task_type: 'investigation',
        autonomy: 'report_only',
      });
      await onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div style={{
        width: '420px', background: '#161b26',
        border: '1px solid #2a3144', borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a3144', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#a78bfa' }}>Analyze Task</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              TT{task.tt_number} — investigation / report only
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✕</button>
          )}
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Task name */}
          <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.4' }}>
            {task.name}
          </div>

          {/* Workspace picker */}
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Assign to workspace</div>
            {available.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#f87171' }}>No available workspaces</div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {available.map((ws) => {
                  const hex = ws.color_hex || AGENT_HEX[ws.color] || '#4a9eff';
                  const selected = selectedWs === ws.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => setSelectedWs(ws.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '13px', fontWeight: selected ? 600 : 400,
                        background: selected ? `${hex}22` : '#1c2333',
                        color: selected ? hex : '#94a3b8',
                        border: selected ? `1px solid ${hex}44` : '1px solid #2a3144',
                      }}
                    >
                      {ws.display_name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={onClose} disabled={loading}
              style={{ padding: '7px 14px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', background: '#1c2333', color: '#94a3b8', border: '1px solid #2a3144' }}>
              Cancel
            </button>
            <button
              onClick={doAnalyze}
              disabled={loading || available.length === 0}
              style={{
                padding: '7px 18px', fontSize: '13px', fontWeight: 600, borderRadius: '6px',
                cursor: loading || available.length === 0 ? 'not-allowed' : 'pointer',
                background: loading || available.length === 0 ? '#1c2333' : '#a78bfa',
                color: loading || available.length === 0 ? '#64748b' : '#000',
                border: 'none',
              }}
            >
              {loading ? 'Starting...' : 'Start Analysis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
