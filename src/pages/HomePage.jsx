import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useCart } from '../context/CartContext.jsx';

const categories = [
  { icon: "🧴", name: "Baby Skincare", desc: "Gentle everyday care" },
  { icon: "🍼", name: "Feeding", desc: "Feeding essentials" },
  { icon: "🧷", name: "Diapering", desc: "Comfort and cleanliness" },
  { icon: "🛁", name: "Bath & Hygiene", desc: "Bath time essentials" },
  { icon: "🧸", name: "Baby Accessories", desc: "Little everyday needs" },
  { icon: "👕", name: "Baby Clothing", desc: "Soft little outfits" }
];

const tips = [
  { icon: "🧴", title: "Choose gentle products", desc: "Check product ingredients and suitability before choosing baby skincare products." },
  { icon: "🛁", title: "Keep bath time comfortable", desc: "Prepare bathing essentials beforehand and always supervise your baby." },
  { icon: "🧼", title: "Maintain everyday hygiene", desc: "Keep feeding and personal-care items clean according to their instructions." },
  { icon: "📦", title: "Check product information", desc: "Review age guidance, expiry dates and manufacturer instructions before use." }
];

export const styles = `
* { box-sizing: border-box; }
body { margin: 0; background: var(--theme-bg); color: var(--theme-text); font-family: Arial, sans-serif; }
a { text-decoration: none; color: inherit; }
button { font: inherit; cursor: pointer; }
.rs-container { width: min(1160px, calc(100% - 36px)); margin: auto; }
.rs-announcement { background: #174D35; color: white; text-align: center; padding: 10px; font-size: 13px; }
.rs-header { background: var(--theme-surface); border-bottom: 1px solid var(--theme-border); }
.rs-headrow { min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.rs-logo { color: #174D35; font-size: 27px; font-weight: 800; letter-spacing: -.8px; }
.rs-logo span { color: #D6A83E; }
.rs-search { display: flex; max-width: 390px; width: 100%; }
.rs-search input { min-width: 0; flex: 1; border: 1px solid #e4dfd5; border-radius: 24px 0 0 24px; padding: 11px 15px; outline-color: #174D35; }
.rs-search button { background: #174D35; color: white; border: 0; border-radius: 0 24px 24px 0; padding: 0 18px; }
.rs-actions { display: flex; gap: 10px; }
.rs-outline { border: 1px solid #174D35; color: #174D35; background: white; border-radius: 22px; padding: 10px 16px; }
.rs-cart { border: 0; color: white; background: #174D35; border-radius: 22px; padding: 10px 16px; }
.rs-nav { border-top: 1px solid var(--theme-border); display: flex; justify-content: center; gap: 38px; padding: 14px; color: var(--theme-text-muted); font-size: 14px; }
.rs-hero { background: linear-gradient(110deg, #f3ead7, #fff9ee 60%, #e6eddf); padding: 75px 0; }
.rs-hero-inner { display: grid; grid-template-columns: 1.2fr .8fr; align-items: center; gap: 35px; }
.rs-eyebrow { color: #9a7626; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
.rs-hero h1 { font-size: clamp(38px, 5vw, 58px); line-height: 1.12; color: #174D35; margin: 17px 0; }
.rs-hero p { color: #667267; line-height: 1.8; max-width: 490px; }
.rs-primary { display: inline-block; background: #174D35; color: white; padding: 14px 25px; border-radius: 28px; margin-top: 15px; border: 0; }
.rs-secondary { display: inline-block; border: 1px solid #174D35; color: #174D35; padding: 13px 23px; border-radius: 28px; margin: 15px 0 0 10px; }
.rs-hero-art { min-height: 280px; border-radius: 48% 48% 35% 35%; background: radial-gradient(circle at 50% 40%, #fff 0 15%, #e5d4aa 16% 38%, #dce7d6 39% 70%, #cbd9c5 71%); display: grid; place-items: center; font-size: 105px; }
.rs-section { padding: 65px 0; }
.rs-section-title { text-align: center; margin-bottom: 35px; }
.rs-section-title h2 { color: #174D35; font-size: 30px; margin: 0 0 10px; }
.rs-section-title p { color: #7b8179; margin: 0; line-height: 1.6; }
.rs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.rs-category { background: white; border-radius: 15px; padding: 25px; text-align: center; border: 1px solid #eee9df; }
.rs-category-icon { font-size: 42px; }
.rs-category h3 { color: #174D35; margin: 13px 0 6px; font-size: 17px; }
.rs-muted { color: #858a82; font-size: 13px; }
.rs-promo { background: #174D35; color: white; padding: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.rs-promo h2 { font-size: 27px; margin: 0 0 10px; }
.rs-promo p { color: #e1e9df; margin: 0; }
.rs-promo .rs-primary { background: #D6A83E; color: #183b2b; white-space: nowrap; }
.rs-products { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.rs-product { background: white; border: 1px solid #eee9df; border-radius: 15px; overflow: hidden; }
.rs-product-art { height: 180px; display: grid; place-items: center; background: #f3f0e7; font-size: 65px; position: relative; }
.rs-product-art img { width: 100%; height: 100%; object-fit: contain; padding: 12px; }
.rs-tag { position: absolute; top: 12px; left: 12px; background: #e9dfc5; color: #72571d; padding: 6px 10px; border-radius: 15px; font-size: 11px; }
.rs-product-info { padding: 17px; }
.rs-product-info h3 { color: #174D35; font-size: 16px; margin: 0 0 8px; }
.rs-price { color: #174D35; font-weight: 700; }
.rs-old { color: #999; text-decoration: line-through; font-size: 13px; margin-left: 8px; }
.rs-demo { font-size: 11px; color: #888; margin-top: 10px; }
.rs-why { background: #f1f3eb; }
.rs-feature { background: white; padding: 25px; border-radius: 14px; text-align: center; }
.rs-feature-icon { font-size: 34px; }
.rs-feature h3 { color: #174D35; }
.rs-tip { background: white; padding: 23px; border-radius: 14px; border: 1px solid #eee9df; }
.rs-tip h3 { color: #174D35; font-size: 17px; }
.rs-tip p { color: #747b72; line-height: 1.7; font-size: 14px; }
.rs-footer { background: #123d2b; color: white; padding: 48px 0 22px; }
.rs-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 35px; }
.rs-footer h3 { color: #e7c875; }
.rs-footer p, .rs-footer a { color: #d5dfd7; font-size: 14px; line-height: 1.9; }
.rs-footer-links { display: grid; gap: 8px; }
.rs-copy { border-top: 1px solid #42604d; margin-top: 30px; padding-top: 18px; color: #c8d4ca; font-size: 12px; text-align: center; }
@media(max-width: 760px) {
 .rs-headrow { flex-wrap: wrap; padding: 16px 0; }
 .rs-logo { font-size: 24px; }
 .rs-search { order: 3; max-width: 100%; }
 .rs-actions { margin-left: auto; }
 .rs-nav { gap: 18px; flex-wrap: wrap; }
 .rs-hero { padding: 48px 0; }
 .rs-hero-inner { grid-template-columns: 1fr; }
 .rs-hero-art { min-height: 210px; font-size: 75px; }
 .rs-grid, .rs-products { grid-template-columns: repeat(2, 1fr); }
 .rs-promo { align-items: flex-start; flex-direction: column; }
 .rs-footer-grid { grid-template-columns: 1fr 1fr; }
}
@media(max-width: 480px) {
 .rs-container { width: calc(100% - 28px); }
 .rs-actions button { padding: 9px 11px; font-size: 12px; }
 .rs-nav { gap: 13px; font-size: 12px; }
 .rs-grid, .rs-products { grid-template-columns: 1fr 1fr; gap: 11px; }
 .rs-category { padding: 17px 8px; }
 .rs-category-icon { font-size: 32px; }
 .rs-category h3 { font-size: 14px; }
 .rs-product-art { height: 135px; font-size: 48px; }
 .rs-product-info { padding: 12px; }
 .rs-product-info h3 { font-size: 14px; }
 .rs-section { padding: 45px 0; }
 .rs-section-title h2 { font-size: 25px; }
 .rs-hero h1 { font-size: 39px; }
 .rs-footer-grid { grid-template-columns: 1fr; gap: 15px; }
}

.rs-home-product-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 13px;
}

.rs-home-product-actions button {
  min-width: 0;
  min-height: 40px;
  padding: 8px 5px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.rs-home-add-button {
  background: #174D35;
  color: #fff;
  border: 1px solid #174D35;
}

.rs-home-add-button:hover {
  background: #123d2b;
}

.rs-home-order-button {
  background: #D6A83E;
  color: #183b2b;
  border: 1px solid #D6A83E;
}

.rs-home-order-button:hover {
  background: #c3972f;
}

@media (max-width: 360px) {
  .rs-home-product-actions {
    grid-template-columns: 1fr;
  }
}

.rs-theme-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rs-theme-label {
  font-size: 12px;
  color: var(--theme-text-muted);
}

.rs-theme-select {
  max-width: 110px;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  background: var(--theme-surface);
  color: var(--theme-text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.rs-theme-select:focus-visible {
  outline: 2px solid var(--theme-primary);
  outline-offset: 2px;
}
`;
function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadFeaturedProducts() {
      setFeaturedLoading(true);
      setFeaturedError("");

      const { data, error } = await supabase
        .from("products")
        .select("id,name,slug,category,description,price,compare_at_price,stock,image_url,tag,is_active,is_featured,sort_order")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        setFeaturedError("Featured products could not be loaded.");
        setFeaturedProducts([]);
      } else {
        setFeaturedProducts((data || []).map((item) => ({
          ...item,
          price: Number(item.price),
          compare_at_price: item.compare_at_price == null ? null : Number(item.compare_at_price),
          stock: Number(item.stock),
          sort_order: Number(item.sort_order || 0),
        })));
      }

      setFeaturedLoading(false);
    }

    loadFeaturedProducts();

    return () => {
      isMounted = false;
    };
  }, []);
  useEffect(() => {
    if (location.pathname !== '/' || location.hash !== '#tips') return;

    document.getElementById('tips')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [location.pathname, location.hash]);

  const handleOrderNow = (product) => {
    navigate('/checkout', {
      state: {
        directProduct: product
      }
    });
  };

  return (
    <>

      <main>
        <section className="rs-hero" id="home">
          <div className="rs-container rs-hero-inner">
            <div>
              <div className="rs-eyebrow">Thoughtful care for little ones</div>
              <h1>Little Care,<br />Big Love.</h1>
              <p>Discover everyday baby-care essentials selected with care for your little one's daily needs.</p>
              <a className="rs-primary" href="#products">Shop Products</a>
              <a className="rs-secondary" href="#categories">Explore Categories</a>
            </div>
            <div className="rs-hero-art" aria-label="Baby care illustration">🧸</div>
          </div>
        </section>

        <section className="rs-section" id="categories">
          <div className="rs-container">
            <div className="rs-section-title">
              <h2>Shop by Category</h2>
              <p>Explore our baby-care collection</p>
            </div>
            <div className="rs-grid">
              {categories.map((item) => (
                <article className="rs-category" key={item.name}>
                  <div className="rs-category-icon">{item.icon}</div>
                  <h3>{item.name}</h3>
                  <div className="rs-muted">{item.desc}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rs-container">
          <div className="rs-promo">
            <div>
              <h2>A little something special</h2>
              <p>Explore our selected baby-care essentials.</p>
            </div>
            <a className="rs-primary" href="#products">Explore Products</a>
          </div>
        </section>

        <section className="rs-section" id="products">
          <div className="rs-container">
            <div className="rs-section-title">
              <h2>Featured Products</h2>
              <p>Discover our featured baby-care products.</p>
            </div>
            <div className="rs-products">
  {featuredLoading ? (
    <p className="rs-muted">Loading featured products...</p>
  ) : featuredError ? (
    <p role="alert">{featuredError}</p>
  ) : featuredProducts.length === 0 ? (
    <p className="rs-muted">No featured products available right now.</p>
  ) : (
    featuredProducts.map((product) => (
      <article className="rs-product" key={product.id}>
        <Link
          className="rs-product-art"
          to={`/product/${encodeURIComponent(product.slug)}`}
          aria-label={`View ${product.name}`}
        >
          {product.tag && <span className="rs-tag">{product.tag}</span>}
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <span aria-hidden="true">🧸</span>
          )}
        </Link>

        <div className="rs-product-info">
          <h3>
            <Link to={`/product/${encodeURIComponent(product.slug)}`}>
              {product.name}
            </Link>
          </h3>
          <div className="rs-muted">{product.category}</div>

          <p className="rs-price">
            ৳{product.price.toLocaleString('en-BD')}
            {product.compare_at_price != null && (
              <span className="rs-old">
                ৳{product.compare_at_price.toLocaleString('en-BD')}
              </span>
            )}
          </p>

          <div className="rs-muted">
            {product.stock > 0 ? `In stock: ${product.stock}` : 'Out of stock'}
          </div>

          <div className="rs-home-product-actions">
            <button
              type="button"
              className="rs-home-add-button"
              disabled={product.stock <= 0}
              onClick={() => addToCart(product)}
            >
              Add to Cart
            </button>
            <button
              type="button"
              className="rs-home-order-button"
              disabled={product.stock <= 0}
              onClick={() => handleOrderNow(product)}
            >
              Order Now
            </button>
          </div>
        </div>
      </article>
    ))
  )}
</div>
          </div>
        </section>

        <section className="rs-section rs-why">
          <div className="rs-container">
            <div className="rs-section-title">
              <h2>Why Royal Shop?</h2>
              <p>Our goals for a thoughtful shopping experience</p>
            </div>
            <div className="rs-grid">
              <article className="rs-feature">
                <div className="rs-feature-icon">🌿</div>
                <h3>Careful Selection</h3>
                <p className="rs-muted">We aim to make product information easy to understand.</p>
              </article>
              <article className="rs-feature">
                <div className="rs-feature-icon">📦</div>
                <h3>Convenient Shopping</h3>
                <p className="rs-muted">A simple and organized way to explore baby-care essentials.</p>
              </article>
              <article className="rs-feature">
                <div className="rs-feature-icon">💬</div>
                <h3>Helpful Support</h3>
                <p className="rs-muted">We aim to make it easier to find information about products.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="rs-section" id="tips">
          <div className="rs-container">
            <div className="rs-section-title">
              <h2>Baby Care Tips</h2>
              <p>Small reminders for everyday baby care</p>
            </div>
            <div className="rs-grid">
              {tips.map((tip) => (
                <article className="rs-tip" key={tip.title}>
                  <div className="rs-feature-icon">{tip.icon}</div>
                  <h3>{tip.title}</h3>
                  <p>{tip.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      
    </>
  );
}

export default HomePage;






















