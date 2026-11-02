import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export const Header = () => {
  const { cartCount } = useCart();

  return (
    <header className="rs-header">
      <div className="rs-container">
        <div className="rs-headrow">
          <Link to="/" className="rs-logo">
            Royal Shop
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
            <Link to="/cart" className="rs-cart">
              Cart
              <span className="rs-cart-count">{cartCount}</span>
            </Link>
          </div>
        </div>

        <nav className="rs-nav" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/shop">Categories</Link>
          <Link to="/shop">Products</Link>
          <Link to="/contact">About</Link>
          <Link to="/#tips">Baby Care Tips</Link>
        </nav>
      </div>
    </header>
  );
};
