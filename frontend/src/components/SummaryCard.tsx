interface SummaryCardProps {
  freeCount: number;
  totalWorkspaces: number;
  activeTasks: number;
  mondayOpen: number;
}

export function SummaryCard({ freeCount, totalWorkspaces, activeTasks, mondayOpen }: SummaryCardProps) {
  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{
        background: 'var(--color-surface-card)',
        borderLeft: '4px solid var(--color-surface-border)',
      }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        Summary
      </h3>
      <div className="space-y-2">
        <SummaryRow label="Free agents" value={`${freeCount} / ${totalWorkspaces}`} color="var(--color-status-success)" />
        <SummaryRow label="Active tasks" value={String(activeTasks)} color="var(--color-status-info)" />
        <SummaryRow label="Monday open" value={String(mondayOpen)} color="var(--color-status-warning)" />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="text-sm font-semibold font-mono" style={{ color }}>{value}</span>
    </div>
  );
}
