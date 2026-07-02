import { BottomNav } from "@/components/bottom-nav";
import { RealtimeSync } from "@/components/realtime-sync";
import { PushManager } from "@/components/features/notifications/push-manager";
import { getProfile } from "@/lib/supabase/server";
import { formatDisplayDate, greeting } from "@/lib/utils/date";

// Protected app shell (CLAUDE.md §4/§10): mobile-first, greeting + IST date,
// bottom tab nav. Auth is enforced in middleware.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const firstName = profile?.display_name?.split(" ")[0];
  const initials = (profile?.display_name ?? "FD").slice(0, 2).toUpperCase();

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
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {initials}
        </div>
      </header>

      <PushManager />
      <main className="flex-1 pb-24">{children}</main>

      <RealtimeSync />
      <BottomNav />
    </div>
  );
}
