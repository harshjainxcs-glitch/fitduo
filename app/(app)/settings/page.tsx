import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

// /settings (PRD.md §4.1/§5): profile, targets, scoring weights, notification
// prefs, theme, logout. Writes to the current user's own profile row.
export default async function SettingsPage() {
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
      <div className="px-4 py-6">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No profile found for this account. Seed it with{" "}
          <code>npm run seed</code>.
        </p>
      </div>
    );
  }

  return <SettingsForm userId={user.id} profile={profile} />;
}
