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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-2 to-forest p-5 text-cream shadow-soft">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-lime ring-1 ring-white/15">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-1.5">
          <span className="inline-flex rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cream/80">
            Daily boost
          </span>
          <p className="text-[15px] font-medium leading-snug text-cream">{tip}</p>
        </div>
      </div>
    </div>
  );
}
