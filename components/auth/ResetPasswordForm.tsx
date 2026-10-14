"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Supabase creates a recovery session from the link's hash on load.
  // Submit stays disabled until that session exists.
  const [ready, setReady] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // The recovery-hash exchange runs asynchronously after page load, so a
    // one-shot getSession() can race it and falsely report a dead link.
    // Listen for the session, and only give up after a grace period.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || !session) return;
      setSubmitError(null);
      setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setReady(true);
        return;
      }
      window.setTimeout(async () => {
        if (cancelled) return;
        const { data: later } = await supabase.auth.getSession();
        if (cancelled || later.session) return;
        setSubmitError(
          "This reset link is invalid or has expired. Request a new one."
        );
      }, 2000);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(values: Values) {
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="size-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            RainierFinance
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>
              Enter a new password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pr-10"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...form.register("confirm")}
                />
                {form.formState.errors.confirm && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.confirm.message}
                  </p>
                )}
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {submitError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !ready}
              >
                {submitting && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Set new password
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
