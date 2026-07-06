"use client";

import { useState } from "react";
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
import { occursOn, tasksOnDate } from "@/lib/calendar";
import type { CalendarTask } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DayTimeline, TaskRow } from "./day-timeline";
import { TaskDialog } from "./task-dialog";

type View = "day" | "week" | "year";
type Partner = { id: string; display_name: string } | null;

const WD = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView({
  userId,
  partner,
  meName,
  today,
}: {
  userId: string;
  partner: Partner;
  meName: string;
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

  const monthYear = `${MONTHS_FULL[Number(selected.slice(5, 7)) - 1]} ${selected.slice(0, 4)}`;

  return (
    <div className="space-y-4 px-4 py-2">
      {/* Month + Today + Add */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{monthYear}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(today)}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
          >
            Today
          </button>
          <Button
            size="icon"
            className="size-11"
            aria-label="Add task"
            onClick={() =>
              setNewInitial({ task_date: view === "year" ? today : selected, owner_id: viewId })
            }
          >
            <Plus className="size-5" />
          </Button>
        </div>
      </div>

      {/* Whose calendar */}
      {partner ? (
        <div className="flex rounded-full bg-muted p-1 text-sm font-semibold">
          {(["you", "partner"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setWhose(v)}
              className={cn(
                "flex-1 rounded-full py-2 transition-colors",
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
              "flex-1 rounded-full py-2 capitalize transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Day strip (day & week) or year nav */}
      {view === "year" ? (
        <div className="flex items-center justify-center gap-6">
          <Button variant="ghost" size="icon" aria-label="Previous year" onClick={() => shift(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <span className="text-lg font-bold">{selected.slice(0, 4)}</span>
          <Button variant="ghost" size="icon" aria-label="Next year" onClick={() => shift(1)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setSelected((w) => addDays(w, -7))}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex flex-1 gap-1">
            {weekDatesIST(selected).map((d) => {
              const active = d === selected;
              const isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelected(d);
                    if (view === "week") setView("day");
                  }}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-accent/40",
                  )}
                >
                  <span className={cn("text-[10px] font-semibold", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {WD[dayOfWeekIST(d)]}
                  </span>
                  <span className={cn("text-base font-bold tabular-nums", isToday && !active && "text-primary")}>
                    {Number(d.slice(8))}
                  </span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setSelected((w) => addDays(w, 7))}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      )}

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
        meName={meName}
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
    <div className="space-y-5">
      {days.map((d) => {
        const items = tasksOnDate(tasks, d);
        return (
          <div key={d} className="space-y-2">
            <button
              type="button"
              onClick={() => onDayTap(d)}
              className="flex w-full items-center justify-between px-1"
            >
              <span className={cn("text-base font-bold", d === today && "text-primary")}>
                {formatDisplayDate(d)}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {items.length ? `${items.length} task${items.length > 1 ? "s" : ""}` : "Free"}
              </span>
            </button>
            {items.length ? (
              <div className="space-y-2">
                {items.map((t) => (
                  <TaskRow key={t.id} task={t} onTap={() => onTaskTap(t)} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                Nothing planned
              </div>
            )}
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
    <div className="space-y-6">
      {MONTHS_FULL.map((label, m) => {
        const mm = String(m + 1).padStart(2, "0");
        const first = `${year}-${mm}-01`;
        const daysIn = new Date(year, m + 1, 0).getDate();
        const lead = dayOfWeekIST(first);
        const cells: (string | null)[] = Array.from({ length: lead }, () => null);
        for (let d = 1; d <= daysIn; d++) {
          cells.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
        }
        return (
          <div key={m}>
            <p className="mb-2 text-lg font-bold">{label}</p>
            <div className="grid grid-cols-7 gap-1.5">
              {WD.map((w, i) => (
                <span key={i} className="pb-1 text-center text-[10px] font-medium text-muted-foreground">
                  {w}
                </span>
              ))}
              {cells.map((date, i) =>
                date ? (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onDayTap(date)}
                    className="flex aspect-square items-center justify-center"
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full text-sm",
                        date === today
                          ? "bg-primary font-bold text-primary-foreground"
                          : tasks.some((t) => occursOn(t, date))
                            ? "bg-primary/12 font-semibold text-primary"
                            : "font-medium text-foreground",
                      )}
                    >
                      {Number(date.slice(8))}
                    </span>
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
