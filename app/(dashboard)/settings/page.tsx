"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { CardSkeleton } from "@/components/shared/CardSkeleton";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PreferencesForm } from "@/components/settings/PreferencesForm";
import { AccountsCard } from "@/components/settings/AccountsCard";
import { CategoryGroupsCard } from "@/components/settings/CategoryGroupsCard";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCategories } from "@/lib/hooks/useCategories";
import {
  useAuthUser,
  useProfile,
  useUserSettings,
} from "@/lib/hooks/useSettings";

export default function SettingsPage() {
  const authUser = useAuthUser();
  const profile = useProfile();
  const settings = useUserSettings();
  const accounts = useAccounts();
  const categories = useCategories();

  const cashAccounts = useMemo(
    () =>
      (accounts.data ?? []).filter(
        (a) => a.is_active && a.type !== "credit_card"
      ),
    [accounts.data]
  );

  const isLoading =
    authUser.isLoading ||
    profile.isLoading ||
    settings.isLoading ||
    accounts.isLoading ||
    categories.isLoading;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile info and app preferences"
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ProfileForm
            profile={profile.data ?? null}
            email={authUser.data?.email ?? null}
          />
          <PreferencesForm
            settings={settings.data ?? null}
            accounts={cashAccounts}
          />
          <AccountsCard accounts={accounts.data ?? []} />
          <CategoryGroupsCard categories={categories.data ?? []} />
        </div>
      )}
    </div>
  );
}
