"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { WidgetEmpty } from "@/components/shared/WidgetEmpty";
import { formatTransactionAmount } from "@/lib/utils/currency";
import { formatDateShort } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { Account, Category, Transaction } from "@/types";

export function CategoryDot({
  category,
  categories,
}: {
  category: string;
  categories: Category[];
}) {
  const color =
    categories.find((c) => c.name === category)?.color ?? "var(--muted-foreground)";
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: color }}
      aria-hidden
    />
  );
}

export function RecentTransactions({
  transactions,
  accounts,
  categories,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}) {
  const recent = transactions.slice(0, 10);
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href="/transactions" className="hover:underline">
            Recent Transactions
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <WidgetEmpty
            message="No transactions yet."
            actionLabel="Add or import transactions"
            actionHref="/transactions"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-72 truncate font-medium">
                      {t.description}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 text-sm">
                        <CategoryDot
                          category={t.category}
                          categories={categories}
                        />
                        {t.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {accountName(t.account_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateShort(t.date)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-numeric text-right font-medium",
                        t.type === "income" && "text-success",
                        t.type === "transfer" && "text-muted-foreground"
                      )}
                    >
                      {formatTransactionAmount(Number(t.amount), t.type)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-2 text-right">
              <Link
                href="/transactions"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View all →
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
