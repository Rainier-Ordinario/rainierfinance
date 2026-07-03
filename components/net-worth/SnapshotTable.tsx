"use client";

import { Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCAD, formatCADSigned } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { NetWorthSnapshot } from "@/types";

export function SnapshotTable({
  snapshots,
  onDelete,
}: {
  snapshots: NetWorthSnapshot[];
  onDelete: (snapshot: NetWorthSnapshot) => void;
}) {
  // newest first, with delta vs the previous (older) snapshot
  const rows = [...snapshots]
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
    .map((s, i, arr) => ({
      snapshot: s,
      delta:
        i < arr.length - 1
          ? Number(s.net_worth) - Number(arr[i + 1].net_worth)
          : null,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Snapshots</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Assets</TableHead>
              <TableHead className="text-right">Liabilities</TableHead>
              <TableHead className="text-right">Net worth</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="w-10" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ snapshot, delta }) => (
              <TableRow key={snapshot.id}>
                <TableCell>
                  {formatDate(snapshot.snapshot_date)}
                  {snapshot.notes && (
                    <p className="max-w-48 truncate text-xs text-muted-foreground">
                      {snapshot.notes}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-numeric text-right">
                  {formatCAD(Number(snapshot.total_assets))}
                </TableCell>
                <TableCell className="text-numeric text-right">
                  {formatCAD(Number(snapshot.total_liabilities))}
                </TableCell>
                <TableCell className="text-numeric text-right font-medium">
                  {formatCAD(Number(snapshot.net_worth))}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-numeric text-right",
                    delta === null
                      ? "text-muted-foreground"
                      : delta >= 0
                        ? "text-success"
                        : "text-destructive"
                  )}
                >
                  {delta === null ? "—" : formatCADSigned(delta)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(snapshot)}
                    aria-label={`Delete snapshot ${snapshot.snapshot_date}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
