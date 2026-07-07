"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Plus, Send, Trash2, Type, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, signedPhotoUrl } from "@/lib/storage";
import { notifyPartner } from "@/lib/actions/notify";
import { todayIST } from "@/lib/utils/date";
import type { Profile, Story, StoryReply } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type StoryWithUrl = Story & { url: string | null };
type Group = { user: Profile; stories: StoryWithUrl[] };

const DURATION = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;
const POSITIONS = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
] as const;
const COLORS = ["#ffffff", "#111111", "#fbbf24", "#fb7185"];

const firstName = (p: Profile) => p.display_name.split(" ")[0];
const initials = (p: Profile) => p.display_name.slice(0, 2).toUpperCase();

export function Stories({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState<number | null>(null);

  const { data: stories = [] } = useQuery({
    queryKey: ["stories"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<StoryWithUrl[]> => {
      const since = new Date(Date.now() - DAY_MS).toISOString();
      const { data, error } = await createClient()
        .from("stories")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return Promise.all(
        (data ?? []).map(async (s) => ({ ...s, url: await signedPhotoUrl(s.image_path) })),
      );
    },
  });

  const { data: myViews = [] } = useQuery({
    queryKey: ["story_views", currentUserId],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("story_views")
        .select("story_id")
        .eq("user_id", currentUserId);
      if (error) throw error;
      return data;
    },
  });
  const viewedIds = new Set(myViews.map((v) => v.story_id));

  const ordered = [...profiles].sort((a, b) =>
    a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0,
  );
  const groups: Group[] = ordered.map((user) => ({
    user,
    stories: stories.filter((s) => s.user_id === user.id),
  }));
  const activeGroups = groups.filter((g) => g.stories.length > 0);
  const me = ordered.find((p) => p.id === currentUserId);
  const myName = me ? firstName(me) : "Your partner";
  const myGroup = groups.find((g) => g.user.id === currentUserId);
  const myActiveIndex = activeGroups.findIndex((g) => g.user.id === currentUserId);

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {/* Your story */}
        {me ? (
          <StoryCircle
            label="Your story"
            fallback={initials(me)}
            imageUrl={myGroup?.stories[0]?.url ?? null}
            hasStory={(myGroup?.stories.length ?? 0) > 0}
            unseen
            showAdd
            onOpen={() =>
              (myGroup?.stories.length ?? 0) > 0
                ? setViewerStart(myActiveIndex)
                : setComposerOpen(true)
            }
            onAdd={() => setComposerOpen(true)}
          />
        ) : null}

        {/* Partner(s) with active stories */}
        {activeGroups
          .filter((g) => g.user.id !== currentUserId)
          .map((g) => (
            <StoryCircle
              key={g.user.id}
              label={firstName(g.user)}
              fallback={initials(g.user)}
              imageUrl={g.stories[0].url}
              hasStory
              unseen={g.stories.some((s) => !viewedIds.has(s.id))}
              onOpen={() => setViewerStart(activeGroups.indexOf(g))}
            />
          ))}
      </div>

      {composerOpen ? (
        <StoryComposer
          userId={currentUserId}
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false);
            qc.invalidateQueries({ queryKey: ["stories"] });
            void notifyPartner({
              kind: "story_new",
              title: `${me ? firstName(me) : "Your partner"} added a story ✨`,
              url: "/us",
            });
          }}
        />
      ) : null}

      {viewerStart !== null && activeGroups.length > 0 ? (
        <StoryViewer
          key={viewerStart}
          groups={activeGroups}
          startGroupIndex={viewerStart}
          currentUserId={currentUserId}
          myName={myName}
          onClose={() => setViewerStart(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["stories"] });
            qc.invalidateQueries({ queryKey: ["story_views", currentUserId] });
          }}
        />
      ) : null}
    </div>
  );
}

function StoryCircle({
  label,
  fallback,
  imageUrl,
  hasStory,
  unseen,
  showAdd,
  onOpen,
  onAdd,
}: {
  label: string;
  fallback: string;
  imageUrl: string | null;
  hasStory: boolean;
  unseen?: boolean;
  showAdd?: boolean;
  onOpen: () => void;
  onAdd?: () => void;
}) {
  return (
    <div className="relative flex w-16 shrink-0 flex-col items-center gap-1">
      <button type="button" onClick={onOpen} aria-label={label}>
        <span
          className={cn(
            "block rounded-full p-[2.5px]",
            !hasStory
              ? "bg-muted"
              : unseen
                ? "bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-500"
                : "bg-border",
          )}
        >
          <span className="block rounded-full border-2 border-background">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {fallback}
              </span>
            )}
          </span>
        </span>
      </button>
      {showAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add to your story"
          className="absolute right-1 top-11 flex size-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
        >
          <Plus className="size-3" />
        </button>
      ) : null}
      <span className="max-w-[64px] truncate text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function StoryComposer({
  userId,
  onClose,
  onPosted,
}: {
  userId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [editingText, setEditingText] = useState(false);
  const [position, setPosition] = useState<string>("bottom");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function post() {
    if (!file) {
      toast.error("Pick a photo first.");
      return;
    }
    setBusy(true);
    try {
      const path = await uploadPhoto(userId, todayIST(), file);
      const { error } = await createClient().from("stories").insert({
        user_id: userId,
        image_path: path,
        text: text.trim() || null,
        text_color: color,
        text_position: position,
      });
      if (error) throw error;
      toast.success("Story added ✨");
      onPosted();
    } catch {
      toast.error("Couldn't add story.");
    } finally {
      setBusy(false);
    }
  }

  const overlayPos = cn(
    "absolute inset-x-0 px-6 text-center text-2xl font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]",
    position === "top" && "top-16",
    position === "center" && "top-1/2 -translate-y-1/2",
    position === "bottom" && "bottom-28",
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />

      {!preview ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-white">
          <p className="text-lg font-bold">Add to your story</p>
          <div className="flex gap-6">
            <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-2">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-white/15">
                <ImageIcon className="size-7" />
              </span>
              <span className="text-sm">Gallery</span>
            </button>
            <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-white/15">
                <Camera className="size-7" />
              </span>
              <span className="text-sm">Camera</span>
            </button>
          </div>
          <button type="button" onClick={onClose} className="mt-4 text-sm text-white/70">
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button
              type="button"
              aria-label="Back"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setText("");
                setEditingText(false);
              }}
            >
              <X className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => setEditingText((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold"
            >
              <Type className="size-4" /> Text
            </button>
          </div>

          <div className="relative flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="absolute inset-0 size-full object-contain" />
            {text && !editingText ? (
              <span className={overlayPos} style={{ color }}>
                {text}
              </span>
            ) : null}
            {editingText ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-6">
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type something…"
                  rows={3}
                  className="w-full resize-none bg-transparent text-center text-2xl font-extrabold outline-none placeholder:text-white/50"
                  style={{ color }}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            {editingText ? (
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPosition(p.id)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold",
                        position === p.id ? "bg-white text-black" : "bg-white/15 text-white",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Colour ${c}`}
                        onClick={() => setColor(c)}
                        className={cn(
                          "size-6 rounded-full border-2",
                          color === c ? "border-white" : "border-white/40",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => setEditingText(false)} className="text-sm font-bold text-white">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <Button onClick={post} disabled={busy} className="h-12 w-full rounded-full text-base font-semibold">
                {busy ? "Sharing…" : "Share to story"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StoryViewer({
  groups,
  startGroupIndex,
  currentUserId,
  myName,
  onClose,
  onChanged,
}: {
  groups: Group[];
  startGroupIndex: number;
  currentUserId: string;
  myName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const items = groups.flatMap((g) =>
    g.stories.map((s) => ({ group: g, story: s })),
  );
  const startPos = groups
    .slice(0, startGroupIndex)
    .reduce((n, g) => n + g.stories.length, 0);
  const qc = useQueryClient();
  const [pos, setPos] = useState(startPos);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState("");

  const current = items[Math.min(pos, items.length - 1)];
  const storyId = current?.story.id;

  // Auto-advance (paused while replying).
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => {
      if (pos < items.length - 1) setPos((p) => p + 1);
      else onClose();
    }, DURATION);
    return () => clearTimeout(id);
  }, [pos, paused, items.length, onClose]);

  // Mark the current story seen (stable deps → no loop).
  useEffect(() => {
    if (!storyId) return;
    createClient()
      .from("story_views")
      .upsert({ story_id: storyId, user_id: currentUserId }, { onConflict: "story_id,user_id" })
      .then(() => qc.invalidateQueries({ queryKey: ["story_views", currentUserId] }));
  }, [storyId, currentUserId, qc]);

  // Persisted reply thread for the current story (inline chat, no new page).
  const { data: replies = [] } = useQuery({
    queryKey: ["story_replies", storyId],
    enabled: Boolean(storyId),
    queryFn: async (): Promise<StoryReply[]> => {
      const { data, error } = await createClient()
        .from("story_replies")
        .select("*")
        .eq("story_id", storyId as string)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!current) return null;
  const { group, story } = current;
  const isMine = group.user.id === currentUserId;
  const groupStart = groups
    .slice(0, groups.indexOf(group))
    .reduce((n, g) => n + g.stories.length, 0);
  const localIndex = pos - groupStart;

  async function del() {
    await createClient().from("stories").delete().eq("id", story.id);
    onChanged();
    onClose();
  }

  async function sendReply(text: string) {
    const body = text.trim();
    if (!body || !storyId) return;
    setReply("");
    const { error } = await createClient()
      .from("story_replies")
      .insert({ story_id: storyId, user_id: currentUserId, body });
    if (error) {
      toast.error("Couldn't send");
      return;
    }
    qc.invalidateQueries({ queryKey: ["story_replies", storyId] });
    // Only ping the partner when the reply is on their story (not your own).
    if (!isMine) {
      void notifyPartner({
        kind: "story_reply",
        title: `${myName} replied to your story`,
        body,
        url: "/us",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex gap-1 px-3 pt-3">
        {group.stories.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full origin-left bg-white"
              style={
                i < localIndex
                  ? { transform: "scaleX(1)" }
                  : i === localIndex && !paused
                    ? { animation: `story-progress ${DURATION}ms linear forwards` }
                    : i === localIndex
                      ? { transform: "scaleX(0.15)" }
                      : { transform: "scaleX(0)" }
              }
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 text-white">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
          {initials(group.user)}
        </span>
        <span className="flex-1 text-sm font-semibold">{firstName(group.user)}</span>
        {isMine ? (
          <button type="button" aria-label="Delete story" onClick={del}>
            <Trash2 className="size-5" />
          </button>
        ) : null}
        <button type="button" aria-label="Close" onClick={onClose}>
          <X className="size-6" />
        </button>
      </div>

      <div className="relative flex-1">
        {story.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.url} alt="" className="absolute inset-0 size-full object-contain" />
        ) : null}
        {story.text ? (
          <span
            className={cn(
              "absolute inset-x-0 px-6 text-center text-2xl font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]",
              story.text_position === "top" && "top-16",
              story.text_position === "center" && "top-1/2 -translate-y-1/2",
              story.text_position === "bottom" && "bottom-24",
            )}
            style={{ color: story.text_color ?? "#ffffff" }}
          >
            {story.text}
          </span>
        ) : null}

        <button
          type="button"
          aria-label="Previous"
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={() => setPos((p) => Math.max(0, p - 1))}
        />
        <button
          type="button"
          aria-label="Next"
          className="absolute inset-y-0 right-0 w-2/3"
          onClick={() => (pos < items.length - 1 ? setPos((p) => p + 1) : onClose())}
        />
      </div>

      {/* Inline chat thread — replies + reply-to-reply, no new page. */}
      <div className="bg-gradient-to-t from-black/80 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {replies.length > 0 ? (
          <div className="mb-2 max-h-[34vh] space-y-1.5 overflow-y-auto px-1">
            {replies.map((r) => {
              const mine = r.user_id === currentUserId;
              return (
                <div key={r.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <span
                    className={cn(
                      "max-w-[80%] break-words rounded-2xl px-3.5 py-2 text-sm leading-snug",
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-white/15 text-white backdrop-blur-sm",
                    )}
                  >
                    {r.body}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onKeyDown={(e) => e.key === "Enter" && sendReply(reply)}
            placeholder={isMine ? "Add to the thread…" : `Reply to ${firstName(group.user)}…`}
            className="h-11 flex-1 rounded-full border border-white/40 bg-black/30 px-4 text-sm text-white placeholder:text-white/60 focus:border-white/70 focus:outline-none"
          />
          {reply.trim() ? (
            <button
              type="button"
              aria-label="Send reply"
              onClick={() => sendReply(reply)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Send className="size-5" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send love"
              onClick={() => sendReply("❤️")}
              className="flex size-11 shrink-0 items-center justify-center text-2xl"
            >
              ❤️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
