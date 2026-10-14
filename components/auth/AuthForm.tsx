"use client";

import { useState } from "react";
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

function makeSchema(isLogin: boolean) {
  return z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: isLogin
      ? z.string().optional()
      : z.string().min(2, "Enter your name"),
  });
}

type AuthValues = z.infer<ReturnType<typeof makeSchema>>;

/** Turn raw Supabase auth errors into copy a person can act on. */
function friendlyAuthError(message: string, isLogin: boolean): string {
  if (message.includes("Invalid login credentials")) {
    return "That email and password don't match. Try again or reset your password.";
  }
  if (message.includes("is invalid")) {
    return "That email address can't be used — double-check it for typos.";
  }
  if (message.includes("already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (message.includes("rate limit") || message.includes("Too many")) {
    return "Too many attempts — wait a minute and try again.";
  }
  return isLogin
    ? `Couldn't sign in: ${message}`
    : `Couldn't create the account: ${message}`;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Set when signup succeeded but Supabase requires email confirmation
  // (no session yet — redirecting would just bounce back to /login).
  const [confirmEmailSentTo, setConfirmEmailSentTo] = useState<string | null>(
    null
  );
  const isLogin = mode === "login";

  const form = useForm<AuthValues>({
    resolver: zodResolver(makeSchema(isLogin)),
    defaultValues: { email: "", password: "", fullName: "" },
  });

  async function onSubmit(values: AuthValues) {
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is on: no session until the link is clicked.
          setConfirmEmailSentTo(values.email);
          setSubmitting(false);
          return;
        }
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? friendlyAuthError(err.message, isLogin)
          : "Something went wrong. Try again."
      );
      setSubmitting(false);
    }
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

        {confirmEmailSentTo ? (
          <Card>
            <CardHeader>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                We sent a confirmation link to{" "}
                <span className="font-medium text-foreground">
                  {confirmEmailSentTo}
                </span>
                . Click it to finish creating your account, then sign in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>{isLogin ? "Welcome back" : "Create account"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in to your finance dashboard"
                : "Start tracking your money in minutes"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    placeholder="Rainier Ordinario"
                    autoComplete="name"
                    {...form.register("fullName")}
                  />
                  <FieldError message={form.formState.errors.fullName?.message} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...form.register("email")}
                />
                <FieldError message={form.formState.errors.email?.message} />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete={isLogin ? "current-password" : "new-password"}
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
                {!isLogin && !form.formState.errors.password && (
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters
                  </p>
                )}
                <FieldError message={form.formState.errors.password?.message} />
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {submitError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {isLogin ? "Sign in" : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? (
            <>
              No account?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Register
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
