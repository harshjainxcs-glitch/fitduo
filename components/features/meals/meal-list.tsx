"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, Flame, MoreHorizontal, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, signedPhotoUrl } from "@/lib/storage";
import { formatTime } from "@/lib/utils/date";
import type { MealGroup, MealLog, PlanItem } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MealList({
  userId,
  date,
  dow,
}: {
  userId: string;
  date: string;
  dow: number;
}) {
  const qc = useQueryClient();
  const logKey = ["meal_logs", userId, date] as const;

  const { data: groups = [] } = useQuery({
    queryKey: ["meal_groups", userId],
    queryFn: async (): Promise<MealGroup[]> => {
      const { data, error } = await createClient()
        .from("meal_groups")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["plan_items", userId],
    queryFn: async (): Promise<PlanItem[]> => {
      const { data, error } = await createClient()
        .from("plan_items")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: logKey,
    queryFn: async (): Promise<MealLog[]> => {
      const { data, error } = await createClient()
        .from("meal_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", date)
        .order("logged_at");
      if (error) throw error;
      return data;
    },
  });

  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) => {
        const ta = a.target_time ?? "99:99";
        const tb = b.target_time ?? "99:99";
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a.sort_order - b.sort_order;
      }),
    [groups],
  );
  const logByGroup = useMemo(() => {
    const m = new Map<string, MealLog>();
    for (const l of logs) if (l.meal_group_id) m.set(l.meal_group_id, l);
    return m;
  }, [logs]);
  const itemsFor = (groupId: string) =>
    items.filter((i) => i.meal_group_id === groupId && i.day_of_week === dow);
  const adHoc = useMemo(
    () => logs.filter((l) => !l.plan_item_id && !l.meal_group_id),
    [logs],
  );

  const total = sortedGroups.length;
  const done = sortedGroups.filter(
    (g) => logByGroup.get(g.id)?.status === "completed",
  ).length;

  const toggle = useMutation({
    mutationFn: async (group: MealGroup) => {
      const supabase = createClient();
      const existing = logByGroup.get(group.id);
      if (existing?.status === "completed") {
        const { error } = await supabase.from("meal_logs").delete().eq("id", existing.id);
        if (error) throw error;
      } else if (existing) {
        const { error } = await supabase
          .from("meal_logs")
          .update({ status: "completed" })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meal_logs").insert({
          user_id: userId,
          meal_group_id: group.id,
          log_date: date,
          status: "completed",
        });
        if (error) throw error;
      }
    },
    onMutate: async (group) => {
      await qc.cancelQueries({ queryKey: logKey });
      const prev = qc.getQueryData<MealLog[]>(logKey) ?? [];
      const existing = prev.find((l) => l.meal_group_id === group.id);
      let next: MealLog[];
      if (existing?.status === "completed") {
        next = prev.filter((l) => l.id !== existing.id);
      } else if (existing) {
        next = prev.map((l) => (l.id === existing.id ? { ...l, status: "completed" } : l));
      } else {
        next = [...prev, optimisticLog(userId, date, group.id)];
      }
      qc.setQueryData(logKey, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(logKey, ctx.prev);
      toast.error("Couldn't update meal.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: logKey }),
  });

  const [detail, setDetail] = useState<
    { mode: "group"; group: MealGroup; log?: MealLog } | { mode: "adhoc" } | null
  >(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: logKey });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Meals</h2>
        <span className="text-sm text-muted-foreground">
          {done}/{total} done
        </span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No meals set up yet. Create them on the Plan tab.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortedGroups.map((group) => {
            const log = logByGroup.get(group.id);
            const completed = log?.status === "completed";
            const skipped = log?.status === "skipped";
            const groupItems = itemsFor(group.id);
            return (
              <li
                key={group.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors",
                  completed && "border-primary/40 bg-primary/[0.04]",
                  skipped && "opacity-60",
                )}
              >
                <button
                  type="button"
                  aria-label={completed ? "Mark not done" : "Mark done"}
                  onClick={() => toggle.mutate(group)}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    completed
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30",
                  )}
                >
                  {completed ? <Check className="size-4" /> : null}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setDetail({ mode: "group", group, log })}
                >
                  <div className="flex items-baseline gap-2">
                    <p className={cn("truncate text-sm font-semibold", skipped && "line-through")}>
                      {group.name}
                    </p>
                    {group.target_time ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(group.target_time)}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {groupItems.length
                      ? groupItems.map((i) => i.title).join(", ")
                      : "No items planned"}
                    {log?.calories != null ? ` · ${log.calories} kcal` : ""}
                    {log?.photo_path ? " · 📷" : ""}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Meal options"
                  onClick={() => setDetail({ mode: "group", group, log })}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Ad-hoc meals (0 points) */}
      <div className="space-y-2">
        {adHoc.length > 0 ? (
          <ul className="space-y-2">
            {adHoc.map((log) => (
              <li key={log.id} className="flex items-center gap-3 rounded-2xl border border-dashed bg-card/50 p-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                  +
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{log.note || "Unplanned meal"}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {log.calories != null ? (
                      <span className="flex items-center gap-0.5">
                        <Flame className="size-3" />
                        {log.calories}
                      </span>
                    ) : null}
                    <span>0 pts</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await createClient().from("meal_logs").delete().eq("id", log.id);
                    invalidate();
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button variant="outline" size="sm" className="w-full" onClick={() => setDetail({ mode: "adhoc" })}>
          <Plus className="mr-1 size-4" /> Add unplanned meal
        </Button>
      </div>

      <MealDialog
        key={
          detail == null
            ? "none"
            : detail.mode === "adhoc"
              ? "adhoc"
              : `group-${detail.group.id}`
        }
        state={detail}
        userId={userId}
        date={date}
        onClose={() => setDetail(null)}
        onSaved={() => {
          setDetail(null);
          invalidate();
        }}
      />
    </section>
  );
}

function optimisticLog(userId: string, date: string, groupId: string): MealLog {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${groupId}`,
    created_at: now,
    updated_at: now,
    user_id: userId,
    plan_item_id: null,
    meal_group_id: groupId,
    log_date: date,
    logged_at: now,
    status: "completed",
    calories: null,
    photo_path: null,
    note: null,
  };
}

type DialogState =
  | { mode: "group"; group: MealGroup; log?: MealLog }
  | { mode: "adhoc" }
  | null;

function MealDialog({
  state,
  userId,
  date,
  onClose,
  onSaved,
}: {
  state: DialogState;
  userId: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = state !== null;
  const grouped = state?.mode === "group" ? state : null;
  const log = grouped?.log;

  const [calories, setCalories] = useState(log?.calories?.toString() ?? "");
  const [note, setNote] = useState(log?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [adHocPhotoPath, setAdHocPhotoPath] = useState<string | null>(null);

  useEffect(() => {
    const path = log?.photo_path;
    if (!path) return;
    let active = true;
    signedPhotoUrl(path).then((u) => active && setPhotoUrl(u));
    return () => {
      active = false;
    };
  }, [log?.photo_path]);

  async function ensureGroupLogId(): Promise<string | null> {
    if (!grouped) return null;
    if (log) return log.id;
    const { data, error } = await createClient()
      .from("meal_logs")
      .insert({
        user_id: userId,
        meal_group_id: grouped.group.id,
        log_date: date,
        status: "completed",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async function setStatus(status: "completed" | "skipped") {
    if (!grouped) return;
    setBusy(true);
    try {
      const supabase = createClient();
      if (log) {
        await supabase.from("meal_logs").update({ status }).eq("id", log.id);
      } else {
        await supabase.from("meal_logs").insert({
          user_id: userId,
          meal_group_id: grouped.group.id,
          log_date: date,
          status,
        });
      }
      onSaved();
    } catch {
      toast.error("Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadPhoto(userId, date, file);
      const supabase = createClient();
      if (grouped) {
        const id = await ensureGroupLogId();
        if (id) await supabase.from("meal_logs").update({ photo_path: path }).eq("id", id);
      } else {
        setAdHocPhotoPath(path);
      }
      setPhotoUrl(await signedPhotoUrl(path));
      toast.success("Photo added.");
    } catch {
      toast.error("Photo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const supabase = createClient();
      const cals = calories ? Number(calories) : null;
      if (grouped) {
        const id = await ensureGroupLogId();
        if (id) {
          await supabase
            .from("meal_logs")
            .update({ calories: cals, note: note.trim() || null })
            .eq("id", id);
        }
      } else {
        await supabase.from("meal_logs").insert({
          user_id: userId,
          plan_item_id: null,
          meal_group_id: null,
          log_date: date,
          status: "completed",
          calories: cals,
          note: note.trim() || null,
          photo_path: adHocPhotoPath,
        });
      }
      onSaved();
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{grouped ? grouped.group.name : "Unplanned meal"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {grouped ? (
            <div className="flex gap-2">
              <Button
                variant={log?.status === "completed" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => setStatus("completed")}
              >
                Completed
              </Button>
              <Button
                variant={log?.status === "skipped" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => setStatus("skipped")}
              >
                Skip
              </Button>
            </div>
          ) : null}

          {!grouped ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">What did you have?</span>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Handful of nuts" autoFocus />
            </label>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Calories (optional)</span>
            <Input type="number" min={0} inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="—" />
          </label>

          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Meal" className="h-32 w-full rounded-lg object-cover" />
          ) : null}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm text-muted-foreground">
            <Camera className="size-4" />
            {photoUrl ? "Replace photo" : "Add photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} disabled={busy} />
          </label>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
