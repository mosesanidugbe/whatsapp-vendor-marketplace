import { redirect } from "next/navigation";
import { AccountHeader } from "@/components/account-header";
import { CustomerCarts } from "@/components/customer-carts";
import { SellerDashboard } from "@/components/seller-dashboard";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/sign-in");

  const [{ data: profile }, { data: store }, { data: categories }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("stores").select("id,name,slug,description,whatsapp_number,logo_url").eq("owner_id", userId).maybeSingle(),
    supabase.from("categories").select("id,name").eq("is_active", true).order("sort_order", { ascending: true }),
  ]);
  const { data: products } = store
    ? await supabase.from("products").select("id,name,slug,description,price,currency,stock_quantity,category_id,image_urls,is_published").eq("store_id", store.id).order("created_at", { ascending: false })
    : { data: [] };

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
        <section className="account-welcome">
          <p className="eyebrow">SELLER STUDIO</p>
          <h1>{store ? "Your store." : "Want to sell something?"}</h1>
          <p>{store ? "Manage your store, products and the images customers see in the marketplace." : "Opening a store is optional. You can keep shopping without one."}</p>
        </section>
        <SellerDashboard userId={userId} initialStore={store} initialProducts={products ?? []} categories={categories ?? []} />
      </div>
    </main>
  );
}
