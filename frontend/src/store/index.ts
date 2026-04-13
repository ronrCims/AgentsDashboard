import { create } from 'zustand';
import type { Workspace, Task, MondayTask, ActivityEntry } from '../api/types';
import { getWorkspaces, getTasks, getMondayTasks } from '../api/client';

interface StoreState {
  // Workspaces
  workspaces: Workspace[];
  setWorkspaces: (ws: Workspace[]) => void;
  updateWorkspace: (id: string, partial: Record<string, unknown>) => void;
  refreshWorkspaces: () => Promise<void>;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  refreshTasks: () => Promise<void>;

  // Monday
  mondayTasks: MondayTask[];
  mondayLoading: boolean;
  refreshMonday: () => Promise<void>;

  // Activity feed
  activities: ActivityEntry[];
  addActivity: (entry: ActivityEntry) => void;

  // UI state
  selectedTab: 'dashboard' | 'queue' | 'history';
  setSelectedTab: (tab: 'dashboard' | 'queue' | 'history') => void;
}

export const useStore = create<StoreState>((set) => ({
  // Workspaces
  workspaces: [],
  setWorkspaces: (ws) => set({ workspaces: ws }),
  updateWorkspace: (id, partial) => set((state) => ({
    workspaces: state.workspaces.map((ws) =>
      ws.id === id ? { ...ws, ...partial } as Workspace : ws
    ),
  })),
  refreshWorkspaces: async () => {
    try {
      const ws = await getWorkspaces();
      set({ workspaces: ws });
    } catch (e) {
      console.error('Failed to refresh workspaces:', e);
    }
  },

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  refreshTasks: async () => {
    try {
      const tasks = await getTasks();
      set({ tasks });
    } catch (e) {
      console.error('Failed to refresh tasks:', e);
    }
  },

  // Monday
  mondayTasks: [],
  mondayLoading: false,
  refreshMonday: async () => {
    set({ mondayLoading: true });
    try {
      const tasks = await getMondayTasks();
      set({ mondayTasks: tasks, mondayLoading: false });
    } catch (e) {
      console.error('Failed to refresh Monday tasks:', e);
      set({ mondayLoading: false });
    }
  },

  // Activity
  activities: [],
  addActivity: (entry) => set((state) => ({
    activities: [entry, ...state.activities].slice(0, 200),
  })),

  // UI
  selectedTab: 'dashboard',
  setSelectedTab: (tab) => set({ selectedTab: tab }),
}));
