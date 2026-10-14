"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck, Wallet } from "lucide-react";
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

const schema = z.object({ email: z.string().email("Enter a valid email") });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setSent(true);
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
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {sent
                ? "Check your inbox for the reset link"
                : "We'll email you a link to set a new password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <MailCheck className="size-8 text-success" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  If an account exists for{" "}
                  <span className="font-medium text-foreground">
                    {form.getValues("email")}
                  </span>
                  , a reset link is on its way. The link opens a page where you
                  can choose a new password.
                </p>
              </div>
            ) : (
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors.email.message}
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

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  Send reset link
                </Button>
              </form>
            )}
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
