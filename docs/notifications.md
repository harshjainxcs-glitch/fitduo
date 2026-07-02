# Push notifications & reminders

## Env vars (already set locally + on Vercel)
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY   # generate: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY              # server only
VAPID_SUBJECT                  # mailto: contact for push services
CRON_SECRET                    # protects /api/cron/reminders
```

## Database
Apply `supabase/migrations/20260703090000_notifications.sql` (the
`notification_sends` dedupe table) in the Supabase SQL editor. **Until this
table exists the scheduler sends nothing** (each send reserves a dedupe row
first; a missing table makes that reservation fail, so it safely no-ops).

## Enabling on a device
1. Open the app, sign in.
2. Tap **Enable reminders** (banner on Today) or **Settings → Notifications →
   Enable on this device**, and allow notifications.
3. **iOS:** you must **Add to Home Screen** first (iOS 16.4+), then open the
   installed app and enable — web push only works from the installed PWA.
4. **Settings → Send test** delivers a test push to confirm it works.

## The scheduler
`GET /api/cron/reminders` (auth: `Authorization: Bearer $CRON_SECRET`) computes,
per user in IST and honoring `notif_prefs` (category toggles, quiet hours, water
interval):
- **Water** — when behind the linear pace toward the daily target, once per
  interval slot.
- **Meals** — when a planned meal's `target_time` has passed and it isn't logged.
- **Weekly** — Monday morning kickoff, Sunday-night wrap-up.
- **Partner** — when your partner logs a workout.

Dry-run locally:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/reminders?dryRun=1"
```

## Cadence on Vercel
`vercel.json` runs the job **once daily** (`30 3 * * *` = 09:00 IST) because the
Vercel **Hobby** plan only allows daily crons. For real ~15-minute reminders:
- **Upgrade to Vercel Pro** and change the schedule to `*/15 * * * *`, **or**
- Use a free external scheduler (e.g. cron-job.org, GitHub Actions) to `GET`
  `https://<your-app>/api/cron/reminders` every 15 min with header
  `Authorization: Bearer <CRON_SECRET>`.
