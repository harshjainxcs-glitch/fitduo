"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyPartner } from "@/lib/actions/notify";
import { formatDateTime } from "@/lib/utils/date";
import type { TaskComment } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaskComments({
  taskId,
  taskTitle,
  userId,
  meName,
  partner,
}: {
  taskId: string;
  taskTitle: string;
  userId: string;
  meName: string;
  partner: { id: string; display_name: string } | null;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["task_comments", taskId],
    queryFn: async (): Promise<TaskComment[]> => {
      const { data, error } = await createClient()
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const nameOf = (id: string) =>
    id === userId ? meName : (partner?.display_name.split(" ")[0] ?? "Partner");

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const { error } = await createClient()
      .from("task_comments")
      .insert({ task_id: taskId, user_id: userId, body });
    if (error) {
      toast.error("Couldn't send.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["task_comments", taskId] });
    void notifyPartner({
      kind: "task_comment",
      title: `${meName} on "${taskTitle}"`,
      body,
      url: "/calendar",
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Updates
      </p>
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No updates yet — start the conversation.
        </p>
      ) : null}
      {comments.map((c) => (
        <div key={c.id} className="rounded-2xl bg-muted/50 px-3 py-2">
          <p className="text-sm">
            <span className="font-semibold">{nameOf(c.user_id)}</span> {c.body}
          </p>
          <p className="text-[10px] text-muted-foreground">{formatDateTime(c.created_at)}</p>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Give an update…"
          className="h-11 rounded-full"
        />
        <Button size="icon" aria-label="Send update" onClick={send}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
