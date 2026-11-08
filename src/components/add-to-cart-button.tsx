"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AddToCartButton({
  productId,
  storeId,
  isOwnStore = false,
}: {
  productId: string;
  storeId: string;
  isOwnStore?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function addToCart() {
    if (isOwnStore) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: initialCart, error: cartError } = await supabase
        .from("carts")
        .select("id")
        .eq("customer_id", user.id)
        .eq("store_id", storeId)
        .eq("status", "active")
        .maybeSingle();

      if (cartError) throw cartError;
      let cart = initialCart;

      if (!cart) {
        const created = await supabase
          .from("carts")
          .insert({ customer_id: user.id, store_id: storeId })
          .select("id")
          .single();

        if (created.error?.code === "23505") {
          const existing = await supabase
            .from("carts")
            .select("id")
            .eq("customer_id", user.id)
            .eq("store_id", storeId)
            .eq("status", "active")
            .single();
          if (existing.error) throw existing.error;
          cart = existing.data;
        } else {
          if (created.error) throw created.error;
          cart = created.data;
        }
      }

      const { data: existingItem, error: itemLookupError } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (itemLookupError) throw itemLookupError;

      if (existingItem) {
        if (existingItem.quantity >= 99) {
          setMessage("Maximum quantity reached");
          return;
        }
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + 1 })
          .eq("id", existingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ cart_id: cart.id, product_id: productId, quantity: 1 });
        if (error) throw error;
      }

      setMessage("Added to cart");
      router.refresh();
    } catch (error) {
      console.error("Unable to add product to cart:", error);
      setMessage("Couldn't add item. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="add-to-cart-control">
      <button className="add-to-cart-button" type="button" onClick={addToCart} disabled={busy || isOwnStore} aria-describedby={isOwnStore ? `own-store-${productId}` : undefined}>
        {isOwnStore ? "Your store" : busy ? "Adding…" : "Add to cart"}
      </button>
      {isOwnStore && <span className="cart-action-message" id={`own-store-${productId}`} role="note">You can’t purchase products from your own store.</span>}
      {message && <span className="cart-action-message" role="status">{message}</span>}
    </div>
  );
}
