"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Copy, Flame, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WEEKDAYS } from "@/lib/constants";
import { formatTime } from "@/lib/utils/date";
import type { PlanItem } from "@/lib/types/database.types";
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

type Partner = { id: string; display_name: string } | null;

type Editing = {
  id?: string;
  day: number;
  title: string;
  target_time: string;
  target_calories: string;
  note: string;
};

function sortMeals(a: PlanItem, b: PlanItem) {
  const ta = a.target_time ?? "99:99";
  const tb = b.target_time ?? "99:99";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.sort_order - b.sort_order;
}

export function PlanEditor({
  userId,
  partner,
  initialDay,
}: {
  userId: string;
  partner: Partner;
  initialDay: number;
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<"you" | "partner">("you");
  const [day, setDay] = useState(initialDay);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);

  const viewId = view === "you" ? userId : (partner?.id ?? userId);
  const readOnly = view === "partner";
  const queryKey = ["plan_items", viewId] as const;

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PlanItem[]> => {
      const { data, error } = await createClient()
        .from("plan_items")
        .select("*")
        .eq("user_id", viewId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["plan_items", userId] });

  const dayItems = useMemo(
    () => items.filter((i) => i.day_of_week === day).sort(sortMeals),
    [items, day],
  );

  function openAdd() {
    setEditing({ day, title: "", target_time: "", target_calories: "", note: "" });
  }
  function openEdit(item: PlanItem) {
    setEditing({
      id: item.id,
      day: item.day_of_week,
      title: item.title,
      target_time: item.target_time?.slice(0, 5) ?? "",
      target_calories: item.target_calories?.toString() ?? "",
      note: item.note ?? "",
    });
  }

  async function saveItem() {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) {
      toast.error("Give the meal a name.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const payload = {
      title,
      target_time: editing.target_time || null,
      target_calories: editing.target_calories
        ? Number(editing.target_calories)
        : null,
      note: editing.note.trim() || null,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase
        .from("plan_items")
        .update(payload)
        .eq("id", editing.id));
    } else {
      const maxSort = Math.max(
        0,
        ...items.filter((i) => i.day_of_week === editing.day).map((i) => i.sort_order),
      );
      ({ error } = await supabase.from("plan_items").insert({
        user_id: userId,
        day_of_week: editing.day,
        sort_order: maxSort + 1,
        ...payload,
      }));
    }
    setBusy(false);
    if (error) {
      toast.error("Couldn't save the meal.");
      return;
    }
    setEditing(null);
    invalidate();
  }

  async function deleteItem(id: string) {
    const { error } = await createClient().from("plan_items").delete().eq("id", id);
    if (error) toast.error("Couldn't delete.");
    else invalidate();
  }

  async function applyToAllDays() {
    setBusy(true);
    const supabase = createClient();
    const source = items.filter((i) => i.day_of_week === day);
    const otherIds = items.filter((i) => i.day_of_week !== day).map((i) => i.id);
    if (otherIds.length) await supabase.from("plan_items").delete().in("id", otherIds);
    const rows = [];
    for (let d = 0; d < 7; d++) {
      if (d === day) continue;
      for (const i of source) {
        rows.push({
          user_id: userId,
          day_of_week: d,
          title: i.title,
          target_time: i.target_time,
          note: i.note,
          target_calories: i.target_calories,
          sort_order: i.sort_order,
        });
      }
    }
    if (rows.length) await supabase.from("plan_items").insert(rows);
    setBusy(false);
    invalidate();
    toast.success("Applied to every day.");
  }

  async function copyFrom(sourceDay: number) {
    if (sourceDay === day) return;
    setBusy(true);
    const supabase = createClient();
    const source = items.filter((i) => i.day_of_week === sourceDay);
    const targetIds = items.filter((i) => i.day_of_week === day).map((i) => i.id);
    if (targetIds.length) await supabase.from("plan_items").delete().in("id", targetIds);
    const rows = source.map((i) => ({
      user_id: userId,
      day_of_week: day,
      title: i.title,
      target_time: i.target_time,
      note: i.note,
      target_calories: i.target_calories,
      sort_order: i.sort_order,
    }));
    if (rows.length) await supabase.from("plan_items").insert(rows);
    setBusy(false);
    invalidate();
    toast.success(`Copied from ${WEEKDAYS[sourceDay].long}.`);
  }

  return (
    <div className="space-y-4 px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Weekly plan</h2>
        <Link
          href="/settings"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Water &amp; workout →
        </Link>
      </div>

      {/* You / Partner toggle */}
      {partner ? (
        <div className="flex rounded-full bg-muted p-1 text-sm font-semibold">
          {(["you", "partner"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "flex-1 rounded-full py-1.5 transition-colors",
                view === v
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {v === "you" ? "You" : partner.display_name.split(" ")[0]}
            </button>
          ))}
        </div>
      ) : null}

      {/* Day selector */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <button
            key={d.index}
            type="button"
            onClick={() => setDay(d.index)}
            className={cn(
              "rounded-2xl py-2 text-xs font-bold transition-colors",
              d.index === day
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent/40",
            )}
          >
            {d.short}
          </button>
        ))}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={openAdd} className="rounded-full">
            <Plus className="mr-1 size-4" /> Add meal
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={applyToAllDays}
            disabled={busy || dayItems.length === 0}
          >
            <Copy className="mr-1 size-4" /> All days
          </Button>
          <CopyFromMenu currentDay={day} onPick={copyFrom} disabled={busy} />
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : dayItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {readOnly
            ? "No meals planned for this day."
            : "No meals yet — tap “Add meal” to build your day."}
        </div>
      ) : (
        <ul className="space-y-2">
          {dayItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {item.target_time ? (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatTime(item.target_time)}
                    </span>
                  ) : null}
                  {item.target_calories != null ? (
                    <span className="flex items-center gap-1">
                      <Flame className="size-3" />
                      {item.target_calories} kcal
                    </span>
                  ) : null}
                </div>
              </div>
              {!readOnly ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() => deleteItem(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit meal" : "Add meal"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Meal name</span>
                <Input
                  autoFocus
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Breakfast, Post-workout shake"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Time</span>
                  <Input
                    type="time"
                    value={editing.target_time}
                    onChange={(e) =>
                      setEditing({ ...editing, target_time: e.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Calories</span>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={editing.target_calories}
                    onChange={(e) =>
                      setEditing({ ...editing, target_calories: e.target.value })
                    }
                    placeholder="—"
                  />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Note (optional)</span>
                <Input
                  value={editing.note}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={saveItem} disabled={busy} className="w-full rounded-full">
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyFromMenu({
  currentDay,
  onPick,
  disabled,
}: {
  currentDay: number;
  onPick: (day: number) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <Copy className="mr-1 size-4" /> Copy day
      </Button>
      {open ? (
        <div className="absolute z-10 mt-1 w-40 rounded-2xl border bg-popover p-1 shadow-md">
          {WEEKDAYS.filter((d) => d.index !== currentDay).map((d) => (
            <button
              key={d.index}
              type="button"
              className="block w-full rounded-xl px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                setOpen(false);
                onPick(d.index);
              }}
            >
              {d.long}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
