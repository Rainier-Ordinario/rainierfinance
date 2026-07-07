"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, subMonths } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecapView } from "@/components/dashboard/RecapView";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useCategories } from "@/lib/hooks/useCategories";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { useInvestments } from "@/lib/hooks/useInvestments";
import { useSnapshots } from "@/lib/hooks/useSnapshots";
import { usePaymentReminders, useProfile } from "@/lib/hooks/useSettings";
import {
  cashFlowByMonth,
  categoryTotals,
  monthlyExpenses,
  monthlyIncome,
  netWorth,
  savingsRate,
  topCategories,
} from "@/lib/utils/aggregate";
import { currentMonthRange, toISODate } from "@/lib/utils/dates";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCardSkeleton, CardSkeleton } from "@/components/shared/CardSkeleton";
import { NetWorthCard } from "@/components/dashboard/NetWorthCard";
import {
  MonthlyIncomeCard,
  MonthlySpendingCard,
  SavingsRateCard,
} from "@/components/dashboard/MetricCards";
import { SpendingDonut } from "@/components/dashboard/SpendingDonut";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { UtilizationWidget } from "@/components/dashboard/UtilizationWidget";
import { UpcomingSubscriptions } from "@/components/dashboard/UpcomingSubscriptions";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { InvestmentSummary } from "@/components/dashboard/InvestmentSummary";

export default function DashboardPage() {
  const [tab, setTab] = useState<"overview" | "weekly" | "monthly">(
    "overview"
  );
  const accounts = useAccounts();
  const transactions = useTransactions();
  const categories = useCategories();
  const subscriptions = useSubscriptions();
  const investments = useInvestments();
  const snapshots = useSnapshots();
  const reminders = usePaymentReminders();

  const loading =
    accounts.isLoading || transactions.isLoading || categories.isLoading;

  const profile = useProfile();
  const firstName = profile.data?.full_name?.split(" ")[0];
  const hour = new Date().getHours();
  const timeOfDay =
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greeting = `Good ${timeOfDay}${firstName ? `, ${firstName}` : ""}`;

  const stats = useMemo(() => {
    const txs = transactions.data ?? [];
    const accts = accounts.data ?? [];
    const { start, end } = currentMonthRange();
    const income = monthlyIncome(txs, start, end);
    const expenses = monthlyExpenses(txs, start, end);

    // Net worth change vs the most recent snapshot at least ~a month old
    const cutoff = toISODate(subMonths(new Date(), 1));
    const lastMonthSnapshot = [...(snapshots.data ?? [])]
      .reverse()
      .find((s) => s.snapshot_date <= cutoff);

    return {
      netWorth: netWorth(accts),
      lastMonthNetWorth: lastMonthSnapshot
        ? Number(lastMonthSnapshot.net_worth)
        : null,
      income,
      expenses,
      savingsRate: savingsRate(income, expenses),
      cashFlow: cashFlowByMonth(txs),
      categories: topCategories(categoryTotals(txs)),
      creditCards: accts.filter((a) => a.type === "credit_card" && a.is_active),
    };
  }, [transactions.data, accounts.data, snapshots.data]);

  const overview = loading ? (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={6} />
      </div>
    </>
  ) : (
    <>
      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NetWorthCard
          netWorth={stats.netWorth}
          lastMonthNetWorth={stats.lastMonthNetWorth}
        />
        <MonthlySpendingCard amount={stats.expenses} history={stats.cashFlow} />
        <MonthlyIncomeCard amount={stats.income} history={stats.cashFlow} />
        <SavingsRateCard rate={stats.savingsRate} />
      </div>

      {/* Middle: charts + right widgets */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <SpendingDonut
            data={stats.categories}
            categories={categories.data ?? []}
          />
          <CashFlowChart data={stats.cashFlow} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <UtilizationWidget
            cards={stats.creditCards}
            reminders={reminders.data ?? []}
          />
          <UpcomingSubscriptions subscriptions={subscriptions.data ?? []} />
        </div>
      </div>

      {/* Bottom: recent transactions + investments */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentTransactions
            transactions={transactions.data ?? []}
            accounts={accounts.data ?? []}
            categories={categories.data ?? []}
          />
        </div>
        <div className="lg:col-span-2">
          <InvestmentSummary holdings={investments.data ?? []} />
        </div>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader
        title={greeting}
        description={format(new Date(), "EEEE, MMMM d")}
        actions={
          <Button asChild>
            <Link href="/transactions">
              <Plus className="size-4" aria-hidden />
              Add transaction
            </Link>
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "overview" | "weekly" | "monthly")}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Recap</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Recap</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "weekly" ? (
        <RecapView period="week" />
      ) : tab === "monthly" ? (
        <RecapView period="month" />
      ) : (
        overview
      )}
    </div>
  );
}
