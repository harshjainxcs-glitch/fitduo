import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Auth gate → /login (CLAUDE.md §5). Next 16 renames this convention to
// "proxy"; middleware still works. Excludes static assets, PWA files, and
// /api routes (which do their own auth).
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|api).*)",
  ],
};
