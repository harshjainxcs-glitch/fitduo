import { Sparkles } from "lucide-react";
import { todayIST } from "@/lib/utils/date";

const TIPS = [
  "Add a handful of greens to your next meal — tiny wins stack up. 🥗",
  "Hydrate first: a glass of water before each meal helps. 💧",
  "Move for 10 minutes today — future you says thanks. 🚶",
  "Protein with breakfast keeps you steady till lunch. 🍳",
  "Log it the moment you eat — consistency beats perfection. ✅",
  "A colorful plate is a healthy plate. Aim for three colors. 🌈",
  "Celebrate small streaks — they grow into big habits. 🔥",
  "Swap one snack for fruit today. Sweet and smart. 🍎",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deep-green motivational "coach" card (design ref). Rotates daily.
export function CoachCard() {
  const tip = TIPS[hash(todayIST()) % TIPS.length];
  return (
    <div className="relative overflow-hidden rounded-3xl bg-forest p-5 text-cream shadow-sm">
      <div className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-lime/20 blur-xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-lime-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-1">
          <span className="inline-flex rounded-full bg-lime/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-lime">
            Daily boost
          </span>
          <p className="text-sm font-medium leading-snug text-cream/90">{tip}</p>
        </div>
      </div>
    </div>
  );
}
