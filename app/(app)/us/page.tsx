import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { UsView } from "./us-view";

// /us (PRD.md §4.7): both partners side-by-side, live.
export default async function UsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");

  if (!profiles || profiles.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        No profiles yet — run <code>npm run seed</code>.
      </div>
    );
  }

  return <UsView profiles={profiles} currentUserId={user.id} />;
}
