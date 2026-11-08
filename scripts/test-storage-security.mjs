import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";

const BUCKET = "marketplace-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PROJECT_REF = "otipprrbdlnwfyltshuu";
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function makePng(red, green, blue) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = deflateSync(Buffer.from([0, red, green, blue]));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", pixels),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG_A = makePng(20, 80, 160);
const PNG_A_UPDATED = makePng(160, 80, 20);
const PNG_B = makePng(40, 120, 200);

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
const paths = { a: null, aOriginal: null, b: null, crossUpload: null, anonymous: null, direct: null };

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

async function requestValidatedUpload(client, folder, bytes, contentType) {
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("Could not read the authenticated seller session.");
  const response = await fetch(`${url.replace(/\/+$/, "")}/functions/v1/upload-marketplace-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      "Content-Type": contentType,
      "x-upload-folder": folder,
    },
    body: bytes,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
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
  paths.a = null;
  paths.b = null;
  paths.crossUpload = `${sellerBId}/products/security-test-${suffix}-cross.png`;
  paths.anonymous = `${sellerAId}/products/security-test-${suffix}-anonymous.png`;
  paths.direct = `${sellerAId}/products/security-test-${suffix}-direct.png`;

  await test("Anonymous visitors cannot upload marketplace images", async () => {
    const { error } = await anonymous.storage.from(BUCKET).upload(paths.anonymous, PNG_A, {
      contentType: "image/png",
      upsert: false,
    });
    assert(error, "Anonymous upload unexpectedly succeeded.");
    await assertMissing(sellerA, paths.anonymous, "An anonymous upload created an object.");
  });

  await test("Authenticated sellers cannot bypass validation with direct Storage uploads", async () => {
    const { error } = await sellerA.storage.from(BUCKET).upload(paths.direct, PNG_A, {
      contentType: "image/png",
      upsert: false,
    });
    assert(error, "A direct Storage upload bypassed the validation function.");
    await assertMissing(sellerA, paths.direct, "A direct Storage upload created an object.");
  });

  await test("Seller A can upload a valid PNG through the validation function", async () => {
    const { response, payload } = await requestValidatedUpload(sellerA, "products", PNG_A, "image/png");
    assert(response.ok && payload.path, payload.error || "Seller A's validated upload failed.");
    paths.a = payload.path;
    paths.aOriginal = payload.path;
  });

  await test("Seller B can upload a valid PNG through the validation function", async () => {
    const { response, payload } = await requestValidatedUpload(sellerB, "products", PNG_B, "image/png");
    assert(response.ok && payload.path, payload.error || "Seller B's validated upload failed.");
    paths.b = payload.path;
  });

  await test("Seller A can replace their own image through the validation function", async () => {
    const { response, payload } = await requestValidatedUpload(sellerA, "products", PNG_A_UPDATED, "image/png");
    assert(response.ok && payload.path, payload.error || "Seller A's replacement upload failed.");
    paths.a = payload.path;
    const actual = await downloadBytes(sellerA, paths.a);
    assert(sameBytes(actual, PNG_A_UPDATED), "Seller A's replacement image content did not match.");
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
    // Check the owner's view regardless of the request's returned error.
    const { data } = await sellerB.storage.from(BUCKET).download(paths.crossUpload);
    assert(!data, `Cross-seller upload unexpectedly created an object (request error: ${errorMessage(error)}).`);
  });

  await test("Seller A cannot replace Seller B's image", async () => {
    const { error } = await sellerA.storage.from(BUCKET).update(paths.b, PNG_A_UPDATED, {
      contentType: "image/png",
    });
    const actual = await downloadBytes(sellerB, paths.b);
    assert(
      sameBytes(actual, PNG_B),
      `Seller A changed the contents of Seller B's object (request error: ${errorMessage(error)}).`,
    );
  });

  await test("Seller A cannot delete Seller B's image", async () => {
    const { error } = await sellerA.storage.from(BUCKET).remove([paths.b]);
    const actual = await downloadBytes(sellerB, paths.b);
    assert(
      sameBytes(actual, PNG_B),
      `Seller A deleted or changed Seller B's object (request error: ${errorMessage(error)}).`,
    );
  });

  await test("Validation function rejects unsupported MIME types", async () => {
    const { response } = await requestValidatedUpload(sellerA, "products", Buffer.from("not an image"), "text/plain");
    assert(response.status === 415, "The upload function did not reject an unsupported MIME type.");
  });

  await test("Validation function rejects a forged image MIME/signature", async () => {
    const { response } = await requestValidatedUpload(sellerA, "products", Buffer.from("not a PNG file"), "image/png");
    assert(response.status === 415, "The upload function accepted bytes that do not contain a PNG signature.");
  });

  await test("Validation function rejects an image larger than 5 MiB", async () => {
    const oversized = Buffer.alloc(MAX_FILE_SIZE + 1, 1);
    const { response } = await requestValidatedUpload(sellerA, "products", oversized, "image/png");
    assert(response.status === 413, "The upload function accepted an image larger than 5 MiB.");
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
    [sellerA, paths.aOriginal],
    [sellerB, paths.b],
    [sellerB, paths.crossUpload],
    [sellerA, paths.anonymous],
    [sellerA, paths.direct],
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
