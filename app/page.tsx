import { redirect } from "next/navigation";

export default function Home() {
  // Middleware routes authenticated users to /dashboard and guests to /login;
  // this is only a fallback.
  redirect("/dashboard");
}
