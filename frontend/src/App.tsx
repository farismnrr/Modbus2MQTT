import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShell, type NavTab } from '@/components/shared';
import { useBridgeState, useTheme } from '@/hooks';
import {
  DeviceDetailPage,
  DevicesPage,
  HomePage,
  LogsPage,
  SettingsPage,
} from '@/pages';

const TAB_LABEL: Record<NavTab, string> = {
  home: 'Home',
  devices: 'Devices',
  settings: 'Settings',
  logs: 'Logs',
};

export function App() {
  const [tab, setTab] = useState<NavTab>('home');
  const [selectedIeee, setSelectedIeee] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { snapshot, wsConnected, logs, reloadSnapshot, restartBridge, clearLogs } = useBridgeState();

  const selectedDevice = snapshot?.devices.find((d) => d.ieee_address === selectedIeee);
  const breadcrumb = selectedDevice ? `Devices / ${selectedDevice.friendly_name}` : TAB_LABEL[tab];

  return (
    <AppShell
      activeTab={tab}
      breadcrumb={breadcrumb}
      deviceCount={snapshot?.devices.length ?? 0}
      logCount={logs.length}
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
      ) : tab === 'home' ? (
        <HomePage
          devices={snapshot.devices}
          states={snapshot.states}
          config={snapshot.config}
          mqttConnected={snapshot.mqtt_connected}
          wsConnected={wsConnected}
          logs={logs}
          onNavigate={(next) => {
            setSelectedIeee(null);
            setTab(next);
          }}
          onSelectDevice={(id) => {
            setTab('devices');
            setSelectedIeee(id);
          }}
        />
      ) : tab === 'devices' ? (
        <DevicesPage
          devices={snapshot.devices}
          states={snapshot.states}
          onSelectDevice={(id) => setSelectedIeee(id)}
          onDevicesChanged={() => void reloadSnapshot()}
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