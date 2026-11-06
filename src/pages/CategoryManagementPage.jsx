import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import './CategoryManagementPage.css';

const initialForm = {
  name: '',
  slug: '',
  description: '',
  image_url: '',
  icon: '',
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

function getFriendlyError(error) {
  const code = error?.code || '';
  const message = error?.message || '';

  if (code === '23505') {
    return 'এই Slug ইতিমধ্যে ব্যবহার করা হয়েছে। অন্য Slug দিন।';
  }

  if (code === '23514') {
    return 'দেওয়া তথ্য Database-এর নিয়মের সঙ্গে মিলছে না।';
  }

  if (code === '42501') {
    return 'আপনার এই কাজটি করার অনুমতি নেই। Admin Login পরীক্ষা করুন।';
  }

  return message || 'কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।';
}

function CategoryManagementPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadCategories() {
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(getFriendlyError(fetchError));
        setLoading(false);
        return false;
      }

      setCategories(data || []);
      setLoading(false);
      return true;
    } catch {
      setError('Network সমস্যা হয়েছে। Category List লোড করা যায়নি।');
      setLoading(false);
      return false;
    }
  }

  useEffect(() => {
    loadCategories();
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

  function handleEdit(category) {
    setEditingId(category.id);
    setForm({
      name: category.name || '',
      slug: category.slug || '',
      description: category.description || '',
      image_url: category.image_url || '',
      icon: category.icon || '',
      is_active: category.is_active,
      sort_order: String(category.sort_order ?? 0),
    });

    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (saving) return;

    const name = form.name.trim();
    const slug = makeSlug(form.slug);
    const sortOrder = form.sort_order.trim() === ''
      ? 0
      : Number(form.sort_order);

    if (!name) {
      setError('Category Name অবশ্যই দিতে হবে।');
      return;
    }

    if (!slug || slug.length > 180) {
      setError('সঠিক Slug দিন। শুধু English letter, number ও hyphen ব্যবহার করুন।');
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
      name,
      slug,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      icon: form.icon.trim() || null,
      is_active: form.is_active,
      sort_order: sortOrder,
    };

    setSaving(true);

    try {
      const result = editingId
        ? await supabase.from('categories').update(payload).eq('id', editingId)
        : await supabase.from('categories').insert(payload);

      if (result.error) {
        setError(getFriendlyError(result.error));
        return;
      }

      const successMessage = editingId
        ? 'Category updated successfully.'
        : 'Category added successfully.';

      setForm(initialForm);
      setEditingId(null);
      await loadCategories();
      setMessage(successMessage);
    } catch {
      setError('Network সমস্যা হয়েছে। Internet সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(category) {
    setError('');
    setMessage('');

    if (category.is_active) {
      try {
        const { count, error: countError } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', category.id);

        if (countError) {
          setError(getFriendlyError(countError));
          return;
        }

        const productCount = count || 0;
        const warning = productCount > 0
          ? `"${category.name}" Category-তে ${productCount}টি Product যুক্ত আছে। Inactive করলে এই Category আর নতুন Product-এর জন্য পাওয়া যাবে না। চালিয়ে যাবেন?`
          : `"${category.name}" Category Inactive করতে চান?`;

        if (!window.confirm(warning)) return;
      } catch {
        setError('Product সংযোগ পরীক্ষা করা যায়নি। Category পরিবর্তন করা হয়নি।');
        return;
      }
    }

    try {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (updateError) {
        setError(getFriendlyError(updateError));
        return;
      }

      await loadCategories();
      setMessage(
        category.is_active
          ? 'Category Inactive করা হয়েছে।'
          : 'Category আবার Active করা হয়েছে।'
      );
    } catch {
      setError('Network সমস্যা হয়েছে। Category status পরিবর্তন করা যায়নি।');
    }
  }

  const filteredCategories = categories.filter((category) => {
    const term = search.toLowerCase();

    return (
      category.name.toLowerCase().includes(term) ||
      category.slug.toLowerCase().includes(term)
    );
  });

  return (
    <main className="rs-categories-page">
      <header className="rs-categories-header">
        <div>
          <Link to="/admin/dashboard" className="rs-categories-back">
            ← Admin Dashboard
          </Link>
          <h1>Category Management</h1>
          <p>Organize your Royal Shop product categories.</p>
        </div>

        <span className="rs-categories-count">
          {categories.length} Categories
        </span>
      </header>

      {error && <div className="rs-categories-alert error">{error}</div>}
      {message && <div className="rs-categories-alert success">{message}</div>}

      <section className="rs-category-form-card">
        <h2>{editingId ? 'Edit Category' : 'Add New Category'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="rs-category-form-grid">
            <label>
              Category Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                maxLength={100}
                placeholder="Baby Skincare"
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
                placeholder="baby-skincare"
              />
            </label>

            <label>
              Icon / Emoji
              <input
                name="icon"
                value={form.icon}
                onChange={handleChange}
                maxLength={30}
                placeholder="🧴"
              />
            </label>

            <label>
              Sort Order
              <input
                name="sort_order"
                type="number"
                min="0"
                step="1"
                value={form.sort_order}
                onChange={handleChange}
              />
            </label>

            <label className="rs-category-full-width">
              Image URL
              <input
                name="image_url"
                type="url"
                value={form.image_url}
                onChange={handleChange}
                placeholder="https://example.com/category.jpg"
              />
            </label>

            <label className="rs-category-full-width">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                maxLength={1000}
                placeholder="Short category description"
              />
            </label>

            <label className="rs-category-checkbox">
              <input
                name="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={handleChange}
              />
              Active — available for products
            </label>
          </div>

          <div className="rs-category-form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Category'
                  : 'Add Category'}
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

      <section className="rs-category-list-card">
        <div className="rs-category-list-heading">
          <h2>All Categories</h2>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search categories..."
            aria-label="Search categories"
          />
        </div>

        {loading ? (
          <p className="rs-category-empty">Loading categories...</p>
        ) : filteredCategories.length === 0 ? (
          <p className="rs-category-empty">
            {search ? 'No matching categories found.' : 'No categories added yet.'}
          </p>
        ) : (
          <div className="rs-category-table-wrap">
            <table className="rs-category-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Slug</th>
                  <th>Sort Order</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="rs-category-name-cell">
                        {category.image_url ? (
                          <img src={category.image_url} alt="" />
                        ) : (
                          <span className="rs-category-image-placeholder">
                            {category.icon || '🗂️'}
                          </span>
                        )}
                        <div>
                          <strong>{category.name}</strong>
                          <small>{category.description || 'No description'}</small>
                        </div>
                      </div>
                    </td>
                    <td>{category.slug}</td>
                    <td>{category.sort_order}</td>
                    <td>
                      <span className={category.is_active ? 'active' : 'inactive'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="rs-category-actions">
                        <button type="button" onClick={() => handleEdit(category)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => toggleActive(category)}
                        >
                          {category.is_active ? 'Disable' : 'Enable'}
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

export default CategoryManagementPage;
