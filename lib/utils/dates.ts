import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDate,
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

/** Long weekday heading, e.g. "Monday, July 6". */
export function formatDayHeading(isoDate: string): string {
  return format(parseISO(isoDate), "EEEE, MMMM d");
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

/** Human phrasing of a day count: "today", "tomorrow", "in 6 days". */
export function formatDaysUntil(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** setDate that can't overflow: day 31 in a 30-day month means the 30th. */
function setDayClamped(base: Date, dayOfMonth: number): Date {
  return setDate(base, Math.min(dayOfMonth, getDate(endOfMonth(base))));
}

/**
 * Days until the next occurrence of a day-of-month (e.g. statement close on
 * the 15th). If today is past it this month, rolls to next month. Days
 * 29–31 clamp to the last day of short months instead of overflowing.
 */
export function daysUntilDayOfMonth(dayOfMonth: number, now = new Date()): number {
  let target = setDayClamped(now, dayOfMonth);
  if (differenceInCalendarDays(target, now) < 0) {
    target = setDayClamped(addMonths(now, 1), dayOfMonth);
  }
  return differenceInCalendarDays(target, now);
}
