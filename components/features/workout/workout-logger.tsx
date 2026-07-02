"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, Dumbbell, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/storage";
import { weekDatesIST, weekStartIST } from "@/lib/utils/date";
import type { WorkoutLog } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function WorkoutLogger({
  userId,
  date,
  workoutDays,
}: {
  userId: string;
  date: string;
  workoutDays: number[];
}) {
  const qc = useQueryClient();
  const weekStart = weekStartIST(date);
  const weekDates = weekDatesIST(date);
  const key = ["workout_logs", userId, weekStart] as const;

  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<WorkoutLog[]> => {
      const { data, error } = await createClient()
        .from("workout_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", weekDates[0])
        .lte("log_date", weekDates[6])
        .order("logged_at");
      if (error) throw error;
      return data;
    },
  });

  const todayLogs = logs.filter((l) => l.log_date === date);
  const todayDone = todayLogs.length > 0;

  const scheduled = workoutDays.length;
  const doneScheduled = workoutDays.filter((idx) =>
    logs.some((l) => l.log_date === weekDates[idx]),
  ).length;

  async function save() {
    setBusy(true);
    try {
      let photo_path: string | null = null;
      if (file) photo_path = await uploadPhoto(userId, date, file);
      const { error } = await createClient().from("workout_logs").insert({
        user_id: userId,
        log_date: date,
        type: type.trim() || null,
        duration_min: duration ? Number(duration) : null,
        note: note.trim() || null,
        photo_path,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: key });
      setOpen(false);
      setType("");
      setDuration("");
      setNote("");
      setFile(null);
      toast.success("Workout logged 💪");
    } catch {
      toast.error("Couldn't log workout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Workout</h2>
        {scheduled > 0 ? (
          <span className="text-sm text-muted-foreground">
            {doneScheduled} of {scheduled} days
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl bg-muted/60 p-3",
          todayDone && "bg-primary/10",
        )}
      >
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full",
            todayDone
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {todayDone ? <Check className="size-5" /> : <Dumbbell className="size-5" />}
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">
            {todayDone ? "Workout done today" : "No workout logged yet"}
          </p>
          {todayLogs.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {todayLogs
                .map((l) =>
                  [l.type, l.duration_min ? `${l.duration_min} min` : null]
                    .filter(Boolean)
                    .join(" · "),
                )
                .filter(Boolean)
                .join(", ") || "Logged"}
            </p>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> Add
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Add workout</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Type (optional)</span>
              <Input
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. Run, Strength, Yoga"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Duration (min, optional)</span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Note (optional)</span>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm text-muted-foreground">
              <Camera className="size-4" />
              {file ? file.name : "Add photo (optional)"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <SheetFooter>
            <Button onClick={save} disabled={busy} className="w-full">
              {busy ? "Saving…" : "Log workout"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
