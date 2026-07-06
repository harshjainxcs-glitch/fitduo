"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RECURRENCES, TASK_TAGS } from "@/lib/calendar";
import type { CalendarTask } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Initial = {
  task_date: string;
  owner_id: string;
  start_time?: string | null;
};

export function TaskDialog({
  open,
  task,
  initial,
  userId,
  partner,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: CalendarTask | null;
  initial: Initial | null;
  userId: string;
  partner: { id: string; display_name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const src = task ?? initial;
  const [title, setTitle] = useState(task?.title ?? "");
  const [ownerId, setOwnerId] = useState(src?.owner_id ?? userId);
  const [taskDate, setTaskDate] = useState(src?.task_date ?? "");
  const [allDay, setAllDay] = useState(task?.all_day ?? false);
  const [startTime, setStartTime] = useState(
    (task?.start_time ?? initial?.start_time ?? "")?.slice(0, 5) ?? "",
  );
  const [endTime, setEndTime] = useState(task?.end_time?.slice(0, 5) ?? "");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? "none");
  const [remind, setRemind] = useState(task?.remind ?? true);
  const [note, setNote] = useState(task?.note ?? "");
  const [done, setDone] = useState(task?.done ?? false);
  const [busy, setBusy] = useState(false);

  function toggleTag(id: string) {
    setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Give the task a title.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const payload = {
      owner_id: ownerId,
      title: title.trim(),
      note: note.trim() || null,
      task_date: taskDate,
      all_day: allDay,
      start_time: allDay ? null : startTime || null,
      end_time: allDay ? null : endTime || null,
      tags,
      recurrence,
      remind,
      done,
    };
    const { error } = task
      ? await supabase.from("calendar_tasks").update(payload).eq("id", task.id)
      : await supabase
          .from("calendar_tasks")
          .insert({ ...payload, created_by: userId });
    setBusy(false);
    if (error) toast.error("Couldn't save the task.");
    else onSaved();
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    const { error } = await createClient()
      .from("calendar_tasks")
      .delete()
      .eq("id", task.id);
    setBusy(false);
    if (error) toast.error("Couldn't delete.");
    else onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-sm overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Physics class"
          />

          {partner ? (
            <Field label="Calendar">
              <div className="flex rounded-full bg-muted p-1 text-sm font-semibold">
                {[
                  { id: userId, label: "You" },
                  { id: partner.id, label: partner.display_name.split(" ")[0] },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOwnerId(o.id)}
                    className={cn(
                      "flex-1 rounded-full py-1.5",
                      ownerId === o.id
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
              />
            </Field>
            <Field label="All day">
              <div className="flex h-9 items-center">
                <Switch checked={allDay} onCheckedChange={setAllDay} />
              </div>
            </Field>
          </div>

          {!allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field label="End">
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {TASK_TAGS.map((t) => {
                const on = tags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      on ? t.chip : "text-muted-foreground",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", t.dot)} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Repeat">
            <div className="flex flex-wrap gap-1.5">
              {RECURRENCES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRecurrence(r.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    recurrence === r.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Remind me</p>
              <p className="text-xs text-muted-foreground">
                {remind ? "Notification at start time" : "Record only, no alert"}
              </p>
            </div>
            <Switch checked={remind} onCheckedChange={setRemind} />
          </div>

          {task ? (
            <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-3 py-2.5">
              <p className="text-sm font-medium">Completed</p>
              <Switch checked={done} onCheckedChange={setDone} />
            </div>
          ) : null}

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
          />
        </div>

        <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
          <Button onClick={save} disabled={busy} className="flex-1 rounded-full">
            {busy ? "Saving…" : "Save"}
          </Button>
          {task ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete task"
              onClick={remove}
              disabled={busy}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
