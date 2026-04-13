import { useEffect, useRef } from 'react';
import { useStore } from '../store';

interface WSEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const addActivity = useStore((s) => s.addActivity);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const refreshTasks = useStore((s) => s.refreshTasks);
  const addSwitchLine = useStore((s) => s.addSwitchLine);
  const clearSwitchProgress = useStore((s) => s.clearSwitchProgress);

  useEffect(() => {
    let reconnectTimer: number;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
      };

      ws.onmessage = (evt) => {
        try {
          const event: WSEvent = JSON.parse(evt.data);
          handleEvent(event);
        } catch {
          console.warn('[WS] Failed to parse message', evt.data);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 2s...');
        reconnectTimer = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function handleEvent(event: WSEvent) {
      const { type, data } = event;

      switch (type) {
        case 'workspace_updated': {
          const wsId = data.workspace_id as string;
          if (wsId) {
            updateWorkspace(wsId, data);
            // If switch completed, clear the progress buffer
            if (data.status && data.status !== 'switching') {
              clearSwitchProgress(wsId);
            }
          }
          break;
        }

        case 'workspace_switch_progress':
          addSwitchLine({
            workspace_id: data.workspace_id as string,
            line: data.line as string,
            lines_seen: data.lines_seen as number,
          });
          break;

        case 'task_stage_changed':
          refreshTasks();
          addActivity({
            id: String(Date.now()),
            timestamp: event.timestamp,
            workspace_id: (data.workspace_id as string) || null,
            tt_number: (data.tt_number as string) || null,
            message: `TT${data.tt_number} → ${data.stage}`,
            stage: (data.stage as string) || null,
            event_type: 'stage_change',
          });
          break;

        case 'activity':
          addActivity({
            id: String(Date.now()),
            timestamp: event.timestamp,
            workspace_id: (data.workspace_id as string) || null,
            tt_number: (data.tt_number as string) || null,
            message: (data.message as string) || '',
            stage: null,
            event_type: (data.event_type as string) || 'info',
          });
          break;

        case 'checkpoint_reached':
          refreshTasks();
          break;

        case 'build_progress':
        case 'test_progress':
          refreshTasks();
          break;

        default:
          console.log('[WS] Unhandled event:', type, data);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [addActivity, updateWorkspace, refreshTasks, addSwitchLine, clearSwitchProgress]);
}
