import { Activity, Cpu, LayoutDashboard, Moon, RotateCw, ScrollText, Settings, Sun } from 'lucide-react';

export type NavTab = 'devices' | 'dashboard' | 'logs' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  wsConnected: boolean;
  mqttConnected: boolean;
  baseTopic: string;
  theme: 'corporate' | 'business';
  onToggleTheme: () => void;
  onRestartBridge: () => void;
}

export function Navbar({
  activeTab,
  onSelectTab,
  wsConnected,
  mqttConnected,
  baseTopic,
  theme,
  onToggleTheme,
  onRestartBridge,
}: NavbarProps) {
  const navItems: Array<{ id: NavTab; label: string; icon: typeof Cpu }> = [
    { id: 'devices', label: 'Devices', icon: Cpu },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'logs', label: 'Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="navbar bg-base-100 border-b border-base-300 px-3 sm:px-6 sticky top-0 z-30 shadow-xs">
      <div className="navbar-start gap-2 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={() => onSelectTab('devices')}
          className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight text-left cursor-pointer"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-content font-mono text-sm">
            M2
          </span>
          <span className="truncate">Modbus2MQTT</span>
        </button>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`btn btn-sm gap-1.5 ${
                  active ? 'btn-primary' : 'btn-ghost text-base-content/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="navbar-end gap-2">
        <div className="hidden lg:flex items-center gap-2 text-xs text-base-content/70 mr-1">
          <span className="badge badge-outline font-mono">{baseTopic}</span>
        </div>

        <div
          className={`badge badge-sm gap-1.5 font-medium ${
            mqttConnected && wsConnected ? 'badge-success' : 'badge-warning'
          }`}
          title={`WebSocket: ${wsConnected ? 'connected' : 'disconnected'} | MQTT: ${
            mqttConnected ? 'connected' : 'disconnected'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span className="hidden sm:inline">
            {mqttConnected ? 'MQTT Online' : 'MQTT Offline'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRestartBridge}
          className="btn btn-ghost btn-sm btn-square"
          title="Restart Bridge"
          aria-label="Restart Bridge"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="btn btn-ghost btn-sm btn-square"
          title="Toggle Theme"
          aria-label="Toggle Theme"
        >
          {theme === 'corporate' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex justify-around py-1.5 z-40">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`btn btn-xs btn-ghost flex-col h-auto py-1 gap-0.5 ${
                active ? 'text-primary' : 'text-base-content/70'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
