import { describe, expect, it } from "vitest";
import {
  currentMonthRange,
  daysUntil,
  daysUntilDayOfMonth,
  formatDaysUntil,
  monthRange,
  toISODate,
} from "@/lib/utils/dates";

describe("daysUntilDayOfMonth", () => {
  it("counts days to a later day this month", () => {
    expect(daysUntilDayOfMonth(15, new Date(2026, 6, 10))).toBe(5);
  });

  it("rolls to next month when the day has passed", () => {
    // Jul 10 → Aug 5
    expect(daysUntilDayOfMonth(5, new Date(2026, 6, 10))).toBe(26);
  });

  it("returns 0 when today is the day", () => {
    expect(daysUntilDayOfMonth(15, new Date(2026, 6, 15))).toBe(0);
  });

  it("clamps day 31 to the last day of a 30-day month", () => {
    // June has 30 days: statement day 31 means June 30, not July 1
    expect(daysUntilDayOfMonth(31, new Date(2026, 5, 15))).toBe(15);
    expect(daysUntilDayOfMonth(31, new Date(2026, 5, 30))).toBe(0);
  });

  it("clamps day 30 to Feb 28 in a non-leap year", () => {
    expect(daysUntilDayOfMonth(30, new Date(2026, 1, 10))).toBe(18);
  });

  it("clamps when rolling into a short month", () => {
    // Jan 31 has passed on Feb 1? No — from Jan 31, day 31: today. From
    // Feb 1 asking for day 31 → Feb 28 (2026), 27 days away.
    expect(daysUntilDayOfMonth(31, new Date(2026, 1, 1))).toBe(27);
  });
});

describe("formatDaysUntil", () => {
  it("phrases day counts", () => {
    expect(formatDaysUntil(0)).toBe("today");
    expect(formatDaysUntil(1)).toBe("tomorrow");
    expect(formatDaysUntil(6)).toBe("in 6 days");
  });
});

describe("month ranges", () => {
  it("currentMonthRange spans the calendar month", () => {
    expect(currentMonthRange(new Date(2026, 6, 15))).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });

  it("monthRange goes back N months with a label", () => {
    expect(monthRange(1, new Date(2026, 6, 15))).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
      label: "Jun",
    });
  });
});

describe("toISODate / daysUntil", () => {
  it("round-trips a local date", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("daysUntil counts calendar days", () => {
    expect(daysUntil("2026-07-20", new Date(2026, 6, 15))).toBe(5);
  });
});
