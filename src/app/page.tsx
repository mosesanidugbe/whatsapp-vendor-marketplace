const categories = [
  { name: "Phones & gadgets", icon: "📱", tone: "lavender" },
  { name: "Fashion", icon: "👟", tone: "peach" },
  { name: "Beauty", icon: "🧴", tone: "rose" },
  { name: "Home & living", icon: "🪴", tone: "mint" },
  { name: "Food & treats", icon: "🍪", tone: "butter" },
  { name: "Art & crafts", icon: "🎨", tone: "sky" },
];

const products = [
  {
    name: "Everyday wireless headphones",
    vendor: "SoundHaus Lagos",
    price: "₦22,500",
    tag: "Bestseller",
    icon: "🎧",
    tone: "product-lilac",
  },
  {
    name: "Minimal leather tote",
    vendor: "The Sunday Edit",
    price: "₦18,000",
    tag: "Handpicked",
    icon: "👜",
    tone: "product-sand",
  },
  {
    name: "Glow essentials set",
    vendor: "Dewdrop Beauty",
    price: "₦12,000",
    tag: "Popular",
    icon: "✨",
    tone: "product-pink",
  },
  {
    name: "Ceramic desk planter",
    vendor: "Little Things Studio",
    price: "₦8,500",
    tag: "Made local",
    icon: "🪴",
    tone: "product-green",
  },
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

export default function Home() {
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
          <a className="sign-in" href="#sellers">Sign in</a>
          <a className="button button-dark button-small" href="#sellers">Open your store <ArrowIcon /></a>
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
          {categories.map((category) => (
            <a className="category-card" href="#featured" key={category.name}>
              <span className={`category-icon ${category.tone}`}>{category.icon}</span>
              <span>{category.name}</span>
              <span className="category-arrow">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="featured-section" id="featured">
        <div className="section-wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE GOOD STUFF</p>
              <h2>Finds worth finding.</h2>
              <p className="section-subtitle">A few lovely things from shops you’ll want to know.</p>
            </div>
            <a className="text-link" href="#sellers">Explore all finds <ArrowIcon /></a>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.name}>
                <div className={`product-art ${product.tone}`}>
                  <span className="product-tag">{product.tag}</span>
                  <span className="product-emoji">{product.icon}</span>
                  <button className="save-product" type="button" aria-label={`Save ${product.name}`}>♡</button>
                </div>
                <div className="product-info">
                  <p className="product-vendor">{product.vendor}</p>
                  <h3>{product.name}</h3>
                  <div className="product-bottom">
                    <strong>{product.price}</strong>
                    <span className="seller-dot" aria-label="Independent seller">✳</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="seller-banner section-wrap" id="sellers">
        <div className="seller-banner-mark">✳</div>
        <div className="seller-banner-copy">
          <p className="eyebrow">YOUR BUSINESS BELONGS HERE</p>
          <h2>You bring the business.<br />We’ll bring the browsers.</h2>
          <p>Turn your WhatsApp hustle into a storefront people can actually discover.</p>
        </div>
        <a className="button button-light" href="https://wa.me/" target="_blank" rel="noreferrer">
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
