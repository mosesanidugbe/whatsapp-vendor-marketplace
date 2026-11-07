import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function SignInPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading sign in…</p></main>}><AuthForm mode="sign-in" /></Suspense>;
}
