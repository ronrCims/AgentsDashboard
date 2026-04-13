import type { Workspace, Task } from '../api/types';
import { getAgentHex, STAGE_LABELS, shortBranch } from '../lib/agentColors';
import { PipelineProgress } from './PipelineProgress';

interface AgentCardProps {
  workspace: Workspace;
  task: Task | null;
  onAssign?: () => void;
  onApprove?: () => void;
}

export function AgentCard({ workspace, task, onAssign, onApprove }: AgentCardProps) {
  const color = getAgentHex(workspace.color);
  const isIdle = !task && workspace.status === 'available';
  const needsApproval = task?.stage === 'planning' || task?.stage === 'review';

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--color-surface-card)',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: color }}
            />
            <span className="font-semibold text-sm" style={{ color }}>
              {workspace.display_name}
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded" style={{
            backgroundColor: isIdle ? 'var(--color-surface-hover)' : `${color}22`,
            color: isIdle ? 'var(--color-text-muted)' : color,
          }}>
            {isIdle ? 'IDLE' : STAGE_LABELS[task?.stage || ''] || workspace.status.toUpperCase()}
          </span>
        </div>

        {/* Task info */}
        {task ? (
          <div className="space-y-1">
            <div className="text-sm font-medium truncate">
              TT{task.tt_number}
              {task.title && <span className="text-text-secondary font-normal"> — {task.title}</span>}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {shortBranch(workspace.current_branch)}
            </div>
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No active task
          </div>
        )}

        {/* Pipeline progress */}
        {task && (
          <PipelineProgress stage={task.stage} color={color} compact />
        )}

        {/* Path */}
        <div className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
          {workspace.path}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {isIdle && (
            <button
              onClick={onAssign}
              className="text-xs px-3 py-1.5 rounded cursor-pointer transition-colors"
              style={{
                backgroundColor: `${color}22`,
                color: color,
                border: `1px solid ${color}44`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${color}44`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${color}22`)}
            >
              Assign TT
            </button>
          )}
          {needsApproval && (
            <button
              onClick={onApprove}
              className="text-xs px-3 py-1.5 rounded cursor-pointer font-medium"
              style={{
                backgroundColor: 'var(--color-status-success)',
                color: '#000',
              }}
            >
              Approve
            </button>
          )}
          {task && (
            <button
              className="text-xs px-3 py-1.5 rounded cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              Open VS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
