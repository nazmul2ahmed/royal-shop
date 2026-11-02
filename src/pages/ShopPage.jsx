import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { products } from '../data/products';
import { useCart } from '../context/CartContext.jsx';
import './ShopPage.css';

const productIcons = {
  'baby-lotion': '🧴',
  'baby-shampoo': '🧼',
  'baby-diapers': '🧷',
  bottle: '🍼',
  'gift-set': '🎁',
  'baby-towel': '🧺',
};

function ShopPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [sort, setSort] = useState('default');

  const { addToCart } = useCart();
  const navigate = useNavigate();

  const categories = [
    'All Categories',
    ...new Set(products.map((product) => product.category)),
  ];

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === 'All Categories' || product.category === category;

      return matchesSearch && matchesCategory;
    });

    if (sort === 'price-low') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sort === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [search, category, sort]);

  const handleOrderNow = (product) => {
    navigate('/checkout', {
      state: { directProduct: product },
    });
  };

  return (
    <main className="rs-shop-page">
      <section className="rs-shop-banner">
        <div className="rs-shop-container">
          <p className="rs-shop-eyebrow">ROYAL SHOP COLLECTION</p>
          <h1>Baby Care Products</h1>
          <p>
            Explore thoughtful essentials for your little one's everyday care.
          </p>
        </div>
      </section>

      <section className="rs-shop-container rs-shop-content">
        <div className="rs-shop-heading">
          <div>
            <h2>Explore Our Collection</h2>
            <p>Find the essentials you are looking for.</p>
          </div>
          <span className="rs-shop-count">
            {filteredProducts.length} Products
          </span>
        </div>

        <div className="rs-shop-toolbar">
          <div className="rs-shop-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search baby care products..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search products"
            />
          </div>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort products"
          >
            <option value="default">Sort: Default</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="rs-shop-grid">
            {filteredProducts.map((product) => (
              <article className="rs-shop-card" key={product.id}>
                <div className="rs-shop-art">
                  {product.tag && (
                    <span className="rs-shop-tag">{product.tag}</span>
                  )}
                  <span aria-hidden="true">
                    {productIcons[product.id] || '🧸'}
                  </span>
                </div>

                <div className="rs-shop-card-info">
                  <p className="rs-shop-category">{product.category}</p>
                  <h3>{product.name}</h3>

                  <div className="rs-shop-prices">
                    <strong>৳{product.price}</strong>
                    {product.oldPrice && (
                      <del>৳{product.oldPrice}</del>
                    )}
                  </div>

                  <p className="rs-shop-demo">
                    Demo product — sample price
                  </p>

                  <div className="rs-product-actions">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="rs-shop-add-button"
                    >
                      Add to Cart
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOrderNow(product)}
                      className="rs-shop-order-button"
                    >
                      Order Now
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rs-shop-empty">
            <span>🔎</span>
            <h3>No products found</h3>
            <p>Try another search term or choose a different category.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('All Categories');
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default ShopPage;