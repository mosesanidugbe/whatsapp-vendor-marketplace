"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthFormProps = { mode: "sign-in" | "sign-up" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setNotice("");
    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/account");
          router.refresh();
        } else {
          setNotice("Account created. Check your email for the confirmation link, then sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/account");
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">m</span>
          <span>marketday<span className="brand-period">.</span></span>
        </Link>
        <p className="eyebrow">{isSignUp ? "JOIN THE MARKETPLACE" : "WELCOME BACK"}</p>
        <h1>{isSignUp ? "Your next chapter starts here." : "Good to see you again."}</h1>
        <p className="auth-description">
          {isSignUp
            ? "Create an account to shop from independent businesses or open your own store whenever you’re ready."
            : "Sign in to continue to your Marketday account."}
        </p>

        {searchParams.get("error") === "confirmation" && (
          <p className="auth-error" role="alert">That confirmation link could not be verified. Please try again or request a new one.</p>
        )}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <label htmlFor="full-name">Full name</label>
              <input id="full-name" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
            </>
          )}
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={isSignUp ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignUp ? "At least 8 characters" : "Your password"} />
          <button className="button button-dark auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "New to Marketday?"}{" "}
          <Link href={isSignUp ? "/sign-in" : "/sign-up"}>{isSignUp ? "Sign in" : "Create an account"}</Link>
        </p>
        <Link className="auth-back" href="/">← Back to marketplace</Link>
      </section>
    </main>
  );
}
