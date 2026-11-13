import {
  Cpu,
  Home,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
  ScrollText,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type { ThemeMode } from '@/hooks';
import { cn } from '@/lib';

export type NavTab = 'home' | 'devices' | 'settings' | 'logs';

export interface NavItem {
  id: NavTab;
  label: string;
  icon: typeof Home;
  section: 'primary' | 'system';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, section: 'primary' },
  { id: 'devices', label: 'Devices', icon: Cpu, section: 'primary' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'primary' },
  { id: 'logs', label: 'Logs', icon: ScrollText, section: 'system' },
];

interface SidebarNavProps {
  activeTab: NavTab;
  deviceCount: number;
  logCount: number;
  collapsed: boolean;
  mobile?: boolean;
  wsConnected: boolean;
  mqttConnected: boolean;
  baseTopic: string;
  theme: ThemeMode;
  onSelectTab: (tab: NavTab) => void;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
  onToggleTheme: () => void;
  onRestartBridge: () => void;
}

export function SidebarNav({
  activeTab,
  deviceCount,
  logCount,
  collapsed,
  mobile = false,
  wsConnected,
  mqttConnected,
  baseTopic,
  theme,
  onSelectTab,
  onToggleCollapse,
  onCloseMobile,
  onToggleTheme,
  onRestartBridge,
}: SidebarNavProps) {
  const healthy = mqttConnected && wsConnected;
  const compact = collapsed && !mobile;

  const badgeFor = (id: NavTab) => {
    if (id === 'devices' && deviceCount > 0) return deviceCount;
    if (id === 'logs' && logCount > 0) return logCount;
    return null;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer focus:outline-none"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-[11px] font-semibold">
            M2
          </span>
          {!compact && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-tight text-foreground truncate">
                Modbus2MQTT
              </div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">
                Z2M-compatible
              </div>
            </div>
          )}
        </button>

        {mobile ? (
          <Button variant="ghost" size="icon-sm" onClick={onCloseMobile} aria-label="Close Menu">
            <X className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapse}
            title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {compact ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {(['primary', 'system'] as const).map((section) => (
          <div
            key={section}
            className={cn('space-y-0.5', section === 'system' && 'pt-2.5 mt-2.5 border-t border-border')}
          >
            {NAV_ITEMS.filter((item) => item.section === section).map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              const count = badgeFor(id);
              return (
                <button
                  key={id}
                  type="button"
                  title={compact ? label : undefined}
                  onClick={() => onSelectTab(id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors cursor-pointer',
                    compact && 'justify-center px-0',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', active && 'text-primary')} />
                  {!compact && (
                    <>
                      <span className="flex-1 text-left truncate">{label}</span>
                      {count !== null && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2.5 space-y-2">
        {!compact ? (
          <div className="rounded-md border border-border bg-muted/35 px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', healthy ? 'bg-emerald-500' : 'bg-amber-500')} />
                {mqttConnected ? 'MQTT Online' : 'MQTT Offline'}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{wsConnected ? 'WS' : 'No WS'}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground truncate" title={baseTopic}>
              {baseTopic}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1" title={mqttConnected ? 'MQTT Online' : 'MQTT Offline'}>
            <span className={cn('h-2 w-2 rounded-full', healthy ? 'bg-emerald-500' : 'bg-amber-500')} />
          </div>
        )}

        <div className={cn('flex items-center gap-1', compact ? 'flex-col' : 'justify-between')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestartBridge}
            title="Restart Bridge"
            className={cn(compact ? 'w-8 px-0' : 'flex-1 justify-start text-xs')}
          >
            <RotateCw className="w-3.5 h-3.5" />
            {!compact && <span>Restart</span>}
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
    </div>
  );
}