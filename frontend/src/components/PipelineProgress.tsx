import { STAGE_ORDER, getStageIndex } from '../lib/agentColors';

const COMPACT_LABELS = ['Q', 'UND', 'PLN', 'PRP', 'IMP', 'BLD', 'TST', 'REV', 'DON'];

interface PipelineProgressProps {
  stage: string;
  color: string;
  compact?: boolean;
}

export function PipelineProgress({ stage, color, compact = false }: PipelineProgressProps) {
  const currentIndex = getStageIndex(stage);
  const isPaused = stage === 'paused';
  const isFailed = stage === 'failed';

  return (
    <div className="space-y-1">
      <div className="flex gap-0.5">
        {STAGE_ORDER.map((s, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          const barColor = isFailed && isCurrent
            ? 'var(--color-status-error)'
            : isPaused && isCurrent
            ? 'var(--color-status-warning)'
            : isComplete || isCurrent
            ? color
            : 'var(--color-surface-border)';

          return (
            <div
              key={s}
              className="h-1.5 flex-1 rounded-sm transition-colors"
              style={{
                backgroundColor: barColor,
                opacity: isComplete ? 1 : isCurrent ? 0.8 : 0.3,
              }}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="flex justify-between">
          {STAGE_ORDER.map((s, i) => (
            <span
              key={s}
              className="text-[9px] font-mono"
              style={{
                color: i <= currentIndex ? color : 'var(--color-text-muted)',
                opacity: i <= currentIndex ? 1 : 0.5,
              }}
            >
              {COMPACT_LABELS[i]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
