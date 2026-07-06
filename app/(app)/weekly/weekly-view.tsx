"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, signedPhotoUrl } from "@/lib/storage";
import { formatDisplayDate, todayIST, weekStartIST, dayOfWeekIST } from "@/lib/utils/date";
import type { WeeklyResult } from "@/lib/types/database.types";
import { Confetti } from "@/components/features/motivation/confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MiniProfile = { id: string; display_name: string };

export function WeeklyView({
  profiles,
  currentUserId,
}: {
  profiles: MiniProfile[];
  currentUserId: string;
}) {
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

  async function uploadProof(week: string, file: File) {
    try {
      const path = await uploadPhoto(currentUserId, todayIST(), file);
      const { error } = await supabase
        .from("weekly_results")
        .update({ prize_photo_path: path, prize_paid: true })
        .eq("week_start", week);
      if (error) throw error;
      toast.success("Prize logged 🎁");
      qc.invalidateQueries({ queryKey: ["weekly_results"] });
    } catch {
      toast.error("Couldn't upload the proof photo.");
    }
  }

  const history = results.filter((r) => r.week_start < currentWeek);
  const latest = history[0];
  const iWon = Boolean(latest && latest.winner_id === currentUserId);

  return (
    <div className="space-y-6 px-4 py-2">
      {/* Winner celebration */}
      {iWon && latest ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-2 to-forest p-5 text-center text-cream shadow-soft">
          <Confetti />
          <p className="text-3xl">🏆</p>
          <p className="mt-1 text-lg font-extrabold">You won last week!</p>
          <p className="text-sm text-cream/80">
            {latest.prize
              ? latest.prize_photo_path
                ? "Prize collected 💛"
                : `Claim your prize: ${latest.prize}`
              : "Champion of the week."}
          </p>
        </div>
      ) : null}

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
          <p className="text-xs text-muted-foreground">
            When the week ends, the winner claims it — log a photo as proof.
          </p>
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
                  <PrizeBlock result={r} onUpload={(f) => uploadProof(r.week_start, f)} />
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

function PrizeBlock({
  result,
  onUpload,
}: {
  result: WeeklyResult;
  onUpload: (file: File) => void;
}) {
  const { data: url } = useQuery({
    queryKey: ["prize_photo", result.prize_photo_path],
    enabled: Boolean(result.prize_photo_path),
    queryFn: async () =>
      result.prize_photo_path ? signedPhotoUrl(result.prize_photo_path) : null,
  });

  return (
    <div className="rounded-xl bg-muted px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">🎁 {result.prize}</span>
        {result.prize_photo_path ? (
          <span className="shrink-0 text-xs font-semibold text-primary">Given ✓</span>
        ) : (
          <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-amber-600">
            <Camera className="size-3" /> Due — log photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        )}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Prize proof" className="mt-2 h-36 w-full rounded-lg object-cover" />
      ) : null}
    </div>
  );
}
