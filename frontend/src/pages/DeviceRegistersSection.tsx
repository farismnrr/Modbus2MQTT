import { Edit3, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatFunctionCode, formatModifier } from '@/lib';
import type { ModbusPointConfig, ModbusRpcConfig } from '@/types';

interface PointsTableProps {
  points: ModbusPointConfig[];
  onAdd: () => void;
  onEdit: (pt: ModbusPointConfig) => void;
  onDelete: (id: string) => void;
}

export function PointsTableCard({ points, onAdd, onEdit, onDelete }: PointsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attributes & Timeseries Registers</CardTitle>
        <Button size="sm" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" />
          Add Register
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="border-0 rounded-none">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tag</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>FC</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scale</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Writable</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No registers mapped yet.
                </TableCell>
              </TableRow>
            ) : (
              points.map((pt) => (
                <TableRow key={pt.id}>
                  <TableCell className="font-mono font-medium text-foreground">{pt.tag}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{pt.kind}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatFunctionCode(pt.function_code)}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{pt.address}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{pt.data_type}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{formatModifier(pt)}</TableCell>
                  <TableCell className="text-muted-foreground">{pt.unit || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {pt.writable ? formatFunctionCode(pt.write_function ?? 6) : 'Read-only'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(pt)} title="Edit">
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-destructive"
                        onClick={() => onDelete(pt.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface RpcsTableProps {
  rpcs: ModbusRpcConfig[];
  onAdd: () => void;
  onEdit: (rpc: ModbusRpcConfig) => void;
  onDelete: (id: string) => void;
}

export function RpcsTableCard({ rpcs, onAdd, onEdit, onDelete }: RpcsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modbus RPC Commands</CardTitle>
        <Button size="sm" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" />
          Add RPC
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="border-0 rounded-none">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Method</TableHead>
              <TableHead>FC</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Objects</TableHead>
              <TableHead>Data Type</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rpcs.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No RPC methods defined yet.
                </TableCell>
              </TableRow>
            ) : (
              rpcs.map((rpc) => (
                <TableRow key={rpc.id}>
                  <TableCell className="font-mono font-medium text-foreground">{rpc.method}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatFunctionCode(rpc.function_code)}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{rpc.address}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{rpc.objects_count}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{rpc.data_type}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(rpc)} title="Edit">
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-destructive"
                        onClick={() => onDelete(rpc.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
