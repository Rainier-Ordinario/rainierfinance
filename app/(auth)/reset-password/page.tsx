import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
