import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { TodayView } from "./today-view";

// /today (PRD.md §5): rings, points, meal/water/workout quick-log, motivation.
export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        No profile yet — run <code>npm run seed</code>.
      </div>
    );
  }

  return <TodayView userId={user.id} profile={profile} />;
}
