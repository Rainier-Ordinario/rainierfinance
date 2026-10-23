"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CardSkeleton } from "@/components/shared/CardSkeleton";
import { CategoryTrends } from "@/components/insights/CategoryTrends";
import { TopMerchants } from "@/components/insights/TopMerchants";
import { SpendingPatterns } from "@/components/insights/SpendingPatterns";
import { MoneyFlow } from "@/components/insights/MoneyFlow";
import { SavingsTrend } from "@/components/insights/SavingsTrend";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useCategories } from "@/lib/hooks/useCategories";

export default function InsightsPage() {
  const transactions = useTransactions();
  const categories = useCategories();
  const loading = transactions.isLoading || categories.isLoading;

  return (
    <div>
      <PageHeader
        title="Insights"
        description="Where your money goes, and how that's changing"
      />
      {loading ? (
        <div className="space-y-4">
          <CardSkeleton lines={8} />
          <CardSkeleton lines={8} />
        </div>
      ) : (
        <div className="space-y-4">
          <MoneyFlow
            transactions={transactions.data ?? []}
            categories={categories.data ?? []}
          />
          <SavingsTrend transactions={transactions.data ?? []} />
          <CategoryTrends
            transactions={transactions.data ?? []}
            categories={categories.data ?? []}
          />
          <TopMerchants
            transactions={transactions.data ?? []}
            categories={categories.data ?? []}
          />
          <SpendingPatterns
            transactions={transactions.data ?? []}
            categories={categories.data ?? []}
          />
        </div>
      )}
    </div>
  );
}
