import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import AdminProtectedRoute from './components/AdminProtectedRoute.jsx';

import HomePage, { styles } from './pages/HomePage.jsx';
import ShopPage from './pages/ShopPage.jsx';
import ProductDetailsPage from './pages/ProductDetailsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import ProductManagementPage from './pages/ProductManagementPage.jsx';
import CategoryManagementPage from './pages/CategoryManagementPage.jsx';
import OrderManagementPage from './pages/OrderManagementPage.jsx';

function App() {
  return (
    <Routes>
      <Route
        path="/admin"
        element={<AdminLoginPage />}
      />

      <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <AdminProtectedRoute>
            <AdminDashboardPage />
          </AdminProtectedRoute>
        }
      />

      <Route
        path="/admin/products"
        element={
          <AdminProtectedRoute>
            <ProductManagementPage />
          </AdminProtectedRoute>
        }
      />

      <Route
        path="/admin/categories"
        element={
          <AdminProtectedRoute>
            <CategoryManagementPage />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <AdminProtectedRoute>
            <OrderManagementPage />
          </AdminProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <>
            <style>{styles}</style>

            <div className="rs-announcement">
              Welcome to Royal Shop — Little Care, Big Love
            </div>

            <Header />

            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/product/:slug" element={<ProductDetailsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
            </Routes>

            <Footer />
          </>
        }
      />
    </Routes>
  );
}

export default App;







