import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  setDate,
  startOfMonth,
  subMonths,
} from "date-fns";

export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "MMM d, yyyy");
}

export function formatDateShort(isoDate: string): string {
  return format(parseISO(isoDate), "MMM d");
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function currentMonthRange(now = new Date()) {
  return { start: toISODate(startOfMonth(now)), end: toISODate(endOfMonth(now)) };
}

export function monthRange(monthsAgo: number, now = new Date()) {
  const target = subMonths(now, monthsAgo);
  return {
    start: toISODate(startOfMonth(target)),
    end: toISODate(endOfMonth(target)),
    label: format(target, "MMM"),
  };
}

export function daysUntil(isoDate: string, now = new Date()): number {
  return differenceInCalendarDays(parseISO(isoDate), now);
}

/**
 * Days until the next occurrence of a day-of-month (e.g. statement close on
 * the 15th). If today is past it this month, rolls to next month.
 */
export function daysUntilDayOfMonth(dayOfMonth: number, now = new Date()): number {
  let target = setDate(now, dayOfMonth);
  if (differenceInCalendarDays(target, now) < 0) {
    target = setDate(subMonths(now, -1), dayOfMonth);
  }
  return differenceInCalendarDays(target, now);
}
