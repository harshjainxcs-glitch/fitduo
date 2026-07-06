"use client";

import { Bell, Check, ChevronRight, Loader, Repeat, SkipForward } from "lucide-react";
import { primaryTag, tasksOnDate, timeToMinutes } from "@/lib/calendar";
import { formatTime } from "@/lib/utils/date";
import type { CalendarTask } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

function hourLabel(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

/** Medication-style task card — reused by the Day rail and Week agenda. */
export function TaskRow({
  task,
  onTap,
}: {
  task: CalendarTask;
  onTap: () => void;
}) {
  const tag = primaryTag(task);
  const settled = task.status === "done" || task.status === "skipped";
  const timeText =
    task.all_day || !task.start_time
      ? "All day"
      : `${formatTime(task.start_time)}${task.end_time ? `–${formatTime(task.end_time)}` : ""}`;
  const badge =
    task.status === "done"
      ? { label: "Done", cls: "bg-primary/10 text-primary", Icon: Check }
      : task.status === "in_progress"
        ? { label: "Active", cls: "bg-amber-500/15 text-amber-600", Icon: Loader }
        : task.status === "skipped"
          ? { label: "Skipped", cls: "bg-muted text-muted-foreground", Icon: SkipForward }
          : null;
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-l-[5px] bg-card p-3 text-left shadow-soft",
        tag?.block ?? "border-l-primary",
        settled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          tag?.tint ?? "bg-primary/10",
        )}
      >
        <span className={cn("size-2.5 rounded-full", tag?.dot ?? "bg-primary")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-bold", settled && "line-through")}>
          {task.title}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {timeText}
          {task.remind ? <Bell className="size-3" /> : null}
          {task.recurrence !== "none" ? <Repeat className="size-3" /> : null}
        </p>
      </div>
      {badge ? (
        <span className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", badge.cls)}>
          <badge.Icon className="size-3" /> {badge.label}
        </span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function DayTimeline({
  date,
  tasks,
  onSlotTap,
  onTaskTap,
}: {
  date: string;
  tasks: CalendarTask[];
  onSlotTap: (startTime: string) => void;
  onTaskTap: (task: CalendarTask) => void;
}) {
  const dayTasks = tasksOnDate(tasks, date);
  const allDay = dayTasks.filter((t) => t.all_day || !t.start_time);
  const timed = dayTasks.filter((t) => !t.all_day && t.start_time);

  const byHour = new Map<number, CalendarTask[]>();
  for (const t of timed) {
    const h = Math.floor((timeToMinutes(t.start_time) ?? 0) / 60);
    const arr = byHour.get(h) ?? [];
    arr.push(t);
    byHour.set(h, arr);
  }
  const eventHours = [...byHour.keys()];
  const minH = Math.min(6, ...eventHours);
  const maxH = Math.max(22, ...eventHours);
  const hours: number[] = [];
  for (let h = minH; h <= maxH; h++) hours.push(h);

  return (
    <div className="space-y-3">
      {allDay.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            All day
          </p>
          {allDay.map((t) => (
            <TaskRow key={t.id} task={t} onTap={() => onTaskTap(t)} />
          ))}
        </div>
      ) : null}

      <div>
        {hours.map((h) => {
          const items = byHour.get(h) ?? [];
          return (
            <div key={h} className="flex gap-3">
              <span className="w-14 shrink-0 pt-2 text-xs font-semibold text-muted-foreground">
                {hourLabel(h)}
              </span>
              <div className="flex-1 border-t border-border/70 py-1.5">
                {items.length === 0 ? (
                  <button
                    type="button"
                    aria-label={`Add task at ${hourLabel(h)}`}
                    onClick={() => onSlotTap(`${String(h).padStart(2, "0")}:00`)}
                    className="h-7 w-full rounded-xl transition-colors hover:bg-accent/40"
                  />
                ) : (
                  <div className="space-y-2">
                    {items.map((t) => (
                      <TaskRow key={t.id} task={t} onTap={() => onTaskTap(t)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
