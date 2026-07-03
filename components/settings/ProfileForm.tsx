"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateProfile } from "@/lib/hooks/useSettings";
import type { Profile } from "@/types";

const schema = z.object({
  full_name: z.string().min(1, "Required").max(100, "Too long"),
  currency: z.enum(["CAD", "USD"]),
});

type FormValues = z.infer<typeof schema>;

export function ProfileForm({
  profile,
  email,
}: {
  profile: Profile | null;
  email: string | null;
}) {
  const updateProfile = useUpdateProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      currency: profile?.currency === "USD" ? "USD" : "CAD",
    },
  });

  useEffect(() => {
    form.reset({
      full_name: profile?.full_name ?? "",
      currency: profile?.currency === "USD" ? "USD" : "CAD",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function onSubmit(values: FormValues) {
    updateProfile.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name and display currency</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              placeholder="Your name"
              {...form.register("full_name")}
            />
            <FieldError message={form.formState.errors.full_name?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              value={email ?? ""}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Email is managed by your sign-in provider and can&apos;t be
              changed here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-currency">Currency</Label>
            <Select
              value={form.watch("currency")}
              onValueChange={(v) =>
                form.setValue("currency", v as FormValues["currency"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="profile-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAD">CAD — Canadian dollar</SelectItem>
                <SelectItem value="USD">USD — US dollar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={updateProfile.isPending || !form.formState.isDirty}
          >
            {updateProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
