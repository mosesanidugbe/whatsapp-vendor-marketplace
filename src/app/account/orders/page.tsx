import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountHeader } from "@/components/account-header";

export const instant = false;

type OrderItem = {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

type CustomerOrder = {
  id: string;
  order_number: string;
  status: "pending" | "confirmed" | "processing" | "completed" | "cancelled";
  subtotal_amount: number;
  total_amount: number;
  currency: string;
  created_at: string;
  stores: { name: string } | null;
  order_items: OrderItem[];
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency.trim(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function statusLabel(status: CustomerOrder["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/sign-in");

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, subtotal_amount, total_amount, currency, created_at, stores(name), order_items(id, product_name, unit_price, quantity, line_total)")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as CustomerOrder[];

  return (
    <main className="account-page">
      <AccountHeader showAccountLink showExploreLink={false} />

      <div className="account-content">
        <Link className="orders-back-link" href="/account">← Back to account</Link>
        <section className="orders-welcome">
          <p className="eyebrow">YOUR MARKETDAY ACCOUNT</p>
          <h1>Your orders.</h1>
          <p>Keep track of the orders you&apos;ve started with marketplace vendors.</p>
        </section>

        {error ? (
          <div className="orders-empty" role="alert">
            <h2>We couldn&apos;t load your orders.</h2>
            <p>Please refresh the page and try again.</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="orders-empty">
            <span aria-hidden="true">📦</span>
            <h2>No orders yet.</h2>
            <p>When you check out with a vendor, your order and its status will appear here.</p>
            <Link className="button button-dark" href="/">Explore marketplace <span aria-hidden="true">→</span></Link>
          </div>
        ) : (
          <section className="orders-list" aria-label="Your orders">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <p className="order-vendor-label">ORDER FROM</p>
                    <h2>{order.stores?.name ?? "Marketplace vendor"}</h2>
                    <p className="order-number">{order.order_number}</p>
                  </div>
                  <span className={`order-status order-status-${order.status}`}>{statusLabel(order.status)}</span>
                </div>

                <div className="order-items">
                  {order.order_items.map((item) => (
                    <div className="order-item" key={item.id}>
                      <div>
                        <strong>{item.product_name}</strong>
                        <span>Qty {item.quantity} · {money(Number(item.unit_price), order.currency)} each</span>
                      </div>
                      <strong>{money(Number(item.line_total), order.currency)}</strong>
                    </div>
                  ))}
                </div>

                <div className="order-card-footer">
                  <span>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</span>
                  <div><span>Total</span><strong>{money(Number(order.total_amount), order.currency)}</strong></div>
                </div>
                <p className="order-status-note">
                  {order.status === "pending"
                    ? "Your order has been created. The vendor will confirm the order with you on WhatsApp."
                    : order.status === "confirmed"
                      ? "The vendor has confirmed your order."
                      : order.status === "processing"
                        ? "The vendor is preparing your order."
                        : order.status === "completed"
                          ? "This order has been marked as completed."
                          : "This order has been cancelled. Contact the vendor if you need more information."}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
