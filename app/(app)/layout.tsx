import { Sparkles } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { BottomNav } from "@/components/bottom-nav";
import { RealtimeSync } from "@/components/realtime-sync";
import { PushManager } from "@/components/features/notifications/push-manager";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  formatDisplayDate,
  greeting,
  todayIST,
  weekStartIST,
} from "@/lib/utils/date";

// Protected app shell (CLAUDE.md §4/§10): mobile-first, greeting + points,
// bottom tab nav. Auth is enforced in middleware.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // One (cached) getUser, then profile + points in parallel.
  const user = await getCurrentUser();
  let firstName: string | undefined;
  let initials = "FD";
  let points = 0;
  let tracksCycle = false;
  if (user) {
    const supabase = await createClient();
    const [{ data: profile }, { data: score }] = await Promise.all([
      supabase.from("profiles").select("display_name,tracks_cycle").eq("id", user.id).single(),
      supabase
        .from("weekly_scores")
        .select("total")
        .eq("user_id", user.id)
        .eq("week_start", weekStartIST(todayIST()))
        .maybeSingle(),
    ]);
    firstName = profile?.display_name?.split(" ")[0];
    initials = (profile?.display_name ?? "FD").slice(0, 2).toUpperCase();
    points = Math.round(Number(score?.total ?? 0));
    tracksCycle = Boolean(profile?.tracks_cycle);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pb-3 pt-7">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {formatDisplayDate()}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-extrabold text-accent-foreground">
            <Sparkles className="size-3.5" />
            {points}
          </span>
          <NotificationBell />
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initials}
          </div>
        </div>
      </header>

      <PushManager />
      <main className="flex-1 pb-28">{children}</main>

      <RealtimeSync />
      <BottomNav showCycle={tracksCycle} />
    </div>
  );
}
