import type { ReactNode } from 'react';
import { Cpu, LayoutDashboard, Moon, RotateCw, ScrollText, Settings, Sun } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import type { ThemeMode } from '@/hooks';
import { cn } from '@/lib';

export type NavTab = 'devices' | 'dashboard' | 'logs' | 'settings';

interface AppShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  wsConnected: boolean;
  mqttConnected: boolean;
  baseTopic: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onRestartBridge: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof Cpu }> = [
  { id: 'devices', label: 'Devices', icon: Cpu },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({
  activeTab,
  onSelectTab,
  wsConnected,
  mqttConnected,
  baseTopic,
  theme,
  onToggleTheme,
  onRestartBridge,
  children,
}: AppShellProps) {
  const healthy = mqttConnected && wsConnected;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-16 md:pb-8">
      <header className="sticky top-0 z-30 h-12 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => onSelectTab('devices')}
              className="flex items-center gap-2 text-left cursor-pointer group focus:outline-none"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-[11px] font-semibold">
                M2
              </span>
              <span className="text-[13px] font-semibold tracking-tight text-foreground">
                Modbus2MQTT
              </span>
            </button>

            <nav className="hidden md:flex items-center gap-0.5 border-l border-border pl-3">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTab(id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5', active && 'text-primary')} />
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="mono" className="hidden lg:inline-flex max-w-[260px] truncate">
              {baseTopic}
            </Badge>

            <Badge
              variant={healthy ? 'success' : 'warning'}
              title={`WebSocket: ${wsConnected ? 'connected' : 'disconnected'} | MQTT: ${
                mqttConnected ? 'connected' : 'disconnected'
              }`}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  healthy ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
              <span className="hidden sm:inline">{mqttConnected ? 'MQTT Online' : 'MQTT Offline'}</span>
            </Badge>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRestartBridge}
              title="Restart Bridge"
              aria-label="Restart Bridge"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleTheme}
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">{children}</main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-md py-1.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
