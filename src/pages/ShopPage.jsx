import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useCart } from '../context/CartContext.jsx';
import './ShopPage.css';

function ShopPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [sort, setSort] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const selectedCategory = searchParams.get('category') || 'all';
    setCategoryId(selectedCategory);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadShopData() {
      setLoading(true);
      setError('');

      const [categoryResult, productResult] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, icon, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),

        supabase
          .from('products')
          .select(`
            id,
            name,
            slug,
            category,
            category_id,
            description,
            price,
            compare_at_price,
            stock,
            image_url,
            tag,
            is_active,
            sort_order
          `)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (cancelled) return;

      if (categoryResult.error || productResult.error) {
        console.error(
          'Shop data loading error:',
          categoryResult.error || productResult.error
        );

        setError('Products load করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
        setProducts([]);
        setCategories([]);
        setLoading(false);
        return;
      }

      const activeCategories = categoryResult.data || [];

      const categoryMap = new Map(
        activeCategories.map((item) => [item.id, item])
      );

      const mappedProducts = (productResult.data || []).map((item) => {
        const matchedCategory = categoryMap.get(item.category_id);

        return {
          id: item.id,
          name: item.name,
          slug: item.slug,
          category: matchedCategory?.name || item.category || 'Uncategorized',
          category_id: item.category_id,
          categoryIcon: matchedCategory?.icon || '🧸',
          description: item.description || '',
          price: Number(item.price),
          oldPrice:
            item.compare_at_price == null
              ? null
              : Number(item.compare_at_price),
          stock: Number(item.stock),
          image_url: item.image_url,
          tag: item.tag,
          sort_order: Number(item.sort_order || 0),
        };
      });

      setCategories(activeCategories);
      setProducts(mappedProducts);
      setLoading(false);
    }

    loadShopData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        product.name.toLowerCase().includes(searchText) ||
        product.category.toLowerCase().includes(searchText) ||
        product.description.toLowerCase().includes(searchText);

      const matchesCategory =
        categoryId === 'all' || product.category_id === categoryId;

      return matchesSearch && matchesCategory;
    });

    if (sort === 'price-low') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sort === 'name') {
      result = [...result].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }

    return result;
  }, [products, search, categoryId, sort]);

  const handleCategoryChange = (value) => {
    setCategoryId(value);

    const nextParams = new URLSearchParams(searchParams);

    if (value === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', value);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleOrderNow = (product) => {
    if (product.stock < 1) return;

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
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>

            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
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

        {loading ? (
          <div className="rs-shop-empty">
            <p>Loading products...</p>
          </div>
        ) : error ? (
          <div className="rs-shop-empty">
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="rs-shop-grid">
            {filteredProducts.map((product) => (
              <article className="rs-shop-card" key={product.id}>
                <Link to={`/product/${encodeURIComponent(product.slug)}`} className="rs-shop-art rs-shop-art-link" aria-label={`View details for ${product.name}`}>
                  {product.tag && (
                    <span className="rs-shop-tag">{product.tag}</span>
                  )}

                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <span aria-hidden="true" style={{ fontSize: '64px' }}>
                      {product.categoryIcon}
                    </span>
                  )}
                </Link>

                <div className="rs-shop-card-info">
                  <p className="rs-shop-category">{product.category}</p>
                  <h3><Link to={`/product/${encodeURIComponent(product.slug)}`}>{product.name}</Link></h3>

                  {product.description && (
                    <p>{product.description}</p>
                  )}

                  <div className="rs-shop-prices">
                    <strong>৳{product.price.toLocaleString('en-BD')}</strong>

                    {product.oldPrice > product.price && (
                      <del>
                        ৳{product.oldPrice.toLocaleString('en-BD')}
                      </del>
                    )}
                  </div>

                  <p className="rs-shop-stock">
                    {product.stock > 0
                      ? `In Stock: ${product.stock}`
                      : 'Out of Stock'}
                  </p>

                  <div className="rs-product-actions">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="rs-shop-add-button"
                      disabled={product.stock < 1}
                    >
                      Add to Cart
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOrderNow(product)}
                      className="rs-shop-order-button"
                      disabled={product.stock < 1}
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
            <h3>
              {products.length === 0
                ? 'No Products Available'
                : 'No products found'}
            </h3>
            <p>
              {products.length === 0
                ? 'New products will appear here when they are added to our collection.'
                : 'Try another search term or choose a different category.'}
            </p>

            {(search || categoryId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  handleCategoryChange('all');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default ShopPage;

