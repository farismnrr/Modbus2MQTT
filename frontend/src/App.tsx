import { useCallback, useEffect, useState } from 'react';
import { fetchInitialSnapshot, openBridgeWebSocket } from './api/client';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { DevicesPage } from './pages/DevicesPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppSnapshot, DeviceRuntimeState, LogMessage } from './types';

export function App() {
  const [tab, setTab] = useState<NavTab>('devices');
  const [selectedIeee, setSelectedIeee] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [theme, setTheme] = useState<'corporate' | 'business'>(() => {
    const saved = localStorage.getItem('m2m_theme');
    return saved === 'business' ? 'business' : 'corporate';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('m2m_theme', theme);
  }, [theme]);

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
          const entry = payload as LogMessage;
          setLogs((prev) => [entry, ...prev].slice(0, 250));
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

  const handleRestartBridge = () => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('m2m_token') || '';
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${proto}//${window.location.host}/api${qs}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ topic: 'bridge/request/restart', payload: { transaction: Date.now() } }));
      setTimeout(() => ws.close(), 300);
    };
  };

  const selectedDevice = snapshot?.devices.find((d) => d.ieee_address === selectedIeee);

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-6">
      <Navbar
        activeTab={tab}
        onSelectTab={(next) => {
          setSelectedIeee(null);
          setTab(next);
        }}
        wsConnected={wsConnected}
        mqttConnected={snapshot?.mqtt_connected ?? false}
        baseTopic={snapshot?.config.mqtt.base_topic ?? 'modbus2mqtt'}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'corporate' ? 'business' : 'corporate'))}
        onRestartBridge={handleRestartBridge}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {!snapshot ? (
          <div className="flex items-center justify-center py-20">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : selectedDevice ? (
          <DeviceDetailPage
            key={selectedDevice.ieee_address}
            device={selectedDevice}
            state={snapshot.states[selectedDevice.ieee_address]}
            baseTopic={snapshot.config.mqtt.base_topic}
            onBack={() => setSelectedIeee(null)}
            onUpdated={() => void reloadSnapshot()}
          />
        ) : tab === 'devices' ? (
          <DevicesPage
            devices={snapshot.devices}
            states={snapshot.states}
            onSelectDevice={(id) => setSelectedIeee(id)}
            onDevicesChanged={() => void reloadSnapshot()}
          />
        ) : tab === 'dashboard' ? (
          <DashboardPage
            devices={snapshot.devices}
            states={snapshot.states}
            onSelectDevice={(id) => {
              setTab('devices');
              setSelectedIeee(id);
            }}
          />
        ) : tab === 'logs' ? (
          <LogsPage logs={logs} onClearLogs={() => setLogs([])} />
        ) : (
          <SettingsPage config={snapshot.config} onSaved={() => void reloadSnapshot()} />
        )}
      </main>
    </div>
  );
}
export default App;
