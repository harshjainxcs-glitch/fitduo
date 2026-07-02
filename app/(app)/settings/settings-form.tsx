"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/actions/auth";
import { sendTestNotification } from "@/lib/actions/push";
import { enablePush } from "@/lib/push/client";
import { WEEKDAYS, resolveNotifPrefs } from "@/lib/constants";
import type { Profile } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function SettingsForm({
  userId,
  profile,
}: {
  userId: string;
  profile: Profile;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [waterTarget, setWaterTarget] = useState(profile.water_target_ml);
  const [bottleSize, setBottleSize] = useState(profile.bottle_size_ml);
  const [workoutDays, setWorkoutDays] = useState<number[]>(
    profile.workout_days ?? [],
  );
  const [weightMeals, setWeightMeals] = useState(profile.weight_meals);
  const [weightWater, setWeightWater] = useState(profile.weight_water);
  const [weightWorkout, setWeightWorkout] = useState(profile.weight_workout);
  const [notif, setNotif] = useState(resolveNotifPrefs(profile.notif_prefs));

  const [avatarPath, setAvatarPath] = useState(profile.avatar_url);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const weightSum = weightMeals + weightWater + weightWorkout;
  const weightsValid = weightSum === 100;

  useEffect(() => {
    let active = true;
    if (avatarPath) {
      createClient()
        .storage.from("photos")
        .createSignedUrl(avatarPath, 3600)
        .then(({ data }) => {
          if (active) setAvatarUrl(data?.signedUrl ?? null);
        });
    }
    return () => {
      active = false;
    };
  }, [avatarPath]);

  function toggleDay(index: number) {
    setWorkoutDays((days) =>
      days.includes(index)
        ? days.filter((d) => d !== index)
        : [...days, index].sort((a, b) => a - b),
    );
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const supabase = createClient();
    const path = `${userId}/avatar/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error("Couldn't upload photo");
      return;
    }
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
    setAvatarPath(path);
    toast.success("Photo updated");
  }

  async function save() {
    if (!weightsValid) {
      toast.error("Scoring weights must add up to 100.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || "Partner",
        water_target_ml: waterTarget,
        bottle_size_ml: bottleSize,
        workout_days: workoutDays,
        weight_meals: weightMeals,
        weight_water: weightWater,
        weight_workout: weightWorkout,
        notif_prefs: notif,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) toast.error("Couldn't save settings");
    else toast.success("Settings saved");
  }

  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 px-4 py-4">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatar}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Change photo
              </Button>
            </div>
          </div>
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Targets */}
      <Card>
        <CardHeader>
          <CardTitle>Targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Daily water target (ml)">
            <Input
              type="number"
              min={0}
              step={100}
              value={waterTarget}
              onChange={(e) => setWaterTarget(Number(e.target.value))}
            />
          </Field>
          <Field label="Bottle size (ml)">
            <Input
              type="number"
              min={1}
              step={50}
              value={bottleSize}
              onChange={(e) => setBottleSize(Number(e.target.value))}
            />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">Workout days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const active = workoutDays.includes(d.index);
                return (
                  <button
                    key={d.index}
                    type="button"
                    onClick={() => toggleDay(d.index)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring weights */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Meals">
            <Input
              type="number"
              min={0}
              max={100}
              value={weightMeals}
              onChange={(e) => setWeightMeals(Number(e.target.value))}
            />
          </Field>
          <Field label="Water">
            <Input
              type="number"
              min={0}
              max={100}
              value={weightWater}
              onChange={(e) => setWeightWater(Number(e.target.value))}
            />
          </Field>
          <Field label="Workout">
            <Input
              type="number"
              min={0}
              max={100}
              value={weightWorkout}
              onChange={(e) => setWeightWorkout(Number(e.target.value))}
            />
          </Field>
          <p
            className={cn(
              "text-sm",
              weightsValid ? "text-muted-foreground" : "text-destructive",
            )}
          >
            Total: {weightSum} / 100
            {weightsValid ? "" : " — must equal 100"}
          </p>
        </CardContent>
      </Card>

      {/* Notifications (prefs stored now; sending comes later) */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await enablePush();
                  toast.success("Reminders enabled on this device 🔔");
                } catch (e) {
                  const m = (e as Error).message;
                  toast.error(
                    m === "denied"
                      ? "Notifications are blocked in browser settings."
                      : m === "unsupported"
                        ? "Push isn't supported on this browser."
                        : "Couldn't enable reminders.",
                  );
                }
              }}
            >
              Enable on this device
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                const r = await sendTestNotification();
                if (r.ok) toast.success(r.message);
                else toast.error(r.message);
              }}
            >
              Send test
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            iPhone: add FitDuo to your Home Screen first, then enable.
          </p>

          {(
            [
              ["water", "Water reminders"],
              ["meals", "Meal reminders"],
              ["partner", "Partner activity"],
              ["weekly", "Weekly standings"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <Switch
                checked={notif[key]}
                onCheckedChange={(v) => setNotif((n) => ({ ...n, [key]: v }))}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quiet hours start">
              <Input
                type="time"
                value={notif.quiet_hours.start}
                onChange={(e) =>
                  setNotif((n) => ({
                    ...n,
                    quiet_hours: { ...n.quiet_hours, start: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Quiet hours end">
              <Input
                type="time"
                value={notif.quiet_hours.end}
                onChange={(e) =>
                  setNotif((n) => ({
                    ...n,
                    quiet_hours: { ...n.quiet_hours, end: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
          <Field label="Water reminder interval (minutes)">
            <Input
              type="number"
              min={15}
              step={15}
              value={notif.water_interval_min}
              onChange={(e) =>
                setNotif((n) => ({
                  ...n,
                  water_interval_min: Number(e.target.value),
                }))
              }
            />
          </Field>
        </CardContent>
      </Card>

      {/* Appearance + account */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button onClick={save} disabled={saving || !weightsValid}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
