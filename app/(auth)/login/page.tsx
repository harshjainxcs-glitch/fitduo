import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

// Neutral sign-in (PRD.md §4.1). App name + generic tagline + form only.
// No screenshots, feature hints, partner names, or signup link.
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold">
            FD
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">FitDuo</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue.</p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
