import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const appUrl = process.env.MARKETPLACE_TEST_APP_URL || "http://127.0.0.1:3187";
const projectRef = "otipprrbdlnwfyltshuu";

function required(value, name) {
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function message(error) {
  return error?.message ?? String(error ?? "Unknown error");
}
function client() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

required(url, "SUPABASE_URL");
required(anonKey, "SUPABASE_ANON_KEY");
assert(new URL(url).hostname.startsWith(projectRef + "."),
  "Refusing to run outside the approved development Supabase project.");

const accounts = [
  {
    label: "Account A",
    email: required(process.env.STORAGE_TEST_SELLER_A_EMAIL, "STORAGE_TEST_SELLER_A_EMAIL"),
    password: required(process.env.STORAGE_TEST_SELLER_A_PASSWORD, "STORAGE_TEST_SELLER_A_PASSWORD"),
  },
  {
    label: "Account B",
    email: required(process.env.STORAGE_TEST_SELLER_B_EMAIL, "STORAGE_TEST_SELLER_B_EMAIL"),
    password: required(process.env.STORAGE_TEST_SELLER_B_PASSWORD, "STORAGE_TEST_SELLER_B_PASSWORD"),
  },
];

const results = [];
const state = {
  users: [],
  createdProducts: [],
  createdCarts: [],
  cartItems: [],
  storeDescriptions: [],
};
let server;

async function test(name, run) {
  try {
    await run();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", reason: message(error) });
  }
}

async function signIn(account) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw new Error(account.label + " sign-in failed: " + message(error));
  assert(data.user?.id, account.label + " did not resolve to a user.");
  return { ...account, id: data.user.id, supabase };
}

async function pageCookie(account) {
  const jar = new Map();
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) jar.set(cookie.name, cookie.value);
      },
    },
  });
  const { error } = await ssr.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw error;
  return [...jar.entries()].map(([name, value]) => name + "=" + value).join("; ");
}

async function startApp() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
  };
  const port = new URL(appUrl).port || "3187";
  server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start",
    "--hostname", "127.0.0.1", "--port", port,
  ], { env, stdio: "ignore" });

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Next.js server exited before becoming ready.");
    try {
      const response = await fetch(appUrl + "/sign-in");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Next.js server did not become ready within 60 seconds.");
}

async function assertAuthenticatedPage(account, path, expectedText) {
  const cookie = await pageCookie(account);
  const response = await fetch(appUrl + path, {
    headers: { cookie },
    redirect: "manual",
  });
  const html = await response.text();
  assert(response.status === 200, account.label + " received HTTP " + response.status + " for " + path + ".");
  assert(!response.headers.get("location"), account.label + " was redirected away from " + path + ".");
  assert(html.includes(expectedText),
    account.label + " page " + path + " did not render expected content: " + expectedText);
}

async function main() {
  const [a, b] = await Promise.all(accounts.map(signIn));
  assert(a.id !== b.id, "The two integration accounts must be different users.");
  state.users = [a, b];

  const stores = [];
  const products = [];
  for (const account of state.users) {
    const { data: profile, error: profileError } = await account.supabase
      .from("profiles").select("id").eq("id", account.id).single();
    if (profileError) throw new Error(account.label + " profile lookup failed: " + message(profileError));
    assert(profile.id === account.id, account.label + " profile was not accessible.");

    const { data: ownStore, error: storeError } = await account.supabase
      .from("stores")
      .select("id,owner_id,name,slug,description,whatsapp_number,is_active")
      .eq("owner_id", account.id).single();
    if (storeError) throw new Error(account.label + " store lookup failed: " + message(storeError));
    assert(ownStore.owner_id === account.id, account.label + " did not resolve its own store.");
    stores.push(ownStore);

    const { data: ownProducts, error: productsError } = await account.supabase
      .from("products")
      .select("id,store_id,name,slug,price,currency,stock_quantity,is_published")
      .eq("store_id", ownStore.id);
    if (productsError) throw new Error(account.label + " product lookup failed: " + message(productsError));
    assert(ownProducts?.length > 0, account.label + " needs at least one existing product for cross-store tests.");
    products.push(ownProducts[0]);
  }
  assert(stores[0].id !== stores[1].id, "The accounts must own different stores.");

  await startApp();

  for (const account of state.users) {
    await test(account.label + " can open the signed-in account page", async () => {
      await assertAuthenticatedPage(account, "/account", "Your shopping carts");
      const cookie = await pageCookie(account);
      const response = await fetch(appUrl + "/account", { headers: { cookie } });
      const html = await response.text();
      assert(html.includes("Open Seller Studio"), "The account page did not expose Seller Studio.");
    });

    await test(account.label + " can open Seller Studio", async () => {
      await assertAuthenticatedPage(account, "/seller-studio", "Seller Studio.");
      const cookie = await pageCookie(account);
      const response = await fetch(appUrl + "/seller-studio", { headers: { cookie } });
      const html = await response.text();
      assert(html.includes("YOUR SHOP"), "Seller Studio did not render the store management panel.");
      assert(html.includes("YOUR CATALOG"), "Seller Studio did not render the product management panel.");
    });
  }

  for (let index = 0; index < state.users.length; index += 1) {
    const account = state.users[index];
    const store = stores[index];
    const otherStore = stores[1 - index];
    const otherProduct = products[1 - index];
    const suffix = randomUUID().slice(0, 8);

    await test(account.label + " can update and restore its own store details", async () => {
      const original = store.description;
      state.storeDescriptions.push({ account, storeId: store.id, description: original });
      const { data, error } = await account.supabase.from("stores")
        .update({ description: "Integration test " + suffix })
        .eq("id", store.id).select("description").single();
      if (error) throw error;
      assert(data.description === "Integration test " + suffix, "Store description update was not saved.");
      const restored = await account.supabase.from("stores")
        .update({ description: original }).eq("id", store.id);
      if (restored.error) throw restored.error;
      state.storeDescriptions.pop();
    });

    await test(account.label + " can create, edit and delete its own product", async () => {
      const slug = "integration-test-" + suffix;
      const created = await account.supabase.from("products").insert({
        store_id: store.id,
        name: "Integration test product " + suffix,
        slug,
        description: "Temporary automated integration-test product.",
        price: 1,
        currency: "NGN",
        stock_quantity: 1,
        is_published: false,
      }).select("id").single();
      if (created.error) throw created.error;
      state.createdProducts.push({ account, id: created.data.id });

      const updated = await account.supabase.from("products")
        .update({ price: 2, stock_quantity: 2 })
        .eq("id", created.data.id).select("price,stock_quantity").single();
      if (updated.error) throw updated.error;
      assert(Number(updated.data.price) === 2 && updated.data.stock_quantity === 2,
        "Product edit did not persist.");

      const removed = await account.supabase.from("products")
        .delete().eq("id", created.data.id).select("id").single();
      if (removed.error) throw removed.error;
      state.createdProducts = state.createdProducts.filter((item) => item.id !== created.data.id);
    });

    await test(account.label + " cannot create a second store", async () => {
      const { data, error } = await account.supabase.from("stores").insert({
        owner_id: account.id,
        name: "Second test store " + suffix,
        slug: "second-test-store-" + suffix,
        whatsapp_number: store.whatsapp_number,
      }).select("id").maybeSingle();
      assert(Boolean(error), "A second store was unexpectedly created.");
      if (data?.id) {
        await account.supabase.from("stores").delete().eq("id", data.id);
        throw new Error("Second-store guard failed; unexpected test store was cleaned up.");
      }
    });

    await test(account.label + " cannot modify another user's product", async () => {
      const before = otherProduct.name;
      const { data, error } = await account.supabase.from("products")
        .update({ name: "Unauthorized edit " + suffix })
        .eq("id", otherProduct.id).select("id");
      if (error) throw error;
      assert(!data || data.length === 0, "Cross-store product update unexpectedly affected a row.");
      const { data: unchanged, error: readError } = await account.supabase
        .from("products").select("name").eq("id", otherProduct.id).single();
      if (readError) throw readError;
      assert(unchanged.name === before, "Another user's product was modified.");
    });

    await test(account.label + " can create a cart and add another store's product", async () => {
      const { data: existingCart, error: lookupError } = await account.supabase
        .from("carts").select("id").eq("customer_id", account.id)
        .eq("store_id", otherStore.id).eq("status", "active").maybeSingle();
      if (lookupError) throw lookupError;

      let cartId = existingCart?.id;
      if (!cartId) {
        const createdCart = await account.supabase.from("carts")
          .insert({ customer_id: account.id, store_id: otherStore.id })
          .select("id").single();
        if (createdCart.error) throw createdCart.error;
        cartId = createdCart.data.id;
        state.createdCarts.push({ account, id: cartId });
      }

      const { data: existingItem, error: itemLookupError } = await account.supabase
        .from("cart_items").select("id,quantity")
        .eq("cart_id", cartId).eq("product_id", otherProduct.id).maybeSingle();
      if (itemLookupError) throw itemLookupError;

      if (existingItem) {
        const changed = await account.supabase.from("cart_items")
          .update({ quantity: Math.min(existingItem.quantity + 1, 99) })
          .eq("id", existingItem.id).select("id").single();
        if (changed.error) throw changed.error;
        state.cartItems.push({ account, id: existingItem.id, quantity: existingItem.quantity });
      } else {
        const added = await account.supabase.from("cart_items")
          .insert({ cart_id: cartId, product_id: otherProduct.id, quantity: 1 })
          .select("id").single();
        if (added.error) throw added.error;
        state.cartItems.push({ account, id: added.data.id, created: true });
      }
    });

    await test(account.label + " cannot create a cart for its own store", async () => {
      const { data, error } = await account.supabase.from("carts")
        .insert({ customer_id: account.id, store_id: store.id })
        .select("id").maybeSingle();
      assert(Boolean(error), "Own-store cart creation unexpectedly succeeded.");
      if (data?.id) {
        await account.supabase.from("carts").delete().eq("id", data.id);
        throw new Error("Own-store cart guard failed; unexpected test cart was cleaned up.");
      }
    });
  }
}

async function cleanup() {
  for (const item of state.cartItems.reverse()) {
    try {
      const result = item.created
        ? await item.account.supabase.from("cart_items").delete().eq("id", item.id)
        : await item.account.supabase.from("cart_items").update({ quantity: item.quantity }).eq("id", item.id);
      if (result.error) throw result.error;
    } catch (error) {
      console.error("Cleanup warning for cart item " + item.id + ": " + message(error));
      process.exitCode = 1;
    }
  }
  for (const item of state.createdCarts.reverse()) {
    try {
      const { error } = await item.account.supabase.from("carts").delete().eq("id", item.id);
      if (error) throw error;
    } catch (error) {
      console.error("Cleanup warning for cart " + item.id + ": " + message(error));
      process.exitCode = 1;
    }
  }
  for (const item of state.createdProducts.reverse()) {
    try {
      const { error } = await item.account.supabase.from("products").delete().eq("id", item.id);
      if (error) throw error;
    } catch (error) {
      console.error("Cleanup warning for product " + item.id + ": " + message(error));
      process.exitCode = 1;
    }
  }
  for (const item of state.storeDescriptions.reverse()) {
    try {
      const { error } = await item.account.supabase.from("stores")
        .update({ description: item.description }).eq("id", item.storeId);
      if (error) throw error;
    } catch (error) {
      console.error("Cleanup warning for store " + item.storeId + ": " + message(error));
      process.exitCode = 1;
    }
  }
  for (const account of state.users) {
    await account.supabase.auth.signOut();
  }
  if (server && server.exitCode === null) server.kill("SIGTERM");
}

try {
  await main();
} catch (error) {
  console.error("Marketplace integration setup error: " + message(error));
  process.exitCode = 1;
} finally {
  await cleanup();
}

console.log("\nUnified marketplace account integration results:");
for (const result of results) {
  console.log(result.status.padEnd(4) + "  " + result.name
    + (result.reason ? " — " + result.reason : ""));
}
const failures = results.filter((result) => result.status === "FAIL");
console.log("\n" + (results.length - failures.length) + "/" + results.length + " tests passed.");
if (failures.length) process.exitCode = 1;
