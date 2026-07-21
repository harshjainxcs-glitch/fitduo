// Menstrual cycle model + predictions (pure, unit-tested).
// Apple-Health-style: the user logs a flow level per day; we infer periods
// (contiguous flow days), then predict the next period, fertile window, and
// ovulation from the average cycle length.

import { addDays, daysBetween } from "@/lib/utils/date";

export type Flow = "spotting" | "light" | "medium" | "heavy";
export type CyclePhase = "menstrual" | "follicular" | "fertile" | "luteal";

export const FLOWS: { id: Flow; label: string; dots: number }[] = [
  { id: "spotting", label: "Spotting", dots: 1 },
  { id: "light", label: "Light", dots: 2 },
  { id: "medium", label: "Medium", dots: 3 },
  { id: "heavy", label: "Heavy", dots: 4 },
];

export const SYMPTOMS = [
  "Cramps",
  "Headache",
  "Bloating",
  "Fatigue",
  "Backache",
  "Nausea",
  "Tender breasts",
  "Acne",
  "Cravings",
  "Appetite",
  "Insomnia",
  "Dizziness",
] as const;

export const MOODS: { id: string; emoji: string; label: string }[] = [
  { id: "happy", emoji: "😊", label: "Happy" },
  { id: "calm", emoji: "😌", label: "Calm" },
  { id: "low", emoji: "😢", label: "Low" },
  { id: "irritable", emoji: "😤", label: "Irritable" },
  { id: "anxious", emoji: "😰", label: "Anxious" },
  { id: "sensitive", emoji: "🥺", label: "Sensitive" },
];

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: "Period",
  follicular: "Follicular",
  fertile: "Fertile window",
  luteal: "Luteal",
};

const clampCycle = (n: number) => Math.max(21, Math.min(40, Math.round(n)));

export interface Period {
  start: string;
  end: string;
  length: number;
}

/** Group logged flow days into contiguous periods (a gap > 1 day starts a new one). */
export function groupPeriods(flowDays: string[]): Period[] {
  const days = [...new Set(flowDays)].sort();
  const periods: Period[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const d of days) {
    if (start === null) {
      start = d;
      prev = d;
      continue;
    }
    if (daysBetween(prev as string, d) > 1) {
      periods.push({
        start,
        end: prev as string,
        length: daysBetween(start, prev as string) + 1,
      });
      start = d;
    }
    prev = d;
  }
  if (start !== null && prev !== null) {
    periods.push({ start, end: prev, length: daysBetween(start, prev) + 1 });
  }
  return periods;
}

export interface CyclePrediction {
  periods: Period[];
  lastStart: string | null;
  /** The period covering `today`, if she's menstruating now. */
  currentPeriod: Period | null;
  isMenstruating: boolean;
  /** 1-based day within the current period (1 = first day). */
  periodDay: number | null;
  avgCycleLength: number;
  avgPeriodLength: number;
  /** 1-based day within the current cycle. */
  cycleDay: number | null;
  nextStart: string | null;
  ovulation: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
  phase: CyclePhase | null;
  daysUntilNext: number | null;
}

/**
 * Predict cycle timing from logged flow days.
 * @param flowDays  ISO dates that have a period flow logged
 * @param today     the reference date (IST today)
 * @param settingCycle default cycle length when history is thin
 * @param settingPeriod default period length when history is thin
 */
export function predictCycle(
  flowDays: string[],
  today: string,
  settingCycle = 28,
  settingPeriod = 5,
): CyclePrediction {
  const periods = groupPeriods(flowDays);
  const last = periods[periods.length - 1] ?? null;
  const lastStart = last?.start ?? null;

  // Average cycle length from the gaps between consecutive period starts.
  const starts = periods.map((p) => p.start);
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    gaps.push(daysBetween(starts[i - 1], starts[i]));
  }
  const avgCycleLength = clampCycle(
    gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : settingCycle,
  );
  const avgPeriodLength =
    periods.length > 0
      ? Math.max(
          2,
          Math.round(
            periods.reduce((a, p) => a + p.length, 0) / periods.length,
          ),
        )
      : Math.max(2, settingPeriod);

  // Is she menstruating today? (today within, or adjacent to, the last period)
  let currentPeriod: Period | null = null;
  if (last) {
    const within = daysBetween(last.start, today) >= 0 && daysBetween(today, last.end) >= 0;
    // Ongoing period: last flow was yesterday/today and hasn't clearly ended.
    const ongoing =
      daysBetween(last.end, today) >= 0 &&
      daysBetween(last.end, today) <= 1 &&
      last.length < avgPeriodLength + 3;
    if (within || ongoing) currentPeriod = last;
  }
  const isMenstruating = currentPeriod !== null;
  const periodDay =
    currentPeriod !== null ? daysBetween(currentPeriod.start, today) + 1 : null;

  const cycleDay = lastStart !== null ? daysBetween(lastStart, today) + 1 : null;
  const nextStart = lastStart !== null ? addDays(lastStart, avgCycleLength) : null;
  const ovulation = nextStart !== null ? addDays(nextStart, -14) : null;
  const fertileStart = ovulation !== null ? addDays(ovulation, -5) : null;
  const fertileEnd = ovulation !== null ? addDays(ovulation, 1) : null;
  const daysUntilNext = nextStart !== null ? daysBetween(today, nextStart) : null;

  return {
    periods,
    lastStart,
    currentPeriod,
    isMenstruating,
    periodDay,
    avgCycleLength,
    avgPeriodLength,
    cycleDay,
    nextStart,
    ovulation,
    fertileStart,
    fertileEnd,
    phase: phaseFor(today, {
      currentPeriod,
      fertileStart,
      fertileEnd,
      ovulation,
      nextStart,
    }),
    daysUntilNext,
  };
}

function inRange(day: string, start: string | null, end: string | null) {
  return (
    start !== null &&
    end !== null &&
    daysBetween(start, day) >= 0 &&
    daysBetween(day, end) >= 0
  );
}

function phaseFor(
  day: string,
  p: {
    currentPeriod: Period | null;
    fertileStart: string | null;
    fertileEnd: string | null;
    ovulation: string | null;
    nextStart: string | null;
  },
): CyclePhase | null {
  if (p.currentPeriod && inRange(day, p.currentPeriod.start, p.currentPeriod.end)) {
    return "menstrual";
  }
  if (inRange(day, p.fertileStart, p.fertileEnd)) return "fertile";
  if (p.ovulation && daysBetween(day, p.ovulation) < 0) return "luteal";
  return "follicular";
}

/** Decorations for a single calendar cell. */
export interface DayMark {
  loggedFlow: boolean;
  predictedPeriod: boolean;
  fertile: boolean;
  ovulation: boolean;
}

/** Compute calendar decorations for a date from logged flow + prediction. */
export function markFor(
  day: string,
  loggedFlowDays: Set<string>,
  pred: CyclePrediction,
): DayMark {
  const predictedPeriod =
    pred.nextStart !== null &&
    inRange(day, pred.nextStart, addDays(pred.nextStart, pred.avgPeriodLength - 1)) &&
    !loggedFlowDays.has(day);
  return {
    loggedFlow: loggedFlowDays.has(day),
    predictedPeriod,
    fertile: inRange(day, pred.fertileStart, pred.fertileEnd),
    ovulation: pred.ovulation === day,
  };
}

// --- Caring messages (sent as gentle nudges "from her partner") ------------

const PAIN_TIPS = [
  "Try a warm heat pad on your lower belly — it really helps the cramps.",
  "Sip something warm (ginger or chamomile tea) and rest when you can.",
  "A little magnesium and staying hydrated eases the aching. I've got you.",
  "Curl up, breathe slow, maybe a warm bath. Be gentle with yourself today.",
];

const CHEER = [
  "You're doing amazing. I'm right here with you 💛",
  "Sending you the biggest hug. Lean on me today 🤗",
  "You're so strong — even on the tough days. Proud of you 💛",
  "Whatever you need today, I've got you. You're not alone 💛",
];

/** One caring message per period-day (day 0 = first day). Meal reminder always folded in. */
export function cycleCareMessage(
  dayIndex: number,
  partnerName: string,
): { title: string; body: string } {
  const meal = "Please eat something proper today — you need your strength, love.";
  if (dayIndex <= 2) {
    const tip = PAIN_TIPS[dayIndex % PAIN_TIPS.length];
    return {
      title: `${partnerName} 💛`,
      body: `${tip} And ${meal.charAt(0).toLowerCase()}${meal.slice(1)}`,
    };
  }
  const cheer = CHEER[dayIndex % CHEER.length];
  return { title: `${partnerName} 💛`, body: `${cheer} ${meal}` };
}

/** In-app pain-care tips shown on the first 3 days. */
export function painTips(): string[] {
  return [
    "Heat pad or a warm bottle on your lower belly for the cramps",
    "Warm ginger/chamomile tea and stay hydrated",
    "Magnesium-rich snacks (dark chocolate, bananas, nuts)",
    "Gentle stretching or a slow walk if you feel up to it",
    "Rest is productive too — let your body take it easy",
  ];
}
