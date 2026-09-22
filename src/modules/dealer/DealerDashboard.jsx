import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
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

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function getOrderStatusLabel(status) {
  const labels = {
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected",
    cancelled: "Cancelled",
    received_by_farmer: "Received by Farmer",
    payment_received: "Payment Received",
    completed: "Completed",
  };

  return (
    labels[String(status || "").toLowerCase()] ||
    "Processing"
  );
}

function getOrderStatusStyle(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  if (
    normalized === "rejected" ||
    normalized === "cancelled"
  ) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (
    normalized === "payment_received" ||
    normalized === "received_by_farmer"
  ) {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  if (normalized === "accepted") {
    return "bg-cyan-100 text-cyan-700 border-cyan-200";
  }

  return "bg-amber-100 text-amber-700 border-amber-200";
}

export default function DealerDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    pendingOrders: 0,
    acceptedOrders: 0,
    completedSales: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const unreadNotifications = useMemo(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return 0;
    }

    try {
      const saved = localStorage.getItem(
        `dealerNotificationReads_${currentUser.uid}`
      );

      const readIds = saved
        ? JSON.parse(saved)
        : [];

      return notifications.filter(
        (notificationId) =>
          !readIds.includes(notificationId)
      ).length;
    } catch {
      return notifications.length;
    }
  }, [notifications]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setRefreshing(true);
      setMessage(null);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      /*
       * PRODUCTS
       *
       * dealerProducts/{dealerUid}/{productId}
       */

      const productsReference = ref(
        database,
        `dealerProducts/${currentUser.uid}`
      );

      /*
       * ORDERS
       *
       * dealerOrders/{orderId}
       */

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("dealerUid"),
        equalTo(currentUser.uid)
      );

      /*
       * SALES
       *
       * sales/{dealerUid}/{saleId}
       */

      const salesReference = ref(
        database,
        `sales/${currentUser.uid}`
      );

      const [
        productsSnapshot,
        ordersSnapshot,
        salesSnapshot,
      ] = await Promise.all([
        get(productsReference),
        get(ordersQuery),
        get(salesReference),
      ]);

      const products = productsSnapshot.exists()
        ? Object.entries(
            productsSnapshot.val()
          ).map(([id, value]) => ({
            id,
            ...(value || {}),
          }))
        : [];

      const orders = ordersSnapshot.exists()
        ? Object.entries(
            ordersSnapshot.val()
          ).map(([id, value]) => ({
            id,
            ...(value || {}),
          }))
        : [];

      const recordedSales = salesSnapshot.exists()
        ? Object.entries(
            salesSnapshot.val()
          ).map(([id, value]) => ({
            id,
            ...(value || {}),
          }))
        : [];

      /*
       * ORDER COUNTS
       */

      const pendingOrders = orders.filter(
        (order) =>
          String(order.status || "").toLowerCase() ===
          "pending"
      );

      const acceptedOrders = orders.filter(
        (order) =>
          String(order.status || "").toLowerCase() ===
          "accepted"
      );

      const completedOrders = orders.filter(
        (order) =>
          String(order.status || "").toLowerCase() ===
          "completed"
      );

      /*
       * SALES COMPATIBILITY
       *
       * Existing sales records are used first.
       * Older completed orders are included if they
       * do not already have a sales record.
       */

      const recordedOrderIds = new Set(
        recordedSales
          .map((sale) => sale.orderId)
          .filter(Boolean)
      );

      const olderCompletedOrders =
        completedOrders.filter(
          (order) =>
            !recordedOrderIds.has(order.id)
        );

      const recordedRevenue =
        recordedSales.reduce(
          (total, sale) =>
            total +
            Number(
              sale.totalAmount || 0
            ),
          0
        );

      const olderOrderRevenue =
        olderCompletedOrders.reduce(
          (total, order) =>
            total +
            Number(
              order.totalAmount || 0
            ),
          0
        );

      const totalRevenue =
        recordedRevenue +
        olderOrderRevenue;

      /*
       * LOW STOCK
       */

      const lowStockProducts =
        products.filter((product) => {
          const quantity = Number(
            product.quantity || 0
          );

          const lowStockLevel = Number(
            product.lowStockLevel || 5
          );

          return quantity <= lowStockLevel;
        });

      /*
       * RECENT ORDERS
       */

      const sortedOrders = [...orders].sort(
        (a, b) => {
          const dateA = new Date(
            a.updatedAt ||
              a.createdAt ||
              0
          ).getTime();

          const dateB = new Date(
            b.updatedAt ||
              b.createdAt ||
              0
          ).getTime();

          return dateB - dateA;
        }
      );

      setRecentOrders(
        sortedOrders.slice(0, 5)
      );

      /*
       * DASHBOARD STATISTICS
       */

      setStats({
        products: products.length,

        lowStock:
          lowStockProducts.length,

        pendingOrders:
          pendingOrders.length,

        acceptedOrders:
          acceptedOrders.length,

        completedSales:
          recordedSales.length +
          olderCompletedOrders.length,

        totalOrders:
          orders.length,

        totalRevenue,
      });

      /*
       * NOTIFICATIONS
       */

      const notificationIds = [];

      orders.forEach((order) => {
        const notificationStatuses = [
          "pending",
          "cancelled",
          "received_by_farmer",
          "payment_received",
          "completed",
          "accepted",
          "rejected",
        ];

        const status = String(
          order.status || ""
        ).toLowerCase();

        if (
          notificationStatuses.includes(status)
        ) {
          notificationIds.push(
            `order-${order.id}-${status}`
          );
        }
      });

      products.forEach((product) => {
        const quantity = Number(
          product.quantity || 0
        );

        const lowStockLevel = Number(
          product.lowStockLevel || 5
        );

        if (quantity <= lowStockLevel) {
          notificationIds.push(
            `stock-${product.id}-${quantity}`
          );
        }
      });

      setNotifications(notificationIds);
    } catch (error) {
      console.error(
        "Dealer dashboard error:",
        error
      );

      const errorMessage = String(
        error?.message || ""
      ).toLowerCase();

      setMessage({
        type: "error",

        text: errorMessage.includes(
          "permission denied"
        )
          ? "Dashboard access is blocked by Firebase rules."
          : "Dashboard information could not be loaded. Please refresh and try again.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);

      localStorage.removeItem("role");

      navigate("/role-selection", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Dealer logout error:",
        error
      );

      setMessage({
        type: "error",
        text: "Logout failed. Please try again.",
      });
    }
  }

  /*
   * MAIN STAT CARDS
   */

  const statCards = [
    {
      title: "Products",
      value: stats.products,
      icon: "📦",
      description: "Listed products",
      path: "/dealer/products",
      bg: "bg-blue-50",
      border: "border-blue-100",
      valueColor: "text-blue-700",
    },

    {
      title: "Pending Orders",
      value: stats.pendingOrders,
      icon: "🛒",
      description: "Need your attention",
      path: "/dealer/orders",
      bg: "bg-amber-50",
      border: "border-amber-100",
      valueColor: "text-amber-700",
    },

    {
      title: "Low Stock",
      value: stats.lowStock,
      icon: "⚠️",
      description: "Products to restock",
      path: "/dealer/products?filter=low-stock",
      bg: "bg-red-50",
      border: "border-red-100",
      valueColor: "text-red-700",
    },

    {
      title: "Completed Sales",
      value: stats.completedSales,
      icon: "📈",
      description: "Successful sales",
      path: "/dealer/sales",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      valueColor: "text-emerald-700",
    },
  ];

  /*
   * QUICK ACTIONS
   */

  const quickActions = [
    {
      title: "Manage Products",
      description:
        "Add products, update prices and maintain stock.",
      icon: "📦",
      path: "/dealer/products",
      className:
        "bg-blue-600 hover:bg-blue-700",
    },

    {
      title: "Manage Orders",
      description:
        "Review farmer orders and update order status.",
      icon: "🛒",
      path: "/dealer/orders",
      className:
        "bg-cyan-600 hover:bg-cyan-700",
    },

    {
      title: "Sales & Revenue",
      description:
        "View completed sales and your revenue.",
      icon: "💰",
      path: "/dealer/sales",
      className:
        "bg-indigo-600 hover:bg-indigo-700",
    },

    {
      title: "Dealer Profile",
      description:
        "View and manage your dealer information.",
      icon: "👤",
      path: "/dealer/profile",
      className:
        "bg-slate-700 hover:bg-slate-800",
    },
  ];

  return (
    <div className="dealer-theme min-h-screen bg-gradient-to-br from-green-50 via-white to-cyan-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* STATUS MESSAGE */}

        <StatusMessage
          message={message}
          onClose={() =>
            setMessage(null)
          }
        />

        {/* =====================================
            HEADER
        ====================================== */}

        <header className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white rounded-3xl shadow-xl p-6 md:p-8">

          {/* Decorative circles */}

          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full" />

          <div className="absolute -bottom-20 -left-10 w-44 h-44 bg-white/10 rounded-full" />

          <div className="relative">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

              <div className="flex items-center gap-4">

                <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-4xl shadow-lg">
                  🏪
                </div>

                <div>
                  <p className="text-blue-100 text-sm font-semibold uppercase tracking-wide">
                    AgriSaathi Dealer Portal
                  </p>

                  <h1 className="text-3xl md:text-4xl font-bold mt-1">
                    Dealer Dashboard
                  </h1>

                  <p className="text-blue-100 mt-1">
                    Manage products, farmer orders,
                    stock and sales.
                  </p>
                </div>

              </div>

              <div className="flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={loadDashboard}
                  disabled={loading || refreshing}
                  className="bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {refreshing
                    ? "Refreshing..."
                    : "↻ Refresh"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/dealer/notifications"
                    )
                  }
                  className="relative bg-white text-blue-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-50 transition shadow-sm"
                >
                  🔔 Notifications

                  {unreadNotifications > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadNotifications > 99
                        ? "99+"
                        : unreadNotifications}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="border border-white/40 hover:bg-white/10 px-4 py-2.5 rounded-xl font-semibold transition"
                >
                  Logout
                </button>

              </div>

            </div>

            {/* Dealer status strip */}

            <div className="mt-6 flex flex-wrap items-center gap-3">

              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                Dealer Account Active
              </div>

              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-sm">
                📊 {formatNumber(stats.totalOrders)} Total Orders
              </div>

            </div>

          </div>

        </header>

        {/* =====================================
            OVERVIEW
        ====================================== */}

        <section className="mt-6">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">

            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                Business Overview
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Your Store at a Glance
              </h2>
            </div>

            <p className="text-sm text-slate-500">
              Updated from your Firebase data
            </p>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {statCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() =>
                  navigate(card.path)
                }
                className={`group ${card.bg} ${card.border} border rounded-2xl p-5 text-left shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all`}
              >

                <div className="flex items-start justify-between gap-3">

                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {card.title}
                    </p>

                    <p
                      className={`text-3xl md:text-4xl font-bold ${card.valueColor} mt-2`}
                    >
                      {loading
                        ? "—"
                        : formatNumber(
                            card.value
                          )}
                    </p>
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition">
                    {card.icon}
                  </div>

                </div>

                <p className="text-xs text-slate-500 mt-3">
                  {card.description}
                </p>

                <div className="mt-4 text-sm font-semibold text-blue-600">
                  Open →
                </div>

              </button>
            ))}

          </div>

        </section>

        {/* =====================================
            REVENUE + ORDER STATUS
        ====================================== */}

        <section className="grid lg:grid-cols-3 gap-5 mt-6">

          {/* Revenue */}

          <button
            type="button"
            onClick={() =>
              navigate("/dealer/sales")
            }
            className="lg:col-span-2 relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >

            <div className="absolute -right-12 -top-12 w-36 h-36 bg-white/10 rounded-full" />

            <div className="relative">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <p className="text-blue-100 text-sm font-semibold">
                    TOTAL REVENUE
                  </p>

                  <h2 className="text-3xl md:text-4xl font-bold mt-2">
                    {loading
                      ? "—"
                      : formatCurrency(
                          stats.totalRevenue
                        )}
                  </h2>

                  <p className="text-blue-100 text-sm mt-2">
                    Revenue from completed sales
                  </p>

                </div>

                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-4xl">
                  💰
                </div>

              </div>

              <div className="mt-5 inline-flex items-center bg-white/15 border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold">
                View Sales Report →
              </div>

            </div>

          </button>

          {/* Order Status */}

          <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-6">

            <h2 className="text-lg font-bold text-slate-900">
              Order Status
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Current order activity
            </p>

            <div className="space-y-3 mt-5">

              <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <span className="text-sm text-amber-700 font-medium">
                  Pending
                </span>

                <span className="font-bold text-amber-800">
                  {loading
                    ? "—"
                    : stats.pendingOrders}
                </span>
              </div>

              <div className="flex items-center justify-between bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3">
                <span className="text-sm text-cyan-700 font-medium">
                  Accepted
                </span>

                <span className="font-bold text-cyan-800">
                  {loading
                    ? "—"
                    : stats.acceptedOrders}
                </span>
              </div>

              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <span className="text-sm text-emerald-700 font-medium">
                  Completed
                </span>

                <span className="font-bold text-emerald-800">
                  {loading
                    ? "—"
                    : stats.completedSales}
                </span>
              </div>

            </div>

          </div>

        </section>

        {/* =====================================
            QUICK ACTIONS
        ====================================== */}

        <section className="mt-7">

          <div className="mb-4">

            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
              Quick Actions
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Manage Your Business
            </h2>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {quickActions.map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={() =>
                  navigate(action.path)
                }
                className={`${action.className} text-white rounded-2xl p-5 text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all`}
              >

                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl">
                  {action.icon}
                </div>

                <h3 className="text-lg font-bold mt-4">
                  {action.title}
                </h3>

                <p className="text-sm text-white/80 mt-2 leading-5">
                  {action.description}
                </p>

                <div className="mt-4 text-sm font-semibold">
                  Open →
                </div>

              </button>
            ))}

          </div>

        </section>

        {/* =====================================
            RECENT ORDERS
        ====================================== */}

        <section className="bg-white border border-blue-100 rounded-2xl shadow-sm mt-7 overflow-hidden">

          <div className="p-5 md:p-6 border-b border-slate-100">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

              <div>

                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                  Orders
                </p>

                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mt-1">
                  Recent Farmer Orders
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Latest activity from your customers.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  navigate("/dealer/orders")
                }
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold transition"
              >
                View All Orders →
              </button>

            </div>

          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">
              Loading recent orders...
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-8 text-center">

              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mx-auto">
                🛒
              </div>

              <h3 className="text-lg font-bold text-slate-800 mt-4">
                No Orders Yet
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Farmer orders will appear here when they are placed.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {recentOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      "/dealer/orders"
                    )
                  }
                  className="w-full text-left p-5 hover:bg-blue-50/40 transition"
                >

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                    <div className="flex items-start gap-4">

                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
                        📦
                      </div>

                      <div>

                        <p className="font-bold text-slate-900">
                          {order.orderId ||
                            order.id}
                        </p>

                        <p className="text-sm text-slate-600 mt-1">
                          {order.customerName ||
                            order.farmerName ||
                            order.customer ||
                            "Farmer"}
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          {order.productName ||
                            order.product ||
                            "Order"}
                        </p>

                      </div>

                    </div>

                    <div className="flex items-center gap-3">

                      <span
                        className={`border px-3 py-1.5 rounded-full text-xs font-semibold ${getOrderStatusStyle(
                          order.status
                        )}`}
                      >
                        {getOrderStatusLabel(
                          order.status
                        )}
                      </span>

                      <span className="font-bold text-slate-800">
                        {formatCurrency(
                          order.totalAmount
                        )}
                      </span>

                    </div>

                  </div>

                </button>
              ))}

            </div>
          )}

        </section>

        {/* =====================================
            LOW STOCK ALERT
        ====================================== */}

        {stats.lowStock > 0 && (
          <section className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div className="flex items-start gap-3">

                <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-xl">
                  ⚠️
                </div>

                <div>

                  <h2 className="font-bold text-amber-900">
                    Stock Attention Required
                  </h2>

                  <p className="text-sm text-amber-800 mt-1">
                    {stats.lowStock} product
                    {stats.lowStock !== 1
                      ? "s"
                      : ""}{" "}
                    {stats.lowStock !== 1
                      ? "are"
                      : "is"}{" "}
                    at or below the low-stock level.
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                      "/dealer/products?filter=low-stock"
                  )
                }
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-semibold transition"
              >
                Check Stock →
              </button>

            </div>

          </section>
        )}

        {/* =====================================
            FOOTER
        ====================================== */}

        <footer className="text-center py-8 text-sm text-slate-400">
          AgriSaathi Dealer Portal · Smart Farming Companion
        </footer>

      </div>
    </div>
  );
}
