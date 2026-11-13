import { useCallback, useEffect, useState } from 'react';
import { fetchInitialSnapshot, openBridgeWebSocket } from '@/api/client';
import { AppSnapshot, DeviceRuntimeState, LogMessage } from '@/types';

export function useBridgeState() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);

  const reloadSnapshot = useCallback(async () => {
    try {
      const data = await fetchInitialSnapshot();
      setSnapshot(data);
    } catch {
      // retry happens on next WS reconnect or manual refresh
    }
  }, []);

  useEffect(() => {
    void reloadSnapshot();
  }, [reloadSnapshot]);

  useEffect(() => {
    return openBridgeWebSocket(
      (topic, payload) => {
        if (topic === 'bridge/logging' && payload && typeof payload === 'object') {
          setLogs((prev) => [payload as LogMessage, ...prev].slice(0, 250));
          return;
        }
        if (topic === 'bridge/devices' || topic === 'bridge/info') {
          void reloadSnapshot();
          return;
        }
        if (topic.endsWith('/availability')) {
          const friendly = topic.slice(0, -'/availability'.length);
          const avail = (payload as { state?: 'online' | 'offline' })?.state ?? 'online';
          setSnapshot((prev) => {
            if (!prev) return prev;
            const target = prev.devices.find((d) => d.friendly_name === friendly);
            if (!target) return prev;
            const existing: DeviceRuntimeState = prev.states[target.ieee_address] ?? {
              ieee_address: target.ieee_address,
              availability: avail,
              values: {},
            };
            return {
              ...prev,
              states: {
                ...prev.states,
                [target.ieee_address]: { ...existing, availability: avail },
              },
            };
          });
          return;
        }

        if (!topic.startsWith('bridge/') && payload && typeof payload === 'object') {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const target = prev.devices.find((d) => d.friendly_name === topic);
            if (!target) return prev;
            const existing: DeviceRuntimeState = prev.states[target.ieee_address] ?? {
              ieee_address: target.ieee_address,
              availability: 'online',
              values: {},
            };
            return {
              ...prev,
              states: {
                ...prev.states,
                [target.ieee_address]: {
                  ...existing,
                  availability: 'online',
                  last_seen: new Date().toISOString(),
                  values: { ...existing.values, ...(payload as Record<string, unknown>) },
                },
              },
            };
          });
        }
      },
      (connected) => setWsConnected(connected),
    );
  }, [reloadSnapshot]);

  const restartBridge = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('m2m_token') || '';
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${proto}//${window.location.host}/api${qs}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ topic: 'bridge/request/restart', payload: { transaction: Date.now() } }));
      setTimeout(() => ws.close(), 300);
    };
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { snapshot, wsConnected, logs, reloadSnapshot, restartBridge, clearLogs };
}
