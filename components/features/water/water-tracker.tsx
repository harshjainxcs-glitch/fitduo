"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Droplet, Plus, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { WaterLog } from "@/lib/types/database.types";
import { Ring } from "@/components/ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function WaterTracker({
  userId,
  date,
  bottleSizeMl,
  targetMl,
}: {
  userId: string;
  date: string;
  bottleSizeMl: number;
  targetMl: number;
}) {
  const qc = useQueryClient();
  const key = ["water_logs", userId, date] as const;
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState("");

  const { data: logs = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await createClient()
        .from("water_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", date)
        .order("logged_at");
      if (error) throw error;
      return data;
    },
  });

  const total = logs.reduce((s, l) => s + l.amount_ml, 0);
  const remaining = Math.max(0, targetMl - total);
  const progress = targetMl > 0 ? total / targetMl : 0;

  const add = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await createClient()
        .from("water_logs")
        .insert({ user_id: userId, log_date: date, amount_ml: amount });
      if (error) throw error;
    },
    onMutate: async (amount) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WaterLog[]>(key) ?? [];
      const now = new Date().toISOString();
      qc.setQueryData<WaterLog[]>(key, [
        ...prev,
        {
          id: `optimistic-${now}`,
          created_at: now,
          user_id: userId,
          log_date: date,
          logged_at: now,
          amount_ml: amount,
          note: null,
        },
      ]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
      toast.error("Couldn't log water.");
    },
    onSuccess: (_d, amount) => {
      if (targetMl > 0 && total < targetMl && total + amount >= targetMl) {
        toast.success("Water goal reached! 💧");
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const undo = useMutation({
    mutationFn: async () => {
      const last = logs[logs.length - 1];
      if (!last) return;
      const { error } = await createClient()
        .from("water_logs")
        .delete()
        .eq("id", last.id);
      if (error) throw error;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WaterLog[]>(key) ?? [];
      qc.setQueryData<WaterLog[]>(key, prev.slice(0, -1));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
      toast.error("Couldn't undo.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  function submitCustom() {
    const ml = Number(customMl);
    if (!ml || ml <= 0) {
      toast.error("Enter an amount in ml.");
      return;
    }
    add.mutate(ml);
    setCustomMl("");
    setCustomOpen(false);
  }

  return (
    <section className="space-y-4 rounded-3xl border bg-card p-4 shadow-sm">
      <h2 className="text-base font-bold">Water</h2>
      <div className="flex items-center gap-5">
        <Ring
          progress={progress}
          size={128}
          ringClassName="stroke-sky-500"
        >
          <Droplet className="size-5 text-sky-500" />
          <span className="mt-1 text-lg font-semibold tabular-nums">
            {(total / 1000).toFixed(total % 1000 === 0 ? 0 : 1)}L
          </span>
          <span className="text-xs text-muted-foreground">
            of {(targetMl / 1000).toFixed(targetMl % 1000 === 0 ? 0 : 1)}L
          </span>
        </Ring>

        <div className="flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            {remaining > 0
              ? `${remaining} ml to go`
              : "Target reached — nice! 💧"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => add.mutate(bottleSizeMl)}>
              <Plus className="mr-1 size-4" /> Bottle ({bottleSizeMl}ml)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCustomOpen(true)}
            >
              Custom
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => undo.mutate()}
              disabled={logs.length === 0}
            >
              <Undo2 className="mr-1 size-4" /> Undo
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Add water</DialogTitle>
          </DialogHeader>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Amount (ml)</span>
            <Input
              type="number"
              min={1}
              autoFocus
              inputMode="numeric"
              value={customMl}
              onChange={(e) => setCustomMl(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button onClick={submitCustom} className="w-full">
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
