
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'royal-shop-cart';

function getSavedCart() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function getSavedSelection(items) {
  return items.map((item) => item.id);
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(getSavedCart);

  // Initially select all products in the cart.
  const [selectedProductIds, setSelectedProductIds] = useState(
    () => getSavedSelection(getSavedCart())
  );

  // Keep cart data synchronized with localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cartItems)
      );
    } catch (error) {
      console.error('Cart storage error:', error);
    }
  }, [cartItems]);

  // Remove selected IDs that no longer exist in the cart.
  useEffect(() => {
    const availableIds = new Set(cartItems.map((item) => item.id));

    setSelectedProductIds((current) =>
      current.filter((id) => availableIds.has(id))
    );
  }, [cartItems]);

  const addToCart = (product) => {
    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });

    setSelectedProductIds((current) =>
      current.includes(product.id)
        ? current
        : [...current, product.id]
    );
  };

  const removeFromCart = (productId) => {
    setCartItems((current) =>
      current.filter((item) => item.id !== productId)
    );

    setSelectedProductIds((current) =>
      current.filter((id) => id !== productId)
    );
  };

  const removeItemsFromCart = (productIds) => {
    const idsToRemove = new Set(productIds);

    setCartItems((current) => {
      const updatedItems = current.filter(
        (item) => !idsToRemove.has(item.id)
      );

      try {
        localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify(updatedItems)
        );
      } catch (error) {
        console.error('Cart storage error:', error);
      }

      return updatedItems;
    });

    setSelectedProductIds((current) =>
      current.filter((id) => !idsToRemove.has(id))
    );
  };

  const updateQuantity = (productId, quantity) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;

    setCartItems((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const toggleProductSelection = (productId) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const selectAllProducts = () => {
    setSelectedProductIds(cartItems.map((item) => item.id));
  };

  const deselectAllProducts = () => {
    setSelectedProductIds([]);
  };

  const clearCart = () => {
    setCartItems([]);
    setSelectedProductIds([]);

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([]));
    } catch (error) {
      console.error('Cart storage error:', error);
    }
  };

  const selectedCartItems = cartItems.filter((item) =>
    selectedProductIds.includes(item.id)
  );

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const selectedCartCount = selectedCartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const selectedSubtotal = selectedCartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      subtotal,
      selectedProductIds,
      selectedCartItems,
      selectedCartCount,
      selectedSubtotal,
      addToCart,
      removeFromCart,
      removeItemsFromCart,
      updateQuantity,
      toggleProductSelection,
      selectAllProducts,
      deselectAllProducts,
      clearCart,
    }),
    [
      cartItems,
      cartCount,
      subtotal,
      selectedProductIds,
      selectedCartItems,
      selectedCartCount,
      selectedSubtotal,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }

  return context;
}
