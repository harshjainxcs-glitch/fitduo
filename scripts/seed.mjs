// Seed the two FitDuo users + their profiles using the Supabase service role.
// Run with:  npm run seed
// Requires in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   EMAIL_A, PASSWORD_A, EMAIL_B, PASSWORD_B   (replace the placeholders)
//
// Public signup stays OFF (Dashboard → Authentication → Providers → Email →
// disable "Allow new users to sign up"). This script uses the admin API, which
// bypasses that setting and RLS.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Display name defaults to the capitalized email local-part (e.g. harsh -> Harsh).
const nameFromEmail = (email) => {
  const local = String(email).split("@")[0].replace(/[._-]+/g, " ");
  return local.charAt(0).toUpperCase() + local.slice(1);
};

const users = [
  {
    email: process.env.EMAIL_A ?? "EMAIL_A",
    password: process.env.PASSWORD_A ?? "REPLACE_ME_A",
    workout_days: [0, 2, 4], // Mon, Wed, Fri
  },
  {
    email: process.env.EMAIL_B ?? "EMAIL_B",
    password: process.env.PASSWORD_B ?? "REPLACE_ME_B",
    workout_days: [1, 3, 5], // Tue, Thu, Sat
  },
];

const defaultNotifPrefs = {
  water: true,
  meals: true,
  partner: true,
  weekly: true,
  quiet_hours: { start: "22:00", end: "07:00" },
  water_interval_min: 90,
};

async function findUserIdByEmail(email) {
  // Paginate through users to find an existing account.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

for (const u of users) {
  if (u.email === "EMAIL_A" || u.email === "EMAIL_B") {
    console.warn(`Skipping placeholder email "${u.email}" — set EMAIL_A/EMAIL_B in .env.local.`);
    continue;
  }

  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  });

  if (createErr) {
    // Likely already exists — reuse it.
    userId = await findUserIdByEmail(u.email);
    if (!userId) {
      console.error(`Could not create or find ${u.email}: ${createErr.message}`);
      continue;
    }
    console.log(`User ${u.email} already existed (${userId}).`);
  } else {
    userId = created.user.id;
    console.log(`Created ${u.email} (${userId}).`);
  }

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    display_name: nameFromEmail(u.email),
    water_target_ml: 3000,
    bottle_size_ml: 750,
    workout_days: u.workout_days,
    weight_meals: 60,
    weight_water: 15,
    weight_workout: 25,
    notif_prefs: defaultNotifPrefs,
  });

  if (profileErr) console.error(`Profile upsert failed for ${u.email}: ${profileErr.message}`);
  else console.log(`Profile ready for ${u.email}.`);
}

console.log("Seed complete.");
