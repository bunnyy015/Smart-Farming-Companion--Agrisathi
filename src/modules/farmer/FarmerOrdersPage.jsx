import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query,
  ref,
  update,
} from "firebase/database";

import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "history", label: "Order History" },
];

const ACTIVE_STATUSES = [
  "pending",
  "accepted",
  "delivered_by_dealer",
  "received_by_farmer",
];

function isPaidOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  return (
    ["payment_received", "completed", "complete", "paid", "payment_completed"].includes(status) ||
    order.dealerPaymentReceived === true ||
    order.paymentStatus === "paid" ||
    order.paymentStatus === "completed"
  );
}

function isHistoryOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase();

  return (
    isPaidOrder(order) ||
    order.farmerArchived === true ||
    Boolean(order.acceptedAt || order.dealerAcceptedAt || order.rejectedAt) ||
    ["accepted", "rejected", "cancelled", "canceled"].includes(status)
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusDetails(status) {
  const statuses = {
    pending: {
      icon: "⏳",
      label: "Waiting for Dealer",
      className: "bg-yellow-100 text-yellow-800",
      progress: 15,
      message: "The dealer has not responded yet.",
    },

    accepted: {
      icon: "✅",
      label: "Dealer Accepted",
      className: "bg-blue-100 text-blue-800",
      progress: 40,
      message: "The dealer accepted your order. Confirm after the products have physically arrived.",
    },

    delivered_by_dealer: {
      icon: "🚚",
      label: "Marked Delivered",
      className: "bg-purple-100 text-purple-800",
      progress: 70,
      message: "Confirm only after receiving the product.",
    },

    received_by_farmer: {
      icon: "📦",
      label: "Order Received",
      className: "bg-indigo-100 text-indigo-800",
      progress: 85,
      message: "You confirmed receipt. Waiting for the dealer to mark delivery.",
    },

    payment_received: {
      icon: "💵",
      label: "Payment Confirmed",
      className: "bg-orange-100 text-orange-800",
      progress: 95,
      message: "The order is almost complete.",
    },

    completed: {
      icon: "🎉",
      label: "Completed",
      className: "bg-green-100 text-green-800",
      progress: 100,
      message: "The order was completed successfully.",
    },

    rejected: {
      icon: "❌",
      label: "Rejected",
      className: "bg-red-100 text-red-800",
      progress: 0,
      message: "The dealer could not accept this request.",
    },

    cancelled: {
      icon: "🚫",
      label: "Cancelled",
      className: "bg-gray-100 text-gray-700",
      progress: 0,
      message: "This order request was cancelled.",
    },
  };

  return (
    statuses[status] || {
      icon: "ℹ️",
      label: "Order Update",
      className: "bg-gray-100 text-gray-700",
      progress: 0,
      message: "Check the latest order information.",
    }
  );
}

export default function FarmerOrdersPage() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("active");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");

  const [confirmation, setConfirmation] = useState(null);
  const [message, setMessage] = useState(null);
  const knownPaidOrderIds = useRef(new Set());
  const knownHistoryOrderIds = useRef(new Set());

  const currentOrders = useMemo(
    () =>
      orders.filter((order) => !isHistoryOrder(order)),
    [orders]
  );

  const paidOrders = useMemo(
    () => orders.filter(isPaidOrder),
    [orders]
  );

  const historyOrders = useMemo(
    () => orders.filter(isHistoryOrder),
    [orders]
  );

  useEffect(() => {
    let unsubscribeOrders = () => {};
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribeOrders();

      if (!user) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      await loadOrders(user.uid);

      if (!active) {
        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(user.uid)
      );

      unsubscribeOrders = onValue(
        ordersQuery,
        (snapshot) => {
          const orderList = snapshot.exists()
            ? Object.entries(snapshot.val())
                .map(([id, value]) => ({ id, ...value }))
                .sort(
                  (first, second) =>
                    new Date(second.updatedAt || second.createdAt || 0) -
                    new Date(first.updatedAt || first.createdAt || 0)
                )
            : [];

          const paidOrderIds = new Set(
            orderList.filter(isPaidOrder).map((order) => order.id)
          );
          const newlyPaidOrder = orderList.find(
            (order) =>
              isPaidOrder(order) &&
              !knownPaidOrderIds.current.has(order.id)
          );
          const historyOnlyStatuses = [
            "accepted",
            "rejected",
            "cancelled",
            "canceled",
          ];
          const newlyMovedToHistory = orderList.find(
            (order) =>
              historyOnlyStatuses.includes(order.status) &&
              !knownHistoryOrderIds.current.has(order.id)
          );

          knownPaidOrderIds.current = paidOrderIds;
          knownHistoryOrderIds.current = new Set(
            orderList.filter(isHistoryOrder).map((order) => order.id)
          );
          setOrders(orderList);

          if (newlyPaidOrder) {
            showMessage(
              "success",
              `Payment completed for ${newlyPaidOrder.productName || "your order"}. It is now in Order History.`
            );
          } else if (newlyMovedToHistory) {
            const statusMessage = {
              accepted:
                "The dealer accepted your order. It is now in Order History.",
              rejected:
                "The dealer rejected your order. It is now in Order History.",
              cancelled:
                "The cancelled order is now in Order History.",
              canceled:
                "The cancelled order is now in Order History.",
            }[newlyMovedToHistory.status];
            showMessage("info", statusMessage);
          }
        },
        (error) => {
          console.error("Farmer order updates error:", error);
        }
      );
    });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeOrders();
    };
  }, [navigate]);

  const filteredOrders = useMemo(() => {
    if (selectedFilter === "all") {
      return currentOrders;
    }

    if (selectedFilter === "active") {
      return currentOrders.filter((order) =>
        ACTIVE_STATUSES.includes(order.status)
      );
    }

    if (selectedFilter === "history") {
      return historyOrders;
    }

    return currentOrders;
  }, [currentOrders, historyOrders, selectedFilter]);

  const counts = useMemo(
    () => ({
      all: currentOrders.length,
      active: currentOrders.filter((order) =>
        ACTIVE_STATUSES.includes(order.status)
      ).length,
      history: historyOrders.length,
    }),
    [currentOrders, historyOrders]
  );

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadOrders(uid, isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const profileSnapshot = await get(
        ref(database, `users/${uid}`)
      );

      if (
        !profileSnapshot.exists() ||
        profileSnapshot.val().role !== "farmer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });

        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(uid)
      );

      const snapshot = await get(ordersQuery);

      if (!snapshot.exists()) {
        setOrders([]);
        knownPaidOrderIds.current = new Set();
        knownHistoryOrderIds.current = new Set();
        return;
      }

      const orderList = Object.entries(snapshot.val())
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort(
          (first, second) =>
            new Date(
              second.updatedAt ||
                second.createdAt ||
                0
            ) -
            new Date(
              first.updatedAt ||
                first.createdAt ||
                0
            )
        );

      setOrders(orderList);
      knownPaidOrderIds.current = new Set(
        orderList.filter(isPaidOrder).map((order) => order.id)
      );
      knownHistoryOrderIds.current = new Set(
        orderList.filter(isHistoryOrder).map((order) => order.id)
      );

      const latestPaidOrder = orderList.find((order) => {
        if (!isPaidOrder(order)) {
          return false;
        }

        const paidAt = new Date(
          order.paymentReceivedAt ||
            order.dealerPaymentReceivedAt ||
            order.completedAt ||
            order.updatedAt ||
            0
        ).getTime();

        return Number.isFinite(paidAt) && Date.now() - paidAt < 24 * 60 * 60 * 1000;
      });

      if (latestPaidOrder) {
        showMessage(
          "success",
          `Payment completed for ${latestPaidOrder.productName || "your order"}. It is now in Order History.`
        );
      }
    } catch (error) {
      console.error("Farmer orders error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Order access is blocked by Firebase rules."
          : "Your orders could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshOrders() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    await loadOrders(currentUser.uid, true);
  }

  function openConfirmation(type, order) {
    setConfirmation({
      type,
      order,
    });
  }

  function closeConfirmation() {
    if (!updatingId) {
      setConfirmation(null);
    }
  }

  async function cancelOrder(order) {
    if (order.status !== "pending") {
      showMessage(
        "warning",
        "Only waiting orders can be cancelled."
      );

      setConfirmation(null);
      return;
    }

    try {
      setUpdatingId(order.id);

      const now = new Date().toISOString();

      await update(
        ref(database, `dealerOrders/${order.id}`),
        {
          status: "cancelled",
          cancelledBy: "farmer",
          cancelledAt: now,
          updatedAt: now,
        }
      );

      setConfirmation(null);

      showMessage(
        "success",
        "The order request was cancelled."
      );

      await refreshOrders();
    } catch (error) {
      console.error("Cancel order error:", error);

      showMessage(
        "error",
        "The order could not be cancelled."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function confirmProductReceived(order) {
    if (!["accepted", "delivered_by_dealer"].includes(order.status) || order.farmerReceived) {
      showMessage(
        "warning",
        "Only accepted orders can be confirmed as received."
      );

      setConfirmation(null);
      return;
    }

    try {
      setUpdatingId(order.id);

      const now = new Date().toISOString();

      await update(
        ref(database, `dealerOrders/${order.id}`),
        {
          farmerReceived: true,
          farmerReceivedAt: now,
          status: "received_by_farmer",
          updatedAt: now,
        }
      );

      setConfirmation(null);

      showMessage(
        "success",
        "Product receipt was confirmed."
      );

      await refreshOrders();
    } catch (error) {
      console.error(
        "Product receipt confirmation error:",
        error
      );

      showMessage(
        "error",
        "Product receipt could not be confirmed."
      );
    } finally {
      setUpdatingId("");
    }
  }

  function executeConfirmation() {
    if (!confirmation) {
      return;
    }

    if (confirmation.type === "cancel") {
      cancelOrder(confirmation.order);
      return;
    }

    confirmProductReceived(confirmation.order);
  }

  function getConfirmationDetails() {
    if (!confirmation) {
      return null;
    }

    if (confirmation.type === "cancel") {
      return {
        icon: "🚫",
        title: "Cancel this order?",
        text: "The dealer will stop processing this request.",
        actionText: "Cancel Order",
        actionClass: "bg-red-600 text-white",
      };
    }

    return {
      icon: "📦",
      title: "Have you received this order?",
      text: "Confirm only after the dealer has physically delivered the products.",
      actionText: "Order Received",
      actionClass: "bg-green-700 text-white",
    };
  }

  const confirmationDetails = getConfirmationDetails();

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />

          <p className="font-semibold text-green-800 mt-4">
            Loading your orders...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 pb-24">
      <main className="w-full max-w-md mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-br from-green-800 to-green-600 text-white rounded-b-3xl px-4 pt-5 pb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Back to dashboard"
            >
              ←
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={refreshOrders}
              className="bg-white/15 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-5">
            <p className="text-green-100 text-sm">
              Farmer purchases
            </p>

            <h1 className="text-3xl font-bold mt-1">
              🛒 My Orders
            </h1>

            <p className="text-green-100 text-sm mt-2">
              View current orders or browse your order history.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-xl font-bold">{orders.length}</p>
              <p className="text-xs text-green-100 mt-1">
                All Orders
              </p>
            </div>

            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-xl font-bold">
                {counts.active}
              </p>
              <p className="text-xs text-green-100 mt-1">
                Active
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/farmer/history")}
              className="bg-white/20 rounded-xl p-3 text-center hover:bg-white/30"
            >
              <p className="text-xl font-bold">{historyOrders.length}</p>
              <p className="text-xs text-green-100 mt-1">
                History
              </p>
            </button>
          </div>
        </header>

        <div className="px-4">
          {paidOrders.length > 0 && (
            <section className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-5">
              <p className="font-bold text-green-900">
                ✅ Payment completed
              </p>
              <p className="text-sm text-green-800 mt-1">
                {paidOrders.length} paid {paidOrders.length === 1 ? "order is" : "orders are"} stored in your history. They no longer appear in My Orders.
              </p>
              <button
                type="button"
                onClick={() => navigate("/farmer/history")}
                className="mt-3 bg-green-700 text-white px-4 py-2 rounded-xl font-semibold"
              >
                View Order History
              </button>
            </section>
          )}

          {confirmation && confirmationDetails && (
            <section className="bg-white border-2 border-green-200 rounded-2xl shadow-lg p-4 mt-5">
              <div className="flex items-start gap-3">
                <div className="text-3xl">
                  {confirmationDetails.icon}
                </div>

                <div className="flex-1">
                  <h2 className="font-bold text-lg text-gray-900">
                    {confirmationDetails.title}
                  </h2>

                  <p className="text-sm text-gray-600 mt-1">
                    {confirmationDetails.text}
                  </p>

                  <div className="bg-gray-50 rounded-xl p-3 mt-3">
                    <p className="font-bold text-green-900">
                      {confirmation.order.productName ||
                        "Farm Product"}
                    </p>

                    <p className="text-sm text-gray-600 mt-1">
                      {confirmation.order.quantity || 0}{" "}
                      {confirmation.order.unit || "units"}
                    </p>

                    <p className="font-semibold mt-1">
                      {formatMoney(
                        confirmation.order.totalAmount
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      disabled={updatingId === confirmation.order.id}
                      onClick={executeConfirmation}
                      className={`${confirmationDetails.actionClass} min-h-12 rounded-xl font-semibold disabled:bg-gray-400`}
                    >
                      {updatingId === confirmation.order.id
                        ? "Please wait..."
                        : confirmationDetails.actionText}
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(updatingId)}
                      onClick={closeConfirmation}
                      className="border border-gray-300 min-h-12 rounded-xl font-semibold disabled:opacity-50"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="flex gap-2 overflow-x-auto py-5">
            {FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                onClick={() => {
                  setSelectedFilter(filter.value);
                  setExpandedOrderId("");
                }}
                aria-pressed={selectedFilter === filter.value}
                className={`shrink-0 min-h-11 px-4 rounded-full text-sm font-semibold ${
                  selectedFilter === filter.value
                    ? "bg-green-700 text-white"
                    : "bg-white border border-green-200 text-green-800"
                }`}
              >
                {filter.label} ({counts[filter.value]})
              </button>
            ))}
          </section>

          {filteredOrders.length === 0 ? (
            <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="text-6xl">📦</div>

              <h2 className="text-xl font-bold text-green-900 mt-4">
                No orders found
              </h2>

              <p className="text-gray-600 text-sm mt-2">
                {selectedFilter === "history"
                  ? "Completed, cancelled, and rejected orders will appear here."
                  : "Your current orders will appear here."}
              </p>
              {selectedFilter === "active" && <button
                type="button"
                onClick={() => navigate("/farmer/dealer-products")}
                className="w-full bg-green-700 text-white min-h-12 rounded-xl font-semibold mt-5"
              >
                Browse Products
              </button>}
            </section>
          ) : (
            <section className="space-y-4">
              {filteredOrders.map((order) => {
                const status = getStatusDetails(order.status);
                const updating = updatingId === order.id;

                return (
                  <article
                    key={order.id}
                    className="bg-white border border-green-100 rounded-2xl shadow-sm overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold text-green-900 truncate">
                            {order.productName || "Farm Product"}
                          </h2>

                          <p className="text-sm text-gray-500 mt-1 truncate">
                            🏪 {order.dealerName || "Dealer"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Ordered {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <span
                          className={`${status.className} shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold`}
                        >
                          {status.icon} {status.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Quantity
                          </p>

                          <p className="font-bold text-green-900 mt-1">
                            {order.quantity || 0}{" "}
                            {order.unit || "units"}
                          </p>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Total Amount
                          </p>

                          <p className="font-bold text-blue-900 mt-1">
                            {formatMoney(order.totalAmount)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedOrderId((current) => current === order.id ? "" : order.id)}
                        className="mt-3 text-sm font-semibold text-green-700 underline underline-offset-2"
                      >
                          {expandedOrderId === order.id ? "Hide Details" : "View Order Details"}
                      </button>

                      {expandedOrderId === order.id && <div className="mt-3">
                      <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                        <p className="flex justify-between"><span>Product/Subtotal</span><strong>{formatMoney(order.subtotalAmount ?? (Number(order.price || 0) * Number(order.quantity || 0)))}</strong></p>
                        {order.deliveryCharge !== undefined && <p className="flex justify-between"><span>Delivery Charges</span><strong>{formatMoney(order.deliveryCharge)}</strong></p>}
                        <p className="flex justify-between border-t pt-1"><span>Total Amount</span><strong>{formatMoney(order.totalAmount)}</strong></p>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                          <span>Order progress</span>
                          <span>{status.progress}%</span>
                        </div>

                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 rounded-full"
                            style={{
                              width: `${status.progress}%`,
                            }}
                          />
                        </div>

                        <p className="text-sm text-gray-600 mt-2">
                          {status.message}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 mt-4">
                        <p className="text-xs text-gray-500">
                          Ordered on
                        </p>

                        <p className="text-sm font-semibold mt-1">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>

                      {order.deliveryAddress && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-3">
                          <p className="text-xs text-gray-500">
                            Delivery address
                          </p>

                          <p className="text-sm font-semibold mt-1">
                            {order.deliveryAddress}
                          </p>
                        </div>
                      )}

                      <div className="space-y-3 mt-4">
                        {order.dealerPhone &&
                          ![
                            "cancelled",
                            "rejected",
                            "completed",
                          ].includes(order.status) && (
                            <a
                              href={`tel:${order.dealerPhone}`}
                              className="w-full border border-blue-200 bg-blue-50 text-blue-700 min-h-12 rounded-xl font-semibold flex items-center justify-center"
                            >
                              📞 Call Dealer
                            </a>
                          )}

                        {order.status === "pending" && (
                          <button
                            type="button"
                            disabled={updating}
                            onClick={() =>
                              openConfirmation("cancel", order)
                            }
                            className="w-full border border-red-500 text-red-700 min-h-12 rounded-xl font-semibold disabled:opacity-50"
                          >
                            Cancel Order
                          </button>
                        )}

                        {["accepted", "delivered_by_dealer"].includes(order.status) && !order.farmerReceived && (
                            <button
                              type="button"
                              disabled={updating}
                              onClick={() =>
                                openConfirmation("received", order)
                              }
                              className="w-full bg-green-700 text-white min-h-12 rounded-xl font-semibold disabled:bg-gray-400"
                            >
                              📦 Order Received
                            </button>
                          )}

                        {order.status === "completed" && (
                          <div className="bg-green-50 text-green-700 min-h-12 rounded-xl font-bold flex items-center justify-center">
                            ✅ Order Completed
                          </div>
                        )}

                        {order.status === "rejected" && (
                          <div className="bg-red-50 text-red-700 min-h-12 rounded-xl font-bold flex items-center justify-center">
                            ❌ Rejected by Dealer
                          </div>
                        )}

                        {order.status === "cancelled" && (
                          <div className="bg-gray-100 text-gray-700 min-h-12 rounded-xl font-bold flex items-center justify-center">
                            🚫 Order Cancelled
                          </div>
                        )}
                      </div>
                      </div>}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-40">
          <div className="max-w-md mx-auto bg-white border-t border-gray-200 shadow-2xl px-2 py-2">
            <div className="grid grid-cols-5">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex flex-col items-center py-2 text-gray-600"
              >
                <span className="text-xl">🏠</span>
                <span className="text-[11px] font-semibold mt-1">
                  Home
                </span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center py-2 text-green-700"
              >
                <span className="text-xl">🛒</span>
                <span className="text-[11px] font-semibold mt-1">
                  Orders
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/farmer/voice")}
                className="flex flex-col items-center"
              >
                <span className="w-14 h-14 -mt-8 rounded-full bg-green-700 text-white flex items-center justify-center text-2xl shadow-lg border-4 border-green-50">
                  🎤
                </span>

                <span className="text-[11px] font-semibold text-green-700 mt-1">
                  Voice
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/community")}
                className="flex flex-col items-center py-2 text-gray-600"
              >
                <span className="text-xl">👥</span>
                <span className="text-[11px] font-semibold mt-1">
                  Community
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex flex-col items-center py-2 text-gray-600"
              >
                <span className="text-xl">👤</span>
                <span className="text-[11px] font-semibold mt-1">
                  Profile
                </span>
              </button>
            </div>
          </div>
        </nav>
      </main>
    </div>
  );
}
