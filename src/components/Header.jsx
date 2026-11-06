import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { businessConfig } from '../config/business.config.js';
import { useTheme } from '../context/ThemeContext.jsx';

export const Header = () => {
  const { cartCount } = useCart();
  const { theme, setTheme } = useTheme();

  return (
    <header className="rs-header">
      <div className="rs-container">
        <div className="rs-headrow">
          <Link to="/" className="rs-logo">
            {businessConfig.name}
          </Link>

          <div className="rs-search">
            <input
              type="search"
              placeholder="Search baby care products..."
              aria-label="Search baby care products"
            />
            <button type="button" className="rs-primary">
              Search
            </button>
          </div>

          <div className="rs-actions">
            <label className="rs-theme-control">
              <span className="rs-theme-label">Theme</span>
              <select
                className="rs-theme-select"
                aria-label="Choose color theme"
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>

            <Link to="/cart" className="rs-cart">
              Cart
              <span className="rs-cart-count">{cartCount}</span>
            </Link>
          </div>
        </div>

        <nav className="rs-nav" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/shop">Products</Link>
          <Link to="/contact">About</Link>
          <Link to="/#tips">Baby Care Tips</Link>
        </nav>
      </div>
    </header>
  );
};



