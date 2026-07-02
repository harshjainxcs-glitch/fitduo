# Supabase — apply & manage the FitDuo database

## One-time setup
```bash
# Install the CLI (if needed): https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref <your-project-ref>   # from the dashboard URL
```
`supabase link` creates `supabase/config.toml` and stores the project ref.

## Apply migrations
```bash
supabase db push          # applies everything in supabase/migrations in order
```
Or, without the CLI: open the Supabase dashboard → **SQL Editor**, paste the
contents of each file in `supabase/migrations/*.sql` (in filename order), run.

## Verify
- **Table editor**: profiles, plan_items, meal_logs, water_logs, workout_logs,
  push_subscriptions, weekly_results, achievements all exist.
- **Auth → Policies**: RLS is **enabled** on every table with the shared-read +
  own-write policy pair (push_subscriptions is own-rows-only).
- **Storage**: a private bucket `photos` exists with read + own-prefix policies.

## Seed users (see ../supabase/seed.sql and PROMPTS.md 0.4)
Public signup must be **OFF**: Dashboard → **Authentication → Providers → Email**
→ disable "Allow new users to sign up".

## Regenerate types after any schema change
```bash
npm run typegen           # supabase gen types typescript > lib/types/database.types.ts
```
