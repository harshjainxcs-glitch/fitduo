import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CycleView } from "./cycle-view";

// /cycle — opt-in menstrual cycle tracker (Apple-Health style).
// Shared between the two partners only (RLS shared-read); logging stays private
// to the person whose cycle it is. If you don't track your own but your partner
// does, you see theirs read-only so you can support them.
export default async function CyclePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");

  const self = profiles?.find((p) => p.id === user.id);
  const other = profiles?.find((p) => p.id !== user.id);

  if (!self) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        No profile found for this account.
      </div>
    );
  }

  const selfTracks = self.tracks_cycle;
  const partnerTracks = other?.tracks_cycle ?? false;

  if (!selfTracks && !partnerTracks) {
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

  // Prefer your own cycle; otherwise show your partner's (read-only).
  const subject = selfTracks ? self : (other as NonNullable<typeof other>);
  const mode = subject.id === user.id ? "own" : "partner";
  const supporter = profiles?.find((p) => p.id !== subject.id);

  return (
    <CycleView
      viewerId={user.id}
      subject={subject}
      mode={mode}
      subjectName={subject.display_name.split(" ")[0]}
      supporterName={supporter?.display_name?.split(" ")[0] ?? "Your partner"}
    />
  );
}
