import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  equalTo,
  get,
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
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function FarmerOrdersPage() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    if (selectedFilter === "all") {
      return orders;
    }

    if (selectedFilter === "active") {
      return orders.filter((order) =>
        [
          "pending",
          "accepted",
          "delivered_by_dealer",
          "received_by_farmer",
          "payment_received",
        ].includes(order.status)
      );
    }

    if (selectedFilter === "completed") {
      return orders.filter(
        (order) => order.status === "completed"
      );
    }

    return orders.filter((order) =>
      ["cancelled", "rejected"].includes(order.status)
    );
  }, [orders, selectedFilter]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadOrders() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(currentUser.uid)
      );

      const snapshot = await get(ordersQuery);

      if (!snapshot.exists()) {
        setOrders([]);
        return;
      }

      const orderList = Object.entries(snapshot.val())
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort(
          (first, second) =>
            new Date(second.createdAt || 0) -
            new Date(first.createdAt || 0)
        );

      setOrders(orderList);
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
    }
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
        "Only pending orders can be cancelled."
      );
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
      showMessage("success", "Order request cancelled.");

      await loadOrders();
    } catch (error) {
      console.error("Cancel order error:", error);

      showMessage(
        "error",
        "Order could not be cancelled."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function confirmProductReceived(order) {
    if (
      ![
        "delivered_by_dealer",
        "payment_received",
      ].includes(order.status)
    ) {
      showMessage(
        "warning",
        "The dealer must mark the order as delivered first."
      );
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

          status: order.dealerPaymentReceived
            ? "payment_received"
            : "received_by_farmer",

          updatedAt: now,
        }
      );

      setConfirmation(null);

      showMessage(
        "success",
        "Product received confirmation sent to the dealer."
      );

      await loadOrders();
    } catch (error) {
      console.error(
        "Farmer delivery confirmation error:",
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

    if (confirmation.type === "received") {
      confirmProductReceived(confirmation.order);
    }
  }

  function getStatusDetails(status) {
    const statuses = {
      pending: {
        icon: "⏳",
        label: "Waiting for Dealer",
        className: "bg-yellow-100 text-yellow-800",
        progress: 20,
      },

      accepted: {
        icon: "✅",
        label: "Accepted by Dealer",
        className: "bg-blue-100 text-blue-800",
        progress: 45,
      },

      delivered_by_dealer: {
        icon: "🚚",
        label: "Delivered by Dealer",
        className: "bg-purple-100 text-purple-800",
        progress: 70,
      },

      received_by_farmer: {
        icon: "📦",
        label: "Product Received",
        className: "bg-indigo-100 text-indigo-800",
        progress: 85,
      },

      payment_received: {
        icon: "💵",
        label: "Payment Confirmed",
        className: "bg-orange-100 text-orange-800",
        progress: 90,
      },

      completed: {
        icon: "🎉",
        label: "Completed",
        className: "bg-green-100 text-green-800",
        progress: 100,
      },

      rejected: {
        icon: "❌",
        label: "Rejected by Dealer",
        className: "bg-red-100 text-red-800",
        progress: 0,
      },

      cancelled: {
        icon: "🚫",
        label: "Cancelled",
        className: "bg-gray-100 text-gray-700",
        progress: 0,
      },
    };

    return (
      statuses[status] || {
        icon: "ℹ️",
        label: status || "Pending",
        className: "bg-gray-100 text-gray-700",
        progress: 0,
      }
    );
  }

  function confirmationDetails() {
    if (!confirmation) {
      return null;
    }

    if (confirmation.type === "cancel") {
      return {
        icon: "🚫",
        title: "Cancel this order?",
        text: "The dealer will no longer process this request.",
        buttonText: "Cancel Order",
        buttonClass: "bg-red-600 text-white",
      };
    }

    return {
      icon: "📦",
      title: "Did you receive the product?",
      text: "Confirm only after the product has been delivered to you.",
      buttonText: "Yes, I Received It",
      buttonClass: "bg-green-700 text-white",
    };
  }

  const confirmationInfo = confirmationDetails();

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">🛒</div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            Loading your orders
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {confirmation && confirmationInfo && (
          <section className="bg-white border border-gray-200 rounded-2xl shadow-lg p-5 mb-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {confirmationInfo.icon}
              </span>

              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">
                  {confirmationInfo.title}
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  {confirmationInfo.text}
                </p>

                <div className="bg-gray-50 rounded-xl p-3 mt-3">
                  <p className="font-semibold text-green-900">
                    {confirmation.order.productName}
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    {confirmation.order.quantity}{" "}
                    {confirmation.order.unit || "units"} • ₹
                    {Number(
                      confirmation.order.totalAmount || 0
                    ).toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    type="button"
                    disabled={
                      updatingId === confirmation.order.id
                    }
                    onClick={executeConfirmation}
                    className={`${confirmationInfo.buttonClass} px-4 py-2.5 rounded-xl font-semibold disabled:bg-gray-400`}
                  >
                    {updatingId === confirmation.order.id
                      ? "Please wait..."
                      : confirmationInfo.buttonText}
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(updatingId)}
                    onClick={closeConfirmation}
                    className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-green-100 font-semibold"
          >
            ← Dashboard
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                🛒 My Orders
              </h1>

              <p className="text-green-100 mt-1">
                Track requests, delivery and payment.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/farmer/dealer-products")
              }
              className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold"
            >
              Buy Products
            </button>
          </div>
        </header>

        <section className="flex gap-2 overflow-x-auto py-5">
          {FILTERS.map((filter) => {
            const active =
              selectedFilter === filter.value;

            return (
              <button
                type="button"
                key={filter.value}
                onClick={() =>
                  setSelectedFilter(filter.value)
                }
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${
                  active
                    ? "bg-green-700 text-white"
                    : "bg-white border border-green-200 text-green-800"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </section>

        {filteredOrders.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">📦</div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              No orders found
            </h2>

            <p className="text-gray-600 mt-2">
              Your product requests will appear here.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate("/farmer/dealer-products")
              }
              className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold mt-5"
            >
              View Products
            </button>
          </section>
        ) : (
          <section className="space-y-4">
            {filteredOrders.map((order) => {
              const status = getStatusDetails(
                order.status
              );

              const updating =
                updatingId === order.id;

              return (
                <article
                  key={order.id}
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-green-900">
                        {order.productName ||
                          "Farm Product"}
                      </h2>

                      <p className="text-sm text-gray-500 mt-1">
                        🏪 {order.dealerName || "Dealer"}
                      </p>

                      <p className="text-sm text-gray-600 mt-2">
                        📦 {order.quantity || 0}{" "}
                        {order.unit || "units"}
                      </p>

                      <p className="font-bold text-gray-900 mt-1">
                        ₹
                        {Number(
                          order.totalAmount || 0
                        ).toFixed(2)}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        {order.createdAt
                          ? new Date(
                              order.createdAt
                            ).toLocaleString()
                          : ""}
                      </p>
                    </div>

                    <span
                      className={`${status.className} px-3 py-1.5 rounded-full text-sm font-semibold self-start`}
                    >
                      {status.icon} {status.label}
                    </span>
                  </div>

                  {![
                    "rejected",
                    "cancelled",
                  ].includes(order.status) && (
                    <div className="mt-5">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 rounded-full transition-all"
                          style={{
                            width: `${status.progress}%`,
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-4 text-center text-xs text-gray-500 mt-2">
                        <span>Requested</span>
                        <span>Accepted</span>
                        <span>Delivered</span>
                        <span>Completed</span>
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3 mt-5 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Payment
                      </p>

                      <p className="font-semibold mt-1">
                        {order.paymentMode ||
                          "Cash on Delivery"}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Delivery Address
                      </p>

                      <p className="font-semibold mt-1">
                        {order.deliveryAddress ||
                          "Address not added"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-5">
                    {order.dealerPhone &&
                      ![
                        "rejected",
                        "cancelled",
                      ].includes(order.status) && (
                        <a
                          href={`tel:${order.dealerPhone}`}
                          className="border border-blue-200 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl font-semibold"
                        >
                          📞 Call Dealer
                        </a>
                      )}

                    {order.status === "pending" && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          openConfirmation(
                            "cancel",
                            order
                          )
                        }
                        className="border border-red-600 text-red-700 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                      >
                        Cancel Order
                      </button>
                    )}

                    {[
                      "delivered_by_dealer",
                      "payment_received",
                    ].includes(order.status) &&
                      !order.farmerReceived && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() =>
                            openConfirmation(
                              "received",
                              order
                            )
                          }
                          className="bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold disabled:bg-gray-400"
                        >
                          I Received Product
                        </button>
                      )}

                    {order.status === "completed" && (
                      <span className="bg-green-50 text-green-700 px-4 py-2.5 rounded-xl font-bold">
                        ✅ Order Completed
                      </span>
                    )}

                    {order.status === "rejected" && (
                      <span className="bg-red-50 text-red-700 px-4 py-2.5 rounded-xl font-bold">
                        Rejected by Dealer
                      </span>
                    )}

                    {order.status === "cancelled" && (
                      <span className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold">
                        Order Cancelled
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}