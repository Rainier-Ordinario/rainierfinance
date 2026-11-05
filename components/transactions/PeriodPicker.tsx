"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactionYears } from "@/lib/hooks/useTransactions";
import {
  calendarPeriodOf,
  calendarPeriodRange,
  stepMonth,
  type CalendarPeriod,
} from "@/lib/utils/dates";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ALL = "all";
const CUSTOM = "custom";

/**
 * Year and month dropdowns (with previous/next month arrows) that set the
 * transactions page's date filter. A range set some other way (the Filters
 * panel, a dashboard link) shows as "Custom dates".
 */
export function PeriodPicker({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom?: string;
  dateTo?: string;
  onChange: (range: { dateFrom?: string; dateTo?: string }) => void;
}) {
  const years = useTransactionYears().data ?? [new Date().getFullYear()];
  const period = calendarPeriodOf(dateFrom, dateTo);
  const custom = !period && Boolean(dateFrom || dateTo);

  function pick(next: CalendarPeriod | null) {
    if (!next) {
      onChange({ dateFrom: undefined, dateTo: undefined });
      return;
    }
    const { from, to } = calendarPeriodRange(next);
    onChange({ dateFrom: from, dateTo: to });
  }

  const yearValue = custom ? CUSTOM : period ? String(period.year) : ALL;
  const monthValue = period?.month != null ? String(period.month) : ALL;
  const yearOptions =
    period && !years.includes(period.year) ? [period.year, ...years] : years;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Period">
      {period?.month != null && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => pick(stepMonth({ year: period.year, month: period.month! }, -1))}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      )}
      <Select
        value={monthValue}
        onValueChange={(v) =>
          pick({
            year: period?.year ?? new Date().getFullYear(),
            month: v === ALL ? null : Number(v),
          })
        }
      >
        <SelectTrigger className="w-36" aria-label="Month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{period ? "Whole year" : "All months"}</SelectItem>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={yearValue}
        onValueChange={(v) =>
          pick(v === ALL ? null : { year: Number(v), month: period?.month ?? null })
        }
      >
        <SelectTrigger className="w-32" aria-label="Year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All dates</SelectItem>
          {custom && (
            <SelectItem value={CUSTOM} disabled>
              Custom dates
            </SelectItem>
          )}
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period?.month != null && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next month"
          onClick={() => pick(stepMonth({ year: period.year, month: period.month! }, 1))}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
