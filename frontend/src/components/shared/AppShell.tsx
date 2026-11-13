import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib';
import { NAV_ITEMS, SidebarNav, type NavTab } from './SidebarNav';

interface AppShellProps {
  activeTab: NavTab;
  breadcrumb?: string;
  deviceCount: number;
  logCount: number;
  onSelectTab: (tab: NavTab) => void;
  wsConnected: boolean;
  mqttConnected: boolean;
  baseTopic: string;
  onRestartBridge: () => void;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  breadcrumb,
  deviceCount,
  logCount,
  onSelectTab,
  wsConnected,
  mqttConnected,
  baseTopic,
  onRestartBridge,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const healthy = mqttConnected && wsConnected;

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside
        className={cn(
          'hidden md:flex shrink-0 sticky top-0 h-screen flex-col border-r border-border bg-card transition-[width] duration-150',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        <SidebarNav
          activeTab={activeTab}
          deviceCount={deviceCount}
          logCount={logCount}
          collapsed={collapsed}
          wsConnected={wsConnected}
          mqttConnected={mqttConnected}
          baseTopic={baseTopic}
          onSelectTab={handleSelect}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          onRestartBridge={onRestartBridge}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full border-r border-border bg-card shadow-lg">
            <SidebarNav
              activeTab={activeTab}
              deviceCount={deviceCount}
              logCount={logCount}
              collapsed={false}
              mobile
              wsConnected={wsConnected}
              mqttConnected={mqttConnected}
              baseTopic={baseTopic}
              onSelectTab={handleSelect}
              onCloseMobile={() => setMobileOpen(false)}
              onRestartBridge={onRestartBridge}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-6">
        <header className="sticky top-0 z-30 h-12 border-b border-border bg-card/85 backdrop-blur-md">
          <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden shrink-0"
                onClick={() => setMobileOpen(true)}
                aria-label="Open Menu"
              >
                <Menu className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium text-muted-foreground truncate">
                {breadcrumb ?? NAV_ITEMS.find((i) => i.id === activeTab)?.label ?? 'Home'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="mono" className="hidden lg:inline-flex max-w-[260px] truncate">
                {baseTopic}
              </Badge>
              <Badge
                variant={healthy ? 'success' : 'warning'}
                title={`WebSocket: ${wsConnected ? 'connected' : 'disconnected'} | MQTT: ${
                  mqttConnected ? 'connected' : 'disconnected'
                }`}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', healthy ? 'bg-emerald-500' : 'bg-amber-500')} />
                <span>{mqttConnected ? 'Online' : 'Offline'}</span>
              </Badge>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-md py-1.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
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