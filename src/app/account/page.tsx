import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { CustomerCarts } from "@/components/customer-carts";

// This authenticated page reads request-specific cookies and Supabase data.
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
    <main className="account-page">
      <header className="account-header">
        <Link className="brand" href="/"><span className="brand-mark">m</span><span>marketday<span className="brand-period">.</span></span></Link>
        <div className="header-actions">
          <Link className="sign-in" href="/account/orders">My orders</Link>
          <Link className="sign-in" href="/">Explore marketplace</Link>
          <SignOutButton className="button button-dark button-small" />
        </div>
      </header>
      <div className="account-content">
        <section className="account-welcome">
          <p className="eyebrow">YOUR MARKETDAY ACCOUNT</p>
          <h1>Welcome{profile?.display_name ? `, ${profile.display_name}` : " back"}.</h1>
          <p>{isSeller
            ? "Your seller account is ready. Store management is the next milestone."
            : "Your finds, all in one place. Pick up where you left off."}</p>
        </section>
        {isSeller ? (
          <div className="seller-account-notice">
            <strong>Seller account</strong>
            <p>Your seller dashboard is being built separately. You can still explore the marketplace while we work on it.</p>
            <Link className="button button-dark" href="/">Explore marketplace <span aria-hidden="true">→</span></Link>
          </div>
        ) : (
          <CustomerCarts />
        )}
      </div>
    </main>
  );
}
