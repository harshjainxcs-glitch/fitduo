"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  Flower2,
  Home,
  LineChart,
  Settings,
  Trophy,
  Users,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const TABS = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/us", label: "Feed", icon: Users },
] as const;

const BASE_MORE_LINKS = [
  { href: "/weekly", label: "Weekly", icon: Trophy },
  { href: "/history", label: "History", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const CYCLE_LINK = { href: "/cycle", label: "Cycle", icon: Flower2 } as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ showCycle = false }: { showCycle?: boolean }) {
  const pathname = usePathname();
  const moreLinks = showCycle
    ? [CYCLE_LINK, ...BASE_MORE_LINKS]
    : BASE_MORE_LINKS;
  const moreActive = moreLinks.some((l) => isActive(pathname, l.href));

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/5 bg-card/95 p-1.5 shadow-float backdrop-blur">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[10px] font-semibold transition active:scale-95",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[10px] font-semibold transition-colors",
              moreActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu className="size-5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
              <SheetDescription className="sr-only">
                Additional pages and settings
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-1 px-4 pb-8">
              {moreLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm hover:bg-accent"
                >
                  <Icon className="size-5 text-muted-foreground" />
                  {label}
                </Link>
              ))}
              <div className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm">
                <span>Theme</span>
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
