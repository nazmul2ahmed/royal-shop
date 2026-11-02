
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import './CartPage.css';

const productIcons = {
  'baby-lotion': '🧴',
  'baby-shampoo': '🧼',
  'baby-diapers': '🧷',
  bottle: '🍼',
  'gift-set': '🎁',
  'baby-towel': '🧺',
};

function CartPage() {
  const {
    cartItems,
    cartCount,
    selectedProductIds,
    selectedCartItems,
    selectedCartCount,
    selectedSubtotal,
    removeFromCart,
    updateQuantity,
    toggleProductSelection,
    selectAllProducts,
    deselectAllProducts,
    clearCart,
  } = useCart();

  const allSelected =
    cartItems.length > 0 &&
    selectedProductIds.length === cartItems.length;

  return (
    <main className="rs-cart-page">
      <div className="rs-cart-container">
        <div className="rs-cart-title">
          <p className="rs-cart-eyebrow">ROYAL SHOP</p>
          <h1>Shopping Cart</h1>
          <p>Review your selected baby-care essentials.</p>
        </div>

        {cartItems.length === 0 ? (
          <section className="rs-cart-empty">
            <div className="rs-cart-empty-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>You haven't added any products to your cart yet.</p>
            <Link to="/shop" className="rs-cart-shop-link">
              Explore Products
            </Link>
          </section>
        ) : (
          <div className="rs-cart-layout">
            <section className="rs-cart-items">
              <div className="rs-cart-items-heading">
                <h2>Your Items ({cartCount})</h2>
                <button type="button" onClick={clearCart}>
                  Clear Cart
                </button>
              </div>

              <div className="rs-cart-selection-bar">
                <label>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      event.target.checked
                        ? selectAllProducts()
                        : deselectAllProducts()
                    }
                  />
                  <span>Select All</span>
                </label>

                <span>
                  {selectedProductIds.length} of {cartItems.length} products
                  selected
                </span>
              </div>

              {cartItems.map((item) => {
                const isSelected = selectedProductIds.includes(item.id);

                return (
                  <article
                    className={`rs-cart-item ${!isSelected ? 'rs-cart-item-unselected' : ''}`}
                    key={item.id}
                  >
                    <label className="rs-cart-item-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProductSelection(item.id)}
                        aria-label={`Select ${item.name}`}
                      />
                    </label>

                    <div className="rs-cart-product-icon">
                      {productIcons[item.id] || '🧸'}
                    </div>

                    <div className="rs-cart-product-info">
                      <h3>{item.name}</h3>
                      <p>{item.category}</p>
                      <strong>৳{item.price}</strong>
                    </div>

                    <div className="rs-cart-item-actions">
                      <div className="rs-cart-quantity">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          −
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          +
                        </button>
                      </div>

                      <strong>
                        ৳{item.price * item.quantity}
                      </strong>

                      <button
                        type="button"
                        className="rs-cart-remove"
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}

              <Link to="/shop" className="rs-cart-continue">
                ← Continue Shopping
              </Link>
            </section>

            <aside className="rs-cart-summary">
              <h2>Order Summary</h2>

              <div className="rs-cart-summary-row">
                <span>Total Products</span>
                <span>{selectedCartItems.length}</span>
              </div>

              <div className="rs-cart-summary-row">
                <span>Total Items</span>
                <span>{selectedCartCount}</span>
              </div>

              <div className="rs-cart-summary-row">
                <span>Subtotal</span>
                <span>
                  ৳{selectedSubtotal.toLocaleString('en-BD')}
                </span>
              </div>

              <div className="rs-cart-summary-row">
                <span>Delivery</span>
                <span>Calculated later</span>
              </div>

              <div className="rs-cart-summary-total">
                <span>Estimated Total</span>
                <strong>
                  ৳{selectedSubtotal.toLocaleString('en-BD')}
                </strong>
              </div>

              {selectedCartItems.length > 0 ? (
                <Link
                  to="/checkout"
                  className="rs-cart-checkout-link"
                >
                  Checkout Selected Products
                </Link>
              ) : (
                <button
                  type="button"
                  className="rs-cart-checkout-disabled"
                  disabled
                >
                  Select Products to Checkout
                </button>
              )}

              <p>
                Only selected products will be included in your order.
                Delivery charges will be confirmed before dispatch.
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default CartPage;
