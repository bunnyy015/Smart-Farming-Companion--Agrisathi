import { useEffect, useMemo, useRef, useState } from "react";
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);
  const longPressTimer = useRef(null);
  const suppressNotificationClick = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(longPressTimer.current);
      suppressNotificationClick.current = false;
      setSelectionMode(false);
      setSelectedNotificationIds([]);
      setDeleteConfirmation(false);

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

  useEffect(() => () => clearTimeout(longPressTimer.current), []);

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
      const parsed = saved ? JSON.parse(saved) : [];

      return Array.isArray(parsed) ? parsed : [];
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
    cancelSelection();
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

  function toggleNotificationSelection(notification) {
    setSelectionMode(true);
    setSelectedNotificationIds((currentIds) =>
      currentIds.includes(notification.id)
        ? currentIds.filter((id) => id !== notification.id)
        : [...currentIds, notification.id]
    );
  }

  function startNotificationLongPress(notification) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      suppressNotificationClick.current = true;
      setSelectionMode(true);
      setSelectedNotificationIds((currentIds) =>
        currentIds.includes(notification.id)
          ? currentIds
          : [...currentIds, notification.id]
      );
    }, 600);
  }

  function stopNotificationLongPress() {
    clearTimeout(longPressTimer.current);
  }

  function handleNotificationCardClick(notification, event) {
    if (suppressNotificationClick.current) {
      suppressNotificationClick.current = false;
      event.preventDefault();
      return;
    }

    if (
      selectionMode &&
      !event.target.closest?.("button, a, input, select, textarea")
    ) {
      toggleNotificationSelection(notification);
    }
  }

  function handleNotificationAction(notification, event) {
    if (suppressNotificationClick.current) {
      suppressNotificationClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (selectionMode) {
      event.preventDefault();
      event.stopPropagation();
      toggleNotificationSelection(notification);
      return;
    }

    event.stopPropagation();
    openNotification(notification);
  }

  function cancelSelection() {
    clearTimeout(longPressTimer.current);
    setSelectionMode(false);
    setSelectedNotificationIds([]);
    setDeleteConfirmation(false);
  }

  function deleteSelectedNotifications() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      showMessage("error", "Sign in again to delete notifications.");
      return;
    }

    const selectedIds = notifications
      .filter((notification) =>
        selectedNotificationIds.includes(notification.id)
      )
      .map((notification) => notification.id);

    if (selectedIds.length === 0) {
      setDeleteConfirmation(false);
      return;
    }

    try {
      const deletedIds = getDeletedIds(currentUser.uid);
      saveDeletedIds(currentUser.uid, [
        ...new Set([...deletedIds, ...selectedIds]),
      ]);
      setNotifications((current) =>
        current.filter((notification) => !selectedIds.includes(notification.id))
      );
      setDeleteConfirmation(false);
      setSelectionMode(false);
      setSelectedNotificationIds([]);
      showMessage(
        "success",
        selectedIds.length === 1
          ? "Notification deleted."
          : "Selected notifications deleted."
      );
    } catch (error) {
      console.error("Farmer notification deletion error:", error);
      showMessage("error", "The selected notifications could not be deleted.");
    }
  }

  function openNotification(notification) {
    if (!selectionMode) {
      markAsRead(notification.id);
    }

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
          {selectionMode && (
            <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/15 p-3">
              <button
                type="button"
                onClick={cancelSelection}
                className="min-h-11 rounded-xl px-3 font-semibold hover:bg-white/10"
              >
                Cancel
              </button>
              <span className="font-bold">
                {selectedNotificationIds.length} selected
              </span>
              {selectedNotificationIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(true)}
                  className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              )}
            </section>
          )}
        </header>

        <div className="px-4">
          <section className="flex gap-2 overflow-x-auto py-5">
            {FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                onClick={() => {
                  if (selectedFilter !== filter.value) cancelSelection();
                  setSelectedFilter(filter.value);
                }}
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
            <section className="divide-y divide-green-100 overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
              {filteredNotifications.map(
                (notification) => (
                  <article
                    key={notification.id}
                    onClick={(event) =>
                      handleNotificationCardClick(notification, event)
                    }
                    onMouseDown={(event) =>
                      startNotificationLongPress(notification, event)
                    }
                    onMouseUp={stopNotificationLongPress}
                    onMouseLeave={stopNotificationLongPress}
                    onTouchStart={(event) =>
                      startNotificationLongPress(notification, event)
                    }
                    onTouchEnd={stopNotificationLongPress}
                    onTouchMove={stopNotificationLongPress}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectionMode(true);
                      setSelectedNotificationIds((currentIds) =>
                        currentIds.includes(notification.id)
                          ? currentIds
                          : [...currentIds, notification.id]
                      );
                    }}
                    className={`w-full text-left transition select-none touch-manipulation ${
                      selectedNotificationIds.includes(notification.id)
                          ? "bg-green-50 ring-2 ring-inset ring-green-500"
                        : notification.read
                            ? "bg-white"
                            : "bg-green-50/60"
                    } ${
                      selectionMode ? "cursor-pointer" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(event) =>
                        handleNotificationAction(notification, event)
                      }
                      className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-lg">
                        {notification.icon}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-semibold text-gray-900">
                          {notification.title}
                        </span>
                        <span className="text-gray-500"> — </span>
                        <span className="text-gray-700">
                          {notification.text}
                        </span>
                      </span>

                      {!notification.read && (
                        <span
                          aria-label="Unread"
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-600"
                        />
                      )}
                      {selectedNotificationIds.includes(notification.id) && (
                        <span
                          aria-label="Selected"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white"
                        >
                          ✓
                        </span>
                      )}
                      <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">
                        {formatDate(notification.date)}
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-green-700">
                        →
                      </span>
                    </button>

                    <span className="sr-only">
                      {notification.read ? "Read notification" : "Unread notification"}
                    </span>
                  </article>
                )
              )}
            </section>
          )}
        </div>

        {deleteConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="farmer-delete-notifications-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h2
                id="farmer-delete-notifications-title"
                className="text-xl font-bold text-gray-900"
              >
                {selectedNotificationIds.length === 1
                  ? "Delete this notification?"
                  : `Delete ${selectedNotificationIds.length} selected notifications?`}
              </h2>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(false)}
                  className="min-h-11 rounded-xl border border-gray-300 px-4 font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedNotifications}
                  className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </section>
          </div>
        )}

      </main>
    </div>
  );
}
