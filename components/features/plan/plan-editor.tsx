"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Copy, Flame, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WEEKDAYS } from "@/lib/constants";
import { formatTime } from "@/lib/utils/date";
import type { MealGroup, PlanItem } from "@/lib/types/database.types";
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
type GroupDraft = { id?: string; name: string; time: string };
type ItemDraft = { id?: string; groupId: string; title: string; calories: string; note: string };

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
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const viewId = view === "you" ? userId : (partner?.id ?? userId);
  const readOnly = view === "partner";

  const { data: groups = [] } = useQuery({
    queryKey: ["meal_groups", viewId],
    queryFn: async (): Promise<MealGroup[]> => {
      const { data, error } = await createClient()
        .from("meal_groups")
        .select("*")
        .eq("user_id", viewId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["plan_items", viewId],
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["meal_groups", userId] });
    qc.invalidateQueries({ queryKey: ["plan_items", userId] });
  };

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
  const itemsFor = (groupId: string) =>
    items
      .filter((i) => i.meal_group_id === groupId && i.day_of_week === day)
      .sort((a, b) => a.sort_order - b.sort_order);

  async function saveGroup() {
    if (!groupDraft) return;
    const name = groupDraft.name.trim();
    if (!name) {
      toast.error("Name the meal (e.g. Breakfast).");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const payload = { name, target_time: groupDraft.time || null };
    const { error } = groupDraft.id
      ? await supabase.from("meal_groups").update(payload).eq("id", groupDraft.id)
      : await supabase.from("meal_groups").insert({
          user_id: userId,
          sort_order: Math.max(0, ...groups.map((g) => g.sort_order)) + 1,
          ...payload,
        });
    setBusy(false);
    if (error) toast.error("Couldn't save the meal.");
    else {
      setGroupDraft(null);
      invalidate();
    }
  }

  async function deleteGroup(group: MealGroup) {
    if (
      !window.confirm(
        `Delete "${group.name}"? Its items on every day will be removed.`,
      )
    )
      return;
    const { error } = await createClient().from("meal_groups").delete().eq("id", group.id);
    if (error) toast.error("Couldn't delete.");
    else invalidate();
  }

  async function saveItem() {
    if (!itemDraft) return;
    const title = itemDraft.title.trim();
    if (!title) {
      toast.error("Add a food item.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const payload = {
      title,
      target_calories: itemDraft.calories ? Number(itemDraft.calories) : null,
      note: itemDraft.note.trim() || null,
    };
    let error;
    if (itemDraft.id) {
      ({ error } = await supabase.from("plan_items").update(payload).eq("id", itemDraft.id));
    } else {
      const maxSort = Math.max(
        0,
        ...items
          .filter((i) => i.meal_group_id === itemDraft.groupId && i.day_of_week === day)
          .map((i) => i.sort_order),
      );
      ({ error } = await supabase.from("plan_items").insert({
        user_id: userId,
        meal_group_id: itemDraft.groupId,
        day_of_week: day,
        sort_order: maxSort + 1,
        ...payload,
      }));
    }
    setBusy(false);
    if (error) toast.error("Couldn't save the item.");
    else {
      setItemDraft(null);
      invalidate();
    }
  }

  async function deleteItem(id: string) {
    const { error } = await createClient().from("plan_items").delete().eq("id", id);
    if (error) toast.error("Couldn't delete.");
    else invalidate();
  }

  async function copyItemsToAllDays(group: MealGroup) {
    setBusy(true);
    const supabase = createClient();
    const src = items.filter((i) => i.meal_group_id === group.id && i.day_of_week === day);
    const otherIds = items
      .filter((i) => i.meal_group_id === group.id && i.day_of_week !== day)
      .map((i) => i.id);
    if (otherIds.length) await supabase.from("plan_items").delete().in("id", otherIds);
    const rows = [];
    for (let d = 0; d < 7; d++) {
      if (d === day) continue;
      for (const i of src) {
        rows.push({
          user_id: userId,
          meal_group_id: group.id,
          day_of_week: d,
          title: i.title,
          target_calories: i.target_calories,
          note: i.note,
          sort_order: i.sort_order,
        });
      }
    }
    if (rows.length) await supabase.from("plan_items").insert(rows);
    setBusy(false);
    invalidate();
    toast.success(`Copied ${group.name} to every day.`);
  }

  return (
    <div className="space-y-4 px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Meal plan</h2>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          Water &amp; workout →
        </Link>
      </div>

      {partner ? (
        <div className="flex rounded-full bg-muted p-1 text-sm font-semibold">
          {(["you", "partner"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "flex-1 rounded-full py-1.5 transition-colors",
                view === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {v === "you" ? "You" : partner.display_name.split(" ")[0]}
            </button>
          ))}
        </div>
      ) : null}

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
        <Button
          size="sm"
          className="rounded-full"
          onClick={() => setGroupDraft({ name: "", time: "" })}
        >
          <Plus className="mr-1 size-4" /> Add meal
        </Button>
      ) : null}

      {sortedGroups.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {readOnly ? "No meals set up." : "Create meals like Breakfast, Lunch, Dinner — then add what's in each."}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedGroups.map((group) => {
            const groupItems = itemsFor(group.id);
            return (
              <div key={group.id} className="rounded-2xl border bg-card p-3 shadow-soft">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold">{group.name}</span>
                    {group.target_time ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatTime(group.target_time)}
                      </span>
                    ) : null}
                  </div>
                  {!readOnly ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit meal" onClick={() => setGroupDraft({ id: group.id, name: group.name, time: group.target_time?.slice(0, 5) ?? "" })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete meal" onClick={() => deleteGroup(group)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                {groupItems.length ? (
                  <ul className="mb-2 space-y-1">
                    {groupItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                        <span className="min-w-0 truncate text-sm">
                          {item.title}
                          {item.target_calories != null ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              <Flame className="mr-0.5 inline size-3" />
                              {item.target_calories}
                            </span>
                          ) : null}
                        </span>
                        {!readOnly ? (
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="size-7" aria-label="Edit item" onClick={() => setItemDraft({ id: item.id, groupId: group.id, title: item.title, calories: item.target_calories?.toString() ?? "", note: item.note ?? "" })}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" aria-label="Delete item" onClick={() => deleteItem(item.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-2 text-xs text-muted-foreground">No items for this day yet.</p>
                )}

                {!readOnly ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setItemDraft({ groupId: group.id, title: "", calories: "", note: "" })}>
                      <Plus className="mr-1 size-3.5" /> Add item
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-full" disabled={busy || groupItems.length === 0} onClick={() => copyItemsToAllDays(group)}>
                      <Copy className="mr-1 size-3.5" /> Copy to all days
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Group dialog */}
      <Dialog open={groupDraft !== null} onOpenChange={(o) => !o && setGroupDraft(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>{groupDraft?.id ? "Edit meal" : "New meal"}</DialogTitle>
          </DialogHeader>
          {groupDraft ? (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Meal name</span>
                <Input autoFocus value={groupDraft.name} onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })} placeholder="e.g. Breakfast, Post-lunch" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Time (optional — used for reminders)</span>
                <Input type="time" value={groupDraft.time} onChange={(e) => setGroupDraft({ ...groupDraft, time: e.target.value })} />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={saveGroup} disabled={busy} className="w-full rounded-full">
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item dialog */}
      <Dialog open={itemDraft !== null} onOpenChange={(o) => !o && setItemDraft(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>{itemDraft?.id ? "Edit item" : "Add item"}</DialogTitle>
          </DialogHeader>
          {itemDraft ? (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Food</span>
                <Input autoFocus value={itemDraft.title} onChange={(e) => setItemDraft({ ...itemDraft, title: e.target.value })} placeholder="e.g. Poha, 2 eggs" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Calories (optional)</span>
                <Input type="number" min={0} inputMode="numeric" value={itemDraft.calories} onChange={(e) => setItemDraft({ ...itemDraft, calories: e.target.value })} placeholder="—" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Note (optional)</span>
                <Input value={itemDraft.note} onChange={(e) => setItemDraft({ ...itemDraft, note: e.target.value })} />
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
