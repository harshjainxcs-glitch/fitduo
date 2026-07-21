import { describe, expect, it } from "vitest";
import { groupPeriods, predictCycle, cycleCareMessage } from "@/lib/cycle";

describe("groupPeriods", () => {
  it("groups contiguous flow days into one period", () => {
    const p = groupPeriods(["2026-07-01", "2026-07-02", "2026-07-03"]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ start: "2026-07-01", end: "2026-07-03", length: 3 });
  });

  it("splits when there is a gap > 1 day", () => {
    const p = groupPeriods([
      "2026-06-01",
      "2026-06-02",
      "2026-06-29",
      "2026-06-30",
    ]);
    expect(p).toHaveLength(2);
    expect(p[0].start).toBe("2026-06-01");
    expect(p[1].start).toBe("2026-06-29");
  });
});

describe("predictCycle", () => {
  it("predicts the next period ~28 days after the last start with no history", () => {
    const pred = predictCycle(["2026-07-01", "2026-07-02"], "2026-07-10", 28, 5);
    expect(pred.avgCycleLength).toBe(28);
    expect(pred.nextStart).toBe("2026-07-29");
    expect(pred.ovulation).toBe("2026-07-15");
    expect(pred.isMenstruating).toBe(false);
    expect(pred.cycleDay).toBe(10);
  });

  it("computes the average cycle length from two logged periods", () => {
    const flow = [
      "2026-06-01",
      "2026-06-02",
      "2026-06-27", // 26 days later
      "2026-06-28",
    ];
    const pred = predictCycle(flow, "2026-06-30", 28, 5);
    expect(pred.avgCycleLength).toBe(26);
    expect(pred.nextStart).toBe("2026-07-23");
  });

  it("knows she is menstruating on a logged flow day", () => {
    const pred = predictCycle(
      ["2026-07-20", "2026-07-21"],
      "2026-07-21",
      28,
      5,
    );
    expect(pred.isMenstruating).toBe(true);
    expect(pred.periodDay).toBe(2);
    expect(pred.phase).toBe("menstrual");
  });
});

describe("cycleCareMessage", () => {
  it("gives a pain tip on the first days and always nudges meals", () => {
    const m = cycleCareMessage(0, "Harsh");
    expect(m.title).toContain("Harsh");
    expect(m.body.toLowerCase()).toContain("eat");
  });

  it("cheers on later days", () => {
    const m = cycleCareMessage(5, "Harsh");
    expect(m.body.toLowerCase()).toContain("eat");
  });
});
