import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PlanEditor } from "@/components/features/plan/plan-editor";
import { dayOfWeekIST, todayIST } from "@/lib/utils/date";

// /plan (PRD.md §4.2): edit your own recurring weekly plan with custom meals,
// and view your partner's plan read-only. Water/workout targets live in Settings.
export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name")
    .order("created_at");
  const partner = profiles?.find((p) => p.id !== user.id) ?? null;

  return (
    <PlanEditor
      userId={user.id}
      partner={partner}
      initialDay={dayOfWeekIST(todayIST())}
    />
  );
}
