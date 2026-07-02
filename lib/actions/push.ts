"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push/webpush";

// Sends a test push to the current user's devices (wired to Settings button).
export async function sendTestNotification(): Promise<{
  ok: boolean;
  sent: number;
  message: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, sent: 0, message: "Not signed in." };

  try {
    const { sent } = await sendPush(user.id, {
      title: "FitDuo",
      body: "🔔 Test notification — reminders are working!",
      url: "/today",
      tag: "test",
    });
    if (sent === 0) {
      return {
        ok: false,
        sent: 0,
        message: "No subscribed device found. Tap “Enable reminders” first.",
      };
    }
    return { ok: true, sent, message: `Sent to ${sent} device(s).` };
  } catch {
    return { ok: false, sent: 0, message: "Push isn't configured on the server." };
  }
}
