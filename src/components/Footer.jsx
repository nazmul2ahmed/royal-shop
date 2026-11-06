import { Link } from 'react-router-dom';
import { businessConfig } from '../config/business.config.js';

export const Footer = () => {
  return (
    <footer className="rs-footer">
      <div className="rs-container">
        <div className="rs-footer-grid">
          <div>
            <Link to="/" className="rs-logo">
              {businessConfig.name}
            </Link>
            <p>
              {businessConfig.tagline}. Premium baby care essentials for your family.
            </p>
          </div>

          <div>
            <h4>Contact</h4>
            <p>Contact details will be added before launch.</p>
          </div>

          <div>
            <h4>Quick Links</h4>
            <ul className="rs-footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/shop">Shop</Link></li>
              <li><Link to="/contact">About</Link></li>
              <li><Link to="/cart">Cart</Link></li>
            </ul>
          </div>

          <div>
            <h4>Follow Us</h4>
            <p>Social media links coming before launch.</p>
          </div>
        </div>

        <div className="rs-copy">
          <p>© {new Date().getFullYear()} {businessConfig.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

