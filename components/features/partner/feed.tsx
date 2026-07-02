"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Heart, UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signedPhotoUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/utils/date";
import type { Profile } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Post {
  id: string;
  userId: string;
  kind: "meal" | "workout";
  caption: string;
  loggedAt: string;
  url: string | null;
}

export function Feed({ profiles }: { profiles: Profile[] }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const nameOf = (id: string) =>
    profiles.find((p) => p.id === id)?.display_name.split(" ")[0] ?? "Someone";
  const initialsOf = (id: string) =>
    (profiles.find((p) => p.id === id)?.display_name ?? "??")
      .slice(0, 2)
      .toUpperCase();

  const { data: mealPosts = [] } = useQuery({
    queryKey: ["meal_logs", "feed"],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await createClient()
        .from("meal_logs")
        .select("id,user_id,note,photo_path,logged_at")
        .not("photo_path", "is", null)
        .order("logged_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return Promise.all(
        (data ?? []).map(async (r) => ({
          id: r.id,
          userId: r.user_id,
          kind: "meal" as const,
          caption: r.note || "Meal",
          loggedAt: r.logged_at,
          url: r.photo_path ? await signedPhotoUrl(r.photo_path) : null,
        })),
      );
    },
  });

  const { data: workoutPosts = [] } = useQuery({
    queryKey: ["workout_logs", "feed"],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await createClient()
        .from("workout_logs")
        .select("id,user_id,type,note,photo_path,logged_at")
        .not("photo_path", "is", null)
        .order("logged_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return Promise.all(
        (data ?? []).map(async (r) => ({
          id: r.id,
          userId: r.user_id,
          kind: "workout" as const,
          caption: r.note || r.type || "Workout",
          loggedAt: r.logged_at,
          url: r.photo_path ? await signedPhotoUrl(r.photo_path) : null,
        })),
      );
    },
  });

  const posts = [...mealPosts, ...workoutPosts]
    .filter((p) => p.url)
    .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));

  if (posts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No moments yet. Snap a photo when you log a meal or workout — it shows up
        here for both of you. 📸
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const Icon = post.kind === "meal" ? UtensilsCrossed : Dumbbell;
        const isLiked = liked[post.id];
        return (
          <article
            key={`${post.kind}-${post.id}`}
            className="overflow-hidden rounded-3xl border bg-card shadow-soft"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                  {initialsOf(post.userId)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {nameOf(post.userId)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(post.loggedAt)}
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <Icon className="size-3" />
                {post.kind === "meal" ? "Meal" : "Workout"}
              </span>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.url ?? ""}
              alt={post.caption}
              className="aspect-square w-full object-cover"
            />

            <div className="space-y-1 px-4 py-3">
              <button
                type="button"
                aria-label="Like"
                onClick={() =>
                  setLiked((l) => ({ ...l, [post.id]: !l[post.id] }))
                }
                className="flex items-center gap-1"
              >
                <Heart
                  className={cn(
                    "size-6 transition-colors",
                    isLiked ? "fill-coral text-coral" : "text-muted-foreground",
                  )}
                />
              </button>
              <p className="text-sm">
                <span className="font-semibold">{nameOf(post.userId)}</span>{" "}
                {post.caption}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
