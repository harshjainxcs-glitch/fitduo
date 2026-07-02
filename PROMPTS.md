# FitDuo — Claude Code Build Playbook (Prompts)

**How to use this file**
1. Create an empty repo/folder. Put **`CLAUDE.md`** and **`PRD.md`** at the root before you start.
2. Open Claude Code in that folder.
3. Paste the prompts **in order**, one at a time. Wait for each to finish, skim the diff, and run the stated **check** before moving on.
4. If something breaks, paste the error back and let Claude fix it before continuing.
5. Prompts assume Claude reads `CLAUDE.md` + `PRD.md` for conventions — don't restate everything.

Legend: 🔑 = you must paste a real value/secret · ✅ = acceptance check.

---

## PHASE 0 — FOUNDATION

### Prompt 0.1 — Scaffold the project
```
Read CLAUDE.md and PRD.md first. Scaffold the FitDuo project per those specs.
- Next.js (App Router) + TypeScript strict, ESLint, Tailwind CSS.
- Install and init shadcn/ui; add: button, card, input, dialog/sheet, tabs, switch, toast/sonner, avatar, progress, badge.
- Add deps: @supabase/supabase-js, @supabase/ssr, @tanstack/react-query, framer-motion, recharts, web-push, date-fns, date-fns-tz.
- Create the exact folder structure from CLAUDE.md §4 (empty placeholder files where needed).
- Set up the PWA manifest (public/manifest.webmanifest) with app name "FitDuo", dark theme colors, and placeholder icons; register it in the root layout. Do NOT build the service worker yet.
- Add a .env.local.example listing every variable from CLAUDE.md §9.
- Add npm scripts: dev, build, lint, typecheck, test, typegen.
- Configure Vitest for unit tests.
Keep it minimal and clean. Don't build features yet.
```
✅ `npm run dev` boots a blank app; `npm run typecheck` passes.

### Prompt 0.2 — Supabase clients & middleware
🔑 You'll need your Supabase URL + anon key in `.env.local`.
```
Wire up Supabase per CLAUDE.md §5.
- lib/supabase/client.ts (browser) and lib/supabase/server.ts (cookie-based server client) using @supabase/ssr.
- middleware.ts: refresh session and gate all /(app) routes — redirect unauthenticated users to /login, and redirect authenticated users away from /login to /today.
- A small server helper getCurrentUser() and getProfile().
Fill .env.local from my values (I've added URL and anon key). Don't create UI yet.
```
✅ `npm run typecheck` passes; visiting any route redirects to `/login`.

### Prompt 0.3 — Database schema + RLS migration
```
Create the full database schema as a Supabase migration in /supabase/migrations, exactly matching PRD.md §6 (profiles, plan_items, meal_logs [with calories], water_logs, workout_logs, push_subscriptions, weekly_results, achievements). Include:
- All columns, defaults, enums/checks, and foreign keys shown in the PRD.
- A CHECK that weight_meals + weight_water + weight_workout = 100.
- Enable RLS on every table with the shared-read + own-write policy pair from CLAUDE.md §3 (authenticated SELECT all; INSERT/UPDATE/DELETE only where user_id = auth.uid()). push_subscriptions: own rows only.
- Create the private Storage bucket "photos" with policies allowing authenticated read and own-prefix writes.
Give me the SQL and the exact commands to apply it. Do not create the scoring views yet.
```
✅ Migration applies cleanly; tables + RLS visible in Supabase.

### Prompt 0.4 — Seed two users + generate types
🔑 Decide the two emails/passwords; disable public signup in Supabase Auth settings.
```
- Create supabase/seed.sql (or a small Node script using the service role key) that creates our TWO auth users and their profiles rows with sensible defaults (water_target_ml, bottle_size_ml, workout_days, weights 60/15/25). Use placeholders EMAIL_A / EMAIL_B I will replace.
- Add an npm script "typegen" that runs `supabase gen types typescript` into lib/types/database.types.ts, and run it now.
- Confirm public signup is expected to be OFF and note where I toggle it.
```
✅ Two users exist; `lib/types/database.types.ts` is populated; typecheck passes.

### Prompt 0.5 — Neutral auth (login + logout)
```
Build the neutral login page per PRD.md §4.1:
- /login: app logo + a generic tagline (nothing revealing) + email/password form. On success go to /today. Friendly inline errors. No signup link.
- A logout action usable from Settings later.
- Dark-mode-first styling with a light toggle wired at the root (next-themes). Store theme preference.
Mobile-first, clean, calm. This page must not hint at what the app does.
```
✅ Can log in as each seeded user; logout returns to `/login`; refresh keeps session.

### Prompt 0.6 — App shell + bottom nav
```
Create the protected /(app) layout: a mobile-first shell with a bottom tab nav — Today, Plan, Us, Weekly, More (links to History + Settings). Add empty placeholder pages for each route with a title. Include the TanStack Query provider and a top area for a greeting/date (in IST). Respect prefers-reduced-motion globally.
```
✅ Navigating between tabs works; layout looks right on a phone viewport.

---

## PHASE 1 — CORE

### Prompt 1.1 — IST date/week utilities (+ tests)
```
Implement lib/utils/date.ts as the ONLY place that computes day/week boundaries, all in Asia/Kolkata (use date-fns-tz, read NEXT_PUBLIC_APP_TZ):
- todayIST(): the current IST calendar date (yyyy-mm-dd).
- weekStartIST(date): the Monday 00:00 IST for a given date.
- dayOfWeekIST(date): 0=Mon … 6=Sun.
- helpers to list the 7 dates of a week, and to format times.
Write Vitest tests covering month/year boundaries and DST-agnostic IST behavior.
```
✅ `npm run test` passes.

### Prompt 1.2 — Scoring engine (+ tests)
```
Implement lib/scoring/scoring.ts exactly per PRD.md §7 and CLAUDE.md §6 as pure functions. Input: planned meal count for the day, completed count, water logged + target, workout done + scheduled, and the user's weights. Output { mealPoints, waterPoints, workoutPoints, total }. Redistribute weights across applicable categories to sum 100; meals proportional, water proportional/capped, workout all-or-nothing; round and cap total at 100. Calories are NOT an input.
Write thorough Vitest tests: all-applicable perfect day = 100; rest-day redistribution = 100; 5/7 meals + 2500/3000 water + no workout ≈ 55; partial water; over-target cap; zero-meal day.
```
✅ Tests pass and match the PRD examples.

### Prompt 1.3 — Scoring SQL views (mirror the engine)
```
Add a migration creating SQL views/functions that mirror lib/scoring/scoring.ts:
- daily_scores(user_id, log_date, meal_points, water_points, workout_points, total) computing the same result server-side from plan_items + logs + profile weights, in IST.
- weekly_scores(user_id, week_start, total).
- An RPC finalize_week(week_start) that upserts weekly_results (both users' totals, winner or tie).
Prove parity: give me a couple of SQL test rows whose totals equal what scoring.ts returns for the same inputs.
```
✅ For identical inputs, `daily_scores` == `scoring.ts`.

### Prompt 1.4 — Settings screen
```
Build /settings per PRD.md §4.1/§5:
- Profile (display_name, avatar upload to the photos bucket).
- Targets: water_target_ml, bottle_size_ml, workout_days (Mon–Sun multi-select).
- Scoring weights (meals/water/workout) with live validation that they sum to 100.
- Notification prefs placeholder (category toggles, quiet hours, water interval) — store in notif_prefs; actual sending comes later.
- Theme toggle + Logout.
Everything writes to the profiles row (own row only). Optimistic UI + toast on save.
```
✅ Saving persists and reloads correctly for both users independently.

### Prompt 1.5 — Weekly plan editor (with optional calories)
```
Build /plan per PRD.md §4.2:
- Edit the current user's recurring weekly plan: for each day (Mon–Sun) and each meal slot from the PRD list, add/edit/remove meal items (title, optional target_time, optional note, optional target_calories, sort_order).
- Convenience actions: "Apply to all days" and "Copy day → day".
- Also edit water target + bottle size + workout days here (or link to Settings — your call, keep one source of truth).
Mobile-first, fast entry, reorderable. target_calories is clearly optional and can be left blank.
```
✅ A full week plan can be created quickly; calories optional; data in `plan_items`.

### Prompt 1.6 — Today: meal quick-log (+photo, +optional calories)
```
Start /today. Render today's planned meals (by IST weekday) grouped by slot, each as a tap-to-complete row. Tapping toggles completed (writes meal_logs with status='completed', optimistic). Each row has an overflow action to: mark skipped, attach a photo (camera/upload to photos bucket, store photo_path), and enter optional calories. Also allow adding an ad-hoc meal (0 points, optional calories/photo). Show a subtle "done/total meals" count. No scoring UI yet.
```
✅ Meals log/unlog instantly; photos upload; calories optional; RLS respected.

### Prompt 1.7 — Today: water logging + ring
```
Add the water tracker to /today: a prominent "+1 bottle" button (uses profile bottle_size_ml) and a "+ custom ml" option; each tap writes a water_log. Show a progress ring toward water_target_ml with logged total and remaining. Allow undo of the last bottle. Optimistic updates.
```
✅ Water logs accumulate; ring fills; undo works.

### Prompt 1.8 — Today: workout logging
```
Add the workout logger to /today: an "Add workout" action opening a sheet (optional type, duration_min, note, optional photo) that writes a workout_log for today. Any log marks today's workout done. Show a small weekly "X of Y workout days" indicator based on workout_days.
```
✅ Workout logs; day marked done; weekly count correct.

### Prompt 1.9 — Today: rings, points, motivation
```
Complete /today's hero:
- Three rings (meals/water/workout) + today's total points computed via lib/scoring/scoring.ts from live data.
- A category breakdown on tap.
- A motivational line from a curated message bank (components/features/motivation) keyed to context (first log, halfway, target hit, comeback, perfect day). Warm, varied, never shaming.
- Confetti/ring-fill celebration on hitting 100 or a category target (Framer Motion, gated by reduced-motion).
- If calories are used today, show a small planned-vs-actual calorie summary; hide if unused.
```
✅ Points match scoring tests; celebrations fire; calorie summary optional.

### Prompt 1.10 — Realtime shared data
```
Add Supabase Realtime subscriptions for meal_logs, water_logs, workout_logs, weekly_results. On any change, invalidate the relevant TanStack Query keys so both partners' views update within seconds. Centralize subscription setup so it's active app-wide while logged in.
```
✅ Logging on one device updates the other within a few seconds.

### Prompt 1.11 — "Us" side-by-side screen
```
Build /us per PRD.md §4.7/§5: show BOTH partners side-by-side — today's three rings + points, current streaks, and this-week head-to-head totals with who's ahead and points remaining. Include each partner's latest meal/workout photo thumbnails. Realtime.
```
✅ Both partners' live data shown correctly.

### Prompt 1.12 — Weekly competition + prize + history
```
Build /weekly per PRD.md §4.8:
- Live current-week head-to-head from weekly_scores (both totals, leader, points remaining).
- A prize widget: set/edit a free-text prize for the current week, and mark prize_paid.
- Finalization: when a past week is viewed and not yet finalized, call finalize_week to freeze results; record winner or tie.
- History list of past weeks: scores, winner, prize, paid status.
```
✅ Standings correct; a completed week finalizes and appears in history.

### Prompt 1.13 — History & insights (with calories)
```
Build /history per PRD.md §5: Recharts visualizations over selectable ranges — daily points, adherence %, water vs target, workouts per week, and (optional) planned-vs-actual calories. Show current and best streaks per user. Keep it readable on mobile.
```
✅ Charts render from real data; calories chart only shows when data exists.

### Prompt 1.14 — Motivation polish + achievements
```
Polish the motivation layer: streak logic (consecutive days ≥ 80, per user), lightweight achievements (first perfect day, 7-day streak, first weekly win) written to the achievements table with a toast on unlock, and a couple more celebratory moments. Keep copy warm and varied; expand the message bank.
```
✅ Streaks compute correctly; an achievement unlocks and toasts once.

---

## PHASE 1.5 — PUSH NOTIFICATIONS (MVP)

### Prompt 1.5.1 — Service worker + push subscription
🔑 Generate VAPID keys (`npx web-push generate-vapid-keys`) into `.env.local`.
```
Implement PWA push per CLAUDE.md §8:
- Create public/sw.js handling 'push' (showNotification with title/body/icon/url) and 'notificationclick' (focus or open the target URL). Register the service worker in the root layout.
- After login, if notifications are supported and not denied, prompt once to enable reminders; on grant, create a PushSubscription with NEXT_PUBLIC_VAPID_PUBLIC_KEY and POST it to /api/push/subscribe, which upserts into push_subscriptions (own rows). Handle unsupported/denied gracefully with an in-app fallback note.
- Add a "Test notification" button in Settings.
Note the iOS "add to home screen" requirement in the enable-reminders UI.
```
✅ Installed PWA can subscribe; a manually triggered test notification arrives.

### Prompt 1.5.2 — Web Push sender
```
Implement lib/push/webpush.ts using the web-push library with VAPID keys (server-only). Expose sendPush(userId, { title, body, url }) that loads the user's push_subscriptions and sends to each, cleaning up expired/invalid (410/404) subscriptions. Add /api/push/subscribe (upsert) and wire the Settings "Test notification" button to a small server action that calls sendPush for the current user.
```
✅ Test button delivers a real push to a subscribed device.

### Prompt 1.5.3 — Reminder scheduler (Vercel Cron)
🔑 Set `CRON_SECRET` in `.env.local` and Vercel; add the cron schedule in `vercel.json`.
```
Build the reminder scheduler per PRD.md §4.5:
- /api/cron/reminders (protected by CRON_SECRET) that runs every ~15 min. It computes, per user in IST and honoring notif_prefs (quiet hours, water interval, category toggles):
  * Water nudges: if behind pace toward water_target_ml during waking hours and the interval has elapsed.
  * Meal reminders: when a planned meal's target_time is due and not yet logged.
  * Weekly: a Monday week-open standing and a Sunday-night week result.
  * Optional partner-activity pings (behind a pref).
  Send via sendPush; avoid duplicate sends within a window (track last-sent in a lightweight table or notif_prefs state).
- Add the Vercel Cron config (every 15 min) in vercel.json and document env setup.
Keep logic testable; give me a way to dry-run it locally.
```
✅ With cron hitting the endpoint, due water/meal reminders arrive on the phone; quiet hours respected.

---

## PHASE 2 — ENHANCEMENTS (optional, later)

### Prompt 2.1 — AI Coach (Claude daily nudge)
🔑 `ANTHROPIC_API_KEY` (server-only).
```
Add an optional AI Coach: a server action that sends a compact summary of today's/this-week's progress (both partners, points, streaks) to the Anthropic API and returns one short, warm, personalized motivational line for the current user. Cache per day. Show it on /today above the message-bank line, with a graceful fallback to the message bank if the API is unavailable. Never expose the API key client-side.
```
✅ A personalized line appears daily; fallback works if the key is missing.

### Prompt 2.2 — AI calorie estimate from meal photo
```
Extend the meal-log photo flow: after a photo is attached, show an optional "Estimate calories" button. It sends the image to the Anthropic multimodal API (server-side) asking for a rough calorie estimate for the meal, then pre-fills the optional calories field for the user to accept or edit. Make clear it's an estimate. Keep it fully optional and never let it affect scoring.
```
✅ For a photo, tapping estimate pre-fills an editable calorie number; scoring unchanged.

---

## Suggested commit points
Commit after each prompt (or at least after 0.6, 1.3, 1.9, 1.14, 1.5.3). Tag `mvp-core` after 1.14 and `mvp-push` after 1.5.3.
