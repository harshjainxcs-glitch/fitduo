import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { WeeklyView } from "./weekly-view";

// /weekly (PRD.md §4.8): live head-to-head, prize widget, finalize + history.
export default async function WeeklyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name")
    .order("created_at");

  if (!profiles || profiles.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        No profiles yet — run <code>npm run seed</code>.
      </div>
    );
  }

  return <WeeklyView profiles={profiles} currentUserId={user.id} />;
}
