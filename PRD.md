# FitDuo — Product Requirements Document (PRD)

> **Working name:** FitDuo (placeholder — safe to find-replace across the codebase).
> **Version:** 1.1 (adds calorie tracking + push notifications in MVP)
> **Owner:** Rohit
> **Stack:** Next.js (App Router) · TypeScript · Supabase (Postgres, Auth, Storage, Realtime) · Tailwind + shadcn/ui · Vercel · PWA (Web Push)

---

## 1. Overview & Vision

FitDuo is a **private, two-person** web app (installable PWA) for a couple on a shared fitness journey. Both partners **plan** the week's meals, water, and workouts in advance, then **log** adherence day-to-day, earning **normalized daily points (max 100/day)** regardless of how different their individual plans are. Both partners see each other's progress in real time, and **each week ends in a friendly head-to-head where the winner gets a prize from the loser.**

Optionally, meals can carry **calorie targets and logged calories** for anyone who wants to track intake — manual and entirely optional, never affecting the points score.

The product's personality is **warm, motivational, and playful** — positive reinforcement, streaks, celebratory micro-animations, and encouraging copy. It should feel like a supportive teammate, never a nag or a guilt-trip.

## 2. Goals & Non-Goals

**Goals**
- Effortless weekly planning (meals in flexible slots, water target, workout days), with **optional calorie targets** per meal.
- 1–2 tap logging (mark a meal had + optional photo + optional calories; add a water bottle; log a workout).
- Fairly score two people with **different plans** on the **same 0–100 daily scale**.
- Show both partners' progress side-by-side, updating live.
- Run a weekly competition with a recorded winner and prize.
- **Push reminders to the phone** (water + meals) via PWA Web Push.
- Strictly private to two accounts; the login screen reveals nothing about the app's contents.

**Non-Goals (out of scope)**
- Public sign-up / more than two users.
- Automatic nutrition databases, barcode scanning, macro breakdowns (calories are **manual & optional** in MVP; AI photo estimation is Phase 2).
- Social feed, sharing outside the couple, wearable integrations.
- Medical/coaching advice.

## 3. Users

- **Exactly two users**, pre-provisioned by the owner. No public registration.
- Both users **read all shared data**; each **writes only their own**.
- Single shared timezone: **Asia/Kolkata (IST)**. "A day" = local IST calendar day. "A week" starts **Monday 00:00 IST**.

## 4. Core Features (MVP)

### 4.1 Authentication & Privacy
- Email + password login via Supabase Auth. **Public sign-up disabled**; the two accounts are seeded by the owner.
- **Neutral login page:** app name/logo + generic tagline + sign-in form. No screenshots, feature hints, or partner names.
- Logout from Settings. Protected routes via middleware; unauthenticated users land on `/login`.
- Persistent sessions.
- **Theme:** dark-mode-first with a light toggle (see Open Questions re: "key mode").

### 4.2 Weekly Meal Planning
- Each user maintains their **own recurring weekly plan**.
- A plan is a set of **meal items**, each on a **day of week** + a **meal slot**.
- **Meal slots** (flexible, ordered): `pre_breakfast`, `breakfast`, `post_breakfast`, `mid_morning_snack`, `lunch`, `evening_snack`, `dinner`, `post_dinner`.
- Each meal item: title, optional target time, optional note, **optional `target_calories`**, sort order.
- Convenience: **"Apply to all days"** and **"Copy day → day."**
- **Water target** per user: daily ml + default bottle size (so "1 bottle" = a known amount).
- **Workout target** per user: which weekdays are workout days.

### 4.3 Logging (the daily loop)
- **Meals:** each planned meal for today is a tap-to-complete item. Tapping marks it **completed** (adds points). **Optional photo** (camera/upload). **Optional calorie entry** (manual number). Can also mark **skipped** (0 points). Ad-hoc/unplanned meals loggable but **0 points** (record-only; may still carry optional calories).
- **Water:** prominent "+1 bottle" (+ custom ml). Each tap = a water log of the bottle size. Ring shows progress to target; over-target allowed, points capped at target.
- **Workout:** "Add workout" logs today's workout with **optional photo, type, duration, note**. Any workout log marks the day done. Weekly tracker shows "X of Y workout days."
- All logs timestamped, owned by the logging user.

### 4.4 Calorie Tracking (optional, informational)
- Purely optional for either partner; **does not affect points**.
- **Planned:** optional `target_calories` per meal item → a daily planned-calorie total.
- **Logged:** optional `calories` per meal log → a daily consumed-calorie total.
- Today & History surface **planned vs actual calories** (per day and week) for whoever fills them in; hidden/blank if unused.
- **Phase 2 — AI calorie estimate:** when a meal photo is attached, offer an optional "estimate calories" action that sends the photo to the **Anthropic (Claude) multimodal API** and pre-fills a suggested number the user can accept/edit. MVP is manual only.

### 4.5 Push Notifications & Reminders (MVP)
- **PWA Web Push** using **VAPID keys** + a service worker. On iOS this works once the PWA is **added to the home screen** (iOS 16.4+); Apple's push service delivers standard Web Push automatically (no direct APNs integration needed for a web app).
- **Subscription flow:** on first grant, store the browser push subscription per user/device in `push_subscriptions`.
- **Scheduled reminders** (server-driven so they fire even when the app is closed):
  - **Water:** paced nudges through waking hours until the daily target is met (interval configurable).
  - **Meals:** at each planned meal's `target_time`.
  - **Partner activity (optional):** "She just logged a workout 💪."
  - **Weekly:** week-open standing + week-close result/winner.
- **Scheduler:** a **Vercel Cron** job (every ~15 min) hits a protected API route that computes who needs a nudge now (respecting quiet hours + prefs) and sends via the `web-push` library. (Supabase `pg_cron` + edge function is an acceptable alternative.)
- **Notification preferences** in Settings: toggle each category, set quiet hours, set water interval.

### 4.6 Points & Scoring (see full spec in §7)
- Up to **100 points/day** from **Meals + Water + Workout**, weighted and normalized so a fully-followed day = 100 regardless of plan size or rest days. Weekly total max 700. Calories are **not** scored.

### 4.7 Shared Visibility & Realtime
- Both partners see each other's today rings/points, breakdown, streaks, photos, calories (if used), and weekly totals.
- Near-real-time updates via **Supabase Realtime** on the shared tables.
- **"Us"** screen: both partners side-by-side for today and the current week.

### 4.8 Weekly Competition & Prizes
- Current week's head-to-head always visible (both totals, who's ahead, points remaining).
- At week rollover (Mon 00:00 IST) the week is **finalized**: winner recorded (or tie flagged).
- A **prize** (free text) can attach to a week and be marked **paid/acknowledged**.
- **Weekly history**: past weeks with scores, winner, prize — the running rivalry scoreboard.

### 4.9 Motivation Layer
- Celebratory micro-interactions (confetti / ring-fill) on meal complete, water target, perfect day, weekly win.
- **Streaks**: consecutive days ≥ threshold (default 80) per user.
- Encouraging, varied copy from a **curated message bank** keyed to context; no shame framing.
- Lightweight **achievements/badges** (first perfect day, 7-day streak, first weekly win).

## 5. Information Architecture / Screens

1. **/login** — Neutral sign-in. No reveal.
2. **/today** (home) — Three rings (meals/water/workout), today's points, today's meal quick-log (+photo, +optional calories), water control, add-workout, motivational line, optional calorie summary, partner snapshot.
3. **/plan** — Weekly plan editor: per-day slots + items (+ optional target calories), water target + bottle size, workout days; apply-to-all / copy-day.
4. **/us** — Side-by-side today + this-week head-to-head, both rings, streaks, latest photos.
5. **/weekly** — Current standings + prize widget; history of past weeks.
6. **/history** — Charts (daily points, adherence %, water, workouts, calories), streak history.
7. **/settings** — Profile, targets, **scoring weights**, **notification prefs (categories, quiet hours, water interval)**, theme, logout.

Global: mobile-first bottom nav; installable PWA; dark-first + light toggle.

## 6. Data Model (Supabase / Postgres)

> All tables: `id uuid default gen_random_uuid() primary key`, `created_at timestamptz default now()`, and `updated_at` where mutable. `date` fields interpreted in IST; timestamps `timestamptz`.

**profiles** (id = auth.users.id)
- `display_name text`, `avatar_url text null`
- `water_target_ml int default 3000`, `bottle_size_ml int default 750`
- `workout_days smallint[]` (0=Mon … 6=Sun)
- `weight_meals int default 60`, `weight_water int default 15`, `weight_workout int default 25` (sum 100; enforced app-side + check)
- `notif_prefs jsonb default '{}'` (category toggles, quiet_hours, water_interval_min)

**plan_items**
- `user_id uuid → profiles.id`, `day_of_week smallint` (0=Mon…6=Sun)
- `meal_slot text`, `title text`, `target_time time null`, `note text null`
- **`target_calories int null`**
- `sort_order int default 0`, `is_active bool default true`

**meal_logs**
- `user_id uuid`, `plan_item_id uuid null → plan_items.id` (null = ad-hoc)
- `log_date date`, `logged_at timestamptz default now()`
- `status text check (status in ('completed','skipped')) default 'completed'`
- **`calories int null`**, `photo_path text null`, `note text null`

**water_logs**
- `user_id uuid`, `log_date date`, `logged_at timestamptz default now()`
- `amount_ml int`, `note text null`

**workout_logs**
- `user_id uuid`, `log_date date`, `logged_at timestamptz default now()`
- `type text null`, `duration_min int null`, `photo_path text null`, `note text null`

**push_subscriptions**
- `user_id uuid`, `endpoint text unique`, `p256dh text`, `auth text`, `device_label text null`, `created_at timestamptz default now()`

**weekly_results**
- `week_start date` (Monday, IST), unique
- `user_a uuid`, `points_a numeric`, `user_b uuid`, `points_b numeric`
- `winner_id uuid null` (null = tie), `prize text null`, `prize_paid bool default false`

**achievements** *(optional)*
- `user_id uuid`, `code text`, `earned_at timestamptz` — unique (user_id, code)

**Storage:** private bucket `photos`; path `{user_id}/{yyyy-mm-dd}/{uuid}.jpg`; authenticated/signed URLs.

**RLS (closed 2-user app that explicitly shares):**
- `SELECT`: any authenticated user reads all rows in shared tables.
- `INSERT/UPDATE/DELETE`: only where `user_id = auth.uid()`. `push_subscriptions` own-rows only. `weekly_results` writes via server/service action or either participant.
- No unauthenticated access.

**Views / functions:** `daily_scores`, `weekly_scores` (mirror §7), optional RPC `finalize_week(week_start)`.

## 7. Scoring Specification (single source of truth)

**Daily maximum = 100.** Base weights per user (defaults): `meals=60`, `water=15`, `workout=25` (sum 100). **Calories are excluded from scoring.**

1. **Applicable categories:** meals (≥1 planned meal that weekday) · water (target>0) · workout (weekday in `workout_days`).
2. **Effective weights:** `eff_i = base_i / Σ(base_j applicable) × 100` (redistribute to sum 100).
3. **Category points:**
   - Meals: `eff_meals × (completed_planned / total_planned)` (ad-hoc = 0).
   - Water: `eff_water × min(1, logged_ml / target_ml)`.
   - Workout: `eff_workout` if ≥1 workout logged, else 0.
4. **Daily total:** `round(sum)`, capped 100.

**Examples**
- *A:* 7 meals, 3000 ml, workout day → all applicable (60/15/25). Perfect = 60 + 15 + 25 = **100**. (5/7 meals, 2500 ml, no workout → ≈ **55**.)
- *B:* 3 meals, 2000 ml, **rest day** → redistribute workout's 25 → meals 80, water 20. Perfect = **100**.

**Weekly:** sum of daily (max 700). Winner = higher weekly total; ties flagged.

**Implementation rule:** define once in `lib/scoring/scoring.ts` (pure, unit-tested) and mirror in the `daily_scores` SQL view; SQL is authoritative for `weekly_results`.

## 8. Tech & Architecture

- Next.js App Router + TypeScript (strict); Server Components for reads, Client Components for logging.
- Supabase: Postgres + RLS, Auth (signup disabled), Storage, Realtime.
- Tailwind + shadcn/ui; **Framer Motion** (animations); **Recharts** (charts).
- **PWA**: manifest + service worker; **Web Push (VAPID)**; installable.
- **Vercel Cron** for the reminder scheduler.
- TanStack Query (or server actions) + optimistic UI.
- DB types via `supabase gen types typescript`.

## 9. Non-Functional Requirements

- **Privacy/Security:** closed 2-user system; RLS; private photo bucket; non-revealing login; cron endpoint protected by secret.
- **Performance:** Today interactive < 1.5s mobile; log taps feel instant.
- **Timezone correctness:** day/week boundaries in Asia/Kolkata.
- **Accessibility:** contrast, large tap targets, `prefers-reduced-motion`.

## 10. Milestones / Phases

**Phase 0 — Foundation:** scaffold; Supabase wiring; schema + RLS (incl. calories + push_subscriptions); seed 2 users; types; neutral auth + protected routes; app shell + nav + theme; PWA manifest.

**Phase 1 — MVP Core:** date utils; scoring engine + tests + SQL views; Settings; Plan editor (with optional calories); Today (meals+photo+calories, water, workout, rings, points, motivation); realtime; Us; Weekly + finalize + history; History charts (incl. calories); motivation polish.

**Phase 1.5 — Push (MVP):** service worker + subscription flow; VAPID send endpoint; Vercel Cron scheduler (water, meals, partner, weekly) with quiet hours + prefs.

**Phase 2 — Enhancements:** AI Coach (Claude API daily nudge); **AI calorie estimate from meal photo (Claude multimodal)**; offline log queue; badge expansion; export/backup.

## 11. Open Questions / Owner Decisions

- Confirm default weights (60/15/25) and that they're user-editable.
- **"Key mode"** — currently interpreted as **dark-mode-first + light toggle**. Confirm meaning.
- Ad-hoc meals: record-only, 0 points (current). OK?
- Week start = Monday; streak threshold = 80. OK?
- Water reminder interval default (e.g., every 90 min in waking hours) — set default.

## 12. Definition of Done (per feature)

- Type-safe; passes lint + typecheck + scoring tests.
- RLS verified (no cross-writes; shared reads work).
- Scoring display == `scoring.ts` == `daily_scores` view.
- Mobile-first; works as installed PWA; reduced-motion respected.
- Push: a real notification is received on a subscribed installed device.
- Realtime change appears on partner's device within seconds.
