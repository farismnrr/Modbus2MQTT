import { useState } from 'react';
import { Save } from 'lucide-react';
import { saveBridgeSettings } from '@/api/client';
import { FormField, NoticeBanner, PageHeader } from '@/components/shared';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Switch } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import type { BridgeConfig } from '@/types';

interface SettingsPageProps {
  config: BridgeConfig;
  onSaved: () => void;
}

export function SettingsPage({ config, onSaved }: SettingsPageProps) {
  const [mqttServer, setMqttServer] = useState(config.mqtt.server);
  const [baseTopic, setBaseTopic] = useState(config.mqtt.base_topic);
  const [mqttUser, setMqttUser] = useState(config.mqtt.user || '');
  const [mqttPassword, setMqttPassword] = useState(config.mqtt.password || '');
  const [availEnabled, setAvailEnabled] = useState(config.availability.enabled);
  const [offlineAfter, setOfflineAfter] = useState(config.availability.offline_after_failures);
  const [logLevel, setLogLevel] = useState(config.advanced.log_level);
  const [lastSeen, setLastSeen] = useState(config.advanced.last_seen);
  const [authToken, setAuthToken] = useState(localStorage.getItem('m2m_token') || '');
  const { pending, notice, run, clearNotice } = useAsyncAction();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await saveBridgeSettings({
        mqtt: {
          server: mqttServer.trim(),
          base_topic: baseTopic.trim(),
          user: mqttUser.trim(),
          password: mqttPassword,
        },
        availability: {
          enabled: availEnabled,
          offline_after_failures: Number(offlineAfter) || 2,
        },
        advanced: {
          log_level: logLevel,
          last_seen: lastSeen,
        },
      });
      if (authToken.trim()) localStorage.setItem('m2m_token', authToken.trim());
      else localStorage.removeItem('m2m_token');
      onSaved();
    }, 'Bridge settings saved. MQTT connection refreshed if changed.');
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-3xl">
      <PageHeader
        title="Bridge Settings"
        description={
          <>
            Zigbee2MQTT-compatible configuration, also managed automatically from{' '}
            <span className="font-medium text-foreground">Sensio &gt; Settings &gt; Plugins</span>.
          </>
        }
        actions={
          <Button type="submit" disabled={pending}>
            <Save className="w-3.5 h-3.5" />
            {pending ? 'Saving...' : 'Save Settings'}
          </Button>
        }
      />

      <NoticeBanner notice={notice} onDismiss={clearNotice} />

      <Card>
        <CardHeader>
          <CardTitle>MQTT Broker</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="MQTT Server URL">
            <Input className="font-mono" value={mqttServer} onChange={(e) => setMqttServer(e.target.value)} required />
          </FormField>
          <FormField label="Base Topic">
            <Input className="font-mono" value={baseTopic} onChange={(e) => setBaseTopic(e.target.value)} required />
          </FormField>
          <FormField label="MQTT Username">
            <Input className="font-mono" value={mqttUser} onChange={(e) => setMqttUser(e.target.value)} />
          </FormField>
          <FormField label="MQTT Password">
            <Input
              type="password"
              className="font-mono"
              value={mqttPassword}
              onChange={(e) => setMqttPassword(e.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Availability & Runtime</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/35 px-3 py-2">
            <span className="text-xs font-medium text-foreground">Publish Per-Slave Availability</span>
            <Switch checked={availEnabled} onCheckedChange={setAvailEnabled} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Offline After Failures">
              <Input
                type="number"
                min={1}
                max={20}
                className="tabular-nums font-mono"
                value={offlineAfter}
                onChange={(e) => setOfflineAfter(Number(e.target.value) || 2)}
              />
            </FormField>
            <FormField label="Log Level">
              <Select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value as 'debug' | 'info' | 'warn' | 'error')}
              >
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </Select>
            </FormField>
            <FormField label="Last Seen Format">
              <Select
                value={lastSeen}
                onChange={(e) => setLastSeen(e.target.value as 'disable' | 'ISO_8601' | 'epoch')}
              >
                <option value="ISO_8601">ISO_8601</option>
                <option value="epoch">epoch</option>
                <option value="disable">disable</option>
              </Select>
            </FormField>
          </div>

          <FormField
            label="Client Browser Token"
            hint="Optional bearer token when frontend.auth_token is enabled in YAML."
          >
            <Input
              type="password"
              className="font-mono"
              placeholder="Optional WebSocket / API bearer token"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>
    </form>
  );
}
