import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const BUCKET = "marketplace-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PROJECT_REF = "otipprrbdlnwfyltshuu";
const PNG_A = Buffer.from("seller-a-test-image-v1");
const PNG_A_UPDATED = Buffer.from("seller-a-test-image-v2");
const PNG_B = Buffer.from("seller-b-test-image-original");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameBytes(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function errorMessage(error) {
  return error?.message ?? String(error ?? "Unknown error");
}

const url = required("SUPABASE_URL");
const anonKey = required("SUPABASE_ANON_KEY");

// Safety guard: this suite is intentionally restricted to the known development project.
const hostname = new URL(url).hostname;
assert(
  hostname.startsWith(`${PROJECT_REF}.`),
  `Refusing to run: expected development Supabase project ${PROJECT_REF}, received ${hostname}`,
);

const sellerAEmail = required("STORAGE_TEST_SELLER_A_EMAIL");
const sellerAPassword = required("STORAGE_TEST_SELLER_A_PASSWORD");
const sellerBEmail = required("STORAGE_TEST_SELLER_B_EMAIL");
const sellerBPassword = required("STORAGE_TEST_SELLER_B_PASSWORD");

function makeClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const sellerA = makeClient();
const sellerB = makeClient();
const anonymous = makeClient();

const results = [];
const paths = { a: null, b: null, crossUpload: null, invalidMime: null, oversized: null };

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", reason: errorMessage(error) });
  }
}

async function downloadBytes(client, path) {
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function assertMissing(client, path, message) {
  const { data, error } = await client.storage.from(BUCKET).download(path);
  assert(Boolean(error) || !data, message);
}

async function removeOwn(client, path) {
  if (!path) return;
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

async function main() {
  const { data: authA, error: loginAError } = await sellerA.auth.signInWithPassword({
    email: sellerAEmail,
    password: sellerAPassword,
  });
  if (loginAError) throw new Error(`Seller A sign-in failed: ${errorMessage(loginAError)}`);

  const { data: authB, error: loginBError } = await sellerB.auth.signInWithPassword({
    email: sellerBEmail,
    password: sellerBPassword,
  });
  if (loginBError) throw new Error(`Seller B sign-in failed: ${errorMessage(loginBError)}`);

  const sellerAId = authA.user?.id;
  const sellerBId = authB.user?.id;
  assert(sellerAId && sellerBId, "Could not resolve both authenticated seller IDs.");
  assert(sellerAId !== sellerBId, "Seller A and Seller B must be two different accounts.");

  for (const [label, client, userId] of [["Seller A", sellerA, sellerAId], ["Seller B", sellerB, sellerBId]]) {
    const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", userId).single();
    if (profileError) throw new Error(`${label} profile check failed: ${errorMessage(profileError)}`);
    assert(profile?.role === "seller", `${label} account must have the seller role.`);
    const { data: store, error: storeError } = await client.from("stores").select("id").eq("owner_id", userId).limit(1).maybeSingle();
    if (storeError) throw new Error(`${label} store check failed: ${errorMessage(storeError)}`);
    assert(store, `${label} must have an existing store before Storage tests can run.`);
  }

  const suffix = randomUUID();
  paths.a = `${sellerAId}/products/security-test-${suffix}-a.png`;
  paths.b = `${sellerBId}/products/security-test-${suffix}-b.png`;
  paths.crossUpload = `${sellerBId}/products/security-test-${suffix}-cross.png`;
  paths.invalidMime = `${sellerAId}/products/security-test-${suffix}-invalid.txt`;
  paths.oversized = `${sellerAId}/products/security-test-${suffix}-oversized.png`;

  await test("Seller A can upload to their own products folder", async () => {
    const { error } = await sellerA.storage.from(BUCKET).upload(paths.a, PNG_A, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) throw error;
  });

  await test("Seller B can upload to their own products folder", async () => {
    const { error } = await sellerB.storage.from(BUCKET).upload(paths.b, PNG_B, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) throw error;
  });

  await test("Seller A can update their own image", async () => {
    const { error } = await sellerA.storage.from(BUCKET).update(paths.a, PNG_A_UPDATED, {
      contentType: "image/png",
    });
    if (error) throw error;
    const actual = await downloadBytes(sellerA, paths.a);
    assert(sameBytes(actual, PNG_A_UPDATED), "Seller A's updated image content did not match.");
  });

  await test("Seller B can list their own product images", async () => {
    const { data, error } = await sellerB.storage.from(BUCKET).list(`${sellerBId}/products`);
    if (error) throw error;
    assert(
      data?.some((entry) => entry.name === paths.b.split("/").at(-1)),
      "Seller B could not see their own test object in the Storage listing.",
    );
  });

  await test("Seller A cannot upload into Seller B's folder", async () => {
    const { error } = await sellerA.storage.from(BUCKET).upload(paths.crossUpload, PNG_A, {
      contentType: "image/png",
      upsert: false,
    });
    // A rejected request is expected. Some Storage operations may not expose row-policy
    // failures uniformly, so verify the object was not created from Seller B's session.
    const { data } = await sellerB.storage.from(BUCKET).download(paths.crossUpload);
    assert(Boolean(error) || !data, "Cross-seller upload unexpectedly created an object.");
  });

  await test("Seller A cannot replace Seller B's image", async () => {
    const { error } = await sellerA.storage.from(BUCKET).update(paths.b, PNG_A_UPDATED, {
      contentType: "image/png",
    });
    const actual = await downloadBytes(sellerB, paths.b);
    assert(
      Boolean(error) || sameBytes(actual, PNG_B),
      "Seller A changed the contents of Seller B's object.",
    );
  });

  await test("Seller A cannot delete Seller B's image", async () => {
    const { error } = await sellerA.storage.from(BUCKET).remove([paths.b]);
    const actual = await downloadBytes(sellerB, paths.b);
    assert(
      Boolean(error) || sameBytes(actual, PNG_B),
      "Seller A deleted or changed Seller B's object.",
    );
  });

  await test("Storage rejects an unsupported MIME type", async () => {
    const { error } = await sellerA.storage.from(BUCKET).upload(
      paths.invalidMime,
      Buffer.from("not an image"),
      { contentType: "text/plain", upsert: false },
    );
    assert(error, "Storage accepted text/plain even though the bucket only allows JPEG, PNG and WebP.");
    await assertMissing(sellerA, paths.invalidMime, "An object was created despite the MIME rejection.");
  });

  await test("Storage rejects an image larger than 5 MiB", async () => {
    const oversized = Buffer.alloc(MAX_FILE_SIZE + 1, 1);
    const { error } = await sellerA.storage.from(BUCKET).upload(paths.oversized, oversized, {
      contentType: "image/png",
      upsert: false,
    });
    assert(error, "Storage accepted an object larger than the 5 MiB bucket limit.");
    await assertMissing(sellerA, paths.oversized, "An oversized object was created.");
  });

  await test("Public image delivery works for a public bucket", async () => {
    const { data, error } = await anonymous.storage.from(BUCKET).download(paths.a);
    if (error) throw error;
    assert(data, "Anonymous download returned no image data.");
    const actual = Buffer.from(await data.arrayBuffer());
    assert(sameBytes(actual, PNG_A_UPDATED), "Public download returned unexpected image content.");
  });
}

try {
  await main();
} catch (error) {
  console.error(`
Setup error: ${errorMessage(error)}`);
  process.exitCode = 1;
} finally {
  // Cleanup is performed with each object's owner session, never with a service-role key.
  for (const [client, path] of [
    [sellerA, paths.a],
    [sellerB, paths.b],
    [sellerA, paths.crossUpload],
    [sellerA, paths.invalidMime],
    [sellerA, paths.oversized],
  ]) {
    try {
      await removeOwn(client, path);
    } catch (error) {
      console.error(`Cleanup warning for ${path}: ${errorMessage(error)}`);
      process.exitCode = 1;
    }
  }

  await sellerA.auth.signOut();
  await sellerB.auth.signOut();
}

console.log("\nStorage security test results:");
for (const result of results) {
  console.log(`${result.status.padEnd(4)}  ${result.name}${result.reason ? ` — ${result.reason}` : ""}`);
}

const failures = results.filter((result) => result.status === "FAIL");
console.log(`
${results.length - failures.length}/${results.length} tests passed.`);
if (failures.length > 0) process.exitCode = 1;
