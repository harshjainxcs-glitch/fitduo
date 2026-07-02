import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { PlanEditor } from "@/components/features/plan/plan-editor";
import { dayOfWeekIST, todayIST } from "@/lib/utils/date";

// /plan (PRD.md §4.2): edit the current user's recurring weekly plan.
// Water/bottle/workout-day targets live in Settings (single source of truth).
export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <PlanEditor userId={user.id} initialDay={dayOfWeekIST(todayIST())} />;
}
