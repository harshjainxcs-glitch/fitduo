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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="px-4 pb-2 pt-6">
        <p className="text-sm text-muted-foreground">{formatDisplayDate()}</p>
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting()}
          {firstName ? `, ${firstName}` : ""} 👋
        </h1>
      </header>

      <PushManager />
      <main className="flex-1 pb-24">{children}</main>

      <RealtimeSync />
      <BottomNav />
    </div>
  );
}
