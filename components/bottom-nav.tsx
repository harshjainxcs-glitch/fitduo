"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LineChart,
  Menu,
  Settings,
  Trophy,
  Users,
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
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/us", label: "Us", icon: Users },
  { href: "/weekly", label: "Weekly", icon: Trophy },
] as const;

const MORE_LINKS = [
  { href: "/history", label: "History", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
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
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              moreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu className="size-5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
              <SheetDescription className="sr-only">
                Additional pages and settings
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-1 px-4 pb-8">
              {MORE_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent"
                >
                  <Icon className="size-5 text-muted-foreground" />
                  {label}
                </Link>
              ))}
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
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
