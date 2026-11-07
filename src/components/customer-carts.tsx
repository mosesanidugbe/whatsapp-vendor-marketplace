"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CartItem = {
  id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    price: number;
    currency: string;
    image_urls: string[] | null;
  } | null;
};

type VendorCart = {
  id: string;
  store_id: string;
  stores: { name: string } | null;
  cart_items: CartItem[];
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function CustomerCarts() {
  const [carts, setCarts] = useState<VendorCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const loadCarts = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("carts")
      .select("id, store_id, stores(name), cart_items(id, quantity, products(id, name, price, currency, image_urls))")
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (queryError) {
      setError("We couldn't load your carts. Please refresh and try again.");
      console.error("Unable to load carts:", queryError);
    } else {
      setCarts((data ?? []) as unknown as VendorCart[]);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCarts();
  }, [loadCarts]);

  async function changeQuantity(item: CartItem, nextQuantity: number) {
    setBusyItem(item.id);
    setError("");
    const supabase = createClient();
    const result = nextQuantity < 1
      ? await supabase.from("cart_items").delete().eq("id", item.id)
      : await supabase.from("cart_items").update({ quantity: nextQuantity }).eq("id", item.id);

    if (result.error) {
      setError("That cart update didn't go through. Please try again.");
      console.error("Unable to update cart item:", result.error);
    } else {
      await loadCarts();
    }
    setBusyItem(null);
  }

  if (loading) return <div className="cart-loading">Loading your saved carts…</div>;

  return (
    <section className="customer-carts" aria-labelledby="cart-heading">
      <div className="cart-section-heading">
        <div>
          <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2 id="cart-heading">Your shopping carts</h2>
          <p className="cart-section-description">Each vendor has a separate cart, ready whenever you are.</p>
        </div>
        <span className="cart-count">{carts.reduce((total, cart) => total + cart.cart_items.length, 0)} items</span>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      {carts.length === 0 ? (
        <div className="cart-empty">
          <span aria-hidden="true">🛍️</span>
          <h3>Your carts are waiting to happen.</h3>
          <p>Browse the marketplace and add something you love. Your items will be saved here.</p>
          <a className="button button-dark" href="/">Explore marketplace <span aria-hidden="true">→</span></a>
        </div>
      ) : (
        <div className="vendor-cart-list">
          {carts.map((cart) => {
            const subtotal = cart.cart_items.reduce((sum, item) =>
              sum + Number(item.products?.price ?? 0) * item.quantity, 0);
            const currency = cart.cart_items[0]?.products?.currency ?? "NGN";

            return (
              <article className="vendor-cart" key={cart.id}>
                <div className="vendor-cart-heading">
                  <div>
                    <span className="vendor-cart-label">YOUR CART FROM</span>
                    <h3>{cart.stores?.name ?? "Independent vendor"}</h3>
                  </div>
                  <span className="vendor-item-count">{cart.cart_items.length} {cart.cart_items.length === 1 ? "product" : "products"}</span>
                </div>

                <div className="vendor-cart-items">
                  {cart.cart_items.map((item) => {
                    const product = item.products;
                    if (!product) return null;
                    const image = product.image_urls?.[0];
                    return (
                      <div className="vendor-cart-item" key={item.id}>
                        <div className="cart-item-image">
                          {image ? <img src={image} alt="" /> : <span>🛍️</span>}
                        </div>
                        <div className="cart-item-details">
                          <h4>{product.name}</h4>
                          <strong>{money(Number(product.price), product.currency)}</strong>
                          <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
                            <button type="button" disabled={busyItem === item.id} onClick={() => void changeQuantity(item, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                            <span>{item.quantity}</span>
                            <button type="button" disabled={busyItem === item.id || item.quantity >= 99} onClick={() => void changeQuantity(item, item.quantity + 1)} aria-label="Increase quantity">+</button>
                          </div>
                        </div>
                        <button className="remove-cart-item" type="button" disabled={busyItem === item.id} onClick={() => void changeQuantity(item, 0)}>Remove</button>
                      </div>
                    );
                  })}
                </div>

                <div className="vendor-cart-footer">
                  <span>Subtotal</span>
                  <strong>{money(subtotal, currency)}</strong>
                </div>
                <p className="cart-checkout-note">Checkout for this vendor will be available in the next step.</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
