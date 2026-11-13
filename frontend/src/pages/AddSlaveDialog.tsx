import { useState } from 'react';
import { createDevice } from '@/api/client';
import {
  FormField,
  NoticeBanner,
  SlaveConnectionFields,
} from '@/components/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { DEFAULT_SLAVE_CONNECTION } from '@/lib';
import type { SlaveConnectionConfig } from '@/types';

interface AddSlaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ieeeAddress: string) => void;
}

export function AddSlaveDialog({ open, onOpenChange, onCreated }: AddSlaveDialogProps) {
  const [friendlyName, setFriendlyName] = useState('');
  const [vendor, setVendor] = useState('Modbus');
  const [model, setModel] = useState('');
  const [conn, setConn] = useState<SlaveConnectionConfig>(DEFAULT_SLAVE_CONNECTION);
  const { pending, notice, run, clearNotice } = useAsyncAction();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendlyName.trim()) return;
    void run(async () => {
      const created = await createDevice({
        friendly_name: friendlyName.trim(),
        vendor: vendor.trim() || 'Modbus',
        model: model.trim() || undefined,
        connection: conn,
        points: [],
        rpc_methods: [],
      });
      setFriendlyName('');
      setModel('');
      onOpenChange(false);
      onCreated(created.ieee_address);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) clearNotice();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Modbus Slave</DialogTitle>
          <DialogDescription>
            Configure transport, network endpoint or serial bus, unit ID, and default byte/word order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Friendly Name *">
              <Input
                placeholder="e.g. Main Panel Meter"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Vendor">
              <Input placeholder="Schneider" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </FormField>
            <FormField label="Model">
              <Input placeholder="PM5110" value={model} onChange={(e) => setModel(e.target.value)} />
            </FormField>
          </div>

          <SlaveConnectionFields connection={conn} onChange={setConn} showTestButton />
          <NoticeBanner notice={notice} onDismiss={clearNotice} />

          <DialogFooter className="justify-end">
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating...' : 'Create & Configure'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
