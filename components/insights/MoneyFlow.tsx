"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { LinkProps, NodeProps } from "recharts/types/chart/Sankey";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KIND_COLORS } from "@/components/dashboard/SpendingMixCard";
import { formatCAD, formatCADWhole } from "@/lib/utils/currency";
import { toISODate } from "@/lib/utils/dates";
import {
  KIND_LABELS,
  moneyFlow,
  PERIOD_LABELS,
  periodLabel,
  periodRange,
  type SpendingPeriod,
} from "@/lib/utils/spending";
import type { Category, Transaction } from "@/types";

// Not a status color: "saved" is a destination here, and must not share a
// hue with any spending group.
const SAVED_COLOR = "var(--chart-4)";
const SOURCE_COLOR = "var(--muted-foreground)";

interface FlowNodeData {
  name: string;
  amount: number;
  color: string;
}

/** Gap between nodes; at least the label's line height, so labels never collide. */
const NODE_PADDING = 16;

function FlowNode({ x, y, width, height, payload }: NodeProps) {
  const node = payload as unknown as FlowNodeData;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        fill={node.color}
      />
      <text
        x={x + width + 6}
        y={y + height / 2}
        dy="0.35em"
        fontSize={11}
        fill="var(--foreground)"
        stroke="var(--card)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {node.name}{" "}
        <tspan fill="var(--muted-foreground)">
          {formatCADWhole(node.amount)}
        </tspan>
      </text>
    </g>
  );
}

function FlowLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
}: LinkProps) {
  const target = payload.target as unknown as FlowNodeData;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={target.color}
      strokeOpacity={0.3}
      strokeWidth={Math.max(1, linkWidth)}
    />
  );
}

/**
 * Where income went: into fixed bills, essentials, and wants, each split
 * into its biggest categories, with what was left over saved.
 */
export function MoneyFlow({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const [period, setPeriod] = useState<SpendingPeriod>("last_month");

  const { flow, label } = useMemo(() => {
    const { from, to, months } = periodRange(period);
    return {
      flow: moneyFlow(transactions, categories, toISODate(from), toISODate(to)),
      label: periodLabel(from, to, months),
    };
  }, [transactions, categories, period]);

  const data = useMemo(() => {
    const deficit = flow.saved < 0;
    const nodes: FlowNodeData[] = [
      {
        name: deficit ? "Income + savings" : "Income",
        amount: deficit ? flow.spent : flow.income,
        color: SOURCE_COLOR,
      },
    ];
    const links: { source: number; target: number; value: number }[] = [];
    for (const g of flow.groups) {
      const groupIndex = nodes.length;
      nodes.push({
        name: KIND_LABELS[g.kind],
        amount: g.total,
        color: KIND_COLORS[g.kind],
      });
      links.push({ source: 0, target: groupIndex, value: g.total });
      for (const c of g.categories) {
        links.push({
          source: groupIndex,
          target: nodes.length,
          value: c.amount,
        });
        nodes.push({
          name: c.name,
          amount: c.amount,
          color:
            categories.find((cat) => cat.name === c.name)?.color ??
            KIND_COLORS[g.kind],
        });
      }
    }
    if (flow.saved > 0) {
      links.push({ source: 0, target: nodes.length, value: flow.saved });
      nodes.push({ name: "Saved", amount: flow.saved, color: SAVED_COLOR });
    }
    return { nodes, links };
  }, [flow, categories]);

  const shareOf = (amount: number) =>
    flow.income > 0 ? Math.round((amount / flow.income) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Where your income goes</CardTitle>
          <CardDescription>{label}</CardDescription>
        </div>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as SpendingPeriod)}
        >
          <SelectTrigger size="sm" className="w-32" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as SpendingPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {flow.income <= 0 && flow.spent <= 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No income or spending in this period.
          </p>
        ) : (
          <>
            {/* The legend doubles as the text version of the diagram. */}
            <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {flow.income > 0 && (
                <li className="text-muted-foreground">
                  Of{" "}
                  <span className="font-medium text-foreground">
                    {formatCADWhole(flow.income)}
                  </span>{" "}
                  income:
                </li>
              )}
              {flow.groups.map((g) => (
                <li key={g.kind} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: KIND_COLORS[g.kind] }}
                    aria-hidden
                  />
                  {KIND_LABELS[g.kind]}{" "}
                  <span className="text-numeric text-muted-foreground">
                    {formatCADWhole(g.total)}
                    {flow.income > 0 && ` · ${shareOf(g.total)}%`}
                  </span>
                </li>
              ))}
              {flow.saved > 0 ? (
                <li className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: SAVED_COLOR }}
                    aria-hidden
                  />
                  Saved{" "}
                  <span className="text-numeric text-muted-foreground">
                    {formatCADWhole(flow.saved)} · {shareOf(flow.saved)}%
                  </span>
                </li>
              ) : (
                <li className="text-destructive">
                  Spent {formatCADWhole(-flow.saved)} more than came in
                </li>
              )}
            </ul>
            <div className="overflow-x-auto">
              <div className="h-96 min-w-[560px]" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={data}
                    node={FlowNode}
                    link={FlowLink}
                    nodePadding={NODE_PADDING}
                    // "Saved" sits beside the spending groups, not out with
                    // the categories.
                    align="left"
                    nodeWidth={10}
                    margin={{ top: 8, right: 170, bottom: 8, left: 8 }}
                    iterations={64}
                  >
                    <Tooltip
                      formatter={(value) => formatCAD(Number(value))}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
