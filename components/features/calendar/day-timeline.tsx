"use client";

import { useEffect, useRef } from "react";
import { Bell, Repeat } from "lucide-react";
import {
  DAY_HOURS,
  HOUR_HEIGHT,
  primaryTag,
  tasksOnDate,
  timeToMinutes,
} from "@/lib/calendar";
import { formatTime, minutesOfDayIST, todayIST } from "@/lib/utils/date";
import type { CalendarTask } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

function hourLabel(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayTasks = tasksOnDate(tasks, date);
  const allDay = dayTasks.filter((t) => t.all_day || !t.start_time);
  const timed = dayTasks.filter((t) => !t.all_day && t.start_time);

  const isToday = date === todayIST();
  const nowMin = isToday ? minutesOfDayIST() : -1;

  // Scroll to a sensible default (7am, or current hour) once.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = isToday ? Math.max(0, nowMin / 60 - 1) : 7;
    el.scrollTop = target * HOUR_HEIGHT;
    // run once on mount for this date
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="space-y-3">
      {allDay.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allDay.map((t) => {
            const tag = primaryTag(t);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTaskTap(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium",
                  t.done && "opacity-50 line-through",
                )}
              >
                {tag ? <span className={cn("size-2 rounded-full", tag.dot)} /> : null}
                {t.title}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="relative max-h-[62vh] overflow-y-auto rounded-3xl border bg-card"
      >
        <div className="relative" style={{ height: DAY_HOURS.length * HOUR_HEIGHT }}>
          {DAY_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onSlotTap(`${String(h).padStart(2, "0")}:00`)}
              className="absolute inset-x-0 flex items-start border-t border-border/60 text-left first:border-t-0 hover:bg-accent/30"
              style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="w-12 shrink-0 px-1 pt-1 text-[10px] text-muted-foreground">
                {hourLabel(h)}
              </span>
            </button>
          ))}

          {isToday && nowMin >= 0 ? (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
              style={{ top: (nowMin / 60) * HOUR_HEIGHT }}
            >
              <span className="ml-11 size-2 rounded-full bg-coral" />
              <span className="h-px flex-1 bg-coral" />
            </div>
          ) : null}

          {timed.map((t) => {
            const start = timeToMinutes(t.start_time) ?? 0;
            const end = timeToMinutes(t.end_time) ?? start + 60;
            const top = (start / 60) * HOUR_HEIGHT;
            const height = Math.max(30, ((end - start) / 60) * HOUR_HEIGHT - 4);
            const tag = primaryTag(t);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTaskTap(t)}
                className={cn(
                  "absolute left-14 right-2 overflow-hidden rounded-2xl border border-l-[5px] px-3 py-1.5 text-left",
                  tag?.block ?? "border-l-primary",
                  tag?.tint ?? "bg-primary/[0.06]",
                  t.done && "opacity-50",
                )}
                style={{ top: top + 2, height }}
              >
                <p
                  className={cn(
                    "truncate text-sm font-bold",
                    t.done && "line-through",
                  )}
                >
                  {t.title}
                </p>
                <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  {formatTime(t.start_time!)}
                  {t.end_time ? `–${formatTime(t.end_time)}` : ""}
                  {t.remind ? <Bell className="size-3" /> : null}
                  {t.recurrence !== "none" ? <Repeat className="size-3" /> : null}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
