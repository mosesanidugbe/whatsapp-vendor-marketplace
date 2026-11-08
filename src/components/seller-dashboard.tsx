"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "marketplace-images";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Category = { id: string; name: string };
type Store = { id: string; name: string; slug: string; description: string | null; whatsapp_number: string; logo_url: string | null };
type Product = { id: string; name: string; slug: string; description: string | null; price: number; currency: string; stock_quantity: number; category_id: string | null; image_urls: string[]; is_published: boolean };

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function storagePath(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
}

export function SellerDashboard({ userId, initialStore, initialProducts, categories }: {
  userId: string; initialStore: Store | null; initialProducts: Product[]; categories: Category[];
}) {
  const router = useRouter();
  const [store, setStore] = useState(initialStore);
  const [products, setProducts] = useState(initialProducts);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [storeName, setStoreName] = useState(initialStore?.name ?? "");
  const [storeSlug, setStoreSlug] = useState(initialStore?.slug ?? "");
  const [description, setDescription] = useState(initialStore?.description ?? "");
  const [whatsapp, setWhatsapp] = useState(initialStore?.whatsapp_number ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [published, setPublished] = useState(true);
  const productFileRef = useRef<HTMLInputElement>(null);
  const storeFileRef = useRef<HTMLInputElement>(null);

  async function validateFile(file: File | null) {
    if (!file) return null;
    if (!TYPES.includes(file.type)) return "Choose a JPEG, PNG, or WebP image.";
    if (file.size > MAX_BYTES) return "Image must be 5 MiB or smaller.";
    // Check the file signature too; the browser's MIME type alone is user-controlled.
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!(jpeg || png || webp)) return "The selected file does not contain a valid JPEG, PNG, or WebP image.";
    return null;
  }
  async function upload(file: File, folder: "products" | "store") {
    const supabase = createClient();
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }
  async function removeObject(path: string | null) {
    if (!path) return;
    const { error } = await createClient().storage.from(BUCKET).remove([path]);
    if (error) console.error("Could not remove replaced image:", error.message);
  }

  async function saveStore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const fileError = await validateFile(logo); if (fileError) { setError(fileError); return; }
    if (!/^\+?[1-9]\d{7,14}$/.test(whatsapp.replace(/[\s()-]/g, ""))) { setError("Enter a valid WhatsApp number with country code."); return; }
    setBusy(true);
    let uploaded: { path: string; url: string } | null = null;
    try {
      const supabase = createClient();
      const payload = { name: storeName.trim(), slug: slugify(storeSlug || storeName), description: description.trim() || null, whatsapp_number: whatsapp.replace(/[\s()-]/g, "") };
      const result = store
        ? await supabase.from("stores").update(payload).eq("id", store.id).select("id,name,slug,description,whatsapp_number,logo_url").single()
        : await supabase.from("stores").insert({ ...payload, owner_id: userId }).select("id,name,slug,description,whatsapp_number,logo_url").single();
      if (result.error) throw result.error;
      // The Storage INSERT policy requires an existing seller-owned store.
      let savedStore = result.data;
      setStore(savedStore);
      if (logo) {
        uploaded = await upload(logo, "store");
        const logoResult = await supabase.from("stores").update({ logo_url: uploaded.url }).eq("id", savedStore.id).select("id,name,slug,description,whatsapp_number,logo_url").single();
        if (logoResult.error) throw logoResult.error;
        savedStore = logoResult.data;
      }
      if (uploaded && store?.logo_url) await removeObject(storagePath(store.logo_url));
      setStore(savedStore); setStoreName(savedStore.name); setStoreSlug(savedStore.slug); setLogo(null);
      if (storeFileRef.current) storeFileRef.current.value = "";
      setMessage("Store details saved."); router.refresh();
    } catch (e) {
      if (uploaded) await removeObject(uploaded.path);
      setError(e instanceof Error ? e.message : "Could not save store.");
    } finally { setBusy(false); }
  }

  function startEdit(product: Product) {
    setEditing(product); setProductName(product.name); setProductDescription(product.description ?? "");
    setPrice(String(product.price)); setStock(String(product.stock_quantity)); setCategoryId(product.category_id ?? "");
    setPublished(product.is_published); setImage(null); setMessage(""); setError("");
    if (productFileRef.current) productFileRef.current.value = "";
  }
  function resetProduct() {
    setEditing(null); setProductName(""); setProductDescription(""); setPrice(""); setStock("1");
    setCategoryId(""); setPublished(true); setImage(null);
    if (productFileRef.current) productFileRef.current.value = "";
  }
  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const fileError = await validateFile(image); if (fileError) { setError(fileError); return; }
    const numericPrice = Number(price), numericStock = Number(stock);
    if (!productName.trim() || productName.trim().length < 2 || !Number.isFinite(numericPrice) || numericPrice < 0 || !Number.isInteger(numericStock) || numericStock < 0) {
      setError("Enter a product name, a valid non-negative price, and a whole-number stock quantity."); return;
    }
    if (!store) { setError("Create your store before adding products."); return; }
    setBusy(true);
    let uploaded: { path: string; url: string } | null = null;
    try {
      const supabase = createClient();
      if (image) uploaded = await upload(image, "products");
      const existingImages = editing?.image_urls ?? [];
      const imageUrls = uploaded ? [uploaded.url, ...existingImages.filter((url) => url !== existingImages[0])] : existingImages;
      const payload = { store_id: store.id, name: productName.trim(), slug: editing ? slugify(productName) : `${slugify(productName)}-${crypto.randomUUID().slice(0, 8)}`, description: productDescription.trim() || null, price: numericPrice, currency: "NGN", stock_quantity: numericStock, category_id: categoryId || null, image_urls: imageUrls, is_published: published };
      const result = editing
        ? await supabase.from("products").update(payload).eq("id", editing.id).select("id,name,slug,description,price,currency,stock_quantity,category_id,image_urls,is_published").single()
        : await supabase.from("products").insert(payload).select("id,name,slug,description,price,currency,stock_quantity,category_id,image_urls,is_published").single();
      if (result.error) throw result.error;
      if (uploaded && editing?.image_urls?.[0]) await removeObject(storagePath(editing.image_urls[0]));
      setProducts((current) => editing ? current.map((item) => item.id === editing.id ? result.data : item) : [result.data, ...current]);
      resetProduct(); setMessage(editing ? "Product updated." : "Product added."); router.refresh();
    } catch (e) {
      if (uploaded) await removeObject(uploaded.path);
      setError(e instanceof Error ? e.message : "Could not save product.");
    } finally { setBusy(false); }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
      setProducts((current) => current.filter((item) => item.id !== product.id));
      await Promise.all(product.image_urls.map((url) => removeObject(storagePath(url))));
      setMessage("Product deleted."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete product."); }
    finally { setBusy(false); }
  }

  return (
    <div className="seller-dashboard">
      <section className="seller-panel">
        <div className="seller-panel-heading"><div><p className="eyebrow">YOUR SHOP</p><h2>{store ? "Store details" : "Set up your store"}</h2><p>Customers see these details on your storefront.</p></div></div>
        <form className="seller-form" onSubmit={saveStore}>
          <label>Store name<input required minLength={2} maxLength={100} value={storeName} onChange={(e) => { setStoreName(e.target.value); if (!store) setStoreSlug(slugify(e.target.value)); }} placeholder="e.g. Gadget Hub" /></label>
          <label>Store URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} placeholder="gadget-hub" /></label>
          <label>WhatsApp number<input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+2348012345678" /></label>
          <label>Store description<textarea rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell customers what you sell..." /></label>
          <label className="seller-file-label">Store logo <span>JPEG, PNG or WebP · up to 5 MiB</span><input ref={storeFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></label>
          {store?.logo_url && <img className="seller-logo-preview" src={store.logo_url} alt="Current store logo" />}
          <button className="button button-dark" disabled={busy}>{busy ? "Saving..." : store ? "Save store details" : "Create store"}</button>
        </form>
      </section>

      {store && <>
        <section className="seller-panel">
          <div className="seller-panel-heading"><div><p className="eyebrow">YOUR CATALOG</p><h2>{editing ? "Edit product" : "Add a product"}</h2><p>List products customers can discover and add to their carts.</p></div></div>
          <form className="seller-form" onSubmit={saveProduct}>
            <label>Product name<input required minLength={2} maxLength={160} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Wireless headphones" /></label>
            <label>Description<textarea rows={3} value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Product details..." /></label>
            <div className="seller-form-row">
              <label>Price (₦)<input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
              <label>Stock quantity<input required type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} /></label>
            </div>
            <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="seller-file-label">Product image <span>JPEG, PNG or WebP · up to 5 MiB</span><input ref={productFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} /></label>
            {editing?.image_urls?.[0] && <img className="seller-product-preview" src={editing.image_urls[0]} alt="Current product" />}
            <label className="seller-publish-toggle"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publish product in marketplace</label>
            <div className="seller-form-actions"><button className="button button-dark" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Add product"}</button>{editing && <button type="button" className="button seller-cancel" onClick={resetProduct}>Cancel</button>}</div>
          </form>
        </section>
        <section className="seller-panel">
          <div className="seller-panel-heading"><div><p className="eyebrow">PRODUCTS</p><h2>Your products <span className="seller-count">{products.length}</span></h2></div></div>
          {products.length ? <div className="seller-product-list">{products.map((product) => <article className="seller-product-row" key={product.id}>
            <div className="seller-product-thumb">{product.image_urls?.[0] ? <img src={product.image_urls[0]} alt="" /> : <span>🛍️</span>}</div>
            <div className="seller-product-summary"><strong>{product.name}</strong><span>₦{Number(product.price).toLocaleString("en-NG")} · {product.stock_quantity} in stock · {product.is_published ? "Published" : "Draft"}</span></div>
            <div className="seller-product-actions"><button type="button" onClick={() => startEdit(product)} disabled={busy}>Edit</button><button type="button" className="seller-delete" onClick={() => deleteProduct(product)} disabled={busy}>Delete</button></div>
          </article>)}</div> : <p className="seller-empty">You haven’t added any products yet. Add your first product above.</p>}
        </section>
      </>}
      {message && <p className="seller-feedback" role="status">{message}</p>}
      {error && <p className="seller-error" role="alert">{error}</p>}
    </div>
  );
}
