import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { createTask } from '../api/client';
import type { AutonomyLevel, TaskType } from '../api/types';

interface Props {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
  onAssigned: () => void;
}

const AUTONOMY_OPTIONS: { value: AutonomyLevel; label: string; desc: string }[] = [
  { value: 'checkpoint', label: 'Checkpoint', desc: 'Pauses after plan, implement, validate' },
  { value: 'supervised', label: 'Supervised', desc: 'Pauses at every stage transition' },
  { value: 'full_auto', label: 'Full Auto', desc: 'Only stops on error' },
  { value: 'report_only', label: 'Report Only', desc: 'Analysis only, no changes' },
];

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'bugfix', label: 'Bug Fix' },
  { value: 'feature', label: 'New Feature' },
  { value: 'merge', label: 'Merge to RTM' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'version', label: 'Version / Release' },
  { value: 'debug', label: 'Debug' },
];

export function AssignTaskModal({ workspaceId, workspaceName, onClose, onAssigned }: Props) {
  const mondayTasks = useStore((s) => s.mondayTasks);
  const refreshTasks = useStore((s) => s.refreshTasks);
  const refreshWorkspaces = useStore((s) => s.refreshWorkspaces);

  const [ttInput, setTtInput] = useState('');
  const [autonomy, setAutonomy] = useState<AutonomyLevel>('checkpoint');
  const [taskType, setTaskType] = useState<TaskType>('bugfix');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick-pick from Monday list
  const mondayMatch = mondayTasks.find(
    (t) => t.tt_number === ttInput.replace(/^TT/i, '').trim()
  );

  async function doAssign() {
    const tt = ttInput.replace(/^TT/i, '').trim();
    if (!tt) { setError('Enter a TT number'); return; }

    setLoading(true);
    setError(null);
    try {
      await createTask(tt, {
        workspace_id: workspaceId,
        autonomy,
        task_type: taskType,
      });
      await Promise.all([refreshTasks(), refreshWorkspaces()]);
      onAssigned();
      onClose();
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
      <div
        style={{
          width: '460px',
          display: 'flex', flexDirection: 'column',
          borderRadius: '12px', overflow: 'hidden',
          background: '#161b26',
          border: '1px solid #2a3144',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a3144', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0' }}>Assign Task</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{workspaceName}</div>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ color: '#64748b', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          )}
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TT Number */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>TT Number</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. 5909 or TT5909"
              value={ttInput}
              onChange={(e) => setTtInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doAssign()}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', fontSize: '14px', borderRadius: '6px',
                background: '#1c2333', color: '#e2e8f0',
                border: '1px solid #2a3144', outline: 'none',
              }}
            />
            {mondayMatch && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#4ade80' }}>
                ✓ {mondayMatch.name}
              </div>
            )}
          </div>

          {/* Task Type */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Task Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTaskType(opt.value)}
                  style={{
                    padding: '5px 10px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                    background: taskType === opt.value ? '#4a9eff22' : '#1c2333',
                    color: taskType === opt.value ? '#4a9eff' : '#94a3b8',
                    border: taskType === opt.value ? '1px solid #4a9eff44' : '1px solid #2a3144',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Autonomy */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Autonomy Level</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {AUTONOMY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAutonomy(opt.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                    background: autonomy === opt.value ? '#4a9eff11' : 'transparent',
                    border: autonomy === opt.value ? '1px solid #4a9eff44' : '1px solid #2a3144',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                >
                  <span style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: autonomy === opt.value ? '#4a9eff' : '#2a3144',
                  }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: autonomy === opt.value ? '#4a9eff' : '#e2e8f0' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer',
                background: '#1c2333', color: '#94a3b8', border: '1px solid #2a3144',
              }}
            >
              Cancel
            </button>
            <button
              onClick={doAssign}
              disabled={loading || !ttInput.trim()}
              style={{
                padding: '8px 20px', fontSize: '13px', fontWeight: 600, borderRadius: '6px',
                cursor: loading || !ttInput.trim() ? 'not-allowed' : 'pointer',
                background: loading || !ttInput.trim() ? '#1c2333' : '#4a9eff',
                color: loading || !ttInput.trim() ? '#64748b' : '#000',
                border: 'none',
              }}
            >
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
