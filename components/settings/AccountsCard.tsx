"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccountModal } from "@/components/accounts/AccountModal";
import { useDeleteAccount } from "@/lib/hooks/useAccounts";
import { formatCAD } from "@/lib/utils/currency";
import type { Account, AccountType } from "@/types";

const TYPE_LABELS: Record<AccountType, string> = {
  chequing: "Chequing",
  savings: "Savings",
  credit_card: "Credit card",
  tfsa: "TFSA",
  fhsa: "FHSA",
  investment: "Investment",
  crypto: "Crypto",
};

export function AccountsCard({ accounts }: { accounts: Account[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const deleteAccount = useDeleteAccount();

  const active = accounts.filter((a) => a.is_active);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            The bank, card, and investment accounts your transactions belong to
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add account
        </Button>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No accounts yet — add one to start recording transactions.
          </p>
        ) : (
          <ul className="divide-y">
            {active.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: a.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.institution}
                    {a.account_number_last4
                      ? ` ···· ${a.account_number_last4}`
                      : ""}
                  </p>
                </div>
                <Badge variant="outline">{TYPE_LABELS[a.type]}</Badge>
                <span className="text-numeric w-28 text-right text-sm">
                  {formatCAD(Number(a.balance))}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(a);
                      setModalOpen(true);
                    }}
                    aria-label={`Edit ${a.name}`}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(a)}
                    aria-label={`Delete ${a.name}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AccountModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The account and all of its transactions will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (deleting) deleteAccount.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
