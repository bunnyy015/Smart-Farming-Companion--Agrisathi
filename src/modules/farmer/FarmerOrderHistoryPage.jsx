import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
} from "firebase/database";

import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

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
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function isPaidOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");

  return (
    ["payment received", "completed", "complete", "paid", "payment completed"].includes(status) ||
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
    order.farmerArchived === true ||
    isPaidOrder(order) ||
    Boolean(order.acceptedAt || order.dealerAcceptedAt || order.rejectedAt) ||
    ["accepted", "rejected", "cancelled", "canceled"].includes(status)
  );
}

export default function FarmerOrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      await loadHistory(user.uid);
    });

    return () => unsubscribe();
  }, [navigate]);

  async function loadHistory(uid, refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true);

    try {
      const profileSnapshot = await get(ref(database, `users/${uid}`));

      if (!profileSnapshot.exists() || profileSnapshot.val().role !== "farmer") {
        navigate("/role-selection", { replace: true });
        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(uid)
      );
      const snapshot = await get(ordersQuery);
      const history = snapshot.exists()
        ? Object.entries(snapshot.val())
            .map(([id, value]) => ({ id, ...value }))
            .filter(isHistoryOrder)
            .sort(
              (first, second) =>
                new Date(
                  second.paymentReceivedAt ||
                    second.dealerPaymentReceivedAt ||
                    second.completedAt ||
                    second.farmerArchivedAt ||
                    second.cancelledAt ||
                    second.updatedAt ||
                    second.createdAt ||
                    0
                ) -
                new Date(
                  first.paymentReceivedAt ||
                    first.dealerPaymentReceivedAt ||
                    first.completedAt ||
                    first.farmerArchivedAt ||
                    first.cancelledAt ||
                    first.updatedAt ||
                    first.createdAt ||
                    0
                )
            )
        : [];

      setOrders(history);
    } catch (error) {
      console.error("Farmer order history error:", error);
      setMessage({
        type: "error",
        text: String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Order history access is blocked by Firebase rules."
          : "Your order history could not be loaded.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshHistory() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    await loadHistory(currentUser.uid, true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
          <p className="font-semibold text-green-800 mt-4">Loading order history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 pb-8">
      <main className="w-full max-w-2xl mx-auto px-4">
        <StatusMessage message={message} onClose={() => setMessage(null)} />

        <header className="bg-gradient-to-br from-green-800 to-green-600 text-white rounded-b-3xl px-4 pt-5 pb-6 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("/farmer/orders")}
              className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Back to My Orders"
            >
              ←
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={refreshHistory}
              className="bg-white/15 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <p className="text-green-100 text-sm mt-5">Farmer purchases</p>
          <h1 className="text-3xl font-bold mt-1">🧾 Order History</h1>
          <p className="text-green-100 text-sm mt-2">
            Accepted, rejected, and cancelled orders, plus paid orders, are kept here automatically.
          </p>
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-xl px-4 py-3 mt-4">
            <span className="text-2xl font-bold">{orders.length}</span>
            <span className="text-sm text-green-100">orders in history</span>
          </div>
        </header>

        {orders.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 mt-5 text-center">
            <div className="text-6xl">🧾</div>
            <h2 className="text-xl font-bold text-green-900 mt-4">No orders in history yet</h2>
            <p className="text-gray-600 text-sm mt-2">
              When an order is accepted, rejected, cancelled, or paid, it will appear here automatically.
            </p>
            <button
              type="button"
              onClick={() => navigate("/farmer/orders")}
              className="w-full bg-green-700 text-white min-h-12 rounded-xl font-semibold mt-5"
            >
              Go to My Orders
            </button>
          </section>
        ) : (
          <section className="space-y-4 mt-5">
            {orders.map((order) => {
              const normalizedStatus = String(
                order.status || order.orderStatus || ""
              )
                .trim()
                .toLowerCase()
                .replaceAll("_", " ");
              const completed = ["completed", "complete"].includes(
                normalizedStatus
              );
              const paid = isPaidOrder(order);
              const archivedStatus = normalizedStatus
                ? normalizedStatus.replace(/^\w/, (character) => character.toUpperCase())
                : "Order";

              return (
                <article
                  key={order.id}
                  className="bg-white border border-green-100 rounded-2xl shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-green-900 truncate">
                        {order.productName || "Farm Product"}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        🏪 {order.dealerName || "Dealer"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${paid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
                      {paid
                        ? `✅ ${completed ? "Completed" : "Payment completed"}`
                        : `🗂️ ${archivedStatus} · History`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Quantity</p>
                      <p className="font-bold text-green-900 mt-1">
                        {order.quantity || 0} {order.unit || "units"}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">{paid ? "Total paid" : "Order total"}</p>
                      <p className="font-bold text-blue-900 mt-1">
                        {formatMoney(order.totalAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 mt-3">
                    <p className="text-xs text-gray-500">
                      {paid ? "Payment confirmed" : "Moved to history"}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {formatDate(
                        (paid &&
                          (order.paymentReceivedAt ||
                            order.dealerPaymentReceivedAt ||
                            order.completedAt)) ||
                          order.farmerArchivedAt ||
                          order.cancelledAt ||
                          order.updatedAt ||
                          order.createdAt
                      )}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
