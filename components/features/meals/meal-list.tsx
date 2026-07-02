"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, Flame, MoreHorizontal, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, signedPhotoUrl } from "@/lib/storage";
import { formatTime } from "@/lib/utils/date";
import type { MealLog, PlanItem } from "@/lib/types/database.types";
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
  const planKey = ["plan_items", userId] as const;
  const logKey = ["meal_logs", userId, date] as const;

  const { data: planItems = [] } = useQuery({
    queryKey: planKey,
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

  const todaysPlan = useMemo(
    () =>
      planItems
        .filter((i) => i.day_of_week === dow && i.is_active)
        .sort((a, b) => {
          const ta = a.target_time ?? "99:99";
          const tb = b.target_time ?? "99:99";
          if (ta !== tb) return ta < tb ? -1 : 1;
          return a.sort_order - b.sort_order;
        }),
    [planItems, dow],
  );
  const logByItem = useMemo(() => {
    const m = new Map<string, MealLog>();
    for (const l of logs) if (l.plan_item_id) m.set(l.plan_item_id, l);
    return m;
  }, [logs]);
  const adHoc = useMemo(() => logs.filter((l) => !l.plan_item_id), [logs]);

  const totalPlanned = todaysPlan.length;
  const donePlanned = todaysPlan.filter(
    (i) => logByItem.get(i.id)?.status === "completed",
  ).length;

  const toggle = useMutation({
    mutationFn: async (item: PlanItem) => {
      const supabase = createClient();
      const existing = logByItem.get(item.id);
      if (existing?.status === "completed") {
        const { error } = await supabase
          .from("meal_logs")
          .delete()
          .eq("id", existing.id);
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
          plan_item_id: item.id,
          log_date: date,
          status: "completed",
        });
        if (error) throw error;
      }
    },
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: logKey });
      const prev = qc.getQueryData<MealLog[]>(logKey) ?? [];
      const existing = prev.find((l) => l.plan_item_id === item.id);
      let next: MealLog[];
      if (existing?.status === "completed") {
        next = prev.filter((l) => l.id !== existing.id);
      } else if (existing) {
        next = prev.map((l) =>
          l.id === existing.id ? { ...l, status: "completed" } : l,
        );
      } else {
        next = [...prev, optimisticLog(userId, date, item.id)];
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
    | { mode: "planned"; item: PlanItem; log?: MealLog }
    | { mode: "adhoc" }
    | null
  >(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: logKey });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Meals</h2>
        <span className="text-sm text-muted-foreground">
          {donePlanned}/{totalPlanned} done
        </span>
      </div>

      {totalPlanned === 0 ? (
        <p className="text-sm text-muted-foreground">
          No meals planned for today. Add some on the Plan tab.
        </p>
      ) : (
        <ul className="space-y-2">
          {todaysPlan.map((item) => {
            const log = logByItem.get(item.id);
            const completed = log?.status === "completed";
            const skipped = log?.status === "skipped";
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-colors",
                  completed && "border-primary/40 bg-primary/5",
                  skipped && "opacity-60",
                )}
              >
                <button
                  type="button"
                  aria-label={completed ? "Mark not done" : "Mark done"}
                  onClick={() => toggle.mutate(item)}
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
                  onClick={() => setDetail({ mode: "planned", item, log })}
                >
                  <p
                    className={cn(
                      "truncate text-sm font-semibold",
                      skipped && "line-through",
                    )}
                  >
                    {item.title}
                  </p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {item.target_time ? (
                      <span>{formatTime(item.target_time)}</span>
                    ) : null}
                    {log?.calories != null ? (
                      <span className="flex items-center gap-0.5">
                        <Flame className="size-3" />
                        {log.calories}
                      </span>
                    ) : null}
                    {log?.photo_path ? <Camera className="size-3" /> : null}
                    {skipped ? <span>skipped</span> : null}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Meal options"
                  onClick={() => setDetail({ mode: "planned", item, log })}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Ad-hoc meals (0 points, record-only) */}
      <div className="space-y-2">
        {adHoc.length > 0 ? (
          <ul className="space-y-2">
            {adHoc.map((log) => (
              <li
                key={log.id}
                className="flex items-center gap-3 rounded-xl border border-dashed bg-card/50 p-3"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                  +
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {log.note || "Unplanned meal"}
                  </p>
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
                    await createClient()
                      .from("meal_logs")
                      .delete()
                      .eq("id", log.id);
                    invalidate();
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setDetail({ mode: "adhoc" })}
        >
          <Plus className="mr-1 size-4" /> Add unplanned meal
        </Button>
      </div>

      <MealDialog
        key={
          detail == null
            ? "none"
            : detail.mode === "adhoc"
              ? "adhoc"
              : `planned-${detail.item.id}`
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

function optimisticLog(
  userId: string,
  date: string,
  planItemId: string,
): MealLog {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${planItemId}`,
    created_at: now,
    updated_at: now,
    user_id: userId,
    plan_item_id: planItemId,
    log_date: date,
    logged_at: now,
    status: "completed",
    calories: null,
    photo_path: null,
    note: null,
  };
}

type DialogState =
  | { mode: "planned"; item: PlanItem; log?: MealLog }
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
  const planned = state?.mode === "planned" ? state : null;
  const log = planned?.log;

  // Fresh mount per target (see `key` at the call site), so initialize directly.
  const [calories, setCalories] = useState(log?.calories?.toString() ?? "");
  const [note, setNote] = useState(log?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [adHocPhotoPath, setPhotoPath] = useState<string | null>(null);

  // Async: resolve a signed URL for an existing photo.
  useEffect(() => {
    const path = log?.photo_path;
    if (!path) return;
    let active = true;
    signedPhotoUrl(path).then((u) => {
      if (active) setPhotoUrl(u);
    });
    return () => {
      active = false;
    };
  }, [log?.photo_path]);

  async function ensurePlannedLogId(): Promise<string | null> {
    if (!planned) return null;
    if (log) return log.id;
    const { data, error } = await createClient()
      .from("meal_logs")
      .insert({
        user_id: userId,
        plan_item_id: planned.item.id,
        log_date: date,
        status: "completed",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async function setStatus(status: "completed" | "skipped") {
    if (!planned) return;
    setBusy(true);
    try {
      const supabase = createClient();
      if (log) {
        await supabase.from("meal_logs").update({ status }).eq("id", log.id);
      } else {
        await supabase.from("meal_logs").insert({
          user_id: userId,
          plan_item_id: planned.item.id,
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
      if (planned) {
        const id = await ensurePlannedLogId();
        if (id) await supabase.from("meal_logs").update({ photo_path: path }).eq("id", id);
      } else {
        // ad-hoc: keep the path locally until save inserts the row
        setPhotoPath(path);
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
      if (planned) {
        const id = await ensurePlannedLogId();
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {planned ? planned.item.title : "Unplanned meal"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {planned ? (
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

          {!planned ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">What did you have?</span>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Handful of nuts"
                autoFocus
              />
            </label>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Calories (optional)</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="—"
            />
          </label>

          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Meal"
              className="h-32 w-full rounded-lg object-cover"
            />
          ) : null}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm text-muted-foreground">
            <Camera className="size-4" />
            {photoUrl ? "Replace photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
              disabled={busy}
            />
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
