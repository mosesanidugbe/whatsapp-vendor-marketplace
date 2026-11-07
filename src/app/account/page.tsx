import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

// This authenticated page reads request-specific cookies and Supabase data.
// It must render on request rather than being prerendered at build time.
export const instant = false;

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", userId)
    .maybeSingle();

  const isSeller = profile?.role === "seller";

  return (
    <main className="auth-page">
      <section className="auth-card account-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">m</span><span>marketday<span className="brand-period">.</span></span></Link>
        <p className="eyebrow">YOUR MARKETDAY ACCOUNT</p>
        <h1>Welcome{profile?.display_name ? `, ${profile.display_name}` : " back"}.</h1>
        <p className="auth-description">
          {isSeller
            ? "Your seller account is ready. The next step is setting up your shop."
            : "You’re signed in and ready to explore independent businesses."}
        </p>
        {isSeller && <p className="auth-notice">Seller account selected · Store setup is coming next.</p>}
        <div className="account-actions">
          <Link className="button button-dark" href="/">Explore marketplace <span aria-hidden="true">→</span></Link>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
