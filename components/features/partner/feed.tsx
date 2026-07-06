"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Heart, ImagePlus, MessageCircle, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, signedPhotoUrl } from "@/lib/storage";
import {
  addDays,
  formatDateTime,
  todayIST,
  weekStartIST,
} from "@/lib/utils/date";
import type { Post, PostComment, PostLike, Profile } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type PostWithUrl = Post & { url: string | null };

export function Feed({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(weekStartIST(todayIST()));
  const [composeOpen, setComposeOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const isThisWeek = weekStart === weekStartIST(todayIST());

  const nameOf = (id: string) =>
    profiles.find((p) => p.id === id)?.display_name.split(" ")[0] ?? "Partner";
  const initialsOf = (id: string) =>
    (profiles.find((p) => p.id === id)?.display_name ?? "??").slice(0, 2).toUpperCase();

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", weekStart],
    queryFn: async (): Promise<PostWithUrl[]> => {
      const { data, error } = await createClient()
        .from("posts")
        .select("*")
        .gte("post_date", weekStart)
        .lte("post_date", weekEnd)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return Promise.all(
        (data ?? []).map(async (p) => ({
          ...p,
          url: await signedPhotoUrl(p.image_path),
        })),
      );
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["post_likes"],
    queryFn: async (): Promise<PostLike[]> => {
      const { data, error } = await createClient().from("post_likes").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["post_comments"],
    queryFn: async (): Promise<PostComment[]> => {
      const { data, error } = await createClient()
        .from("post_comments")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      const supabase = createClient();
      const liked = likes.some((l) => l.post_id === postId && l.user_id === currentUserId);
      if (liked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: currentUserId });
      }
    },
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["post_likes"] });
      const prev = qc.getQueryData<PostLike[]>(["post_likes"]) ?? [];
      const liked = prev.some((l) => l.post_id === postId && l.user_id === currentUserId);
      qc.setQueryData<PostLike[]>(
        ["post_likes"],
        liked
          ? prev.filter((l) => !(l.post_id === postId && l.user_id === currentUserId))
          : [...prev, { post_id: postId, user_id: currentUserId, created_at: "" }],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(["post_likes"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["post_likes"] }),
  });

  async function addComment(postId: string) {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const { error } = await createClient()
      .from("post_comments")
      .insert({ post_id: postId, user_id: currentUserId, body });
    if (error) toast.error("Couldn't send.");
    else qc.invalidateQueries({ queryKey: ["post_comments"] });
  }

  async function createPost() {
    if (!file) {
      toast.error("Pick a photo first.");
      return;
    }
    setBusy(true);
    try {
      const path = await uploadPhoto(currentUserId, todayIST(), file);
      const { error } = await createClient().from("posts").insert({
        user_id: currentUserId,
        post_date: todayIST(),
        image_path: path,
        caption: caption.trim() || null,
      });
      if (error) throw error;
      setComposeOpen(false);
      setFile(null);
      setCaption("");
      setWeekStart(weekStartIST(todayIST()));
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Shared 💛");
    } catch {
      toast.error("Couldn't share.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(id: string) {
    await createClient().from("posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["posts"] });
  }

  return (
    <div className="space-y-4">
      {/* Header + week nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="size-5" />
          </Button>
          <span className="text-sm font-bold">
            {isThisWeek ? "This week" : `Week of ${weekStart.slice(8)}/${weekStart.slice(5, 7)}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            disabled={isThisWeek}
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <Button size="sm" className="rounded-full" onClick={() => setComposeOpen(true)}>
          <ImagePlus className="mr-1 size-4" /> Share
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isThisWeek
            ? "No moments yet this week. Share a photo — your partner will love it. 💛"
            : "No moments this week."}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const postComments = comments
              .filter((c) => c.post_id === post.id)
              .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
            const likeCount = likes.filter((l) => l.post_id === post.id).length;
            const likedByMe = likes.some((l) => l.post_id === post.id && l.user_id === currentUserId);
            const showComments = openComments === post.id;
            return (
              <article key={post.id} className="overflow-hidden rounded-3xl border bg-card shadow-soft">
                <div className="flex items-center gap-2 px-4 py-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                      {initialsOf(post.user_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{nameOf(post.user_id)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(post.created_at)}</p>
                  </div>
                  {post.user_id === currentUserId ? (
                    <Button variant="ghost" size="icon" aria-label="Delete post" onClick={() => deletePost(post.id)}>
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  ) : null}
                </div>

                {post.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.url} alt={post.caption ?? "Moment"} className="aspect-square w-full object-cover" />
                ) : null}

                <div className="space-y-2 px-4 py-3">
                  <div className="flex items-center gap-4">
                    <button type="button" aria-label="Like" className="flex items-center gap-1.5" onClick={() => toggleLike.mutate(post.id)}>
                      <Heart className={cn("size-6 transition-colors", likedByMe ? "fill-coral text-coral" : "text-muted-foreground")} />
                      {likeCount > 0 ? <span className="text-sm font-medium">{likeCount}</span> : null}
                    </button>
                    <button type="button" aria-label="Comments" className="flex items-center gap-1.5" onClick={() => setOpenComments(showComments ? null : post.id)}>
                      <MessageCircle className="size-6 text-muted-foreground" />
                      {postComments.length > 0 ? <span className="text-sm font-medium">{postComments.length}</span> : null}
                    </button>
                  </div>

                  {post.caption ? (
                    <p className="text-sm">
                      <span className="font-semibold">{nameOf(post.user_id)}</span> {post.caption}
                    </p>
                  ) : null}

                  {!showComments && postComments.length > 0 ? (
                    <button type="button" className="text-xs text-muted-foreground" onClick={() => setOpenComments(post.id)}>
                      View {postComments.length} comment{postComments.length > 1 ? "s" : ""}
                    </button>
                  ) : null}

                  {showComments ? (
                    <div className="space-y-2 pt-1">
                      {postComments.map((c) => (
                        <p key={c.id} className="text-sm">
                          <span className="font-semibold">{nameOf(c.user_id)}</span> {c.body}
                        </p>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addComment(post.id);
                          }}
                          placeholder="Add a comment…"
                          className="h-9 rounded-full"
                        />
                        <Button size="icon" aria-label="Send comment" onClick={() => addComment(post.id)}>
                          <Send className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Sheet open={composeOpen} onOpenChange={setComposeOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Share a moment</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <label className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed bg-muted/40 text-sm text-muted-foreground">
              {file ? file.name : "Tap to pick a photo 📷"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say something…" />
          </div>
          <SheetFooter>
            <Button onClick={createPost} disabled={busy} className="w-full rounded-full">
              {busy ? "Sharing…" : "Share"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
