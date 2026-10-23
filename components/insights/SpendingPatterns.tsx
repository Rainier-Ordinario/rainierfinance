"use client";

import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCAD, formatCADWhole } from "@/lib/utils/currency";
import {
  foodSplit,
  SMALL_PURCHASE_LIMIT,
  smallPurchases,
  weekdayPattern,
} from "@/lib/utils/spending";
import type { Category, Transaction } from "@/types";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

/** One habit: a sentence that says what the chart shows, then the chart. */
function Panel({
  title,
  headline,
  children,
}: {
  title: string;
  headline: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <p className="mt-1 min-h-10 text-sm">{headline}</p>
      <div className="mt-3 h-32">{children}</div>
    </section>
  );
}

function MiniBars<T extends { label: string; partial?: boolean }>({
  data,
  dataKey,
  color,
  tooltip,
}: {
  data: T[];
  dataKey: string;
  color: string;
  tooltip: (row: T) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap={4}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          height={18}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(_, __, item) => [tooltip(item.payload as T), null]}
          labelFormatter={(label, payload) =>
            payload?.[0]?.payload?.partial ? `${label} (so far)` : label
          }
        />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((row) => (
            <Cell
              key={row.label}
              fill={color}
              fillOpacity={row.partial ? 0.4 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Habits hiding in the transaction list: which days wants get bought, how
 * many small purchases add up, and how much food money goes to delivery.
 */
export function SpendingPatterns({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const weekdays = useMemo(
    () => weekdayPattern(transactions, categories),
    [transactions, categories]
  );
  const small = useMemo(
    () => smallPurchases(transactions, categories),
    [transactions, categories]
  );
  const food = useMemo(() => foodSplit(transactions), [transactions]);

  const lastMonthSmall = small.at(-2);
  const lastMonthFood = food.at(-2);
  const ratio =
    weekdays.weekdayAverage > 0
      ? weekdays.weekendAverage / weekdays.weekdayAverage
      : null;
  const busiest = [...weekdays.days].sort((a, b) => b.average - a.average)[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Habits</CardTitle>
        <CardDescription>
          Patterns in your discretionary spending that a monthly total hides
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-3">
        <Panel
          title="By day of week"
          headline={
            busiest.average === 0 ? (
              "No discretionary spending in the last 12 weeks."
            ) : ratio !== null && ratio >= 1.3 ? (
              <>
                A weekend day costs{" "}
                <span className="font-medium">{ratio.toFixed(1)}×</span> a
                weekday ({formatCADWhole(weekdays.weekendAverage)} vs{" "}
                {formatCADWhole(weekdays.weekdayAverage)}).
              </>
            ) : (
              <>
                {busiest.day}s are your biggest day for wants, about{" "}
                <span className="font-medium">
                  {formatCADWhole(busiest.average)}
                </span>
                .
              </>
            )
          }
        >
          <MiniBars
            data={weekdays.days.map((d) => ({ ...d, label: d.day }))}
            dataKey="average"
            color="var(--chart-1)"
            tooltip={(d) => `${formatCAD(d.average)} average`}
          />
        </Panel>

        <Panel
          title={`Purchases under $${SMALL_PURCHASE_LIMIT}`}
          headline={
            lastMonthSmall && lastMonthSmall.count > 0 ? (
              <>
                <span className="font-medium">
                  {lastMonthSmall.count} small purchases
                </span>{" "}
                last month added up to{" "}
                <span className="font-medium">
                  {formatCADWhole(lastMonthSmall.total)}
                </span>
                .
              </>
            ) : (
              "No small purchases last month."
            )
          }
        >
          <MiniBars
            data={small}
            dataKey="count"
            color="var(--chart-4)"
            tooltip={(m) => `${m.count} purchases · ${formatCAD(m.total)}`}
          />
        </Panel>

        <Panel
          title="Delivery share of food"
          headline={
            lastMonthFood?.deliveryShare != null ? (
              <>
                <span className="font-medium">
                  {Math.round(lastMonthFood.deliveryShare)}%
                </span>{" "}
                of food money went to delivery last month (
                {formatCADWhole(lastMonthFood.delivery)} of{" "}
                {formatCADWhole(
                  lastMonthFood.groceries +
                    lastMonthFood.dining +
                    lastMonthFood.delivery
                )}
                ).
              </>
            ) : (
              "No food spending last month."
            )
          }
        >
          <MiniBars
            data={food.map((m) => ({ ...m, share: m.deliveryShare ?? 0 }))}
            dataKey="share"
            color="var(--chart-3)"
            tooltip={(m) =>
              m.deliveryShare === null
                ? "No food spending"
                : `${Math.round(m.deliveryShare)}% delivery · groceries ${formatCADWhole(m.groceries)}, dining ${formatCADWhole(m.dining)}, delivery ${formatCADWhole(m.delivery)}`
            }
          />
        </Panel>
      </CardContent>
    </Card>
  );
}
