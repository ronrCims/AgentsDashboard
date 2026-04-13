const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ── Typed API functions ───────────────────────────────────────────

import type { Workspace, Task, MondayTask, HubInfo } from './types';

export const getWorkspaces = () => api.get<Workspace[]>('/workspaces');
export const getWorkspace = (id: string) => api.get<Workspace>(`/workspaces/${id}`);
export const refreshWorkspace = (id: string) => api.post<Workspace>(`/workspaces/${id}/refresh`);

export const getTasks = () => api.get<Task[]>('/tasks');
export const getTask = (tt: string) => api.get<Task>(`/tasks/${tt}`);
export const createTask = (tt: string, opts?: { workspace_id?: string; autonomy?: string; task_type?: string }) =>
  api.post<Task>('/tasks', { tt_number: tt, ...opts });
export const approveTask = (tt: string, proceed = true, feedback?: string) =>
  api.post<Task>(`/tasks/${tt}/approve`, { proceed, feedback });
export const sendMessage = (tt: string, content: string) =>
  api.post<Task>(`/tasks/${tt}/message`, { content });
export const cancelTask = (tt: string) => api.del<{ success: boolean }>(`/tasks/${tt}`);

export const getMondayTasks = (name = 'Ron') => api.get<MondayTask[]>(`/monday/my-tasks?name=${name}`);
export const getMondayOpen = () => api.get<MondayTask[]>('/monday/open');
export const getMondayTT = (tt: string) => api.get<MondayTask>(`/monday/${tt}`);

export const getHistory = (limit = 50) => api.get<{ total: number; items: Task[] }>(`/history?limit=${limit}`);
export const getHubInfo = () => api.get<HubInfo>('/info');
