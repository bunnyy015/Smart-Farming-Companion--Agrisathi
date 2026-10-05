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

/* =========================================================
   HELPERS
========================================================= */

function formatCurrency(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return number.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatNumber(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString("en-IN");
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function DealerDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    completedSales: 0,
    totalRevenue: 0,
  });

  const [notifications, setNotifications] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState(null);

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  const unreadNotifications = useMemo(() => {
    return notifications.filter(
      (notificationId) => !readNotificationIds.includes(notificationId)
    ).length;
  }, [notifications, readNotificationIds]);

  useEffect(() => {
    function refreshReadNotificationIds() {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setReadNotificationIds([]);
        return;
      }

      try {
        const saved = localStorage.getItem(
          `dealerNotificationReads_${currentUser.uid}`
        );
        const parsed = saved ? JSON.parse(saved) : [];
        setReadNotificationIds(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error("Dealer notification read state error:", error);
        setReadNotificationIds([]);
      }
    }

    function handleStorageChange(event) {
      const currentUser = auth.currentUser;
      if (
        currentUser &&
        event.key === `dealerNotificationReads_${currentUser.uid}`
      ) {
        refreshReadNotificationIds();
      }
    }

    refreshReadNotificationIds();
    window.addEventListener(
      "dealer-notification-reads-updated",
      refreshReadNotificationIds
    );
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "dealer-notification-reads-updated",
        refreshReadNotificationIds
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  useEffect(() => {
    loadDashboard();
  }, []);

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

      /* ===================================================
         PRODUCTS
         dealerProducts/{dealerUid}/{productId}
      =================================================== */

      const productsReference = ref(
        database,
        `dealerProducts/${currentUser.uid}`
      );

      /* ===================================================
         ORDERS
         dealerOrders/{orderId}
      =================================================== */

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("dealerUid"),
        equalTo(currentUser.uid)
      );

      /* ===================================================
         SALES
         sales/{dealerUid}/{saleId}
      =================================================== */

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

      /* ===================================================
         PRODUCTS DATA
      =================================================== */

      const products = productsSnapshot.exists()
        ? Object.entries(
            productsSnapshot.val()
          ).map(([id, value]) => ({
            id,
            ...(value || {}),
          }))
        : [];

      /* ===================================================
         ORDERS DATA
      =================================================== */

      const orders = ordersSnapshot.exists()
        ? Object.entries(
            ordersSnapshot.val()
          ).map(([id, value]) => ({
            id,
            ...(value || {}),
          }))
        : [];

      /* ===================================================
         SALES DATA
      =================================================== */

      const recordedSales = salesSnapshot.exists()
        ? Object.entries(
            salesSnapshot.val()
          ).map(([id, value]) => ({
            id,
            ...(value || {}),
          }))
        : [];

      const completedOrders = orders.filter(
        (order) =>
          String(order.status || "")
            .toLowerCase() === "completed"
      );

      /* ===================================================
         SALES COMPATIBILITY
      =================================================== */

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

      /* ===================================================
         LOW STOCK
      =================================================== */

      const lowStockProducts =
        products.filter((product) => {
          const quantity = Number(
            product.quantity || 0
          );

          const lowStockLevel = Number(
            product.lowStockLevel || 5
          );

          return (
            quantity <=
            lowStockLevel
          );
        });

      /* ===================================================
         DASHBOARD STATISTICS
      =================================================== */

      setStats({
        products: products.length,

        lowStock:
          lowStockProducts.length,

        completedSales:
          recordedSales.length +
          olderCompletedOrders.length,

        totalRevenue,
      });

      /* ===================================================
         NOTIFICATIONS
      =================================================== */

      const notificationIds = [];
      const notificationStatuses = new Set([
        "pending",
        "cancelled",
        "canceled",
        "received_by_farmer",
        "payment_received",
        "completed",
        "accepted",
        "rejected",
        "delivered_by_dealer",
      ]);

      orders.forEach((order) => {
        const status = String(
          order.status || order.orderStatus || ""
        )
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");

        if (notificationStatuses.has(status)) {
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

        if (
          quantity <=
          lowStockLevel
        ) {
          notificationIds.push(
            `stock-${product.id}-${quantity}`
          );
        }
      });

      const deletedNotificationIds = new Set();
      try {
        const savedDeletedIds = localStorage.getItem(
          `dealerNotificationDeletes_${currentUser.uid}`
        );
        const parsedDeletedIds = savedDeletedIds
          ? JSON.parse(savedDeletedIds)
          : [];
        if (Array.isArray(parsedDeletedIds)) {
          parsedDeletedIds.forEach((id) => deletedNotificationIds.add(id));
        }
      } catch (error) {
        console.error("Dealer notification deletion state error:", error);
      }

      setNotifications(
        notificationIds.filter((id) => !deletedNotificationIds.has(id))
      );
    } catch (error) {
      console.error(
        "Dealer dashboard error:",
        error
      );

      const errorMessage =
        String(
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

  /* =======================================================
     LOGOUT
  ======================================================= */

  async function handleLogout() {
    try {
      await signOut(auth);

      localStorage.removeItem(
        "role"
      );

      navigate(
        "/role-selection",
        {
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        "Dealer logout error:",
        error
      );

      setMessage({
        type: "error",
        text:
          "Logout failed. Please try again.",
      });
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="dealer-theme min-h-screen bg-gradient-to-br from-green-50 via-white to-cyan-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* =================================================
            STATUS MESSAGE
        ================================================= */}

        <StatusMessage
          message={message}
          onClose={() =>
            setMessage(null)
          }
        />

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white rounded-3xl shadow-xl p-6 md:p-8">

          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full" />

          <div className="absolute -bottom-20 -left-10 w-44 h-44 bg-white/10 rounded-full" />

          <div className="relative">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

              {/* BRAND */}

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
                    Manage your products,
                    orders, sales and dealer
                    information.
                  </p>
                </div>

              </div>

              {/* HEADER ACTIONS */}

              <div className="flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={loadDashboard}
                  disabled={
                    loading ||
                    refreshing
                  }
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

                  {unreadNotifications >
                    0 && (
                    <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadNotifications >
                      99
                        ? "99+"
                        : unreadNotifications}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={
                    handleLogout
                  }
                  className="border border-white/40 hover:bg-white/10 px-4 py-2.5 rounded-xl font-semibold transition"
                >
                  Logout
                </button>

              </div>

            </div>

            {/* ACCOUNT STATUS */}

            <div className="mt-6 flex flex-wrap items-center gap-3">

              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                Dealer Account Active
              </div>

            </div>

          </div>
        </header>

        {/* =================================================
            MAIN BUSINESS SERVICES
        ================================================= */}

        <section className="mt-7">

          <div className="mb-5">

            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
              Business Services
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              Manage Your Business
            </h2>

              <p className="text-sm text-slate-500 mt-1">
                Manage products, sales and your dealer profile here.
              </p>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

            {/* =================================================
                PRODUCTS & STOCK
            ================================================= */}

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dealer/products"
                )
              }
              className="group bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-6 text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all"
            >

              <div className="flex items-start justify-between gap-3">

                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl">
                  📦
                </div>

                <span className="text-xs font-semibold bg-white/15 px-3 py-1.5 rounded-full">
                  Products
                </span>

              </div>

              <h3 className="text-xl font-bold mt-5">
                Products & Stock
              </h3>

              <p className="text-sm text-white/80 mt-2 leading-5">
                Add products, update prices,
                manage quantities and monitor
                stock levels.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-5">

                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/70">
                    Products
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {loading
                      ? "—"
                      : formatNumber(
                          stats.products
                        )}
                  </p>
                </div>

                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/70">
                    Low Stock
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {loading
                      ? "—"
                      : formatNumber(
                          stats.lowStock
                        )}
                  </p>
                </div>

              </div>

              <div className="mt-5 text-sm font-bold">
                Open Products & Stock →
              </div>

            </button>

            {/* =================================================
                ORDERS
            ================================================= */}

            <button type="button" onClick={() => navigate("/dealer/orders")} className="group bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl p-6 text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl">🛒</div>
              <h3 className="text-xl font-bold mt-5">Farmer Orders</h3>
              <p className="text-sm text-white/80 mt-2 leading-5">Open the dedicated page to review and process farmer orders.</p>
              <div className="mt-5 text-sm font-bold">Open Orders →</div>
            </button>

            {/* =================================================
                SALES & REVENUE
            ================================================= */}

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dealer/sales"
                )
              }
              className="group bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl p-6 text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all"
            >

              <div className="flex items-start justify-between gap-3">

                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl">
                  💰
                </div>

                <span className="text-xs font-semibold bg-white/15 px-3 py-1.5 rounded-full">
                  Sales
                </span>

              </div>

              <h3 className="text-xl font-bold mt-5">
                Sales & Revenue
              </h3>

              <p className="text-sm text-white/80 mt-2 leading-5">
                View completed sales, revenue,
                transactions and sales reports.
              </p>

              <div className="mt-5 bg-white/10 rounded-xl p-4">

                <p className="text-xs text-white/70">
                  Total Revenue
                </p>

                <p className="text-2xl font-bold mt-1">
                  {loading
                    ? "—"
                    : formatCurrency(
                        stats.totalRevenue
                      )}
                </p>

              </div>

              <div className="mt-3 bg-white/10 rounded-xl p-4">

                <p className="text-xs text-white/70">
                  Completed Sales
                </p>

                <p className="text-2xl font-bold mt-1">
                  {loading
                    ? "—"
                    : formatNumber(
                        stats.completedSales
                      )}
                </p>

              </div>

              <div className="mt-5 text-sm font-bold">
                Open Sales & Revenue →
              </div>

            </button>

            {/* =================================================
                DEALER PROFILE
            ================================================= */}

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dealer/profile"
                )
              }
              className="group bg-slate-700 hover:bg-slate-800 text-white rounded-2xl p-6 text-left shadow-md hover:shadow-xl hover:-translate-y-1 transition-all"
            >

              <div className="flex items-start justify-between gap-3">

                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl">
                  👤
                </div>

                <span className="text-xs font-semibold bg-white/15 px-3 py-1.5 rounded-full">
                  Account
                </span>

              </div>

              <h3 className="text-xl font-bold mt-5">
                Dealer Profile
              </h3>

              <p className="text-sm text-white/80 mt-2 leading-5">
                View and manage your dealer
                information, business details
                and account information.
              </p>

              <div className="mt-5 bg-white/10 rounded-xl p-4">

                <p className="text-xs text-white/70">
                  Account Status
                </p>

                <div className="flex items-center gap-2 mt-2">

                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />

                  <span className="font-semibold">
                    Active
                  </span>

                </div>

              </div>

              <div className="mt-5 text-sm font-bold">
                Open Dealer Profile →
              </div>

            </button>

          </div>
        </section>

        {/* =================================================
            PRODUCTS & STOCK SECTION
            PRODUCT-RELATED INFORMATION STAYS HERE
        ================================================= */}

        {stats.lowStock > 0 && (
          <section className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div className="flex items-start gap-3">

                <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-xl">
                  ⚠️
                </div>

                <div>

                  <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                    Products & Stock
                  </p>

                  <h2 className="font-bold text-amber-900 mt-1">
                    Stock Attention Required
                  </h2>

                  <p className="text-sm text-amber-800 mt-1">
                    {stats.lowStock} product
                    {stats.lowStock !== 1
                      ? "s are"
                      : " is"}{" "}
                    at or below the
                    low-stock level.
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
                Open Products & Stock →
              </button>

            </div>

          </section>
        )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="text-center py-8 text-sm text-slate-400">
          AgriSaathi Dealer Portal · Smart Farming Companion
        </footer>

      </div>
    </div>
  );
}
