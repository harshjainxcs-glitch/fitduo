import { describe, it, expect } from "vitest";
import {
  addDays,
  dayOfWeekIST,
  daysBetween,
  formatDisplayDate,
  formatTime,
  greeting,
  hourIST,
  todayIST,
  weekDatesIST,
  weekStartIST,
  weekdayLabel,
} from "./date";

// All tests assume APP_TZ defaults to Asia/Kolkata (UTC+5:30, no DST).

describe("todayIST", () => {
  it("shifts a UTC evening instant into the next IST day", () => {
    // 20:00Z + 5:30 = 01:30 IST next day.
    expect(todayIST(new Date("2026-07-02T20:00:00Z"))).toBe("2026-07-03");
  });

  it("keeps a UTC morning instant on the same IST day", () => {
    expect(todayIST(new Date("2026-07-02T10:00:00Z"))).toBe("2026-07-02");
  });

  it("handles a month boundary", () => {
    // 30 Jun 19:00Z -> 1 Jul 00:30 IST.
    expect(todayIST(new Date("2026-06-30T19:00:00Z"))).toBe("2026-07-01");
  });

  it("handles a year boundary", () => {
    // 31 Dec 20:00Z -> 1 Jan 01:30 IST.
    expect(todayIST(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
  });
});

describe("hourIST", () => {
  it("adds the +5:30 offset", () => {
    expect(hourIST(new Date("2026-07-02T03:00:00Z"))).toBe(8); // 08:30 IST
    expect(hourIST(new Date("2026-07-02T18:30:00Z"))).toBe(0); // 00:00 IST next day
  });
});

describe("dayOfWeekIST", () => {
  it("maps 0=Mon … 6=Sun", () => {
    // 2026-07-02 is a Thursday.
    expect(dayOfWeekIST("2026-07-02")).toBe(3);
    expect(weekdayLabel("2026-07-02")).toBe("Thursday");
    // Monday and Sunday of that week.
    expect(dayOfWeekIST("2026-06-29")).toBe(0);
    expect(dayOfWeekIST("2026-07-05")).toBe(6);
  });
});

describe("weekStartIST", () => {
  it("returns the Monday of the containing week", () => {
    expect(weekStartIST("2026-07-02")).toBe("2026-06-29"); // Thu -> Mon
    expect(weekStartIST("2026-06-29")).toBe("2026-06-29"); // Mon -> itself
    expect(weekStartIST("2026-07-05")).toBe("2026-06-29"); // Sun -> Mon
  });

  it("crosses a month boundary correctly", () => {
    expect(weekStartIST("2026-08-01")).toBe("2026-07-27"); // Sat 1 Aug -> Mon 27 Jul
  });
});

describe("weekDatesIST", () => {
  it("lists Mon…Sun for the week", () => {
    expect(weekDatesIST("2026-07-02")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
  });
});

describe("addDays / daysBetween", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28"); // 2026 not a leap year
  });

  it("crosses year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-06-29", "2026-07-05")).toBe(6);
    expect(daysBetween("2026-07-05", "2026-06-29")).toBe(-6);
  });
});

describe("formatTime", () => {
  it("formats 12-hour times with AM/PM", () => {
    expect(formatTime("07:30")).toBe("7:30 AM");
    expect(formatTime("13:05")).toBe("1:05 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("18:00:00")).toBe("6:00 PM");
  });
});

describe("greeting", () => {
  it("varies by IST time of day", () => {
    expect(greeting(new Date("2026-07-02T03:00:00Z"))).toBe("Good morning"); // 08:30
    expect(greeting(new Date("2026-07-02T09:00:00Z"))).toBe("Good afternoon"); // 14:30
    expect(greeting(new Date("2026-07-02T15:00:00Z"))).toBe("Good evening"); // 20:30
  });
});

describe("formatDisplayDate", () => {
  it("renders a readable label", () => {
    expect(formatDisplayDate("2026-07-02")).toBe("Thursday, 2 Jul");
  });
});
