import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  ORDER_STATUSES,
  createOrderListPayload,
  createOrderDetailPayload,
  createOrderConfirmPayload,
  getOrderStatusLabel,
} from "../lib/orderManagement.js";
import "./OrderManagementPage.css";

const PAGE_SIZE = 20;

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "৳0.00";

  return `৳${amount.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function OrderStatus({ status }) {
  return (
    <span className={`rs-order-status rs-order-status-${status || "unknown"}`}>
      {getOrderStatusLabel(status)}
    </span>
  );
}

function OrderDetails({ order, onClose, onConfirm, confirming, error }) {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div
      className="rs-order-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="rs-order-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rs-order-details-title"
      >
        <header className="rs-order-details-header">
          <div>
            <p className="rs-order-eyebrow">ORDER DETAILS</p>
            <h2 id="rs-order-details-title">
              {order.order_number || "Order"}
            </h2>
          </div>

          <button
            type="button"
            className="rs-order-close"
            onClick={onClose}
            aria-label="Close order details"
          >
            ×
          </button>
        </header>

        <div className="rs-order-details-body">
          <div className="rs-order-detail-status">
            <span>Status</span>
            <OrderStatus status={order.status} />
          </div>

          <section className="rs-order-detail-section">
            <h3>Customer information</h3>
            <dl>
              <div><dt>Name</dt><dd>{order.customer_name || "—"}</dd></div>
              <div><dt>Phone</dt><dd>{order.customer_phone || "—"}</dd></div>
              <div><dt>District</dt><dd>{order.district || "—"}</dd></div>
              <div><dt>Upazila</dt><dd>{order.upazila || "—"}</dd></div>
              <div><dt>Area</dt><dd>{order.area || "—"}</dd></div>
              <div className="rs-order-address">
                <dt>Full address</dt>
                <dd>{order.address || "—"}</dd>
              </div>
              <div className="rs-order-address">
                <dt>Customer note</dt>
                <dd>{order.customer_note || "No note"}</dd>
              </div>
            </dl>
          </section>

          <section className="rs-order-detail-section">
            <h3>Ordered products</h3>

            {items.length === 0 ? (
              <p className="rs-order-muted">No item details available.</p>
            ) : (
              <div className="rs-order-items">
                {items.map((item, index) => {
                  const name =
                    item?.name ||
                    item?.product_name ||
                    item?.title ||
                    "Unnamed product";

                  const quantity = Number(item?.quantity) || 0;
                  const price = Number(item?.price) || 0;

                  return (
                    <div className="rs-order-item" key={`${item?.id || "item"}-${index}`}>
                      <div>
                        <strong>{name}</strong>
                        <span>{quantity} × {formatMoney(price)}</span>
                      </div>
                      <strong>{formatMoney(quantity * price)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rs-order-detail-section rs-order-totals">
            <div><span>Item count</span><strong>{order.item_count ?? "—"}</strong></div>
            <div><span>Subtotal</span><strong>{formatMoney(order.subtotal)}</strong></div>
            <div><span>Delivery charge</span><strong>{formatMoney(order.delivery_charge)}</strong></div>
            <div className="rs-order-grand-total">
              <span>Total</span><strong>{formatMoney(order.total)}</strong>
            </div>
            <div><span>Payment method</span><strong>{order.payment_method || "—"}</strong></div>
          </section>

          <section className="rs-order-detail-section">
            <h3>Order timeline</h3>
            <dl>
              <div><dt>Created</dt><dd>{formatDate(order.created_at)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDate(order.updated_at)}</dd></div>
            </dl>
          </section>

          {error && <p className="rs-order-error" role="alert">{error}</p>}

          {order.status === "pending" && (
            <button
              type="button"
              className="rs-order-confirm-button"
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? "Confirming..." : "Confirm this order"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function OrderManagementPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState("all");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    from: "",
    to: "",
  });

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      setLoading(true);
      setListError("");

      try {
        const { data, error } = await supabase.functions.invoke(
          "admin-orders",
          {
            body: createOrderListPayload({
              ...filters,
              page,
              limit: PAGE_SIZE,
            }),
          },
        );

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || "Could not load orders.");
        }

        if (!active) return;

        const pagination = data.pagination || {};

        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setTotalOrders(Number(pagination.total) || 0);
        setTotalPages(
          Math.max(
            1,
            Number(pagination.totalPages) ||
              Math.ceil((Number(pagination.total) || 0) / PAGE_SIZE),
          ),
        );
      } catch (error) {
        if (!active) return;

        setOrders([]);
        setTotalOrders(0);
        setTotalPages(1);
        setListError(getErrorMessage(error, "Could not load orders."));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      active = false;
    };
  }, [filters, page, refreshKey]);

  function closeOrderDetails() {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setDetailError("");
    setDetailLoading(false);
  }

  useEffect(() => {
    if (!selectedOrderId) {
      return undefined;
    }

    let active = true;

    async function loadOrderDetails() {
      setDetailLoading(true);
      setDetailError("");
      setSelectedOrder(null);

      try {
        const { data, error } = await supabase.functions.invoke(
          "admin-orders",
          {
            body: createOrderDetailPayload(selectedOrderId),
          },
        );

        if (error) throw error;
        if (!data?.success || !data.order) {
          throw new Error(data?.error || "Could not load order details.");
        }

        if (active) setSelectedOrder(data.order);
      } catch (error) {
        if (active) {
          setDetailError(
            getErrorMessage(error, "Could not load order details."),
          );
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    }

    loadOrderDetails();

    return () => {
      active = false;
    };
  }, [selectedOrderId, refreshKey]);

  function applyFilters(event) {
    event.preventDefault();

    if (fromInput && toInput && fromInput > toInput) {
      setListError("The start date cannot be after the end date.");
      return;
    }

    setListError("");
    setPage(1);
    setFilters({
      search: searchInput,
      status: statusInput,
      from: fromInput,
      to: toInput,
    });
  }

  function resetFilters() {
    setSearchInput("");
    setStatusInput("all");
    setFromInput("");
    setToInput("");
    setListError("");
    setPage(1);
    setFilters({
      search: "",
      status: "all",
      from: "",
      to: "",
    });
  }

  async function confirmSelectedOrder() {
    if (!selectedOrder || selectedOrder.status !== "pending") return;

    const confirmed = window.confirm(
      `Confirm order ${selectedOrder.order_number || ""}?`,
    );

    if (!confirmed) return;

    setConfirming(true);
    setDetailError("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-orders",
        {
          body: createOrderConfirmPayload(selectedOrder.id),
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Could not confirm this order.");
      }

      setRefreshKey((value) => value + 1);
    } catch (error) {
      setDetailError(
        getErrorMessage(error, "Could not confirm this order."),
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="rs-order-management">
      <header className="rs-order-page-header">
        <div>
          <p className="rs-order-eyebrow">ROYAL SHOP ADMIN</p>
          <h1>Order Management</h1>
          <p>View customer orders and manage order confirmation.</p>
        </div>

        <a href="/admin/dashboard" className="rs-order-back-link">
          ← Dashboard
        </a>
      </header>

      <section className="rs-order-summary">
        <div>
          <span>Total matching orders</span>
          <strong>{totalOrders.toLocaleString("en-BD")}</strong>
        </div>
        <div>
          <span>Current page</span>
          <strong>{page} / {totalPages}</strong>
        </div>
      </section>

      <form className="rs-order-filters" onSubmit={applyFilters}>
        <div className="rs-order-search-field">
          <label htmlFor="rs-order-search">Search orders</label>
          <input
            id="rs-order-search"
            type="search"
            placeholder="Order number, customer name or phone"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="rs-order-status-filter">Status</label>
          <select
            id="rs-order-status-filter"
            value={statusInput}
            onChange={(event) => setStatusInput(event.target.value)}
          >
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rs-order-from">From date</label>
          <input
            id="rs-order-from"
            type="date"
            value={fromInput}
            onChange={(event) => setFromInput(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="rs-order-to">To date</label>
          <input
            id="rs-order-to"
            type="date"
            value={toInput}
            onChange={(event) => setToInput(event.target.value)}
          />
        </div>

        <div className="rs-order-filter-actions">
          <button type="submit" className="rs-order-apply-button">
            Apply filters
          </button>
          <button
            type="button"
            className="rs-order-reset-button"
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>
      </form>

      {listError && <p className="rs-order-error" role="alert">{listError}</p>}

      <section className="rs-order-list-section">
        <div className="rs-order-list-heading">
          <h2>Orders</h2>
          <button
            type="button"
            className="rs-order-refresh-button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="rs-order-state">Loading orders...</div>
        ) : listError ? (
          <div className="rs-order-state">
            Unable to display orders. Check the error above.
          </div>
        ) : orders.length === 0 ? (
          <div className="rs-order-state">
            <strong>No orders found</strong>
            <span>Try changing your search or filters.</span>
          </div>
        ) : (
          <>
            <div className="rs-order-table-wrap">
              <table className="rs-order-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.order_number || "—"}</strong>
                        <span className="rs-order-subtext">
                          {order.item_count ?? 0} item(s)
                        </span>
                      </td>
                      <td>
                        <strong>{order.customer_name || "—"}</strong>
                        <span className="rs-order-subtext">
                          {order.customer_phone || "—"}
                        </span>
                      </td>
                      <td>{formatDate(order.created_at)}</td>
                      <td><strong>{formatMoney(order.total)}</strong></td>
                      <td><OrderStatus status={order.status} /></td>
                      <td>
                        <button
                          type="button"
                          className="rs-order-view-button"
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rs-order-mobile-list">
              {orders.map((order) => (
                <article className="rs-order-mobile-card" key={order.id}>
                  <div className="rs-order-mobile-card-top">
                    <strong>{order.order_number || "—"}</strong>
                    <OrderStatus status={order.status} />
                  </div>
                  <p>{order.customer_name || "—"}</p>
                  <span>{order.customer_phone || "—"}</span>
                  <div className="rs-order-mobile-card-bottom">
                    <strong>{formatMoney(order.total)}</strong>
                    <button
                      type="button"
                      className="rs-order-view-button"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      View details
                    </button>
                  </div>
                  <small>{formatDate(order.created_at)}</small>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && orders.length > 0 && (
          <nav className="rs-order-pagination" aria-label="Order pages">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </nav>
        )}
      </section>

      {detailLoading && (
        <div className="rs-order-modal-backdrop">
          <div className="rs-order-state rs-order-detail-loading">
            Loading order details...
          </div>
        </div>
      )}

      {detailError && !selectedOrder && selectedOrderId && !detailLoading && (
        <div className="rs-order-modal-backdrop">
          <section className="rs-order-details" role="alert">
            <button
              type="button"
              className="rs-order-close"
              onClick={closeOrderDetails}
              aria-label="Close"
            >
              ×
            </button>
            <p className="rs-order-error">{detailError}</p>
          </section>
        </div>
      )}

      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={closeOrderDetails}
          onConfirm={confirmSelectedOrder}
          confirming={confirming}
          error={detailError}
        />
      )}
    </main>
  );
}


