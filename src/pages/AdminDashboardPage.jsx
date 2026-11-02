import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import './AdminDashboardPage.css';

function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAdminAuth();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert('Logout failed. Please try again.');
      return;
    }

    navigate('/admin', { replace: true });
  };

  return (
    <main className="rs-admin-dashboard">
      <header className="rs-admin-topbar">
        <div>
          <strong>ROYAL SHOP</strong>
          <span>ADMIN PANEL</span>
        </div>

        <button onClick={handleLogout}>Logout</button>
      </header>

      <section className="rs-admin-dashboard-content">
        <p className="rs-admin-eyebrow">STORE MANAGEMENT</p>
        <h1>Welcome to Admin Dashboard</h1>
        <p className="rs-admin-welcome">
          Logged in as: {user?.email}
        </p>

        <div className="rs-admin-module-grid">
          <article
            className="rs-admin-product-link"
            onClick={() => navigate('/admin/products')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                navigate('/admin/products');
              }
            }}
          >
            <span>📦</span>
            <h2>Products</h2>
            <p>Manage products, prices and stock.</p>
            <small>Manage Products →</small>
          </article>

          <article>
            <span>🛒</span>
            <h2>Orders</h2>
            <p>View and manage customer orders.</p>
            <small>Coming next</small>
          </article>

          <article>
            <span>🗂️</span>
            <h2>Categories</h2>
            <p>Organize your product categories.</p>
            <small>Coming next</small>
          </article>

          <article>
            <span>🖥️</span>
            <h2>Website Content</h2>
            <p>Manage banners and website pages.</p>
            <small>Coming next</small>
          </article>
        </div>
      </section>
    </main>
  );
}

export default AdminDashboardPage;

