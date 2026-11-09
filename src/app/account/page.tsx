import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountHeader } from "@/components/account-header";
import { CustomerCarts } from "@/components/customer-carts";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return (
    <main className="account-page">
      <AccountHeader showOrdersLink />
      <div className="account-content">
        <section className="account-welcome">
          <p className="eyebrow">YOUR MARKETDAY ACCOUNT</p>
          <h1>Welcome{profile?.display_name ? `, ${profile.display_name}` : " back"}.</h1>
          <p>Shop from independent businesses, keep track of your orders, or open a store of your own.</p>
        </section>
        <CustomerCarts />
        <section className="seller-studio-entry">
          <div>
            <p className="eyebrow">SELLER STUDIO</p>
            <h2>Manage your store.</h2>
            <p>Set up your store, add products and manage your marketplace listings — all from the same account you use to shop.</p>
          </div>
          <Link className="button button-dark" href="/seller-studio">
            Open Seller Studio <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
