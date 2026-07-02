# CLAUDE.md — FitDuo Build Guide

Operating context for Claude Code on **FitDuo**. Read before every task. When in doubt, follow this file over habit. Full scope + scoring live in `PRD.md` (source of truth).

## 1. What we're building
A **private, two-user** PWA for a couple to plan and track diet + water + workouts, earning **normalized daily points (max 100)**, sharing progress in real time, competing weekly for a prize. **Optional, manual calorie tracking** per meal (never scored). **Push notifications** for water/meal reminders. Warm, motivational, playful.

## 2. Stack (do not swap without being asked)
- **Next.js (App Router) + TypeScript** (strict).
- **Supabase**: Postgres + RLS, Auth (email/password, **public signup disabled**), Storage (`photos`), Realtime.
- **Tailwind + shadcn/ui**, **Framer Motion** (animation), **Recharts** (charts).
- **TanStack Query** + optimistic updates (or server actions where cleaner).
- **PWA**: manifest + service worker + **Web Push (VAPID)**.
- **Vercel** deploy; **Vercel Cron** for the reminder scheduler.

## 3. Golden rules
- **Two users only. Never build public sign-up.** Accounts are seeded. `/login` must reveal nothing about the app.
- **Timezone `Asia/Kolkata`.** All day/week boundaries in IST; week starts **Monday**. Centralize in `lib/utils/date.ts`; never compute boundaries inline.
- **Scoring defined once** in `lib/scoring/scoring.ts` (pure, unit-tested), mirrored by the `daily_scores` SQL view. They must agree. **Calories never affect scoring.**
- **RLS everywhere.** Shared tables: authenticated users `SELECT` all rows; `INSERT/UPDATE/DELETE` only where `user_id = auth.uid()`. Verify after each migration.
- **Type-safe.** No `any` in domain code. Use generated `lib/types/database.types.ts`.
- **Mobile-first.** Phone-first; big tap targets; logging is 1–2 taps and feels instant (optimistic). Respect `prefers-reduced-motion`.
- **Calories are optional & informational.** Blank when unused; must never block a log or change points.
- **Secrets are server-only.** Service role key, VAPID private key, Anthropic key, CRON secret never reach the client.

## 4. Folder structure
```
/app
  /(auth)/login/page.tsx
  /(app)/today|plan|us|weekly|history|settings/page.tsx
  /(app)/layout.tsx           # protected shell + bottom nav
  /api/push/subscribe/route.ts
  /api/cron/reminders/route.ts   # Vercel Cron target (secret-protected)
  layout.tsx                  # providers, theme, PWA registration
middleware.ts                 # auth gate → /login
/components/ui                # shadcn
/components/features/{meals,water,workout,plan,scoring,partner,weekly,motivation,calories,notifications}
/lib/supabase                 # client.ts, server.ts, middleware.ts
/lib/scoring/scoring.ts + scoring.test.ts
/lib/push/webpush.ts          # web-push sender (VAPID)
/lib/utils/date.ts            # IST day/week helpers (ONLY place)
/lib/types/database.types.ts  # generated
/supabase/migrations/*.sql
/supabase/seed.sql            # 2 users + profiles
/public                       # icons, manifest.webmanifest, sw.js
```

## 5. Supabase conventions
- Two clients: browser (`lib/supabase/client.ts`) and server (`lib/supabase/server.ts`, cookie-based). Never expose service role to the browser.
- Schema changes via **migration files** only; regenerate types after.
- **RLS on every table** with the shared-read + own-write policy pair.
- Storage `photos` **private**; signed URLs; path `{user_id}/{yyyy-mm-dd}/{uuid}.jpg`.
- Realtime: subscribe to `meal_logs`, `water_logs`, `workout_logs`, `weekly_results`; invalidate matching TanStack Query keys on events.

## 6. Scoring — implementation contract
`lib/scoring/scoring.ts` = pure functions returning `{ mealPoints, waterPoints, workoutPoints, total }`. Rules (detail + examples in `PRD.md §7`): base weights 60/15/25 → keep only applicable categories → redistribute to sum 100 → meals `eff×completed/planned`, water `eff×min(1,logged/target)`, workout all-or-nothing → `round`, cap 100. **Write tests first** (perfect day, rest-day redistribution, partial meals, partial water, cap). Mirror in the `daily_scores` SQL view.

## 7. Calories — implementation contract
- `plan_items.target_calories int null`, `meal_logs.calories int null`.
- UI: optional numeric fields in the plan editor and the meal-log sheet; skip cleanly if empty.
- Summaries: daily/weekly planned-vs-actual on Today + History; hidden when no data.
- **Never** feed calories into scoring. Phase 2: optional "estimate from photo" via Anthropic multimodal API pre-filling the number.

## 8. Push / PWA — implementation contract
- Web manifest + service worker (`public/sw.js`) handling `push` → `showNotification`, and `notificationclick` → focus/open the app.
- Subscription: request permission after login (once), `POST` the subscription to `/api/push/subscribe`, upsert into `push_subscriptions`.
- Send via `web-push` with VAPID keys in `lib/push/webpush.ts`.
- **Scheduler:** `/api/cron/reminders` (guarded by `CRON_SECRET`) runs on Vercel Cron (~every 15 min): compute due water/meal/partner/weekly nudges honoring `notif_prefs` (quiet hours, water interval), then send.
- iOS: web push only works when installed to home screen (16.4+); handle unsupported/denied gracefully with in-app fallback.

## 9. Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server only
NEXT_PUBLIC_APP_TZ=Asia/Kolkata
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=               # server only
CRON_SECRET=                     # protects the cron route
ANTHROPIC_API_KEY=               # Phase 2, server only
```

## 10. UI / UX principles
- Warm, encouraging, **never shaming**; copy from the motivation message bank.
- Celebrate wins with Framer Motion (gate behind reduced-motion).
- Three rings (meals/water/workout) anchor Today and Us.
- Bottom nav: Today · Plan · Us · Weekly · More(History/Settings).
- **Dark-mode-first + light toggle.**
- Optimistic updates on every log tap; reconcile on response.

## 11. Commands
```
npm run dev | build | lint | typecheck | test
npm run typegen        # supabase gen types typescript > lib/types/database.types.ts
supabase db push       # apply migrations
```

## 12. Do / Don't
**Do:** small feature-scoped components; shared logic in `lib`; regenerate types after schema changes; test scoring; verify RLS; keep login neutral; handle push-denied gracefully.
**Don't:** add signup; compute IST dates or scoring inline; let calories touch scoring; use `any` in domain code; put secrets client-side; swap the stack or add heavy deps unasked; over-engineer (it's a 2-person app).

## 13. Definition of done (every task)
- `npm run lint && npm run typecheck && npm run test` clean.
- RLS holds; scoring display == `scoring.ts` == `daily_scores`.
- Mobile-first + installable PWA; reduced-motion respected.
- If touching push: a real notification arrives on a subscribed device.
- Realtime change shows on partner's device within seconds.
