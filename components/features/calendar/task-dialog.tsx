"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyPartner } from "@/lib/actions/notify";
import { RECURRENCES, TASK_TAGS } from "@/lib/calendar";
import { addDays } from "@/lib/utils/date";
import type { CalendarTask } from "@/lib/types/database.types";
import { TaskComments } from "./task-comments";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Initial = { task_date: string; owner_id: string; start_time?: string | null };
type Partner = { id: string; display_name: string } | null;

export function TaskDialog({
  open,
  task,
  initial,
  userId,
  partner,
  meName,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: CalendarTask | null;
  initial: Initial | null;
  userId: string;
  partner: Partner;
  meName: string;
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
  const [busy, setBusy] = useState(false);

  function toggleTag(id: string) {
    setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function save(overrides: Partial<CalendarTask> = {}) {
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
      done: task?.done ?? false,
      ...overrides,
    };
    const { error } = task
      ? await supabase.from("calendar_tasks").update(payload).eq("id", task.id)
      : await supabase.from("calendar_tasks").insert({ ...payload, created_by: userId });
    setBusy(false);
    if (error) {
      toast.error("Couldn't save the task.");
      return;
    }
    if (!task) {
      void notifyPartner({
        kind: "task_new",
        title:
          ownerId !== userId
            ? `${meName} added a task to your calendar`
            : `${meName} added a task`,
        body: payload.title,
        url: "/calendar",
      });
    }
    onSaved();
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    const { error } = await createClient().from("calendar_tasks").delete().eq("id", task.id);
    setBusy(false);
    if (error) toast.error("Couldn't delete.");
    else onSaved();
  }

  function nudge() {
    void notifyPartner({
      kind: "task_remind",
      title: `${meName} nudged you 🔔`,
      body: task?.title,
      url: "/calendar",
    });
    toast.success("Nudge sent.");
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[92vh] max-w-md flex-col gap-0 rounded-t-3xl p-0"
      >
        <SheetHeader className="px-5 pb-2 pt-5">
          <SheetTitle className="text-xl font-bold">
            {task ? "Edit task" : "New task"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-3">
          {/* Quick actions (edit) */}
          {task ? (
            <div className="flex gap-2">
              <Button
                variant={task.done ? "default" : "outline"}
                className="h-11 flex-1 rounded-2xl"
                disabled={busy}
                onClick={() =>
                  save({ done: !task.done, status: task.done ? "todo" : "done" })
                }
              >
                <Check className="mr-1 size-4" />
                {task.done ? "Done" : "Mark done"}
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-2xl"
                disabled={busy}
                onClick={() => save({ task_date: addDays(taskDate, 1) })}
              >
                <CalendarClock className="mr-1 size-4" />
                Tomorrow
              </Button>
              {partner ? (
                <Button variant="outline" className="h-11 rounded-2xl" disabled={busy} onClick={nudge}>
                  Nudge
                </Button>
              ) : null}
            </div>
          ) : null}

          <Input
            autoFocus={!task}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the plan?"
            className="h-12 rounded-2xl border-0 bg-muted/60 px-4 text-base font-medium"
          />

          {partner ? (
            <Section label="Calendar">
              <Segmented
                options={[
                  { id: userId, label: "You" },
                  { id: partner.id, label: partner.display_name.split(" ")[0] },
                ]}
                value={ownerId}
                onChange={setOwnerId}
              />
            </Section>
          ) : null}

          <Section label="Date">
            <Input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              className="h-12 rounded-2xl border-0 bg-muted/60 px-4 text-base"
            />
          </Section>

          <Row label="All day">
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </Row>

          {!allDay ? (
            <div className="space-y-4">
              <Section label="Starts">
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-12 w-full rounded-2xl border-0 bg-muted/60 px-4 text-base" />
              </Section>
              <Section label="Ends">
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-12 w-full rounded-2xl border-0 bg-muted/60 px-4 text-base" />
              </Section>
            </div>
          ) : null}

          <Section label="Tags">
            <div className="flex flex-wrap gap-2">
              {TASK_TAGS.map((t) => {
                const on = tags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      on ? t.chip : "border-border text-muted-foreground",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full", t.dot)} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section label="Repeat">
            <div className="flex flex-wrap gap-2">
              {RECURRENCES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRecurrence(r.id)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    recurrence === r.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Section>

          <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold">Remind me</p>
              <p className="text-xs text-muted-foreground">
                {remind ? "Notification at start time" : "Record only, no alert"}
              </p>
            </div>
            <Switch checked={remind} onCheckedChange={setRemind} />
          </div>

          <Section label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="h-12 rounded-2xl border-0 bg-muted/60 px-4 text-base" />
          </Section>

          {task ? (
            <TaskComments
              taskId={task.id}
              taskTitle={task.title}
              userId={userId}
              meName={meName}
              partner={partner}
            />
          ) : null}
        </div>

        <div className="space-y-1 border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <Button onClick={() => save()} disabled={busy} className="h-12 w-full rounded-full text-base font-semibold">
            {busy ? "Saving…" : "Save task"}
          </Button>
          {task ? (
            <button type="button" onClick={remove} disabled={busy} className="w-full py-2.5 text-center text-sm font-medium text-destructive">
              Delete task
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-full bg-muted p-1 text-sm font-semibold">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 rounded-full py-2.5 transition-colors",
            value === o.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
