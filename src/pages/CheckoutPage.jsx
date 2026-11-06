import { businessConfig } from '../config/business.config.js';

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { products } from '../data/products';
import { supabase } from '../lib/supabase.js';
import './CheckoutPage.css';

const WHATSAPP_NUMBER = businessConfig.contact.whatsapp;
const STORAGE_KEY = 'royal-shop-checkout-state';
const PENDING_REQUEST_KEY = 'royal-shop-pending-order-request';

function readCheckoutState() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function readPendingRequest() {
  try {
    const saved = sessionStorage.getItem(PENDING_REQUEST_KEY);

    if (!saved) return null;

    const parsed = JSON.parse(saved);

    const valid =
      parsed &&
      typeof parsed.idempotencyKey === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.idempotencyKey) &&
      parsed.payload &&
      typeof parsed.payload.name === 'string' &&
      parsed.payload.name.trim().length > 0 &&
      parsed.payload.name.trim().length <= 100 &&
      typeof parsed.payload.phone === 'string' &&
      typeof parsed.payload.district === 'string' &&
      parsed.payload.district.trim().length > 0 &&
      parsed.payload.district.trim().length <= 50 &&
      typeof parsed.payload.upazila === 'string' &&
      parsed.payload.upazila.trim().length > 0 &&
      parsed.payload.upazila.trim().length <= 50 &&
      (parsed.payload.area === null ||
        (typeof parsed.payload.area === 'string' &&
          parsed.payload.area.trim().length <= 100)) &&
      typeof parsed.payload.address === 'string' &&
      parsed.payload.address.trim().length > 0 &&
      parsed.payload.address.trim().length <= 200 &&
      (parsed.payload.customer_note === null ||
        (typeof parsed.payload.customer_note === 'string' &&
          parsed.payload.customer_note.trim().length <= 250)) &&
      Array.isArray(parsed.payload.items) &&
      parsed.payload.items.length > 0 &&
      parsed.payload.items.every(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0
      );

    return valid ? parsed : { invalid: true };
  } catch {
    return { invalid: true };
  }
}

function savePendingRequest(request) {
  sessionStorage.setItem(
    PENDING_REQUEST_KEY,
    JSON.stringify(request)
  );
}

function clearPendingRequest() {
  sessionStorage.removeItem(PENDING_REQUEST_KEY);
}
function createIdempotencyKey() {
  if (
    typeof globalThis.crypto?.randomUUID !== 'function'
  ) {
    throw new Error(
      'Secure UUID generation is unavailable in this browser.'
    );
  }

  return globalThis.crypto.randomUUID();
}
function CheckoutPage() {
  const {
    selectedCartItems,
    removeItemsFromCart,
  } = useCart();

  const location = useLocation();
  const directProductId = location.state?.directProductId;
  const directProduct =
    location.state?.directProduct ||
    (directProductId
      ? products.find((product) => product.id === directProductId)
      : null);

  const isDirectCheckout = Boolean(directProduct);

  const checkoutItems = isDirectCheckout
    ? [{ ...directProduct, quantity: 1 }]
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
    customer_note: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [checkoutState, setCheckoutState] = useState(readCheckoutState);
  const [pendingRequest, setPendingRequest] = useState(readPendingRequest);
  const [trackingUrl, setTrackingUrl] = useState('');

  useEffect(() => {
    const match = window.location.hash.match(
      /^#t=([A-Za-z0-9_-]{43})$/
    );

    if (!match) return;

    const token = match[1];

    setTrackingUrl(
      `${window.location.origin}/track-order#t=${token}`
    );
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    const isRetry =
      pendingRequest &&
      ['request_pending', 'outcome_unknown'].includes(
        pendingRequest.status
      );

    if (!isRetry && checkoutItems.length === 0) return;
    if (pendingRequest && !isRetry) {
      setError(
        'আগের request-এর অবস্থা যাচাই করা যাচ্ছে না। নতুন order পাঠানো বন্ধ রাখা হয়েছে।'
      );
      return;
    }

    let request = isRetry ? pendingRequest : null;

    if (!request) {
      const phone = form.phone.replace(/[\s-]/g, '');
      const name = form.name.trim();
      const district = form.district.trim();
      const upazila = form.upazila.trim();
      const area = form.area.trim();
      const address = form.address.trim();
      const customerNote = form.customer_note.trim();

      if (!name || !district || !upazila || !address) {
        setError('নাম, জেলা, উপজেলা ও সম্পূর্ণ ঠিকানা পূরণ করুন।');
        return;
      }

      if (
        name.length > 80 ||
        district.length > 50 ||
        upazila.length > 50 ||
        area.length > 100 ||
        address.length > 200 ||
        customerNote.length > 250
      ) {
        setError('কোনো একটি তথ্য নির্ধারিত অক্ষরসীমা অতিক্রম করেছে।');
        return;
      }

      if (!/^01[3-9]\d{8}$/.test(phone)) {
        setError('সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন।');
        return;
      }

      const submittedItems = checkoutItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
      }));

      try {
        request = {
          version: 1,
          status: 'request_pending',
          idempotencyKey: createIdempotencyKey(),
          payload: {
            name,
            phone,
            district,
            upazila,
            area: area || null,
            address,
            customer_note: customerNote || null,
            items: submittedItems,
          },
          orderedProductIds: isDirectCheckout
            ? []
            : submittedItems.map((item) => item.id),
          createdAt: new Date().toISOString(),
        };

        // Persist before making any network request.
        savePendingRequest(request);
        setPendingRequest(request);
      } catch {
        setError(
          'Request নিরাপদে সংরক্ষণ করা যায়নি। তাই order পাঠানো হয়নি।'
        );
        return;
      }
    }

    setError('');
    setIsSubmitting(true);

    let whatsappWindow = null;

    try {
      whatsappWindow = window.open('about:blank', '_blank');
    } catch {
      whatsappWindow = null;
    }

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke('create-order', {
          body: {
            ...request.payload,
            idempotencyKey: request.idempotencyKey,
          },
        });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data?.success || !data?.orderNumber) {
        throw new Error(data?.error || 'Order could not be saved.');
      }

      let verifiedTrackingUrl;

      try {
        const parsedTrackingUrl = new URL(data.trackingUrl);

        if (
          parsedTrackingUrl.protocol !== 'https:' ||
          parsedTrackingUrl.origin !== window.location.origin ||
          parsedTrackingUrl.username ||
          parsedTrackingUrl.password ||
          parsedTrackingUrl.pathname !== '/track-order' ||
          parsedTrackingUrl.search ||
          !/^#t=[A-Za-z0-9_-]{43}$/.test(parsedTrackingUrl.hash)
        ) {
          throw new Error('Invalid tracking URL.');
        }

        verifiedTrackingUrl = parsedTrackingUrl.toString();
      } catch {
        throw new Error('Invalid tracking link received from server.');
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
        `*${businessConfig.shortName} - NEW ORDER*`,
        '',
        `Order ID: ${orderId}`,
        '',
        '*CUSTOMER INFORMATION*',
        `Name: ${request.payload.name}`,
        `Mobile: ${request.payload.phone}`,
        `District: ${request.payload.district}`,
        `Upazila: ${request.payload.upazila}`,
        ...(request.payload.area ? [`Area: ${request.payload.area}`] : []),
        `Full Address: ${request.payload.address}`,
        ...(request.payload.customer_note
          ? [`Customer Note: ${request.payload.customer_note}`]
          : []),
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
        'Please confirm this order and delivery charge.',
      ].join('\n');

      const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

      const order = {
        orderId,
        name: request.payload.name,
        phone: request.payload.phone,
        district: request.payload.district,
        upazila: request.payload.upazila,
        area: request.payload.area,
        address: request.payload.address,
        customer_note: request.payload.customer_note,
        items: verifiedItems,
        orderedProductIds: request.orderedProductIds,
        cartCount: verifiedItemCount,
        subtotal: verifiedSubtotal,
        deliveryCharge: data.deliveryCharge,
        total: data.total,
        whatsappUrl,
        status: 'pending',
      };

      // Save the confirmed server response before clearing the retry draft.
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));

      clearPendingRequest();
      setPendingRequest(null);
      setCheckoutState(order);
      setTrackingUrl(verifiedTrackingUrl);

      const trackingToken = new URL(verifiedTrackingUrl).hash.slice(3);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#t=${trackingToken}`
      );

      if (whatsappWindow) {
        try {
          whatsappWindow.location.href = whatsappUrl;
        } catch {
          // The saved order remains valid; the manual WhatsApp link is available.
          whatsappWindow.close();
        }
      }
    } catch (submitError) {
      console.error('Checkout submission error:', submitError);

      const uncertainRequest = {
        ...request,
        status: 'outcome_unknown',
      };

      // Keep the same key and exact payload for a safe retry.
      setPendingRequest(uncertainRequest);

      try {
        savePendingRequest(uncertainRequest);
      } catch {
        // The original request draft may still exist in sessionStorage.
      }

      if (whatsappWindow) {
        whatsappWindow.close();
      }

      setError(
        'Order তৈরি হয়েছে কি না নিশ্চিত হওয়া যায়নি। নতুন order পাঠাবেন না। একই request আবার চেষ্টা করুন। Cart অপরিবর্তিত আছে।'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleCustomerConfirmation = async () => {
    if (!checkoutState || isAcknowledging) return;

    setIsAcknowledging(true);
    setError('');

    try {
      const tokenMatch = window.location.hash.match(
        /^#t=([A-Za-z0-9_-]{43})$/
      );

      if (!tokenMatch) {
        throw new Error('Tracking token পাওয়া যায়নি।');
      }

      const { data, error: acknowledgementError } =
        await supabase.functions.invoke('acknowledge-order', {
          body: { token: tokenMatch[1] },
        });

      if (acknowledgementError) throw acknowledgementError;

      if (!data?.success || !data?.acknowledged) {
        throw new Error(
          data?.error || 'Customer acknowledgement সংরক্ষণ করা যায়নি।'
        );
      }

      const completedOrder = {
        ...checkoutState,
        status: 'customer_confirmed',
      };

      // Preserve the cart if local recovery data cannot be saved.
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(completedOrder));
      clearPendingRequest();

      setPendingRequest(null);

      const orderedProductIds =
        checkoutState.orderedProductIds ||
        checkoutState.items.map((item) => item.id);

      removeItemsFromCart(orderedProductIds);
      setCheckoutState(completedOrder);
    } catch {
      setError(
        'Confirmation server-এ সংরক্ষণ করা যায়নি। Cart অপরিবর্তিত আছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setIsAcknowledging(false);
    }
  };

  const startNewOrder = (event) => {
    const savedPending = readPendingRequest();

    if (savedPending) {
      event.preventDefault();
      setError(
        `আগের order request এখনো সংরক্ষিত আছে। নতুন order শুরু করার আগে ${businessConfig.name}-এর সঙ্গে যোগাযোগ করুন।`
      );
      return;
    }

    try {
      sessionStorage.removeItem(STORAGE_KEY);
      setCheckoutState(null);
      setTrackingUrl('');

      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`
      );
    } catch {
      event.preventDefault();
      setError('আগের order state পরিষ্কার করা যায়নি। আবার চেষ্টা করুন।');
    }
  };
  if (checkoutState?.status === 'customer_confirmed') {
    return (
      <main className="rs-checkout-page">
        <div className="rs-checkout-container rs-order-result">
          <div className="rs-order-result-icon">✓</div>
          <p className="rs-order-eyebrow">{businessConfig.shortName}</p>
          <h1>Thank You!</h1>
          <h2>Your Order Submission Is Acknowledged</h2>
          <p>
            আপনি জানিয়েছেন যে WhatsApp-এ অর্ডারটি পাঠিয়েছেন।
            {businessConfig.name} কর্তৃপক্ষের যাচাই ও নিশ্চিতকরণ এখনো বাকি।
          </p>

          <div className="rs-order-reference">
            <span>Your Order Reference</span>
            <strong>{checkoutState.orderId}</strong>
          </div>

          {trackingUrl && (
            <a
              href={trackingUrl}
              className="rs-checkout-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Track Your Order
            </a>
          )}

          <p className="rs-order-status">
            Status: Awaiting {businessConfig.name} Confirmation
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
          <p className="rs-order-eyebrow">{businessConfig.shortName}</p>
          <h1>WhatsApp Order Pending</h1>

          <div className="rs-order-reference">
            <span>Your Order Reference</span>
            <strong>{checkoutState.orderId}</strong>
          </div>

          {trackingUrl && (
            <a
              href={trackingUrl}
              className="rs-checkout-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Track Your Order
            </a>
          )}

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
            disabled={isAcknowledging}
          >
            {isAcknowledging
              ? 'Confirmation সংরক্ষণ হচ্ছে...'
              : 'আমি WhatsApp-এ Send করেছি'}
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

  if (pendingRequest) {
    const canRetryPendingRequest =
      !pendingRequest.invalid &&
      ['request_pending', 'outcome_unknown'].includes(
        pendingRequest.status
      );

    return (
      <main className="rs-checkout-page">
        <div className="rs-checkout-container rs-order-result">
          <div className="rs-order-pending-icon">!</div>
          <p className="rs-order-eyebrow">{businessConfig.shortName}</p>
          <h1>Order Request Recovery</h1>

          {pendingRequest.invalid ? (
            <>
              <p>
                আগের order request-এর সংরক্ষিত তথ্য যাচাই করা যাচ্ছে না।
                নিরাপত্তার জন্য নতুন order বা automatic retry বন্ধ রাখা হয়েছে।
              </p>
              <p className="rs-order-reminder">
                {businessConfig.name} কর্তৃপক্ষের সঙ্গে যোগাযোগ করে আগের order-এর
                অবস্থা যাচাই করুন।
              </p>
            </>
          ) : (
            <>
              <p>
                আগের order request-এর ফলাফল নিশ্চিত নয়।
                Database-এ order তৈরি হয়ে থাকতে পারে।
              </p>
              <p className="rs-order-reminder">
                নতুন order তৈরি করবেন না। নিচের বাটনে চাপলে আগের একই
                payload ও idempotency key দিয়ে retry হবে।
              </p>

              <button
                type="button"
                className="rs-checkout-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !canRetryPendingRequest}
              >
                {isSubmitting
                  ? 'আগের request যাচাই হচ্ছে...'
                  : 'একই request আবার চেষ্টা করুন'}
              </button>
            </>
          )}

          {error && <p className="rs-checkout-error">{error}</p>}
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
          <p>{businessConfig.shortName}</p>
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

              <label>
                District *
                <input
                  name="district"
                  value={form.district}
                  onChange={updateField}
                  placeholder="Enter district"
                  required
                  maxLength={50}
                />
              </label>

              <label>
                Upazila *
                <input
                  name="upazila"
                  value={form.upazila}
                  onChange={updateField}
                  placeholder="Enter upazila"
                  required
                  maxLength={50}
                />
              </label>

              <label>
                Area / Locality (Optional)
                <input
                  name="area"
                  value={form.area}
                  onChange={updateField}
                  placeholder="Village, union, area or locality"
                  maxLength={100}
                />
              </label>

              <label>
                Full Delivery Address *
                <textarea
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  placeholder="House, road, village and nearby landmark"
                  rows={3}
                  required
                  maxLength={200}
                />
              </label>

              <label>
                Customer Note (Optional)
                <textarea
                  name="customer_note"
                  value={form.customer_note}
                  onChange={updateField}
                  placeholder="Any additional delivery instructions"
                  rows={2}
                  maxLength={250}
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
              প্রথমে আপনার অর্ডার {businessConfig.name} Database-এ সংরক্ষিত হবে।
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


















