import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShell, type NavTab } from '@/components/shared';
import { useBridgeState, useTheme } from '@/hooks';
import {
  DashboardPage,
  DeviceDetailPage,
  DevicesPage,
  LogsPage,
  SettingsPage,
} from '@/pages';

export function App() {
  const [tab, setTab] = useState<NavTab>('devices');
  const [selectedIeee, setSelectedIeee] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { snapshot, wsConnected, logs, reloadSnapshot, restartBridge, clearLogs } = useBridgeState();

  const selectedDevice = snapshot?.devices.find((d) => d.ieee_address === selectedIeee);

  return (
    <AppShell
      activeTab={tab}
      onSelectTab={(next) => {
        setSelectedIeee(null);
        setTab(next);
      }}
      wsConnected={wsConnected}
      mqttConnected={snapshot?.mqtt_connected ?? false}
      baseTopic={snapshot?.config.mqtt.base_topic ?? 'modbus2mqtt'}
      theme={theme}
      onToggleTheme={toggleTheme}
      onRestartBridge={restartBridge}
    >
      {!snapshot ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Connecting to bridge...
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
        <LogsPage logs={logs} onClearLogs={clearLogs} />
      ) : (
        <SettingsPage config={snapshot.config} onSaved={() => void reloadSnapshot()} />
      )}
    </AppShell>
  );
}

export default App;
