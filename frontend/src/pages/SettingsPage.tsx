import { useState } from 'react';
import { Save } from 'lucide-react';
import { saveBridgeSettings } from '../api/client';
import { BridgeConfig } from '../types';

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
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
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
      if (authToken.trim()) {
        localStorage.setItem('m2m_token', authToken.trim());
      } else {
        localStorage.removeItem('m2m_token');
      }
      onSaved();
      setNotice({ ok: true, text: 'Bridge settings saved. MQTT connection refreshed if changed.' });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-3xl">
      <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
        <h1 className="text-lg font-bold">Bridge Settings (Zigbee2MQTT Compatible)</h1>
        <p className="text-xs text-base-content/70">
          Settings here can also be managed automatically from <strong>Sensio IoT &gt; Settings &gt; Plugins</strong> via WebSocket <code className="font-mono">/api</code>.
        </p>
      </div>

      {notice && (
        <div className={`alert text-xs ${notice.ok ? 'alert-success' : 'alert-error'}`}>
          <span>{notice.text}</span>
        </div>
      )}

      <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs space-y-3">
        <h2 className="font-semibold text-sm">MQTT Broker</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="form-control">
            <span className="label-text text-xs font-medium mb-1">MQTT Server URL</span>
            <input
              className="input input-sm input-bordered font-mono"
              value={mqttServer}
              onChange={(e) => setMqttServer(e.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs font-medium mb-1">Base Topic</span>
            <input
              className="input input-sm input-bordered font-mono"
              value={baseTopic}
              onChange={(e) => setBaseTopic(e.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs font-medium mb-1">MQTT Username</span>
            <input
              className="input input-sm input-bordered font-mono"
              value={mqttUser}
              onChange={(e) => setMqttUser(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs font-medium mb-1">MQTT Password</span>
            <input
              type="password"
              className="input input-sm input-bordered font-mono"
              value={mqttPassword}
              onChange={(e) => setMqttPassword(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs space-y-3">
        <h2 className="font-semibold text-sm">Availability & Advanced</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={availEnabled}
              onChange={(e) => setAvailEnabled(e.target.checked)}
            />
            <span className="label-text text-xs font-medium">Publish Per-Slave Availability</span>
          </label>
          <label className="form-control">
            <span className="label-text text-xs font-medium mb-1">Offline After Failures</span>
            <input
              type="number"
              min={1}
              max={20}
              className="input input-sm input-bordered tabular-nums"
              value={offlineAfter}
              onChange={(e) => setOfflineAfter(Number(e.target.value) || 2)}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs font-medium mb-1">Log Level</span>
            <select
              className="select select-sm select-bordered"
              value={logLevel}
              onChange={(e) =>
                setLogLevel(e.target.value as 'debug' | 'info' | 'warn' | 'error')
              }
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text text-xs font-medium mb-1">Last Seen Format</span>
            <select
              className="select select-sm select-bordered"
              value={lastSeen}
              onChange={(e) =>
                setLastSeen(e.target.value as 'disable' | 'ISO_8601' | 'epoch')
              }
            >
              <option value="ISO_8601">ISO_8601</option>
              <option value="epoch">epoch</option>
              <option value="disable">disable</option>
            </select>
          </label>
        </div>

        <label className="form-control pt-2">
          <span className="label-text text-xs font-medium mb-1">
            Client Browser Token (if frontend.auth_token is configured in YAML)
          </span>
          <input
            type="password"
            className="input input-sm input-bordered font-mono"
            placeholder="Optional WebSocket / API bearer token"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary btn-sm gap-1.5" disabled={saving}>
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
