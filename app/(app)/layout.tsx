import { Sparkles } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { RealtimeSync } from "@/components/realtime-sync";
import { PushManager } from "@/components/features/notifications/push-manager";
import { createClient, getProfile } from "@/lib/supabase/server";
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
  const profile = await getProfile();
  const firstName = profile?.display_name?.split(" ")[0];
  const initials = (profile?.display_name ?? "FD").slice(0, 2).toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let points = 0;
  if (user) {
    const { data } = await supabase
      .from("weekly_scores")
      .select("total")
      .eq("user_id", user.id)
      .eq("week_start", weekStartIST(todayIST()))
      .maybeSingle();
    points = Math.round(Number(data?.total ?? 0));
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
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initials}
          </div>
        </div>
      </header>

      <PushManager />
      <main className="flex-1 pb-28">{children}</main>

      <RealtimeSync />
      <BottomNav />
    </div>
  );
}
