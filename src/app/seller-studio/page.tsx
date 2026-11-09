import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountHeader } from "@/components/account-header";
import { SellerDashboard } from "@/components/seller-dashboard";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function SellerStudioPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/sign-in");

  const [{ data: store }, { data: categories }] = await Promise.all([
    supabase
      .from("stores")
      .select("id,name,slug,description,whatsapp_number,logo_url")
      .eq("owner_id", userId)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id,name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const { data: products } = store
    ? await supabase
        .from("products")
        .select("id,name,slug,description,price,currency,stock_quantity,category_id,image_urls,is_published")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="account-page">
      <AccountHeader showAccountLink />
      <div className="account-content">
        <Link className="orders-back-link" href="/account">← Back to my account</Link>
        <section className="orders-welcome">
          <p className="eyebrow">YOUR MARKETDAY BUSINESS</p>
          <h1>Seller Studio.</h1>
          <p>Manage your store and the products customers discover in the marketplace.</p>
        </section>
        <SellerDashboard
          userId={userId}
          initialStore={store}
          initialProducts={products ?? []}
          categories={categories ?? []}
        />
      </div>
    </main>
  );
}
