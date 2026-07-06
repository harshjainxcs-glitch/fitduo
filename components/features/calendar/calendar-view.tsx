"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  dayOfWeekIST,
  formatDisplayDate,
  todayIST,
  weekDatesIST,
} from "@/lib/utils/date";
import { occursOn, primaryTag, tasksOnDate } from "@/lib/calendar";
import { formatTime } from "@/lib/utils/date";
import type { CalendarTask } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DayTimeline } from "./day-timeline";
import { TaskDialog } from "./task-dialog";

type View = "day" | "week" | "year";
type Partner = { id: string; display_name: string } | null;

const WD = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function CalendarView({
  userId,
  partner,
  today,
}: {
  userId: string;
  partner: Partner;
  today: string;
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("day");
  const [selected, setSelected] = useState(today);
  const [whose, setWhose] = useState<"you" | "partner">("you");
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const [newInitial, setNewInitial] = useState<{
    task_date: string;
    owner_id: string;
    start_time?: string | null;
  } | null>(null);

  const viewId = whose === "you" ? userId : (partner?.id ?? userId);

  const { data: tasks = [] } = useQuery({
    queryKey: ["calendar_tasks", viewId],
    queryFn: async (): Promise<CalendarTask[]> => {
      const { data, error } = await createClient()
        .from("calendar_tasks")
        .select("*")
        .eq("owner_id", viewId);
      if (error) throw error;
      return data;
    },
  });

  const closeDialog = () => {
    setEditingTask(null);
    setNewInitial(null);
  };
  const onSaved = () => {
    closeDialog();
    qc.invalidateQueries({ queryKey: ["calendar_tasks"] });
  };

  function shift(dir: 1 | -1) {
    if (view === "day") setSelected((d) => addDays(d, dir));
    else if (view === "week") setSelected((d) => addDays(d, dir * 7));
    else setSelected((d) => `${Number(d.slice(0, 4)) + dir}-01-01`);
  }

  const heading = useMemo(() => {
    if (view === "day") return formatDisplayDate(selected);
    if (view === "week") {
      const wd = weekDatesIST(selected);
      return `${formatDisplayDate(wd[0]).replace(/^\w+, /, "")} – ${formatDisplayDate(wd[6]).replace(/^\w+, /, "")}`;
    }
    return selected.slice(0, 4);
  }, [view, selected]);

  return (
    <div className="space-y-4 px-4 py-2">
      {/* Whose calendar */}
      {partner ? (
        <div className="flex rounded-full bg-muted p-1 text-sm font-semibold">
          {(["you", "partner"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setWhose(v)}
              className={cn(
                "flex-1 rounded-full py-1.5 transition-colors",
                whose === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {v === "you" ? "My calendar" : `${partner.display_name.split(" ")[0]}'s`}
            </button>
          ))}
        </div>
      ) : null}

      {/* View switch */}
      <div className="flex rounded-full bg-muted p-1 text-sm font-semibold">
        {(["day", "week", "year"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "flex-1 rounded-full py-1.5 capitalize transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Nav row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => shift(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <button
            type="button"
            onClick={() => setSelected(today)}
            className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground"
          >
            Today
          </button>
          <Button variant="ghost" size="icon" aria-label="Next" onClick={() => shift(1)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <p className="text-sm font-bold">{heading}</p>
        <Button
          size="icon"
          aria-label="Add task"
          onClick={() =>
            setNewInitial({ task_date: view === "year" ? today : selected, owner_id: viewId })
          }
        >
          <Plus className="size-5" />
        </Button>
      </div>

      {/* Views */}
      {view === "day" ? (
        <DayTimeline
          date={selected}
          tasks={tasks}
          onSlotTap={(start) =>
            setNewInitial({ task_date: selected, owner_id: viewId, start_time: start })
          }
          onTaskTap={setEditingTask}
        />
      ) : view === "week" ? (
        <WeekAgenda
          selected={selected}
          tasks={tasks}
          onDayTap={(d) => {
            setSelected(d);
            setView("day");
          }}
          onTaskTap={setEditingTask}
        />
      ) : (
        <YearGrid
          year={Number(selected.slice(0, 4))}
          tasks={tasks}
          onDayTap={(d) => {
            setSelected(d);
            setView("day");
          }}
        />
      )}

      <TaskDialog
        key={editingTask?.id ?? (newInitial ? `new-${newInitial.task_date}-${newInitial.start_time ?? ""}` : "none")}
        open={Boolean(editingTask || newInitial)}
        task={editingTask}
        initial={newInitial}
        userId={userId}
        partner={partner}
        onClose={closeDialog}
        onSaved={onSaved}
      />
    </div>
  );
}

function WeekAgenda({
  selected,
  tasks,
  onDayTap,
  onTaskTap,
}: {
  selected: string;
  tasks: CalendarTask[];
  onDayTap: (d: string) => void;
  onTaskTap: (t: CalendarTask) => void;
}) {
  const days = weekDatesIST(selected);
  const today = todayIST();
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const items = tasksOnDate(tasks, d);
        return (
          <div key={d} className="rounded-2xl border bg-card p-3">
            <button
              type="button"
              onClick={() => onDayTap(d)}
              className="mb-2 flex w-full items-center justify-between"
            >
              <span className={cn("text-sm font-bold", d === today && "text-primary")}>
                {formatDisplayDate(d)}
              </span>
              <span className="text-xs text-muted-foreground">
                {items.length ? `${items.length} task${items.length > 1 ? "s" : ""}` : "—"}
              </span>
            </button>
            {items.length ? (
              <ul className="space-y-1">
                {items.map((t) => {
                  const tag = primaryTag(t);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onTaskTap(t)}
                        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-accent/40"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", tag?.dot ?? "bg-primary")} />
                        <span className="w-12 shrink-0 text-[11px] text-muted-foreground">
                          {t.all_day || !t.start_time ? "All day" : formatTime(t.start_time)}
                        </span>
                        <span className={cn("truncate text-sm", t.done && "line-through opacity-60")}>
                          {t.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function YearGrid({
  year,
  tasks,
  onDayTap,
}: {
  year: number;
  tasks: CalendarTask[];
  onDayTap: (d: string) => void;
}) {
  const today = todayIST();
  return (
    <div className="grid grid-cols-2 gap-3">
      {MONTHS.map((label, m) => {
        const mm = String(m + 1).padStart(2, "0");
        const first = `${year}-${mm}-01`;
        const daysIn = new Date(year, m + 1, 0).getDate();
        const lead = dayOfWeekIST(first);
        const cells: (string | null)[] = Array.from({ length: lead }, () => null);
        for (let d = 1; d <= daysIn; d++) {
          cells.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
        }
        return (
          <div key={m} className="rounded-2xl border bg-card p-2">
            <p className="mb-1 px-1 text-xs font-bold">{label}</p>
            <div className="grid grid-cols-7 gap-0.5">
              {WD.map((w, i) => (
                <span key={i} className="text-center text-[8px] text-muted-foreground">
                  {w}
                </span>
              ))}
              {cells.map((date, i) =>
                date ? (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onDayTap(date)}
                    className={cn(
                      "relative aspect-square rounded-md text-[9px] leading-none",
                      date === today ? "bg-primary font-bold text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      {Number(date.slice(8))}
                    </span>
                    {tasks.some((t) => occursOn(t, date)) ? (
                      <span
                        className={cn(
                          "absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full",
                          date === today ? "bg-primary-foreground" : "bg-coral",
                        )}
                      />
                    ) : null}
                  </button>
                ) : (
                  <span key={`b-${i}`} />
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
