import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
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

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "orders", label: "Orders" },
  { value: "delivery", label: "Delivery" },
  { value: "payment", label: "Payment" },
];

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const difference = now.getTime() - date.getTime();

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function createOrderNotification(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const statusData = {
    accepted: {
      category: "orders",
      icon: "✅",
      title: "Order accepted",
      text: `${
        order.dealerName || "The dealer"
      } accepted your request for ${
        order.productName || "the product"
      }.`,
      className: "bg-blue-50 border-blue-200",
      date:
        order.dealerAcceptedAt ||
        order.updatedAt ||
        order.createdAt,
    },

    rejected: {
      category: "orders",
      icon: "❌",
      title: "Order rejected",
      text: `${
        order.dealerName || "The dealer"
      } rejected your request for ${
        order.productName || "the product"
      }.`,
      className: "bg-red-50 border-red-200",
      date:
        order.rejectedAt ||
        order.updatedAt ||
        order.createdAt,
    },

    delivered_by_dealer: {
      category: "delivery",
      icon: "🚚",
      title: "Product marked delivered",
      text: `${
        order.dealerName || "The dealer"
      } marked ${
        order.productName || "your product"
      } as delivered.`,
      className: "bg-purple-50 border-purple-200",
      date:
        order.dealerDeliveredAt ||
        order.updatedAt ||
        order.createdAt,
    },

    received_by_farmer: {
      category: "delivery",
      icon: "📦",
      title: "Delivery confirmed",
      text: `You confirmed receiving ${
        order.productName || "the product"
      }.`,
      className: "bg-indigo-50 border-indigo-200",
      date:
        order.farmerReceivedAt ||
        order.updatedAt ||
        order.createdAt,
    },

    payment_received: {
      category: "payment",
      icon: "💵",
      title: "Payment completed",
      text: `${
        order.dealerName || "The dealer"
      } confirmed payment for ${
        order.productName || "your order"
      }. The order is now in Order History.`,
      className: "bg-orange-50 border-orange-200",
      date:
        order.paymentReceivedAt ||
        order.dealerPaymentReceivedAt ||
        order.updatedAt ||
        order.createdAt,
    },

    completed: {
      category: "payment",
      icon: "🎉",
      title: "Order completed",
      text: `Your order for ${
        order.productName || "the product"
      } was completed.`,
      className: "bg-green-50 border-green-200",
      date:
        order.completedAt ||
        order.updatedAt ||
        order.createdAt,
    },

    cancelled: {
      category: "orders",
      icon: "🚫",
      title: "Order cancelled",
      text: `Your request for ${
        order.productName || "the product"
      } was cancelled.`,
      className: "bg-gray-50 border-gray-200",
      date:
        order.cancelledAt ||
        order.updatedAt ||
        order.createdAt,
    },

    canceled: {
      category: "orders",
      icon: "🚫",
      title: "Order cancelled",
      text: `Your request for ${
        order.productName || "the product"
      } was cancelled.`,
      className: "bg-gray-50 border-gray-200",
      date:
        order.cancelledAt ||
        order.updatedAt ||
        order.createdAt,
    },
  };

  const details = statusData[status];

  if (!details) {
    return null;
  }

  return {
    id: `order-${order.id}-${status}`,
    orderId: order.id,
    orderStatus: status,
    ...details,
  };
}

export default function FarmerNotificationsPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      await loadNotifications(user.uid);
    });

    return () => unsubscribe();
  }, [navigate]);

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === "all") {
      return notifications;
    }

    if (selectedFilter === "unread") {
      return notifications.filter(
        (notification) => !notification.read
      );
    }

    return notifications.filter(
      (notification) =>
        notification.category === selectedFilter
    );
  }, [notifications, selectedFilter]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => !notification.read
      ).length,
    [notifications]
  );

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  function getStorageKey(uid) {
    return `farmerNotificationReads_${uid}`;
  }

  function getReadIds(uid) {
    try {
      const saved = localStorage.getItem(
        getStorageKey(uid)
      );
      const parsed = saved ? JSON.parse(saved) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveReadIds(uid, ids) {
    localStorage.setItem(
      getStorageKey(uid),
      JSON.stringify(ids)
    );
    window.dispatchEvent(new Event("farmer-notification-reads-updated"));
  }

  function getDeletedIds(uid) {
    try {
      const saved = localStorage.getItem(
        `farmerNotificationDeletes_${uid}`
      );

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  function saveDeletedIds(uid, ids) {
    localStorage.setItem(
      `farmerNotificationDeletes_${uid}`,
      JSON.stringify(ids)
    );
  }

  async function loadNotifications(uid, isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const userSnapshot = await get(
        ref(database, `users/${uid}`)
      );

      if (
        !userSnapshot.exists() ||
        userSnapshot.val().role !== "farmer"
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
      const orderNotifications = [];

      if (snapshot.exists()) {
        Object.entries(snapshot.val()).forEach(
          ([id, order]) => {
            const notification = createOrderNotification({
              id,
              ...order,
            });

            if (notification) {
              orderNotifications.push(notification);
            }
          }
        );
      }

      const readIds = getReadIds(uid);
      const deletedIds = getDeletedIds(uid);

      const finalNotifications = orderNotifications
        .filter(
          (notification) =>
            !deletedIds.includes(notification.id)
        )
        .sort(
          (first, second) =>
            new Date(second.date || 0) -
            new Date(first.date || 0)
        );

      const updatedReadIds = [
        ...new Set([
          ...readIds,
          ...finalNotifications.map((notification) => notification.id),
        ]),
      ];
      saveReadIds(uid, updatedReadIds);
      setNotifications(
        finalNotifications.map((notification) => ({
          ...notification,
          read: true,
        }))
      );
    } catch (error) {
      console.error(
        "Farmer notifications error:",
        error
      );

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Notification access is blocked by Firebase rules."
          : "Notifications could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshNotifications() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    await loadNotifications(currentUser.uid, true);
  }

  function markAsRead(notificationId) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              read: true,
            }
          : notification
      )
    );

    const readIds = getReadIds(currentUser.uid);

    saveReadIds(currentUser.uid, [
      ...new Set([...readIds, notificationId]),
    ]);
  }

  function markAllRead() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return;
    }

    const allIds = notifications.map(
      (notification) => notification.id
    );

    saveReadIds(currentUser.uid, allIds);

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      }))
    );

    showMessage(
      "success",
      "All notifications were marked as read."
    );
  }

  function deleteNotification(notification) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return;
    }

    const deletedIds = getDeletedIds(currentUser.uid);
    saveDeletedIds(currentUser.uid, [
      ...new Set([...deletedIds, notification.id]),
    ]);
    setNotifications((current) =>
      current.filter((item) => item.id !== notification.id)
    );
    showMessage("success", "Notification deleted.");
  }

  function openNotification(notification) {
    markAsRead(notification.id);

    if (notification.orderId) {
      const orderFilter = ["accepted", "rejected"].includes(notification.orderStatus)
        ? "active"
        : "history";
      navigate(orderFilter === "active" ? "/farmer/orders" : "/farmer/orders?filter=history");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />

          <p className="font-semibold text-green-800 mt-4">
            Loading notifications...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50">
      <main className="w-full px-4 sm:px-6 lg:px-10">
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
              onClick={refreshNotifications}
              className="bg-white/15 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-5">
            <p className="text-green-100 text-sm">
              Farmer updates
            </p>

            <h1 className="text-3xl font-bold mt-1">
              🔔 Notifications
            </h1>

            <p className="text-green-100 text-sm mt-2">
              Order, delivery and payment updates.
            </p>
          </div>

          <div className="flex items-center justify-between bg-white/15 rounded-2xl p-4 mt-5">
            <div>
              <p className="text-3xl font-bold">
                {unreadCount}
              </p>

              <p className="text-xs text-green-100 mt-1">
                Unread notifications
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="bg-white text-green-800 px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                Mark All Read
              </button>
            )}
          </div>
        </header>

        <div className="px-4">
          <section className="flex gap-2 overflow-x-auto py-5">
            {FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                onClick={() =>
                  setSelectedFilter(filter.value)
                }
                className={`shrink-0 min-h-11 px-4 rounded-full text-sm font-semibold ${
                  selectedFilter === filter.value
                    ? "bg-green-700 text-white"
                    : "bg-white border border-green-200 text-green-800"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </section>

          {filteredNotifications.length === 0 ? (
            <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="text-6xl">🔕</div>

              <h2 className="text-xl font-bold text-green-900 mt-4">
                No notifications
              </h2>

              <p className="text-gray-600 text-sm mt-2">
                New order updates will appear here.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/farmer/dealer-products")
                }
                className="w-full bg-green-700 text-white min-h-12 rounded-xl font-semibold mt-5"
              >
                View Dealer Products
              </button>
            </section>
          ) : (
            <section className="space-y-3">
              {filteredNotifications.map(
                (notification) => (
                  <article
                    key={notification.id}
                    className={`w-full text-left border rounded-2xl p-4 shadow-sm active:scale-[0.98] transition ${notification.className} ${
                      notification.read
                        ? "opacity-70"
                        : "ring-2 ring-green-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        openNotification(notification)
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 shrink-0 bg-white/70 rounded-full flex items-center justify-center text-2xl">
                          {notification.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <h2 className="font-bold text-gray-900">
                              {notification.title}
                            </h2>

                            {!notification.read && (
                              <span className="w-3 h-3 shrink-0 bg-green-600 rounded-full mt-1" />
                            )}
                          </div>

                          <p className="text-sm text-gray-700 mt-1">
                            {notification.text}
                          </p>

                          <div className="flex items-center justify-between mt-3">
                            <p className="text-xs text-gray-500">
                              {formatDate(notification.date)}
                            </p>

                            <span className="text-xs font-semibold text-green-700">
                              View order →
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-col gap-2 mt-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="w-full sm:w-auto min-h-10 px-3 rounded-lg border border-green-200 bg-white text-sm font-semibold text-green-800 hover:bg-green-50"
                      >
                        {notification.read ? "View order" : "Mark as read"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNotification(notification)}
                        aria-label={`Delete notification: ${notification.title}`}
                        title="Delete notification"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                )
              )}
            </section>
          )}
        </div>

      </main>
    </div>
  );
}
