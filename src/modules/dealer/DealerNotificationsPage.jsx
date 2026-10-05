import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import "./DealerTheme.css";

export default function DealerNotificationsPage() {
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

  function getReadStorageKey(uid) {
    return `dealerNotificationReads_${uid}`;
  }

  function getReadNotificationIds(uid) {
    try {
      const saved = localStorage.getItem(
        getReadStorageKey(uid)
      );
      const parsed = saved ? JSON.parse(saved) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveReadNotificationIds(uid, ids) {
    localStorage.setItem(
      getReadStorageKey(uid),
      JSON.stringify(ids)
    );
    window.dispatchEvent(new Event("dealer-notification-reads-updated"));
  }

  function getDeletedNotificationIds(uid) {
    try {
      const saved = localStorage.getItem(
        `dealerNotificationDeletes_${uid}`
      );
      const parsed = saved ? JSON.parse(saved) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveDeletedNotificationIds(uid, ids) {
    localStorage.setItem(
      `dealerNotificationDeletes_${uid}`,
      JSON.stringify(ids)
    );
  }

  function createOrderNotification(order) {
    const status = String(order.status || order.orderStatus || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    const statusMap = {
      pending: {
        category: "orders",
        icon: "🛒",
        title: "New farmer order",
        text: `${order.farmerName || "A farmer"} requested ${
          order.quantity || 0
        } ${order.unit || "units"} of ${
          order.productName || "a product"
        }.`,
        color: "bg-yellow-50 border-yellow-200",
        date: order.createdAt,
      },

      accepted: {
        category: "orders",
        icon: "✅",
        title: "Order accepted",
        text: `You accepted ${order.farmerName || "the farmer"}'s request for ${
          order.productName || "the product"
        }.`,
        color: "bg-blue-50 border-blue-200",
        date: order.acceptedAt || order.updatedAt || order.createdAt,
      },

      rejected: {
        category: "orders",
        icon: "❌",
        title: "Order rejected",
        text: `You rejected ${order.farmerName || "the farmer"}'s request for ${
          order.productName || "the product"
        }.`,
        color: "bg-red-50 border-red-200",
        date: order.rejectedAt || order.updatedAt || order.createdAt,
      },

      cancelled: {
        category: "orders",
        icon: "🚫",
        title: "Order cancelled",
        text: `${order.farmerName || "The farmer"} cancelled the order for ${
          order.productName || "a product"
        }.`,
        color: "bg-gray-50 border-gray-200",
        date:
          order.cancelledAt ||
          order.updatedAt ||
          order.createdAt,
      },

      canceled: {
        category: "orders",
        icon: "🚫",
        title: "Order cancelled",
        text: `${order.farmerName || "The farmer"} cancelled the order for ${
          order.productName || "a product"
        }.`,
        color: "bg-gray-50 border-gray-200",
        date:
          order.cancelledAt ||
          order.updatedAt ||
          order.createdAt,
      },

      received_by_farmer: {
        category: "delivery",
        icon: "📦",
        title: "Farmer received product",
        text: `${order.farmerName || "The farmer"} confirmed receiving ${
          order.productName || "the product"
        }.`,
        color: "bg-blue-50 border-blue-200",
        date:
          order.farmerReceivedAt ||
          order.updatedAt ||
          order.createdAt,
      },

      delivered_by_dealer: {
        category: "delivery",
        icon: "🚚",
        title: "Product marked delivered",
        text: `You marked ${order.productName || "the product"} as delivered to ${
          order.farmerName || "the farmer"
        }.`,
        color: "bg-purple-50 border-purple-200",
        date: order.deliveredAt || order.updatedAt || order.createdAt,
      },

      payment_received: {
        category: "payment",
        icon: "💵",
        title: "Order ready to complete",
        text: `Delivery and payment confirmation are available for ${
          order.productName || "this order"
        }.`,
        color: "bg-orange-50 border-orange-200",
        date:
          order.dealerPaymentReceivedAt ||
          order.updatedAt ||
          order.createdAt,
      },

      completed: {
        category: "sales",
        icon: "✅",
        title: "Sale completed",
        text: `The sale of ${
          order.productName || "the product"
        } was completed successfully.`,
        color: "bg-green-50 border-green-200",
        date:
          order.completedAt ||
          order.updatedAt ||
          order.createdAt,
      },
    };

    const details = statusMap[status];

    if (!details) {
      return null;
    }

    return {
      id: `order-${order.id}-${status}`,
      orderId: order.id,
      ...details,
    };
  }

  function createLowStockNotification(product) {
    const available = Number(product.quantity || 0);
    const lowStockLevel = Number(
      product.lowStockLevel || 5
    );

    if (available > lowStockLevel) {
      return null;
    }

    return {
      id: `stock-${product.id}-${available}`,
      productId: product.id,
      category: "stock",
      icon: available === 0 ? "❌" : "⚠️",
      title:
        available === 0
          ? "Product out of stock"
          : "Low stock warning",
      text: `${product.productName || "Product"} has ${available} ${
        product.unit || "units"
      } remaining.`,
      color:
        available === 0
          ? "bg-red-50 border-red-200"
          : "bg-yellow-50 border-yellow-200",
      date:
        product.updatedAt ||
        product.createdAt ||
        new Date().toISOString(),
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
        userSnapshot.val().role !== "dealer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });
        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("dealerUid"),
        equalTo(currentUser.uid)
      );

      const [ordersSnapshot, productsSnapshot] =
        await Promise.all([
          get(ordersQuery),
          get(
            ref(
              database,
              `dealerProducts/${currentUser.uid}`
            )
          ),
        ]);

      const orderNotifications = [];

      if (ordersSnapshot.exists()) {
        Object.entries(ordersSnapshot.val()).forEach(
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

      const stockNotifications = [];

      if (productsSnapshot.exists()) {
        Object.entries(productsSnapshot.val()).forEach(
          ([id, product]) => {
            const notification =
              createLowStockNotification({
                id,
                ...product,
              });

            if (notification) {
              stockNotifications.push(notification);
            }
          }
        );
      }

      const deletedIds = getDeletedNotificationIds(
        currentUser.uid
      );

      const combinedNotifications = [
        ...orderNotifications,
        ...stockNotifications,
      ]
        .filter(
          (notification) => !deletedIds.includes(notification.id)
        )
        .sort(
          (first, second) =>
            new Date(second.date || 0) -
            new Date(first.date || 0)
        );

      const readIds = [
        ...new Set([
          ...getReadNotificationIds(currentUser.uid),
          ...combinedNotifications.map((notification) => notification.id),
        ]),
      ];
      saveReadNotificationIds(currentUser.uid, readIds);
      setNotifications(
        combinedNotifications.map((notification) => ({
          ...notification,
          read: true,
        }))
      );
    } catch (error) {
      console.error(
        "Dealer notifications error:",
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

    const currentIds = getReadNotificationIds(
      currentUser.uid
    );

    const updatedIds = [
      ...new Set([...currentIds, notificationId]),
    ];

    saveReadNotificationIds(
      currentUser.uid,
      updatedIds
    );
  }

  function markAllAsRead() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return;
    }

    const allIds = notifications.map(
      (notification) => notification.id
    );

    saveReadNotificationIds(
      currentUser.uid,
      allIds
    );

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

  function deleteNotification(notification) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return;
    }

    const deletedIds = getDeletedNotificationIds(currentUser.uid);
    saveDeletedNotificationIds(currentUser.uid, [
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
      navigate("/dealer/orders");
      return;
    }

    if (notification.productId) {
      navigate("/dealer/products");
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
    { value: "stock", label: "Stock" },
    { value: "sales", label: "Sales" },
  ];

  if (loading) {
    return (
      <div className="dealer-theme min-h-screen bg-green-50 flex items-center justify-center p-4">
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
    <div className="dealer-theme min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() => navigate("/dealer")}
            className="text-green-100 font-semibold"
          >
            ← Dealer Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                🔔 Notifications
              </h1>

              <p className="text-green-100 mt-1">
                Orders, delivery, payment and stock updates.
              </p>
            </div>

            <div className="flex gap-2">
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
                  onClick={markAllAsRead}
                  className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold"
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/15 rounded-xl px-4 py-3 mt-4">
            <strong>{unreadCount}</strong> unread notifications
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
              New order and stock updates will appear here.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {filteredNotifications.map(
              (notification) => (
                <article
                  key={notification.id}
                  className={`flex items-start gap-3 border rounded-2xl p-4 shadow-sm transition ${notification.color} ${
                    notification.read
                      ? "opacity-70"
                      : "ring-1 ring-green-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className="text-2xl">
                      {notification.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-bold text-gray-900">
                          {notification.title}
                        </h2>

                        {!notification.read && (
                          <span className="w-2.5 h-2.5 bg-green-600 rounded-full shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-sm text-gray-700 mt-1">
                        {notification.text}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(notification.date)}
                      </p>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteNotification(notification)}
                    aria-label={`Delete notification: ${notification.title}`}
                    title="Delete notification"
                    className="shrink-0 rounded-lg border border-red-200 bg-white/80 p-2 text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </article>
              )
            )}
          </section>
        )}
      </div>
    </div>
  );
}
