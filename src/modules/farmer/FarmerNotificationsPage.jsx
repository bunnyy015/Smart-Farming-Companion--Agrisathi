import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

export default function FarmerNotificationsPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === "all") {
      return notifications;
    }

    return notifications.filter(
      (notification) =>
        notification.category === selectedFilter
    );
  }, [notifications, selectedFilter]);

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

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  function saveReadIds(uid, ids) {
    localStorage.setItem(
      getStorageKey(uid),
      JSON.stringify(ids)
    );
  }

  function createOrderNotification(order) {
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
        } as delivered. Confirm after receiving it.`,
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
        title: "Payment confirmed",
        text: `${
          order.dealerName || "The dealer"
        } confirmed receiving payment for ${
          order.productName || "your order"
        }.`,
        className: "bg-orange-50 border-orange-200",
        date:
          order.dealerPaymentReceivedAt ||
          order.updatedAt ||
          order.createdAt,
      },

      completed: {
        category: "completed",
        icon: "🎉",
        title: "Order completed",
        text: `Your order for ${
          order.productName || "the product"
        } is complete.`,
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
    };

    const details = statusData[order.status];

    if (!details) {
      return null;
    }

    return {
      id: `order-${order.id}-${order.status}`,
      orderId: order.id,
      ...details,
    };
  }

  async function loadNotifications() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const userSnapshot = await get(
        ref(database, `users/${currentUser.uid}`)
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
        equalTo(currentUser.uid)
      );

      const snapshot = await get(ordersQuery);
      const orderNotifications = [];

      if (snapshot.exists()) {
        Object.entries(snapshot.val()).forEach(
          ([id, order]) => {
            const notification =
              createOrderNotification({
                id,
                ...order,
              });

            if (notification) {
              orderNotifications.push(notification);
            }
          }
        );
      }

      const readIds = getReadIds(currentUser.uid);

      const finalNotifications =
        orderNotifications
          .map((notification) => ({
            ...notification,
            read: readIds.includes(
              notification.id
            ),
          }))
          .sort(
            (first, second) =>
              new Date(second.date || 0) -
              new Date(first.date || 0)
          );

      setNotifications(finalNotifications);
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
    }
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
      "All notifications marked as read."
    );
  }

  function openNotification(notification) {
    markAsRead(notification.id);

    if (notification.orderId) {
      navigate("/farmer/orders");
    }
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString("en-IN");
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const filters = [
    { value: "all", label: "All" },
    { value: "orders", label: "Orders" },
    { value: "delivery", label: "Delivery" },
    { value: "payment", label: "Payment" },
    { value: "completed", label: "Completed" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">🔔</div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            Loading notifications
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

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-green-100 font-semibold"
          >
            ← Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                🔔 Notifications
              </h1>

              <p className="text-green-100 mt-1">
                Order and delivery updates.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadNotifications}
                className="bg-white/15 text-white px-4 py-2.5 rounded-xl font-semibold"
              >
                Refresh
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold"
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/15 rounded-xl px-4 py-3 mt-4">
            <strong>{unreadCount}</strong> unread
          </div>
        </header>

        <section className="flex gap-2 overflow-x-auto py-5">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.value}
              onClick={() =>
                setSelectedFilter(filter.value)
              }
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${
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
            <div className="text-5xl">🔕</div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              No notifications
            </h2>

            <p className="text-gray-600 mt-2">
              Order updates will appear here.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {filteredNotifications.map(
              (notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() =>
                    openNotification(notification)
                  }
                  className={`w-full text-left border rounded-2xl p-4 shadow-sm ${notification.className} ${
                    notification.read
                      ? "opacity-70"
                      : "ring-1 ring-green-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {notification.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-bold text-gray-900">
                          {notification.title}
                        </h2>

                        {!notification.read && (
                          <span className="w-2.5 h-2.5 bg-green-600 rounded-full mt-1" />
                        )}
                      </div>

                      <p className="text-sm text-gray-700 mt-1">
                        {notification.text}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(notification.date)}
                      </p>
                    </div>
                  </div>
                </button>
              )
            )}
          </section>
        )}
      </div>
    </div>
  );
}