import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { AddToCartButton } from "@/components/add-to-cart-button";

const categoryPresentation: Record<
  string,
  { icon: string; tone: string }
> = {
  "phones-gadgets": { icon: "📱", tone: "lavender" },
  fashion: { icon: "👟", tone: "peach" },
  beauty: { icon: "🧴", tone: "rose" },
  "home-living": { icon: "🪴", tone: "mint" },
  "food-treats": { icon: "🍪", tone: "butter" },
  "art-crafts": { icon: "🎨", tone: "sky" },
};

const productTones = [
  "product-lilac",
  "product-sand",
  "product-pink",
  "product-green",
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M10 5l5 5-5 5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency.trim(),
    maximumFractionDigits: 2,
  }).format(price);
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="homepage-loading" aria-busy="true">
          <p>Loading Marketday...</p>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const supabase = await createClient();

  const [{ data: claimsData }, { data: categoryRows }, { data: productRows }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, store_id, name, price, currency, image_urls, stock_quantity, stores!inner(name, is_active)",
      )
      .eq("is_published", true)
      .eq("stores.is_active", true)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const userId = claimsData?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
    : { data: null };
  const isSeller = profile?.role === "seller";

  const categories = categoryRows ?? [];
  const products = productRows ?? [];

  return (
    <main>
      <div className="announcement">
        <span className="announcement-sparkle">✳</span>
        Discover independent Nigerian businesses, all in one place.
        <a href="#featured">Explore the marketplace <span>↗</span></a>
      </div>

      <header className="site-header">
        <a className="brand" href="#" aria-label="Marketday home">
          <span className="brand-mark">m</span>
          <span>marketday<span className="brand-period">.</span></span>
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="nav-active" href="#featured">Discover</a>
          <a href="#categories">Categories</a>
          <a href="#sellers">For sellers</a>
        </nav>

        <div className="header-actions">
          {userId ? (
            <>
              <a className="sign-in" href="/account">
                {isSeller ? "Seller account" : "My account"}
              </a>
              <SignOutButton className="button button-dark button-small" />
            </>
          ) : (
            <>
              <a className="sign-in" href="/sign-in">Sign in</a>
              <a className="button button-dark button-small" href="/sign-up?role=seller">Open your store <ArrowIcon /></a>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> THE HOME OF WHATSAPP BUSINESSES</div>
          <h1>Good finds.<br /><span>Great people.</span></h1>
          <p className="hero-description">
            Meet the independent businesses behind the WhatsApp numbers.
            Find something you love, then shop directly with the seller.
          </p>

          <div className="hero-search">
            <SearchIcon />
            <input aria-label="Search products and stores" placeholder="Try “wireless headphones”" />
            <button type="button">Search <ArrowIcon /></button>
          </div>
          <div className="popular-searches">
            <span>Popular:</span>
            <a href="#featured">sneakers</a>
            <a href="#featured">skincare</a>
            <a href="#featured">home decor</a>
          </div>
        </div>

        <div className="hero-art" aria-label="A selection of products from independent sellers">
          <div className="hero-art-note"><span>✳</span> Little shops, big finds</div>
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-product hero-product-main">
            <span className="hero-product-emoji">👟</span>
            <span className="hero-product-caption">Your next favourite pair</span>
          </div>
          <div className="hero-product hero-product-small hero-product-top">
            <span>🧴</span>
          </div>
          <div className="hero-product hero-product-small hero-product-bottom">
            <span>🎧</span>
          </div>
          <div className="floating-note">
            <span className="floating-note-icon">♡</span>
            <span><strong>Shop small.</strong><small>Find your people.</small></span>
          </div>
          <span className="hero-star star-one">✳</span>
          <span className="hero-star star-two">✦</span>
        </div>
      </section>

      <section className="category-section section-wrap" id="categories">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A LITTLE BIT OF EVERYTHING</p>
            <h2>What are you in the mood for?</h2>
          </div>
          <a className="text-link" href="#featured">Browse all categories <ArrowIcon /></a>
        </div>
        <div className="category-grid">
          {categories.map((category) => {
            const presentation = categoryPresentation[category.slug] ?? {
              icon: "🛍️",
              tone: "lavender",
            };

            return (
              <a className="category-card" href="#featured" key={category.id}>
                <span className={`category-icon ${presentation.tone}`}>
                  {presentation.icon}
                </span>
                <span>{category.name}</span>
                <span className="category-arrow">↗</span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="featured-section" id="featured">
        <div className="section-wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE GOOD STUFF</p>
              <h2>Finds worth finding.</h2>
              <p className="section-subtitle">
                Fresh finds listed by independent WhatsApp sellers.
              </p>
            </div>
            <a className="text-link" href="#sellers">Explore all finds <ArrowIcon /></a>
          </div>
          {products.length > 0 ? (
            <div className="product-grid">
              {products.map((product, index) => {
                const store = Array.isArray(product.stores)
                  ? product.stores[0]
                  : product.stores;
                const imageUrl = product.image_urls?.[0];

                return (
                  <article className="product-card" key={product.id}>
                    <div
                      className={`product-art ${productTones[index % productTones.length]}`}
                      style={
                        imageUrl
                          ? {
                              backgroundImage: `url("${imageUrl.replaceAll('"', "%22")}")`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      <span className="product-tag">
                        {product.stock_quantity > 0 ? "In stock" : "Check availability"}
                      </span>
                      {!imageUrl && <span className="product-emoji">🛍️</span>}
                    </div>
                    <div className="product-info">
                      <p className="product-vendor">{store?.name ?? "Independent seller"}</p>
                      <h3>{product.name}</h3>
                      <div className="product-bottom">
                        <strong>
                          {formatPrice(Number(product.price), product.currency)}
                        </strong>
                        <AddToCartButton productId={product.id} storeId={product.store_id} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="marketplace-empty">
              <span aria-hidden="true">✳</span>
              <h3>The shelves are getting ready.</h3>
              <p>
                There aren’t any published products just yet. Check back soon
                as our independent sellers set up their stores.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="seller-banner section-wrap" id="sellers">
        <div className="seller-banner-mark">✳</div>
        <div className="seller-banner-copy">
          <p className="eyebrow">YOUR BUSINESS BELONGS HERE</p>
          <h2>You bring the business.<br />We’ll bring the browsers.</h2>
          <p>Turn your WhatsApp hustle into a storefront people can actually discover.</p>
        </div>
        <a className="button button-light" href="/sign-up?role=seller">
          Get started as a seller <ArrowIcon />
        </a>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">m</span>
          <span>marketday<span className="brand-period">.</span></span>
        </a>
        <p>Made for the people who make things happen.</p>
        <span className="footer-copyright">© 2026 Marketday · A marketplace for independent sellers</span>
      </footer>
    </main>
  );
}
