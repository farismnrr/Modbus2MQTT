import { useState } from 'react';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import { pollDeviceNow, setDeviceValue, updateDevice } from '@/api/client';
import {
  FormField,
  NoticeBanner,
  PageHeader,
  PointEditorModal,
  RpcEditorModal,
  SlaveConnectionFields,
  StatusBadge,
} from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { formatSlaveEndpoint } from '@/lib';
import type {
  DeviceRuntimeState,
  ModbusDeviceConfig,
  ModbusPointConfig,
  ModbusRpcConfig,
} from '@/types';
import { DeviceDiscoverySection } from './DeviceDiscoverySection';
import { DeviceExposesSection } from './DeviceExposesSection';
import { PointsTableCard, RpcsTableCard } from './DeviceRegistersSection';

interface DeviceDetailPageProps {
  device: ModbusDeviceConfig;
  state?: DeviceRuntimeState;
  baseTopic: string;
  onBack: () => void;
  onUpdated: () => void;
}

export function DeviceDetailPage({
  device,
  state,
  baseTopic,
  onBack,
  onUpdated,
}: DeviceDetailPageProps) {
  const [draft, setDraft] = useState<ModbusDeviceConfig>(() => structuredClone(device));
  const [editingPoint, setEditingPoint] = useState<ModbusPointConfig | 'new' | null>(null);
  const [editingRpc, setEditingRpc] = useState<ModbusRpcConfig | 'new' | null>(null);
  const saveAction = useAsyncAction();
  const pollAction = useAsyncAction();

  const persistDevice = (next: ModbusDeviceConfig) =>
    void saveAction.run(async () => {
      const saved = await updateDevice(device.ieee_address, next);
      setDraft(saved);
      onUpdated();
      return saved;
    }, 'Device configuration saved and published to bridge/devices.');

  const handlePollNow = () =>
    void pollAction.run(() => pollDeviceNow(device.ieee_address), 'Poll completed and published to MQTT.');

  const handleSetProperty = (key: string, val: unknown) =>
    void saveAction.run(
      () => setDeviceValue(device.ieee_address, { [key]: val }),
      `Executed /set {"${key}": ${JSON.stringify(val)}}`,
    );

  const avail = state?.availability ?? 'online';

  return (
    <div className="space-y-4">
      <PageHeader
        leading={
          <Button variant="outline" size="icon-sm" onClick={onBack} title="Back to slaves">
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        }
        title={
          <>
            <span>{draft.friendly_name}</span>
            <StatusBadge status={avail} />
            <Badge variant="mono">{draft.ieee_address}</Badge>
          </>
        }
        description={
          <span className="font-mono">
            {draft.connection.transport.toUpperCase()} · Unit {draft.connection.unit_id} ·{' '}
            {formatSlaveEndpoint(draft.connection)}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={handlePollNow} disabled={pollAction.pending}>
              <RefreshCw className={`w-3.5 h-3.5 ${pollAction.pending ? 'animate-spin' : ''}`} />
              Poll Now
            </Button>
            <Button onClick={() => persistDevice(draft)} disabled={saveAction.pending}>
              <Save className="w-3.5 h-3.5" />
              {saveAction.pending ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <NoticeBanner
        notice={saveAction.notice ?? pollAction.notice}
        onDismiss={() => {
          saveAction.clearNotice();
          pollAction.clearNotice();
        }}
      />

      <Tabs defaultValue="exposes">
        <TabsList>
          <TabsTrigger value="exposes">
            Exposes & State ({draft.points.length + draft.rpc_methods.length})
          </TabsTrigger>
          <TabsTrigger value="connection">Slave Connection</TabsTrigger>
          <TabsTrigger value="registers">Registers ({draft.points.length})</TabsTrigger>
          <TabsTrigger value="rpcs">RPCs ({draft.rpc_methods.length})</TabsTrigger>
          <TabsTrigger value="discovery">Discovery</TabsTrigger>
        </TabsList>

        <TabsContent value="exposes">
          <DeviceExposesSection device={draft} state={state} onSetProperty={handleSetProperty} />
        </TabsContent>

        <TabsContent value="connection">
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Friendly Name">
                  <Input
                    value={draft.friendly_name}
                    onChange={(e) => setDraft((d) => ({ ...d, friendly_name: e.target.value }))}
                  />
                </FormField>
                <FormField label="Vendor">
                  <Input
                    value={draft.vendor || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
                  />
                </FormField>
                <FormField label="Model">
                  <Input
                    value={draft.model || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                  />
                </FormField>
              </div>
              <SlaveConnectionFields
                connection={draft.connection}
                onChange={(connection) => setDraft((d) => ({ ...d, connection }))}
                showTestButton
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registers">
          <PointsTableCard
            points={draft.points}
            onAdd={() => setEditingPoint('new')}
            onEdit={(pt) => setEditingPoint(pt)}
            onDelete={(id) => {
              const updated = { ...draft, points: draft.points.filter((p) => p.id !== id) };
              setDraft(updated);
              persistDevice(updated);
            }}
          />
        </TabsContent>

        <TabsContent value="rpcs">
          <RpcsTableCard
            rpcs={draft.rpc_methods}
            onAdd={() => setEditingRpc('new')}
            onEdit={(rpc) => setEditingRpc(rpc)}
            onDelete={(id) => {
              const updated = { ...draft, rpc_methods: draft.rpc_methods.filter((r) => r.id !== id) };
              setDraft(updated);
              persistDevice(updated);
            }}
          />
        </TabsContent>

        <TabsContent value="discovery">
          <DeviceDiscoverySection baseTopic={baseTopic} device={draft} />
        </TabsContent>
      </Tabs>

      {editingPoint ? (
        <PointEditorModal
          connection={draft.connection}
          initial={editingPoint === 'new' ? undefined : editingPoint}
          onClose={() => setEditingPoint(null)}
          onSave={(saved) => {
            const exists = draft.points.some((p) => p.id === saved.id);
            const points = exists
              ? draft.points.map((p) => (p.id === saved.id ? saved : p))
              : [...draft.points, saved];
            const updated = { ...draft, points };
            setDraft(updated);
            setEditingPoint(null);
            persistDevice(updated);
          }}
        />
      ) : null}

      {editingRpc ? (
        <RpcEditorModal
          connection={draft.connection}
          initial={editingRpc === 'new' ? undefined : editingRpc}
          onClose={() => setEditingRpc(null)}
          onSave={(saved) => {
            const exists = draft.rpc_methods.some((r) => r.id === saved.id);
            const rpc_methods = exists
              ? draft.rpc_methods.map((r) => (r.id === saved.id ? saved : r))
              : [...draft.rpc_methods, saved];
            const updated = { ...draft, rpc_methods };
            setDraft(updated);
            setEditingRpc(null);
            persistDevice(updated);
          }}
        />
      ) : null}
    </div>
  );
}
