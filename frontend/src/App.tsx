import { useEffect } from 'react';
import { useStore } from './store';
import { useWebSocket } from './ws/useWebSocket';
import { AgentCard } from './components/AgentCard';
import { SummaryCard } from './components/SummaryCard';
import { ActivityFeed } from './components/ActivityFeed';
import { TaskQueue } from './components/TaskQueue';

function App() {
  const workspaces = useStore((s) => s.workspaces);
  const tasks = useStore((s) => s.tasks);
  const mondayTasks = useStore((s) => s.mondayTasks);
  const refreshWorkspaces = useStore((s) => s.refreshWorkspaces);
  const refreshTasks = useStore((s) => s.refreshTasks);
  const selectedTab = useStore((s) => s.selectedTab);
  const setSelectedTab = useStore((s) => s.setSelectedTab);

  // Connect WebSocket
  useWebSocket();

  // Initial data load
  useEffect(() => {
    refreshWorkspaces();
    refreshTasks();
  }, [refreshWorkspaces, refreshTasks]);

  const freeCount = workspaces.filter((w) => w.status === 'available').length;

  // Find task for each workspace
  const getTaskForWorkspace = (wsId: string) =>
    tasks.find((t) => t.workspace_id === wsId) || null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      {/* Top Bar */}
      <header
        className="sticky top-0 z-50 px-6 py-3 flex items-center gap-6"
        style={{
          background: 'var(--color-surface-card)',
          borderBottom: '1px solid var(--color-surface-border)',
        }}
      >
        <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-accent)' }}>
          SPARK AGENT HUB
        </h1>
        <nav className="flex gap-1 ml-4">
          {(['dashboard', 'queue', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className="px-3 py-1.5 text-sm rounded cursor-pointer transition-colors"
              style={{
                backgroundColor: selectedTab === tab ? 'var(--color-surface-hover)' : 'transparent',
                color: selectedTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          localhost:8800
        </span>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6">
        {selectedTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Agent Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {workspaces.map((ws) => (
                <AgentCard
                  key={ws.id}
                  workspace={ws}
                  task={getTaskForWorkspace(ws.id)}
                />
              ))}
              <SummaryCard
                freeCount={freeCount}
                totalWorkspaces={workspaces.length}
                activeTasks={tasks.length}
                mondayOpen={mondayTasks.length}
              />
            </div>

            {/* Activity Feed */}
            <ActivityFeed />
          </div>
        )}

        {selectedTab === 'queue' && <TaskQueue />}

        {selectedTab === 'history' && (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: 'var(--color-surface-card)' }}
          >
            <p style={{ color: 'var(--color-text-muted)' }}>
              History view — coming soon. Complete a task to see it here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
