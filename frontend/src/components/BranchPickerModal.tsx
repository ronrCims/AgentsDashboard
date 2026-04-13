import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { switchBranch } from '../api/client';
import type { SwitchProgressEvent } from '../api/types';

interface Props {
  workspaceId: string;
  workspaceName: string;
  currentBranch: string | null;
  onClose: () => void;
}

export function BranchPickerModal({ workspaceId, workspaceName, currentBranch, onClose }: Props) {
  const { branches, branchesLoading, refreshBranches, switchProgress } = useStore((s) => ({
    branches: s.branches,
    branchesLoading: s.branchesLoading,
    refreshBranches: s.refreshBranches,
    switchProgress: s.switchProgress,
  }));

  const [filter, setFilter] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const progress: SwitchProgressEvent[] = switchProgress[workspaceId] ?? [];
  const isSwitchingRemotely = useStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId)?.status === 'switching'
  );

  useEffect(() => {
    if (!branches) refreshBranches();
  }, []);

  // Build a flat list of branch entries for display
  type BranchEntry = { label: string; value: string; category: string };
  const allBranches: BranchEntry[] = [];

  if (branches) {
    allBranches.push({ label: 'Current (trunk)', value: 'Current', category: 'Trunk' });

    for (const name of branches.work) {
      allBranches.push({ label: name, value: name, category: 'Work' });
    }

    for (const b of branches.rtm_roots) {
      allBranches.push({ label: b.name, value: b.name, category: 'RTM' });
    }

    for (const b of branches.rtm_clients) {
      allBranches.push({ label: b.name, value: b.name, category: 'RTM Client' });
    }
  }

  const filtered = filter.trim()
    ? allBranches.filter(
        (b) =>
          b.label.toLowerCase().includes(filter.toLowerCase()) ||
          b.category.toLowerCase().includes(filter.toLowerCase())
      )
    : allBranches;

  async function doSwitch(branchValue: string) {
    setSwitching(true);
    setSwitchError(null);
    try {
      await switchBranch(workspaceId, branchValue);
      // Modal stays open to show progress via WS events
    } catch (e: unknown) {
      setSwitchError(e instanceof Error ? e.message : String(e));
      setSwitching(false);
    }
  }

  const categoryColors: Record<string, string> = {
    'Trunk': '#4a9eff',
    'Work': '#4ade80',
    'RTM': '#fb923c',
    'RTM Client': '#a78bfa',
  };

  const isActive = switching || isSwitchingRemotely;

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isActive) onClose(); }}
    >
      <div
        style={{
          width: '520px', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: '12px', overflow: 'hidden',
          background: '#161b26',
          border: '1px solid #2a3144',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
          <div>
            <div className="font-semibold text-sm">Switch Branch</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {workspaceName} — current: <span className="font-mono">{currentBranch ?? '—'}</span>
            </div>
          </div>
          {!isActive && (
            <button
              onClick={onClose}
              className="text-sm px-2 py-1 rounded"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Progress view (while switching) */}
        {isActive && (
          <div className="flex-1 overflow-auto p-4">
            <div className="text-xs mb-2 font-medium" style={{ color: '#4ade80' }}>
              Switching branch... ({progress.length} lines)
            </div>
            <div
              className="font-mono text-xs rounded p-3 overflow-auto max-h-64"
              style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--color-text-secondary)' }}
            >
              {progress.length === 0 && (
                <span style={{ color: 'var(--color-text-muted)' }}>Waiting for SVN output...</span>
              )}
              {progress.map((p, i) => (
                <div key={i}>{p.line}</div>
              ))}
            </div>
          </div>
        )}

        {/* Branch picker (when not switching) */}
        {!isActive && (
          <>
            {/* Search */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
              <input
                autoFocus
                type="text"
                placeholder="Filter branches..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{
                  background: 'var(--color-surface-hover)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-surface-border)',
                }}
              />
            </div>

            {/* Error */}
            {switchError && (
              <div className="mx-4 mt-3 px-3 py-2 rounded text-xs" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                {switchError}
              </div>
            )}

            {/* Branch list */}
            <div className="flex-1 overflow-auto p-2">
              {branchesLoading && (
                <div className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                  Loading branches...
                </div>
              )}
              {!branchesLoading && filtered.length === 0 && (
                <div className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                  No branches found
                </div>
              )}
              {filtered.map((b) => {
                const catColor = categoryColors[b.category] ?? '#888';
                const isCurrent = currentBranch?.includes(b.value) || (b.value === 'Current' && currentBranch?.includes('/Current'));
                return (
                  <button
                    key={b.value}
                    onClick={() => doSwitch(b.value)}
                    disabled={isCurrent}
                    className="w-full text-left px-3 py-2 rounded flex items-center gap-3 transition-colors mb-0.5"
                    style={{
                      background: isCurrent ? 'rgba(255,255,255,0.05)' : 'transparent',
                      opacity: isCurrent ? 0.5 : 1,
                      cursor: isCurrent ? 'default' : 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
                      style={{ background: `${catColor}22`, color: catColor, minWidth: '64px', textAlign: 'center' }}
                    >
                      {b.category}
                    </span>
                    <span className="text-sm font-mono truncate">{b.label}</span>
                    {isCurrent && (
                      <span className="text-xs ml-auto shrink-0" style={{ color: 'var(--color-text-muted)' }}>current</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 flex justify-between items-center text-xs" style={{ borderTop: '1px solid var(--color-surface-border)', color: 'var(--color-text-muted)' }}>
              <span>{filtered.length} branch{filtered.length !== 1 ? 'es' : ''}</span>
              <button onClick={() => refreshBranches()} className="underline">Refresh</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
