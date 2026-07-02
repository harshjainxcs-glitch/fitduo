import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { HistoryView } from "./history-view";

// /history (PRD.md §5): charts over selectable ranges + streaks.
export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");

  const me = profiles?.find((p) => p.id === user.id);
  if (!me) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        No profile yet — run <code>npm run seed</code>.
      </div>
    );
  }

  return (
    <HistoryView profile={me} profiles={profiles ?? []} currentUserId={user.id} />
  );
}
