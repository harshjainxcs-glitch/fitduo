"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Heart, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  dayOfWeekIST,
  daysBetween,
  formatDisplayDate,
  todayIST,
} from "@/lib/utils/date";
import {
  FLOWS,
  MOODS,
  PHASE_LABEL,
  SYMPTOMS,
  markFor,
  painTips,
  predictCycle,
  type Flow,
} from "@/lib/cycle";
import type { CycleDay, Profile, WorkoutLog } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const WD = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Mode = "own" | "partner";

export function CycleView({
  viewerId,
  subject,
  mode,
  subjectName,
  supporterName,
}: {
  viewerId: string;
  subject: Profile;
  mode: Mode;
  subjectName: string;
  supporterName: string;
}) {
  const qc = useQueryClient();
  const today = todayIST();
  const own = mode === "own";
  const [month, setMonth] = useState(today.slice(0, 7)); // "yyyy-MM"
  const [logDate, setLogDate] = useState<string | null>(null);

  const { data: days = [] } = useQuery({
    queryKey: ["cycle_days", subject.id],
    queryFn: async (): Promise<CycleDay[]> => {
      const { data, error } = await createClient()
        .from("cycle_days")
        .select("*")
        .eq("user_id", subject.id)
        .gte("day", addDays(today, -400))
        .order("day");
      if (error) throw error;
      return data;
    },
  });

  const { data: todayWorkouts = [] } = useQuery({
    queryKey: ["workout_logs", viewerId, today],
    enabled: own,
    queryFn: async (): Promise<WorkoutLog[]> => {
      const { data, error } = await createClient()
        .from("workout_logs")
        .select("*")
        .eq("user_id", viewerId)
        .eq("log_date", today);
      if (error) throw error;
      return data;
    },
  });

  const flowDays = useMemo(
    () => days.filter((d) => d.flow).map((d) => d.day),
    [days],
  );
  const flowSet = useMemo(() => new Set(flowDays), [flowDays]);
  const byDay = useMemo(() => {
    const m = new Map<string, CycleDay>();
    for (const d of days) m.set(d.day, d);
    return m;
  }, [days]);

  const pred = useMemo(
    () =>
      predictCycle(
        flowDays,
        today,
        subject.cycle_avg_length,
        subject.cycle_period_length,
      ),
    [flowDays, today, subject.cycle_avg_length, subject.cycle_period_length],
  );

  const todayEntry = byDay.get(today);
  const movementClaimed = todayWorkouts.length > 0;

  async function setTodayFlow(flow: Flow | null) {
    const supabase = createClient();
    if (flow === null && !todayEntry) return;
    const { error } = await supabase
      .from("cycle_days")
      .upsert({ user_id: viewerId, day: today, flow }, { onConflict: "user_id,day" });
    if (error) toast.error("Couldn't save.");
    else qc.invalidateQueries({ queryKey: ["cycle_days", subject.id] });
  }

  async function claimMovement() {
    if (movementClaimed) return;
    const { error } = await createClient().from("workout_logs").insert({
      user_id: viewerId,
      log_date: today,
      type: "Period self-care",
      source: "cycle_selfcare",
      note: "Rest & self-care in lieu of a workout 💛",
    });
    if (error) {
      toast.error("Couldn't claim.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["workout_logs", viewerId, today] });
    qc.invalidateQueries({ queryKey: ["workout_logs"] });
    toast.success("Movement points claimed — rest up 💛");
  }

  return (
    <div className="space-y-5 px-4 py-2">
      <StatusHero pred={pred} own={own} subjectName={subjectName} />

      {/* Care (her) vs support (partner) */}
      {pred.isMenstruating ? (
        own ? (
          <CareCard
            supporterName={supporterName}
            periodDay={pred.periodDay ?? 1}
            movementClaimed={movementClaimed}
            onClaim={claimMovement}
          />
        ) : (
          <SupportCard subjectName={subjectName} periodDay={pred.periodDay ?? 1} />
        )
      ) : null}

      {/* Log today's flow (own only) */}
      {own ? (
        <section className="space-y-3 rounded-3xl border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">How are you today?</h2>
            <button
              type="button"
              className="text-xs font-semibold text-primary"
              onClick={() => setLogDate(today)}
            >
              Symptoms & mood
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <FlowChip
              label="None"
              active={!todayEntry?.flow}
              onClick={() => setTodayFlow(null)}
            />
            {FLOWS.map((f) => (
              <FlowChip
                key={f.id}
                label={f.label}
                dots={f.dots}
                active={todayEntry?.flow === f.id}
                onClick={() => setTodayFlow(f.id)}
              />
            ))}
          </div>
          {todayEntry && (todayEntry.symptoms.length > 0 || todayEntry.mood) ? (
            <p className="text-xs text-muted-foreground">
              {[
                todayEntry.mood
                  ? MOODS.find((m) => m.id === todayEntry.mood)?.emoji
                  : null,
                todayEntry.symptoms.join(", ") || null,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Month calendar */}
      <section className="space-y-3 rounded-3xl border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="flex size-8 items-center justify-center rounded-full hover:bg-accent"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-sm font-bold">{monthLabel(month)}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="flex size-8 items-center justify-center rounded-full hover:bg-accent"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <MonthGrid
          month={month}
          today={today}
          flowSet={flowSet}
          pred={pred}
          onTap={setLogDate}
        />
        <Legend />
      </section>

      <Insights pred={pred} logged={days.length} />

      <DayLogSheet
        viewerId={viewerId}
        subjectId={subject.id}
        date={logDate}
        existing={logDate ? byDay.get(logDate) : undefined}
        readOnly={!own}
        onClose={() => setLogDate(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cycle_days", subject.id] })}
      />
    </div>
  );
}

function StatusHero({
  pred,
  own,
  subjectName,
}: {
  pred: ReturnType<typeof predictCycle>;
  own: boolean;
  subjectName: string;
}) {
  const menstruating = pred.isMenstruating;
  const cycleDay = pred.cycleDay ?? 0;
  const frac = Math.min(1, cycleDay / pred.avgCycleLength);
  const who = own ? "You" : subjectName;

  return (
    <section
      className={cn(
        "space-y-3 rounded-3xl p-5 text-white shadow-float",
        menstruating
          ? "bg-gradient-to-br from-rose-500 to-rose-400"
          : "bg-gradient-to-br from-primary to-emerald-500",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
        {menstruating
          ? `Period · Day ${pred.periodDay}`
          : pred.phase
            ? PHASE_LABEL[pred.phase]
            : "Cycle"}
      </p>
      <h1 className="text-3xl font-extrabold leading-tight">
        {menstruating
          ? own
            ? "You're on your period 🌸"
            : `${subjectName} is on their period 🌸`
          : pred.daysUntilNext !== null
            ? pred.daysUntilNext <= 0
              ? `${who}${own ? "r" : "’s"} period is expected any day`
              : `${who}${own ? "r" : "’s"} period in ${pred.daysUntilNext} day${pred.daysUntilNext === 1 ? "" : "s"}`
            : "Log the first period to begin"}
      </h1>
      {pred.cycleDay !== null ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.round(frac * 100)}%` }}
            />
          </div>
          <p className="text-sm text-white/85">
            Day {cycleDay} of ~{pred.avgCycleLength} · avg period{" "}
            {pred.avgPeriodLength} days
          </p>
        </>
      ) : null}
    </section>
  );
}

function CareCard({
  supporterName,
  periodDay,
  movementClaimed,
  onClaim,
}: {
  supporterName: string;
  periodDay: number;
  movementClaimed: boolean;
  onClaim: () => void;
}) {
  const showTips = periodDay <= 3;
  return (
    <section className="space-y-3 rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/30">
      <div className="flex items-start gap-2">
        <Heart className="mt-0.5 size-5 shrink-0 fill-rose-500 text-rose-500" />
        <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
          {supporterName} is here for you 💛 Take it easy today — rest, warmth,
          and please eat well.
        </p>
      </div>

      {showTips ? (
        <ul className="space-y-1.5 rounded-2xl bg-white/70 p-3 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-100">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rose-500">
            Ease the pain
          </p>
          {painTips()
            .slice(0, 3)
            .map((t) => (
              <li key={t} className="flex gap-2">
                <span>•</span>
                <span>{t}</span>
              </li>
            ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onClaim}
        disabled={movementClaimed}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition",
          movementClaimed
            ? "bg-rose-200 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
            : "bg-rose-500 text-white active:scale-[0.98]",
        )}
      >
        <Sparkles className="size-4" />
        {movementClaimed
          ? "Movement points claimed 💛"
          : "Claim movement points with self-care"}
      </button>
      <p className="text-center text-xs text-rose-700/80 dark:text-rose-300/70">
        No workout needed while you&apos;re on your period — rest counts.
      </p>
    </section>
  );
}

function SupportCard({
  subjectName,
  periodDay,
}: {
  subjectName: string;
  periodDay: number;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/30">
      <div className="flex items-start gap-2">
        <Heart className="mt-0.5 size-5 shrink-0 fill-rose-500 text-rose-500" />
        <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
          {subjectName} is on Day {periodDay} of their period. Be extra gentle
          today — check in, remind them to eat, bring warmth 💛
        </p>
      </div>
      {periodDay <= 3 ? (
        <ul className="space-y-1.5 rounded-2xl bg-white/70 p-3 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-100">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rose-500">
            Ways to help
          </p>
          {painTips()
            .slice(0, 3)
            .map((t) => (
              <li key={t} className="flex gap-2">
                <span>•</span>
                <span>{t}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}

function MonthGrid({
  month,
  today,
  flowSet,
  pred,
  onTap,
}: {
  month: string;
  today: string;
  flowSet: Set<string>;
  pred: ReturnType<typeof predictCycle>;
  onTap: (d: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysIn = new Date(y, m, 0).getDate();
  const lead = dayOfWeekIST(first);
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysIn; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WD.map((w, i) => (
        <span
          key={i}
          className="pb-1 text-center text-[10px] font-medium text-muted-foreground"
        >
          {w}
        </span>
      ))}
      {cells.map((date, i) => {
        if (!date) return <span key={`b-${i}`} />;
        const mark = markFor(date, flowSet, pred);
        const isToday = date === today;
        const future = daysBetween(today, date) > 0;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onTap(date)}
            disabled={future}
            className="flex aspect-square items-center justify-center disabled:opacity-100"
          >
            <span
              className={cn(
                "relative flex size-9 items-center justify-center rounded-full text-sm transition-colors",
                mark.loggedFlow && "bg-rose-500 font-bold text-white",
                !mark.loggedFlow &&
                  mark.predictedPeriod &&
                  "border-2 border-dashed border-rose-300 font-semibold text-rose-500",
                !mark.loggedFlow &&
                  !mark.predictedPeriod &&
                  mark.fertile &&
                  "bg-sky-100 font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
                !mark.loggedFlow &&
                  !mark.predictedPeriod &&
                  !mark.fertile &&
                  "text-foreground",
                future && "text-muted-foreground/50",
                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
            >
              {Number(date.slice(8))}
              {mark.ovulation ? (
                <span className="absolute -bottom-0.5 size-1.5 rounded-full bg-sky-500" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  const items = [
    { cls: "bg-rose-500", label: "Period" },
    { cls: "border-2 border-dashed border-rose-300", label: "Predicted" },
    { cls: "bg-sky-200", label: "Fertile" },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-3 rounded-full", it.cls)} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Insights({
  pred,
  logged,
}: {
  pred: ReturnType<typeof predictCycle>;
  logged: number;
}) {
  const stats = [
    { label: "Avg cycle", value: `${pred.avgCycleLength} days` },
    { label: "Avg period", value: `${pred.avgPeriodLength} days` },
    {
      label: "Last period",
      value: pred.lastStart ? formatShort(pred.lastStart) : "—",
    },
    { label: "Days logged", value: String(logged) },
  ];
  return (
    <section className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="text-lg font-bold">{s.value}</p>
        </div>
      ))}
    </section>
  );
}

function DayLogSheet({
  viewerId,
  subjectId,
  date,
  existing,
  readOnly,
  onClose,
  onSaved,
}: {
  viewerId: string;
  subjectId: string;
  date: string | null;
  existing: CycleDay | undefined;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={date !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-3xl">
        {date ? (
          readOnly ? (
            <ReadOnlyDay date={date} entry={existing} subjectId={subjectId} />
          ) : (
            <DayLogForm
              key={date}
              userId={viewerId}
              date={date}
              existing={existing}
              onClose={onClose}
              onSaved={onSaved}
            />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ReadOnlyDay({
  date,
  entry,
  subjectId,
}: {
  date: string;
  entry: CycleDay | undefined;
  subjectId: string;
}) {
  void subjectId;
  const flow = entry?.flow ? FLOWS.find((f) => f.id === entry.flow) : null;
  const mood = entry?.mood ? MOODS.find((m) => m.id === entry.mood) : null;
  const hasAny = entry && (entry.flow || entry.symptoms.length || entry.mood || entry.note);
  return (
    <>
      <SheetHeader>
        <SheetTitle>{formatDisplayDate(date)}</SheetTitle>
      </SheetHeader>
      <div className="space-y-4 px-4 py-2">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">Nothing logged this day.</p>
        ) : (
          <>
            {flow ? (
              <Row label="Flow" value={flow.label} />
            ) : null}
            {mood ? (
              <Row label="Mood" value={`${mood.emoji} ${mood.label}`} />
            ) : null}
            {entry && entry.symptoms.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Symptoms</p>
                <div className="flex flex-wrap gap-2">
                  {entry.symptoms.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {entry?.note ? <Row label="Note" value={entry.note} /> : null}
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function DayLogForm({
  userId,
  date,
  existing,
  onClose,
  onSaved,
}: {
  userId: string;
  date: string;
  existing: CycleDay | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [flow, setFlow] = useState<Flow | null>((existing?.flow as Flow) ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [busy, setBusy] = useState(false);

  function toggleSymptom(s: string) {
    setSymptoms((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }

  async function save() {
    setBusy(true);
    const { error } = await createClient()
      .from("cycle_days")
      .upsert(
        {
          user_id: userId,
          day: date,
          flow,
          symptoms,
          mood,
          note: note.trim() || null,
        },
        { onConflict: "user_id,day" },
      );
    setBusy(false);
    if (error) {
      toast.error("Couldn't save.");
      return;
    }
    onSaved();
    onClose();
  }

  async function clear() {
    setBusy(true);
    await createClient()
      .from("cycle_days")
      .delete()
      .eq("user_id", userId)
      .eq("day", date);
    setBusy(false);
    onSaved();
    onClose();
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{formatDisplayDate(date)}</SheetTitle>
      </SheetHeader>
      <div className="space-y-5 px-4 py-2">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Flow</p>
          <div className="grid grid-cols-5 gap-2">
            <FlowChip label="None" active={!flow} onClick={() => setFlow(null)} />
            {FLOWS.map((f) => (
              <FlowChip
                key={f.id}
                label={f.label}
                dots={f.dots}
                active={flow === f.id}
                onClick={() => setFlow(f.id)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Symptoms</p>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  symptoms.includes(s)
                    ? "border-rose-400 bg-rose-500 text-white"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Mood</p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((mo) => (
              <button
                key={mo.id}
                type="button"
                onClick={() => setMood(mood === mo.id ? null : mo.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  mood === mo.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <span className="text-base">{mo.emoji}</span>
                {mo.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Note</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything you want to remember…"
          />
        </label>
      </div>
      <SheetFooter className="gap-2">
        <Button onClick={save} disabled={busy} className="w-full rounded-full">
          {busy ? "Saving…" : "Save"}
        </Button>
        {existing ? (
          <Button
            onClick={clear}
            disabled={busy}
            variant="ghost"
            className="w-full rounded-full text-destructive"
          >
            <Trash2 className="mr-1 size-4" /> Clear this day
          </Button>
        ) : null}
      </SheetFooter>
    </>
  );
}

function FlowChip({
  label,
  dots,
  active,
  onClick,
}: {
  label: string;
  dots?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl border py-2 text-[11px] font-semibold transition-colors",
        active
          ? "border-rose-400 bg-rose-500 text-white"
          : "text-muted-foreground hover:bg-accent",
      )}
    >
      <span className="flex h-3 items-center gap-0.5">
        {dots
          ? Array.from({ length: dots }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full",
                  active ? "bg-white" : "bg-rose-400",
                )}
              />
            ))
          : "—"}
      </span>
      {label}
    </button>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function formatShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1].slice(0, 3)}`;
}
