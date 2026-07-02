import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

// Neutral sign-in (PRD.md §4.1). App name + generic tagline + form only.
// No screenshots, feature hints, partner names, or signup link.
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6">
      {/* soft pastel glow — reveals nothing */}
      <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-56 rounded-full bg-coral/20 blur-3xl" />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary text-2xl font-extrabold text-primary-foreground shadow-lg shadow-primary/30">
            FD
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">FitDuo</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue.</p>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
