import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import './ProductManagementPage.css';

const initialForm = {
  name: '',
  slug: '',
  sku: '',
  category: '',
  description: '',
  price: '',
  compare_at_price: '',
  stock: '0',
  image_url: '',
  tag: '',
  is_active: true,
  sort_order: '0',
};

function makeSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ProductManagementPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadProducts() {
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(getFriendlyError(fetchError));
        setLoading(false);
        return false;
      }

      setProducts(data || []);
      setLoading(false);
      return true;
    } catch {
      setError('Network সমস্যা হয়েছে। Product List লোড করা যায়নি।');
      setLoading(false);
      return false;
    }
  }
  useEffect(() => {
    loadProducts();
  }, []);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'name' && !editingId
        ? { slug: makeSlug(value) }
        : {}),
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError('');
    setMessage('');
  }

  function handleEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      slug: product.slug || '',
      sku: product.sku || '',
      category: product.category || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      compare_at_price: product.compare_at_price == null
        ? ''
        : String(product.compare_at_price),
      stock: String(product.stock ?? 0),
      image_url: product.image_url || '',
      tag: product.tag || '',
      is_active: product.is_active,
      sort_order: String(product.sort_order ?? 0),
    });

    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getFriendlyError(error) {
    const code = error?.code || '';
    const message = error?.message || '';

    if (code === '23505' && message.includes('products_slug_key')) {
      return 'এই Slug ইতিমধ্যে ব্যবহার করা হয়েছে। অন্য Slug দিন।';
    }

    if (code === '23505' && message.includes('products_sku_key')) {
      return 'এই SKU ইতিমধ্যে ব্যবহার করা হয়েছে। অন্য SKU দিন।';
    }

    if (code === '23505') {
      return 'এই তথ্যটি আগে থেকেই আছে। Slug ও SKU পরীক্ষা করুন।';
    }

    if (code === '23514') {
      return 'দেওয়া তথ্যের কোনো একটি Database-এর নিয়মের সঙ্গে মিলছে না।';
    }

    if (code === '42501') {
      return 'আপনার এই কাজটি করার অনুমতি নেই। Admin Login পরীক্ষা করুন।';
    }

    return message || 'কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (saving) return;

    const priceText = form.price.trim();
    const stockText = form.stock.trim();
    const compareText = form.compare_at_price.trim();
    const sortText = form.sort_order.trim();

    if (!form.name.trim() || !form.category.trim()) {
      setError('Product Name এবং Category অবশ্যই দিতে হবে।');
      return;
    }

    const slug = makeSlug(form.slug);

    if (!slug || slug.length > 180) {
      setError('সঠিক Slug দিন। শুধু English letter, number ও hyphen ব্যবহার করুন।');
      return;
    }

    const price = Number(priceText);
    const stock = Number(stockText);
    const compareAtPrice = compareText === '' ? null : Number(compareText);
    const sortOrder = sortText === '' ? 0 : Number(sortText);

    if (
      priceText === '' ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 999999999999
    ) {
      setError('সঠিক Product Price দিন।');
      return;
    }

    if (
      stockText === '' ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setError('Stock অবশ্যই ০ বা তার বেশি পূর্ণসংখ্যা হতে হবে।');
      return;
    }

    if (
      compareAtPrice !== null &&
      (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)
    ) {
      setError('সঠিক Compare-at Price দিন।');
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError('Sort Order অবশ্যই ০ বা তার বেশি পূর্ণসংখ্যা হতে হবে।');
      return;
    }

    if (form.image_url.trim()) {
      try {
        const imageUrl = new URL(form.image_url.trim());
        if (!['http:', 'https:'].includes(imageUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        setError('Image URL সঠিক নয়। পূর্ণ http বা https URL দিন।');
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      slug,
      sku: form.sku.trim() || null,
      category: form.category.trim(),
      description: form.description.trim() || null,
      price,
      compare_at_price: compareAtPrice,
      stock,
      image_url: form.image_url.trim() || null,
      tag: form.tag.trim() || null,
      is_active: form.is_active,
      sort_order: sortOrder,
    };

    setSaving(true);

    try {
      const result = editingId
        ? await supabase.from('products').update(payload).eq('id', editingId)
        : await supabase.from('products').insert(payload);

      if (result.error) {
        setError(getFriendlyError(result.error));
        return;
      }

      const successMessage = editingId
        ? 'Product updated successfully.'
        : 'Product added successfully.';

      setForm(initialForm);
      setEditingId(null);
      await loadProducts();
      setMessage(successMessage);
    } catch {
      setError('Network সমস্যা হয়েছে। Internet সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product) {
    setError('');
    setMessage('');

    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (updateError) {
        setError(getFriendlyError(updateError));
        return;
      }

      await loadProducts();
      setMessage(
        product.is_active
          ? 'Product inactive করা হয়েছে। এটি আর Public Shop-এ দেখাবে না।'
          : 'Product আবার active করা হয়েছে।'
      );
    } catch {
      setError('Network সমস্যা হয়েছে। Product status পরিবর্তন করা যায়নি।');
    }
  }

  async function deleteProduct(product) {
    setError('');
    setMessage('');

    const confirmed = window.confirm(
      `"${product.name}" স্থায়ীভাবে Delete করা হবে না। এটিকে Inactive করতে চান?`
    );

    if (!confirmed) return;

    await toggleActive(product);
  }
  const filteredProducts = products.filter((product) => {
    const term = search.toLowerCase();

    return (
      product.name.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term) ||
      product.slug.toLowerCase().includes(term)
    );
  });

  return (
    <main className="rs-products-page">
      <header className="rs-products-header">
        <div>
          <Link to="/admin/dashboard" className="rs-products-back">
            ← Admin Dashboard
          </Link>
          <h1>Product Management</h1>
          <p>Manage your Royal Shop products, prices and stock.</p>
        </div>

        <span className="rs-products-count">
          {products.length} Products
        </span>
      </header>

      {error && <div className="rs-products-alert error">{error}</div>}
      {message && <div className="rs-products-alert success">{message}</div>}

      <section className="rs-product-form-card">
        <h2>{editingId ? 'Edit Product' : 'Add New Product'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="rs-product-form-grid">
            <label>
              Product Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                maxLength={150}
                placeholder="Product name"
              />
            </label>

            <label>
              Slug *
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                required
                maxLength={180}
                placeholder="product-name"
              />
            </label>

            <label>
              SKU
              <input
                name="sku"
                value={form.sku}
                onChange={handleChange}
                maxLength={80}
                placeholder="Optional product code"
              />
            </label>

            <label>
              Category *
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                maxLength={100}
                placeholder="Baby Skincare"
              />
            </label>

            <label>
              Selling Price (৳) *
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Compare-at Price (৳)
              <input
                name="compare_at_price"
                type="number"
                min="0"
                step="0.01"
                value={form.compare_at_price}
                onChange={handleChange}
              />
            </label>

            <label>
              Stock Quantity *
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Product Tag
              <input
                name="tag"
                value={form.tag}
                onChange={handleChange}
                maxLength={50}
                placeholder="New, Popular, Featured"
              />
            </label>

            <label className="rs-product-full-width">
              Image URL
              <input
                name="image_url"
                type="url"
                value={form.image_url}
                onChange={handleChange}
                placeholder="https://example.com/product.jpg"
              />
            </label>

            <label className="rs-product-full-width">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                maxLength={2000}
                placeholder="Product description"
              />
            </label>

            <label>
              Sort Order
              <input
                name="sort_order"
                type="number"
                step="1"
                value={form.sort_order}
                onChange={handleChange}
              />
            </label>

            <label className="rs-product-checkbox">
              <input
                name="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={handleChange}
              />
              Active — visible to customers
            </label>
          </div>

          <div className="rs-product-form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Product'
                  : 'Add Product'}
            </button>

            {editingId && (
              <button
                type="button"
                className="secondary"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rs-product-list-card">
        <div className="rs-product-list-heading">
          <h2>All Products</h2>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
          />
        </div>

        {loading ? (
          <p className="rs-product-empty">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="rs-product-empty">
            {search ? 'No matching products found.' : 'No products added yet.'}
          </p>
        ) : (
          <div className="rs-product-table-wrap">
            <table className="rs-product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="rs-product-name-cell">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" />
                        ) : (
                          <span className="rs-product-image-placeholder">🧸</span>
                        )}
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td>৳{Number(product.price).toLocaleString('en-BD')}</td>
                    <td>{product.stock}</td>
                    <td>
                      <span className={product.is_active ? 'active' : 'inactive'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="rs-product-actions">
                        <button type="button" onClick={() => handleEdit(product)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => toggleActive(product)}
                        >
                          {product.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => deleteProduct(product)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default ProductManagementPage;


