import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import './CategoriesPage.css';

function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('id, name, slug, description, image_url, icon')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) {
        setError('Category লোড করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।');
      } else {
        setCategories(data || []);
      }

      setLoading(false);
    }

    loadCategories();
  }, []);

  function openCategory(category) {
    navigate(`/shop?category=${encodeURIComponent(category.id)}`);
  }

  return (
    <main className="rs-categories-page">
      <section className="rs-categories-banner">
        <div className="rs-categories-container">
          <p className="rs-categories-eyebrow">ROYAL SHOP COLLECTION</p>
          <h1>Shop by Category</h1>
          <p>Explore thoughtful essentials for your little one's everyday care.</p>
        </div>
      </section>

      <section className="rs-categories-container rs-categories-content">
        <div className="rs-categories-heading">
          <div>
            <h2>All Categories</h2>
            <p>Find the right essentials for your little one.</p>
          </div>
          <span>{categories.length} Categories</span>
        </div>

        {loading ? (
          <p className="rs-categories-message">Loading categories...</p>
        ) : error ? (
          <p className="rs-categories-message error">{error}</p>
        ) : categories.length === 0 ? (
          <p className="rs-categories-message">No categories available right now.</p>
        ) : (
          <div className="rs-categories-grid">
            {categories.map((category) => (
              <button
                type="button"
                className="rs-category-card"
                key={category.id}
                onClick={() => openCategory(category)}
              >
                {category.image_url ? (
                  <img
                    className="rs-category-image"
                    src={category.image_url}
                    alt={category.name}
                    loading="lazy"
                  />
                ) : (
                  <span className="rs-category-icon" aria-hidden="true">
                    {category.icon || '🧸'}
                  </span>
                )}

                <span className="rs-category-card-name">{category.name}</span>

                {category.description && (
                  <span className="rs-category-card-description">
                    {category.description}
                  </span>
                )}

                <span className="rs-category-card-link">Explore Products →</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default CategoriesPage;
