"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/date";
import type { Activity } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function NotificationBell() {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await createClient()
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data;
    },
  });
  const unread = items.filter((a) => !a.read).length;

  async function markAllRead() {
    await createClient().from("activities").update({ read: true }).eq("read", false);
    qc.invalidateQueries({ queryKey: ["activities"] });
  }

  async function openItem(a: Activity) {
    if (!a.read) {
      await createClient().from("activities").update({ read: true }).eq("id", a.id);
      qc.invalidateQueries({ queryKey: ["activities"] });
    }
    setOpen(false);
    if (a.url) router.push(a.url);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
        className="relative flex size-10 items-center justify-center rounded-full bg-muted"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[80vh] max-w-md overflow-y-auto rounded-t-3xl">
          <SheetHeader className="flex-row items-center justify-between space-y-0">
            <SheetTitle>Activity</SheetTitle>
            {unread > 0 ? (
              <button type="button" className="pr-6 text-xs font-medium text-primary" onClick={markAllRead}>
                Mark all read
              </button>
            ) : null}
          </SheetHeader>
          <div className="space-y-1 px-4 pb-8">
            {items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No activity yet.
              </p>
            ) : (
              items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openItem(a)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left",
                    !a.read && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      a.read ? "bg-transparent" : "bg-coral",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.body ? (
                      <p className="truncate text-xs text-muted-foreground">{a.body}</p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
