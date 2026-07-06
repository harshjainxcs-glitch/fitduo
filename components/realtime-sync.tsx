"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// App-wide Supabase Realtime (CLAUDE.md §5). Any change to a shared log table
// invalidates the matching TanStack Query keys (prefix match covers every user
// and date), so both partners' views update within seconds.
const TABLES = [
  "meal_logs",
  "water_logs",
  "workout_logs",
  "weekly_results",
  "calendar_tasks",
  "posts",
  "post_likes",
  "post_comments",
  "meal_groups",
  "stories",
  "story_views",
  "activities",
  "task_comments",
] as const;

export function RealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("fitduo-realtime");

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          qc.invalidateQueries({ queryKey: [table] });
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return null;
}
