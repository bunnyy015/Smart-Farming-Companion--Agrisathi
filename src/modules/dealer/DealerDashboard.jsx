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

export default function DealerDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });

  const [notifications, setNotifications] =
    useState([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const productsSnapshot = await get(
        ref(
          database,
          `dealerProducts/${currentUser.uid}`
        )
      );

      const products = productsSnapshot.exists()
        ? Object.entries(productsSnapshot.val()).map(
            ([id, value]) => ({
              id,
              ...value,
            })
          )
        : [];

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("dealerUid"),
        equalTo(currentUser.uid)
      );

      const ordersSnapshot = await get(
        ordersQuery
      );

      const orders = ordersSnapshot.exists()
        ? Object.entries(ordersSnapshot.val()).map(
            ([id, value]) => ({
              id,
              ...value,
            })
          )
        : [];

      setStats({
        products: products.length,

        lowStock: products.filter(
          (product) =>
            Number(product.quantity || 0) <=
            Number(product.lowStockLevel || 5)
        ).length,

        pendingOrders: orders.filter(
          (order) => order.status === "pending"
        ).length,

        completedOrders: orders.filter(
          (order) => order.status === "completed"
        ).length,
      });

      const notificationIds = [];

      orders.forEach((order) => {
        if (
          [
            "pending",
            "cancelled",
            "received_by_farmer",
            "payment_received",
            "completed",
          ].includes(order.status)
        ) {
          notificationIds.push(
            `order-${order.id}-${order.status}`
          );
        }
      });

      products.forEach((product) => {
        const available = Number(
          product.quantity || 0
        );

        const lowStockLevel = Number(
          product.lowStockLevel || 5
        );

        if (available <= lowStockLevel) {
          notificationIds.push(
            `stock-${product.id}-${available}`
          );
        }
      });

      setNotifications(notificationIds);
    } catch (error) {
      console.error(
        "Dealer dashboard error:",
        error
      );

      setMessage({
        type: "error",
        text: "Dashboard information could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    localStorage.removeItem("role");

    navigate("/role-selection", {
      replace: true,
    });
  }

  const cards = [
    {
      title: "Products",
      value: stats.products,
      icon: "📦",
      path: "/dealer/products",
      text: "Products and available stock",
    },

    {
      title: "Pending Orders",
      value: stats.pendingOrders,
      icon: "🛒",
      path: "/dealer/orders",
      text: "New farmer requests",
    },

    {
      title: "Low Stock",
      value: stats.lowStock,
      icon: "⚠️",
      path: "/dealer/products",
      text: "Products needing restock",
    },

    {
      title: "Completed Sales",
      value: stats.completedOrders,
      icon: "📈",
      path: "/dealer/sales",
      text: "Completed transactions",
    },
  ];

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                🏪 Dealer Dashboard
              </h1>

              <p className="text-green-100 mt-1">
                Products, farmer orders and sales.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/dealer/notifications"
                  )
                }
                className="relative bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold"
              >
                🔔 Notifications

                {unreadNotifications > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications > 99
                      ? "99+"
                      : unreadNotifications}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="border border-white/50 text-white px-4 py-2.5 rounded-xl font-semibold"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {cards.map((card) => (
            <button
              type="button"
              key={card.title}
              onClick={() => navigate(card.path)}
              className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 text-left hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">
                  {card.icon}
                </span>

                <span className="text-2xl font-bold text-green-800">
                  {loading ? "—" : card.value}
                </span>
              </div>

              <h2 className="font-bold text-gray-800 mt-3">
                {card.title}
              </h2>

              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {card.text}
              </p>
            </button>
          ))}
        </section>

        <section className="grid md:grid-cols-2 gap-4 mt-5">
          <button
            type="button"
            onClick={() =>
              navigate("/dealer/products")
            }
            className="bg-green-700 text-white rounded-2xl p-5 text-left shadow"
          >
            <span className="text-3xl">
              ➕
            </span>

            <h2 className="text-xl font-bold mt-3">
              Add or Update Product
            </h2>

            <p className="text-green-100 mt-1">
              Keep price and stock information correct.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/dealer/orders")
            }
            className="bg-white rounded-2xl border border-green-100 p-5 text-left shadow-sm"
          >
            <span className="text-3xl">
              📋
            </span>

            <h2 className="text-xl font-bold text-green-800 mt-3">
              Manage Farmer Orders
            </h2>

            <p className="text-gray-600 mt-1">
              Accept, deliver and complete orders.
            </p>
          </button>
        </section>
      </div>
    </div>
  );
}