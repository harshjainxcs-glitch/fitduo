"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push/webpush";

// Records a partner-facing activity (for the bell) and fires an instant push.
// Fire-and-forget from the client after an event (post/like/comment/task/story).
export async function notifyPartner(input: {
  kind: string;
  title: string;
  body?: string;
  url?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: partners } = await admin
    .from("profiles")
    .select("id")
    .neq("id", user.id)
    .limit(1);
  const partnerId = partners?.[0]?.id;
  if (!partnerId) return;

  await admin.from("activities").insert({
    actor_id: user.id,
    recipient_id: partnerId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    url: input.url ?? null,
  });

  try {
    await sendPush(partnerId, {
      title: input.title,
      body: input.body ?? "",
      url: input.url ?? "/us",
      tag: input.kind,
    });
  } catch {
    // push is best-effort; the activity row is still recorded
  }
}
