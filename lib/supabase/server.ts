import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database, Profile } from "@/lib/types/database.types";

// Supabase server client (cookie-based). Use in Server Components, Route Handlers,
// and Server Actions. Never expose the service role key to the browser.
// Cached per request so the same render reuses one client (and its getUser).
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies are read-only here.
            // Session refresh is handled in middleware, so this is safe to ignore.
          }
        },
      },
    },
  );
});

/**
 * The authenticated user, or null. Verified against the auth server.
 * cache() dedupes the getUser network call across the layout + page in a single
 * request render (was firing 3-4× per navigation).
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The current user's profile row, or null if unauthenticated / missing. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
});
