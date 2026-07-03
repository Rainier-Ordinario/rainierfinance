import { redirect } from "next/navigation";

// Crypto now lives as a tab on the Investments page.
export default function CryptoPage() {
  redirect("/investments?tab=crypto");
}
