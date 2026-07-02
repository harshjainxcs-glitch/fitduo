"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDisplayDate, todayIST, weekStartIST, dayOfWeekIST } from "@/lib/utils/date";
import type { WeeklyResult } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MiniProfile = { id: string; display_name: string };

export function WeeklyView({ profiles }: { profiles: MiniProfile[] }) {
  const qc = useQueryClient();
  const supabase = createClient();
  const date = todayIST();
  const currentWeek = weekStartIST(date);
  const daysLeft = 6 - dayOfWeekIST(date);

  const a = profiles[0];
  const b = profiles[1];
  const nameOf = (id: string | null) =>
    profiles.find((p) => p.id === id)?.display_name.split(" ")[0] ?? "—";

  const { data: weeklyScores = [] } = useQuery({
    queryKey: ["weekly_scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_scores").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["weekly_results"],
    queryFn: async (): Promise<WeeklyResult[]> => {
      const { data, error } = await supabase
        .from("weekly_results")
        .select("*")
        .order("week_start", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalFor = (uid: string | undefined, week: string) =>
    uid
      ? Number(
          weeklyScores.find((w) => w.user_id === uid && w.week_start === week)
            ?.total ?? 0,
        )
      : 0;

  const aTotal = totalFor(a?.id, currentWeek);
  const bTotal = totalFor(b?.id, currentWeek);
  const leaderId =
    !b || aTotal === bTotal ? null : aTotal > bTotal ? a.id : b.id;

  // Auto-finalize any past week that has activity but no frozen result.
  useEffect(() => {
    const activityWeeks = new Set(
      weeklyScores
        .map((w) => w.week_start as string)
        .filter((w) => w < currentWeek),
    );
    const finalized = new Set(results.map((r) => r.week_start));
    const missing = [...activityWeeks].filter((w) => !finalized.has(w));
    if (missing.length === 0) return;
    (async () => {
      for (const w of missing) {
        await supabase.rpc("finalize_week", { p_week_start: w });
      }
      qc.invalidateQueries({ queryKey: ["weekly_results"] });
    })();
  }, [weeklyScores, results, currentWeek, qc, supabase]);

  // Prize for the current week (stored on a weekly_results row).
  const currentResult = results.find((r) => r.week_start === currentWeek);
  const [prize, setPrize] = useState("");
  const [prizeDirty, setPrizeDirty] = useState(false);
  const effectivePrize = prizeDirty ? prize : (currentResult?.prize ?? "");

  async function savePrize() {
    if (!a || !b) return;
    const { error } = await supabase.from("weekly_results").upsert(
      {
        week_start: currentWeek,
        user_a: a.id,
        user_b: b.id,
        points_a: aTotal,
        points_b: bTotal,
        prize: effectivePrize.trim() || null,
      },
      { onConflict: "week_start" },
    );
    if (error) toast.error("Couldn't save prize.");
    else {
      toast.success("Prize saved.");
      setPrizeDirty(false);
      qc.invalidateQueries({ queryKey: ["weekly_results"] });
    }
  }

  async function togglePaid(week: string, paid: boolean) {
    const { error } = await supabase
      .from("weekly_results")
      .update({ prize_paid: paid })
      .eq("week_start", week);
    if (error) toast.error("Couldn't update.");
    else qc.invalidateQueries({ queryKey: ["weekly_results"] });
  }

  const history = results.filter((r) => r.week_start < currentWeek);

  return (
    <div className="space-y-6 px-4 py-2">
      {/* Current week */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            This week
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-around text-center">
            <Side name={a?.display_name} points={aTotal} lead={leaderId === a?.id} />
            <span className="text-sm text-muted-foreground">vs</span>
            <Side name={b?.display_name} points={bTotal} lead={leaderId === b?.id} />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {leaderId
              ? `${nameOf(leaderId)} is ahead by ${Math.abs(aTotal - bTotal)}`
              : "Neck and neck"}
            {" · "}
            {daysLeft === 0
              ? "final day"
              : `${daysLeft * 100} pts still in play`}
          </p>
        </CardContent>
      </Card>

      {/* Prize widget */}
      <Card>
        <CardHeader>
          <CardTitle>This week&apos;s prize</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={effectivePrize}
              placeholder="e.g. Loser cooks dinner 🍝"
              onChange={(e) => {
                setPrize(e.target.value);
                setPrizeDirty(true);
              }}
            />
            <Button onClick={savePrize}>Save</Button>
          </div>
          {currentResult ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Marked paid</span>
              <Switch
                checked={currentResult.prize_paid}
                onCheckedChange={(v) => togglePaid(currentWeek, v)}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Past weeks</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No finished weeks yet — the rivalry starts this week.
          </p>
        ) : (
          history.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Week of {formatDisplayDate(r.week_start)}
                  </span>
                  <span className="flex items-center gap-1 text-sm">
                    {r.winner_id ? (
                      <>
                        <Trophy className="size-4 text-amber-500" />
                        {nameOf(r.winner_id)}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Tie</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    {nameOf(r.user_a)} {Number(r.points_a)}
                  </span>
                  <span>·</span>
                  <span>
                    {nameOf(r.user_b)} {Number(r.points_b)}
                  </span>
                </div>
                {r.prize ? (
                  <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                    <span>🎁 {r.prize}</span>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Paid
                      <Switch
                        checked={r.prize_paid}
                        onCheckedChange={(v) => togglePaid(r.week_start, v)}
                      />
                    </label>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Side({
  name,
  points,
  lead,
}: {
  name?: string;
  points: number;
  lead: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground">
        {name?.split(" ")[0] ?? "—"}
      </span>
      <span className="text-3xl font-bold tabular-nums">{points}</span>
      {lead ? <Trophy className="size-4 text-amber-500" /> : null}
    </div>
  );
}
