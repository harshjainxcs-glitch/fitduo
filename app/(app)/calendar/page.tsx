import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { CalendarView } from "@/components/features/calendar/calendar-view";
import { todayIST } from "@/lib/utils/date";

// /calendar: personal daily timetable with Day/Week/Year views. Partners share
// visibility and can add tasks to each other's calendars.
export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name")
    .order("created_at");
  const partner = profiles?.find((p) => p.id !== user.id) ?? null;

  return <CalendarView userId={user.id} partner={partner} today={todayIST()} />;
}
