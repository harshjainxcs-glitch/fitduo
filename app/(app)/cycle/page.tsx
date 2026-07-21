import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CycleView } from "./cycle-view";

// /cycle — private, opt-in menstrual cycle tracker (Apple-Health style).
export default async function CyclePage() {
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
        No profile found for this account.
      </div>
    );
  }

  if (!profile.tracks_cycle) {
    return (
      <div className="mx-4 mt-8 space-y-4 rounded-3xl border bg-card p-6 text-center shadow-soft">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-100 text-2xl">
          🌸
        </div>
        <h2 className="text-lg font-bold">Cycle tracking</h2>
        <p className="text-sm text-muted-foreground">
          Track your period, symptoms and moods, get gentle predictions, and
          earn your movement points with self-care on the days you need rest.
        </p>
        <Button asChild className="rounded-full">
          <Link href="/settings">Turn it on in Settings</Link>
        </Button>
      </div>
    );
  }

  const { data: partner } = await supabase
    .from("profiles")
    .select("display_name")
    .neq("id", user.id)
    .limit(1)
    .maybeSingle();

  return (
    <CycleView
      userId={user.id}
      profile={profile}
      partnerName={partner?.display_name?.split(" ")[0] ?? "Your partner"}
    />
  );
}
