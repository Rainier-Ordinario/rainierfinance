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
import { formatCAD } from "@/lib/utils/currency";
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
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions yet. Add one or import a CSV.
          </p>
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
                    <TableCell className="max-w-48 truncate font-medium">
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
                        Number(t.amount) > 0 && "text-success"
                      )}
                    >
                      {formatCAD(Number(t.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
