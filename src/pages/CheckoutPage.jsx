
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { products } from '../data/products';
import { supabase } from '../lib/supabase.js';
import './CheckoutPage.css';

const WHATSAPP_NUMBER = '8801346553350';
const STORAGE_KEY = 'royal-shop-checkout-state';

function readCheckoutState() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function CheckoutPage() {
  const {
    selectedCartItems,
    selectedCartCount,
    selectedSubtotal,
    removeItemsFromCart,
  } = useCart();

  const location = useLocation();
  const directProductId =
    location.state?.directProductId || location.state?.directProduct?.id;
  const isDirectCheckout = Boolean(directProductId);
  const directProduct = isDirectCheckout
    ? products.find((product) => product.id === directProductId)
    : null;

  const checkoutItems = isDirectCheckout
    ? (directProduct ? [{ ...directProduct, quantity: 1 }] : [])
    : selectedCartItems;

  const checkoutItemCount = checkoutItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const checkoutSubtotal = checkoutItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );


  const [form, setForm] = useState({
    name: '',
    phone: '',
    district: '',
    upazila: '',
    area: '',
    address: '',
    note: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutState, setCheckoutState] = useState(readCheckoutState);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || checkoutItems.length === 0) return;

    const phone = form.phone.replace(/[\s-]/g, '');

    if (
      !form.name.trim() ||
      !form.district.trim() ||
      !form.upazila.trim() ||
      !form.area.trim() ||
      !form.address.trim()
    ) {
      setError('সব প্রয়োজনীয় তথ্য সঠিকভাবে পূরণ করুন।');
      return;
    }

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      setError('সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন।');
      return;
    }

    // Keep a snapshot of the selected products for this order.
    const submittedItems = checkoutItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
    }));

    setError('');
    setIsSubmitting(true);

    const whatsappWindow = window.open('about:blank', '_blank');

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke('create-order', {
          body: {
            name: form.name.trim(),
            phone,
            district: form.district.trim(),
            upazila: form.upazila.trim(),
            area: form.area.trim(),
            address: form.address.trim(),
            note: form.note.trim(),
            items: submittedItems,
          },
        });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data?.success || !data?.orderNumber) {
        throw new Error(data?.error || 'Order could not be saved.');
      }

      if (
        !Array.isArray(data.items) ||
        !Number.isInteger(data.itemCount) ||
        !Number.isFinite(Number(data.subtotal))
      ) {
        throw new Error('Invalid order data received from server.');
      }

      const orderId = data.orderNumber;
      const verifiedItems = data.items;
      const verifiedItemCount = data.itemCount;
      const verifiedSubtotal = Number(data.subtotal);

      const productLines = verifiedItems.map((item, index) =>
        `${index + 1}. ${item.name}\n` +
        `   Quantity: ${item.quantity}\n` +
        `   Unit Price: Tk ${item.price}\n` +
        `   Total: Tk ${item.price * item.quantity}`
      );

      const message = [
        '*ROYAL SHOP - NEW ORDER*',
        '',
        `Order ID: ${orderId}`,
        '',
        '*CUSTOMER INFORMATION*',
        `Name: ${form.name.trim()}`,
        `Mobile: ${phone}`,
        `District: ${form.district.trim()}`,
        `Upazila: ${form.upazila.trim()}`,
        `Area: ${form.area.trim()}`,
        `Full Address: ${form.address.trim()}`,
        '',
        '*ORDER ITEMS*',
        ...productLines,
        '',
        `Total Items: ${verifiedItemCount}`,
        `Subtotal: Tk ${verifiedSubtotal}`,
        'Delivery Charge: To be confirmed',
        `Estimated Total: Tk ${verifiedSubtotal} + Delivery Charge`,
        'Payment Method: Cash on Delivery',
        '',
        `Special Note: ${form.note.trim() || 'None'}`,
        '',
        'Please confirm this order and delivery charge.',
      ].join('\n');

      const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

      const order = {
        orderId,
        name: form.name.trim(),
        phone,
        district: form.district.trim(),
        upazila: form.upazila.trim(),
        area: form.area.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
        items: verifiedItems,
        orderedProductIds: isDirectCheckout ? [] : submittedItems.map((item) => item.id),
        cartCount: verifiedItemCount,
        subtotal: verifiedSubtotal,
        deliveryCharge: data.deliveryCharge,
        total: data.total,
        whatsappUrl,
        status: 'pending',
      };

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
      } catch (storageError) {
        console.error('Session storage error:', storageError);
        throw new Error('Order state could not be saved in this browser.');
      }

      setCheckoutState(order);

      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      }
    } catch (submitError) {
      console.error('Checkout submission error:', submitError);

      if (whatsappWindow) {
        whatsappWindow.close();
      }

      setError(
        'অর্ডার সংরক্ষণ করা যায়নি। আপনার Cart অক্ষত আছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomerConfirmation = () => {
    if (!checkoutState) return;

    const completedOrder = {
      ...checkoutState,
      status: 'customer_confirmed',
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(completedOrder));
    } catch {
      setError('Confirmation সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।');
      return;
    }

    // Remove only the products included in this order.
    const orderedProductIds =
      checkoutState.orderedProductIds ||
      checkoutState.items.map((item) => item.id);

    removeItemsFromCart(orderedProductIds);

    setCheckoutState(completedOrder);
  };

  const startNewOrder = () => {
    sessionStorage.removeItem(STORAGE_KEY);
  };

  if (checkoutState?.status === 'customer_confirmed') {
    return (
      <main className="rs-checkout-page">
        <div className="rs-checkout-container rs-order-result">
          <div className="rs-order-result-icon">✓</div>
          <p className="rs-order-eyebrow">ROYAL SHOP</p>
          <h1>Thank You!</h1>
          <h2>Your Order Submission Is Acknowledged</h2>
          <p>
            আপনি জানিয়েছেন যে WhatsApp-এ অর্ডারটি পাঠিয়েছেন।
            Royal Shop কর্তৃপক্ষের যাচাই ও নিশ্চিতকরণ এখনো বাকি।
          </p>

          <div className="rs-order-reference">
            <span>Your Order Reference</span>
            <strong>{checkoutState.orderId}</strong>
          </div>

          <p className="rs-order-status">
            Status: Awaiting Royal Shop Confirmation
          </p>

          <p className="rs-order-reminder">
            WhatsApp-এ অর্ডার পাঠানো না হয়ে থাকলে,
            এই Confirmation-কে চূড়ান্ত অর্ডার হিসেবে বিবেচনা করবেন না।
          </p>

          <Link
            to="/shop"
            className="rs-checkout-primary"
            onClick={startNewOrder}
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  if (checkoutState?.status === 'pending') {
    return (
      <main className="rs-checkout-page">
        <div className="rs-checkout-container rs-order-result">
          <div className="rs-order-pending-icon">!</div>
          <p className="rs-order-eyebrow">ROYAL SHOP</p>
          <h1>WhatsApp Order Pending</h1>

          <div className="rs-order-reference">
            <span>Your Order Reference</span>
            <strong>{checkoutState.orderId}</strong>
          </div>

          <p className="rs-order-instruction">
            WhatsApp খুলেছে। সেখানে অর্ডারের বার্তাটি দেখে
            <strong> Send </strong>
            চাপুন। তারপর এখানে ফিরে আসুন।
          </p>

          <a
            href={checkoutState.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rs-checkout-primary"
          >
            WhatsApp না খুললে এখানে চাপুন
          </a>

          <button
            type="button"
            className="rs-order-confirm-button"
            onClick={handleCustomerConfirmation}
          >
            আমি WhatsApp-এ Send করেছি
          </button>

          {error && <p className="rs-checkout-error">{error}</p>}

          <p className="rs-order-reminder">
            এই বাটন চাপার আগে WhatsApp-এ Send করা হয়েছে কি না নিশ্চিত হোন।
            আমরা WhatsApp-এর Send status সরাসরি যাচাই করতে পারি না।
          </p>
        </div>
      </main>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <main className="rs-checkout-page">
        <div className="rs-checkout-container rs-checkout-empty">
          <h1>No Products Selected</h1>
          <p>আপনার Cart থেকে Checkout করার জন্য পণ্য নির্বাচন করুন।</p>
          <Link to="/cart" className="rs-checkout-primary">
            Back to Cart
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="rs-checkout-page">
      <div className="rs-checkout-container">
        <div className="rs-checkout-heading">
          <p>ROYAL SHOP</p>
          <h1>Checkout</h1>
          <span>Complete your details to place your order.</span>
        </div>

        <div className="rs-checkout-layout">
          <form className="rs-checkout-form" onSubmit={handleSubmit}>
            <section className="rs-checkout-section">
              <h2>Customer Information</h2>

              <label>
                Full Name *
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  placeholder="Enter your full name"
                  required
                  maxLength={80}
                />
              </label>

              <label>
                Mobile Number *
                <input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={updateField}
                  placeholder="01XXXXXXXXX"
                  required
                  maxLength={15}
                />
              </label>
            </section>

            <section className="rs-checkout-section">
              <h2>Delivery Address</h2>

              <div className="rs-checkout-fields">
                <label>
                  District *
                  <input
                    name="district"
                    value={form.district}
                    onChange={updateField}
                    placeholder="District"
                    required
                  />
                </label>

                <label>
                  Upazila *
                  <input
                    name="upazila"
                    value={form.upazila}
                    onChange={updateField}
                    placeholder="Upazila"
                    required
                  />
                </label>
              </div>

              <label>
                Area / Village / Road *
                <input
                  name="area"
                  value={form.area}
                  onChange={updateField}
                  placeholder="Area or village name"
                  required
                />
              </label>

              <label>
                Full Address *
                <textarea
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  placeholder="House number, road, landmark and other details"
                  rows={3}
                  required
                />
              </label>

              <label>
                Order Note (Optional)
                <textarea
                  name="note"
                  value={form.note}
                  onChange={updateField}
                  placeholder="Any additional delivery instructions?"
                  rows={2}
                />
              </label>
            </section>

            <section className="rs-checkout-payment">
              <h2>Payment Method</h2>
              <div>
                <strong>Cash on Delivery (COD)</strong>
                <p>Pay when you receive your order.</p>
              </div>
            </section>

            {error && <p className="rs-checkout-error">{error}</p>}

            <button
              className="rs-checkout-primary"
              type="submit"
              disabled={isSubmitting || checkoutItems.length === 0}
            >
              {isSubmitting
                ? 'অর্ডার সংরক্ষণ হচ্ছে...'
                : 'অর্ডার সংরক্ষণ করে WhatsApp-এ যান'}
            </button>

            <p className="rs-checkout-disclaimer">
              প্রথমে আপনার অর্ডার Royal Shop Database-এ সংরক্ষিত হবে।
              এরপর WhatsApp খুলবে। সেখানে Send চাপার পর এখানে ফিরে আসুন।
            </p>
          </form>

          <aside className="rs-checkout-summary">
            <h2>Selected Products ({checkoutItems.length})</h2>

            {checkoutItems.map((item) => (
              <div className="rs-checkout-product" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>Quantity: {item.quantity}</span>
                </div>
                <strong>
                  Tk {(item.price * item.quantity).toLocaleString('en-BD')}
                </strong>
              </div>
            ))}

            <div className="rs-checkout-total-row">
              <span>Total Items</span>
              <strong>{checkoutItemCount}</strong>
            </div>

            <div className="rs-checkout-total-row">
              <span>Subtotal</span>
              <strong>Tk {checkoutSubtotal.toLocaleString('en-BD')}</strong>
            </div>

            <div className="rs-checkout-total-row">
              <span>Delivery Charge</span>
              <strong>To be confirmed</strong>
            </div>

            <div className="rs-checkout-grand-total">
              <span>Estimated Total</span>
              <strong>
                Tk {checkoutSubtotal.toLocaleString('en-BD')} + Delivery
              </strong>
            </div>

            <p>
              Only selected products are included in this order.
              Our team will confirm the delivery charge and final payable
              amount before dispatch.
            </p>

            <Link to="/cart" className="rs-checkout-back">
              ← Back to Cart
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default CheckoutPage;

