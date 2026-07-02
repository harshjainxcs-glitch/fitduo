// Curated, warm, never-shaming message bank keyed to context (PRD.md §4.9).
// Expanded in Prompt 1.14 (streaks, comebacks, achievements).

export type MotivationBucket =
  | "perfect"
  | "strong"
  | "midway"
  | "started"
  | "fresh";

export const MOTIVATION: Record<MotivationBucket, string[]> = {
  perfect: [
    "Perfect day. You showed up all the way today. 🌟",
    "100/100 — that's a masterpiece of a day. 💯",
    "Flawless. Your future self is grinning. ✨",
    "Chef's kiss. Nothing left on the table today. 👏",
    "Textbook day. This is what consistency looks like.",
  ],
  strong: [
    "So close to perfect — you're crushing it. 💪",
    "Strong day. Momentum is on your side.",
    "Nearly there — one more nudge and it's gold.",
    "Big effort today. You can almost taste 100.",
  ],
  midway: [
    "Halfway home. Keep the streak alive. 🔥",
    "Good rhythm today — stack another win.",
    "You're rolling. Little by little adds up.",
    "Solid progress. Finish what you started. 🙌",
  ],
  started: [
    "Nice start — every log counts. 🌱",
    "You're on the board. Keep going.",
    "First steps done. Build on it.",
    "Great — momentum begins with one tap.",
  ],
  fresh: [
    "Fresh day, blank canvas. Start with a sip of water. 💧",
    "Today's wide open — one small win to begin?",
    "Let's make today count, together.",
    "New day, new streak. What's the first move?",
  ],
};

export function getMotivationBucket(total: number): MotivationBucket {
  if (total >= 100) return "perfect";
  if (total >= 80) return "strong";
  if (total >= 40) return "midway";
  if (total > 0) return "started";
  return "fresh";
}

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Pure, stable-per-seed pick from the bucket matching `total`. */
export function pickMotivation(total: number, seed: string): string {
  const bucket = getMotivationBucket(total);
  const bank = MOTIVATION[bucket];
  return bank[hash(`${seed}-${bucket}`) % bank.length];
}
