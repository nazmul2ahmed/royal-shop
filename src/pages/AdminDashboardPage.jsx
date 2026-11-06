import { businessConfig } from '../config/business.config.js';
import React from 'react';

import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase.js';

import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import './AdminDashboardPage.css';

function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAdminAuth();

  const [orderEnabled, setOrderEnabled] = React.useState(null);
  const [orderLoading, setOrderLoading] = React.useState(true);
  const [orderSaving, setOrderSaving] = React.useState(false);
  const [orderError, setOrderError] = React.useState('');

  React.useEffect(() => {
    let active = true;

    async function loadOrderSetting() {
      const { data, error } = await supabase
        .from('store_settings')
        .select('public_order_enabled')
        .eq('id', 1)
        .single();

      if (!active) return;

      if (error || !data) {
        setOrderError('Could not load online order settings.');
      } else {
        setOrderEnabled(data.public_order_enabled === true);
      }

      setOrderLoading(false);
    }

    loadOrderSetting();

    return () => {
      active = false;
    };
  }, []);

  const handleOrderToggle = async () => {
    if (orderEnabled === null || orderSaving) return;

    const nextValue = !orderEnabled;

    setOrderSaving(true);
    setOrderError('');

    const { data, error } = await supabase
      .from('store_settings')
      .update({
        public_order_enabled: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select('public_order_enabled')
      .single();

    if (error || !data) {
      setOrderError('Could not update online order settings.');
    } else {
      setOrderEnabled(data.public_order_enabled === true);
    }

    setOrderSaving(false);
  };

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
          <strong>{businessConfig.shortName}</strong>
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

        <section className="rs-order-control-card">
          <div className="rs-order-control-info">
            <span>🛒</span>
            <div>
              <h2>Public Order Control</h2>
              <p>
                Control whether customers can place orders
                through the website.
              </p>
            </div>
          </div>

          <div className="rs-order-control-status" aria-live="polite">
            {orderLoading ? (
              <span>Loading order settings...</span>
            ) : orderEnabled === null ? (
              <span>Order status unavailable</span>
            ) : (
              <span>
                Online Orders: <strong>
                  {orderEnabled ? 'ENABLED' : 'DISABLED'}
                </strong>
              </span>
            )}
          </div>

          {orderError && (
            <p className="rs-order-control-error" role="alert">
              {orderError}
            </p>
          )}

          <button
            type="button"
            className="rs-order-control-button"
            onClick={handleOrderToggle}
            disabled={
              orderLoading ||
              orderSaving ||
              orderEnabled === null
            }
          >
            {orderSaving
              ? 'Saving...'
              : orderEnabled
                ? 'Disable Online Orders'
                : 'Enable Online Orders'}
          </button>
        </section>
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

          <article
            className="rs-admin-product-link"
            onClick={() => navigate('/admin/orders')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/admin/orders');
              }
            }}
          >
            <span>🛒</span>
            <h2>Orders</h2>
            <p>View and manage customer orders.</p>
            <small>Manage Orders →</small>
          </article>

          <article
            className="rs-admin-product-link"
            onClick={() => navigate('/admin/categories')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                navigate('/admin/categories');
              }
            }}
          >
            <span>🗂️</span>
            <h2>Categories</h2>
            <p>Organize your product categories.</p>
            <small>Manage Categories →</small>
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




