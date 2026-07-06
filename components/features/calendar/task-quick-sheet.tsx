"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Loader,
  MessageSquare,
  Pencil,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyPartner } from "@/lib/actions/notify";
import { addDays, formatTime } from "@/lib/utils/date";
import type { CalendarTask } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TaskComments } from "./task-comments";

type Partner = { id: string; display_name: string } | null;

const STATUSES = [
  { id: "done", label: "Done", icon: Check, cls: "bg-primary text-primary-foreground" },
  { id: "in_progress", label: "In progress", icon: Loader, cls: "bg-amber-500/15 text-amber-600" },
  { id: "todo", label: "To do", icon: RotateCcw, cls: "bg-muted text-foreground" },
  { id: "skipped", label: "Skipped", icon: SkipForward, cls: "bg-muted text-muted-foreground" },
] as const;
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUSES.map((s) => [s.id, s.label]),
);

export function TaskQuickSheet({
  task,
  userId,
  meName,
  partner,
  onEdit,
  onClose,
  onChanged,
}: {
  task: CalendarTask;
  userId: string;
  meName: string;
  partner: Partner;
  onEdit: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "status" | "updates">("menu");
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();

  async function setStatus(status: string) {
    setBusy(true);
    const { error } = await createClient()
      .from("calendar_tasks")
      .update({ status, done: status === "done" })
      .eq("id", task.id);
    setBusy(false);
    if (error) {
      toast.error("Couldn't update.");
      return;
    }
    onChanged();
    void notifyPartner({
      kind: "task_update",
      title: `${meName} · ${task.title}`,
      body: `Marked ${STATUS_LABEL[status] ?? status}`,
      url: "/calendar",
    });
    onClose();
  }

  async function tomorrow() {
    setBusy(true);
    const { error } = await createClient()
      .from("calendar_tasks")
      .update({ task_date: addDays(task.task_date, 1) })
      .eq("id", task.id);
    setBusy(false);
    if (error) {
      toast.error("Couldn't reschedule.");
      return;
    }
    onChanged();
    void notifyPartner({
      kind: "task_update",
      title: `${meName} · ${task.title}`,
      body: "Moved to tomorrow",
      url: "/calendar",
    });
    onClose();
  }

  const menu = [
    { k: "status", label: "Status", icon: SlidersHorizontal },
    { k: "updates", label: "Updates", icon: MessageSquare },
    { k: "edit", label: "Edit", icon: Pencil },
  ] as const;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="pr-6">{task.title}</SheetTitle>
          {!task.all_day && task.start_time ? (
            <p className="text-sm text-muted-foreground">
              {formatTime(task.start_time)}
              {task.end_time ? `–${formatTime(task.end_time)}` : ""}
            </p>
          ) : null}
        </SheetHeader>

        {mode === "menu" ? (
          <div className="grid grid-cols-3 gap-3 px-4 pb-8 pt-2">
            {menu.map((b, i) => (
              <motion.button
                key={b.k}
                type="button"
                initial={reduce ? false : { opacity: 0, y: 24, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 320, damping: 22 }}
                onClick={() => (b.k === "edit" ? onEdit() : setMode(b.k))}
                className="flex flex-col items-center gap-2 rounded-2xl bg-muted/60 py-5"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <b.icon className="size-5" />
                </span>
                <span className="text-sm font-semibold">{b.label}</span>
              </motion.button>
            ))}
          </div>
        ) : mode === "status" ? (
          <div className="space-y-3 px-4 pb-8 pt-2">
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-3 py-3.5 text-sm font-semibold",
                    s.cls,
                    task.status === s.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <s.icon className="size-4" /> {s.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={tomorrow}
              className="flex w-full items-center gap-2 rounded-2xl bg-muted/60 px-3 py-3.5 text-sm font-semibold"
            >
              <Clock className="size-4" /> Do it tomorrow
            </button>
            <button type="button" onClick={() => setMode("menu")} className="w-full py-2 text-sm text-muted-foreground">
              Back
            </button>
          </div>
        ) : (
          <div className="px-4 pb-8 pt-2">
            <TaskComments
              taskId={task.id}
              taskTitle={task.title}
              userId={userId}
              meName={meName}
              partner={partner}
            />
            <button type="button" onClick={() => setMode("menu")} className="mt-3 w-full py-2 text-sm text-muted-foreground">
              Back
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
