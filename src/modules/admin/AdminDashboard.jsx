import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { database } from "../../firebase";

const EMPTY_STATS = {
  farmers: 0,
  kvk: 0,
  dealers: 0,
  admins: 0,
  dealerRequests: 0,
  kvkRequests: 0,
  products: 0,
  orders: 0,
  schemes: 0,
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

/*
 * Counts a Firebase collection.
 * Supports both:
 *   products/{productId}
 * and:
 *   products/{dealerUid}/{productId}
 *
 * For nested data, only the second-level records are counted.
 */
function countCollectionRecords(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return 0;
  }

  const entries = Object.values(data);

  if (!entries.length) return 0;

  // A normal Firebase record usually contains primitive fields.
  // If most top-level values look like records, count top-level items.
  const recordLike = entries.filter((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const keys = Object.keys(value);
    return keys.some((key) =>
      [
        "name",
        "title",
        "productName",
        "orderId",
        "customerName",
        "schemeName",
        "description",
        "price",
        "status",
      ].includes(key)
    );
  }).length;

  if (recordLike >= Math.ceil(entries.length / 2)) {
    return entries.length;
  }

  // Otherwise treat the first level as a grouping level and count
  // object records underneath it.
  let total = 0;

  entries.forEach((group) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      total += 1;
      return;
    }

    total += Object.keys(group).length;
  });

  return total;
}

async function readFirstExistingCollection(paths) {
  for (const path of paths) {
    try {
      const snapshot = await get(ref(database, path));

      if (snapshot.exists()) {
        return snapshot.val();
      }
    } catch (error) {
      console.warn(`Unable to read ${path}:`, error);
    }
  }

  return null;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      setErrorMessage("");

      /* ==============================
         USERS
         users/{uid}
      ============================== */
      const usersSnapshot = await get(ref(database, "users"));

      let farmers = 0;
      let dealers = 0;
      let kvk = 0;
      let admins = 0;

      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();

        Object.values(users).forEach((user) => {
          if (!user || typeof user !== "object") return;

          const role = normalize(user.role);
          const status = normalize(user.status);

          if (role === "farmer") {
            farmers++;
            return;
          }

          if (
            role === "dealer" &&
            (!status || status === "approved" || status === "active")
          ) {
            dealers++;
            return;
          }

          if (
            role === "kvk" &&
            (!status || status === "approved" || status === "active")
          ) {
            kvk++;
            return;
          }

          if (
            role === "admin" &&
            (!status || status === "approved" || status === "active")
          ) {
            admins++;
          }
        });
      }

      /* ==============================
         PENDING REQUESTS
      ============================== */
      const [dealerRequestsSnapshot, kvkRequestsSnapshot] =
        await Promise.all([
          get(ref(database, "dealerRequests")),
          get(ref(database, "kvkRequests")),
        ]);

      const dealerRequests = dealerRequestsSnapshot.exists()
        ? Object.keys(dealerRequestsSnapshot.val() || {}).length
        : 0;

      const kvkRequests = kvkRequestsSnapshot.exists()
        ? Object.keys(kvkRequestsSnapshot.val() || {}).length
        : 0;

      /* ==============================
         PRODUCTS
         Primary: products
         Fallback: dealerProducts
      ============================== */
      const productsData = await readFirstExistingCollection([
        "products",
        "dealerProducts",
      ]);

      const products = countCollectionRecords(productsData);

      /* ==============================
         ORDERS
         Primary: dealerOrders
         Fallback: orders
      ============================== */
      const ordersData = await readFirstExistingCollection([
        "dealerOrders",
        "orders",
      ]);

      const orders = countCollectionRecords(ordersData);

      /* ==============================
         GOVERNMENT SCHEMES
         Primary: governmentSchemes
         Fallback: schemes
      ============================== */
      const schemesData = await readFirstExistingCollection([
        "governmentSchemes",
        "schemes",
      ]);

      const schemes = countCollectionRecords(schemesData);

      setStats({
        farmers,
        dealers,
        kvk,
        admins,
        dealerRequests,
        kvkRequests,
        products,
        orders,
        schemes,
      });
    } catch (error) {
      console.error("Admin dashboard statistics error:", error);
      setErrorMessage(
        "Unable to load dashboard statistics. Check Firebase database access and database rules."
      );
    } finally {
      setLoading(false);
    }
  }

  const totalPendingApprovals =
    stats.dealerRequests + stats.kvkRequests;

  const summaryCards = [
    {
      title: "Total Farmers",
      value: stats.farmers,
      icon: "👨‍🌾",
      description: "Registered farmers",
      path: "/admin/farmers",
      bg: "bg-green-50",
      border: "border-green-100",
      valueColor: "text-green-800",
    },
    {
      title: "KVK Officers",
      value: stats.kvk,
      icon: "🏛️",
      description: "Approved KVK officers",
      path: "/admin/kvk-officers",
      bg: "bg-blue-50",
      border: "border-blue-100",
      valueColor: "text-blue-800",
    },
    {
      title: "Dealers",
      value: stats.dealers,
      icon: "🏪",
      description: "Approved dealers",
      path: "/admin/dealers",
      bg: "bg-orange-50",
      border: "border-orange-100",
      valueColor: "text-orange-800",
    },
    {
      title: "Pending Approvals",
      value: totalPendingApprovals,
      icon: "📋",
      description: "Dealer + KVK requests",
      path: "/admin/approvals",
      bg: "bg-purple-50",
      border: "border-purple-100",
      valueColor: "text-purple-800",
    },
  ];

  const platformStats = [
    {
      title: "Products",
      value: stats.products,
      icon: "🛒",
      description: "Products listed by dealers",
      bg: "bg-cyan-50",
      border: "border-cyan-100",
      valueColor: "text-cyan-800",
      path: "/admin/products",
    },
    {
      title: "Orders",
      value: stats.orders,
      icon: "📦",
      description: "Orders in the platform",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      valueColor: "text-indigo-800",
      path: "/admin/orders",
    },
    {
      title: "Government Schemes",
      value: stats.schemes,
      icon: "🌾",
      description: "Agricultural schemes",
      bg: "bg-yellow-50",
      border: "border-yellow-100",
      valueColor: "text-yellow-800",
      path: "/admin/schemes",
    },
  ];

  const adminOptions = [
    {
      title: "Farmers",
      description: "View and manage registered farmers.",
      icon: "👨‍🌾",
      path: "/admin/farmers",
    },
    {
      title: "Dealers",
      description: "View and manage approved dealers.",
      icon: "🏪",
      path: "/admin/dealers",
    },
    {
      title: "KVK Officers",
      description: "View and manage approved KVK officers.",
      icon: "🏛️",
      path: "/admin/kvk-officers",
    },
    {
      title: "Approvals",
      description: "Approve or reject dealer and KVK requests.",
      icon: "📋",
      path: "/admin/approvals",
    },
    {
      title: "Products",
      description: "Monitor products listed by dealers.",
      icon: "🛒",
      path: "/admin/products",
    },
    {
      title: "Orders",
      description: "Monitor farmer orders and order status.",
      icon: "📦",
      path: "/admin/orders",
    },
    {
      title: "Government Schemes",
      description: "Manage agricultural government schemes.",
      icon: "🌾",
      path: "/admin/schemes",
    },
    {
      title: "Reports & Statistics",
      description: "View platform statistics and activity reports.",
      icon: "📊",
      path: "/admin/reports",
    },
  ];

  function handleLogout() {
    localStorage.removeItem("role");
    navigate("/role-selection", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-gradient-to-r from-green-900 via-green-800 to-green-600 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
                🛡️
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Admin Dashboard
                </h1>
                <p className="text-green-100 mt-1">
                  Manage the AgriSaathi Platform
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={loadStats}
                disabled={loading}
                className="bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-green-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Error */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6">
            <strong>Dashboard Error:</strong> {errorMessage}
          </div>
        )}

        {/* Main summary */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {summaryCards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => navigate(card.path)}
              className={`group ${card.bg} ${card.border} border rounded-2xl shadow-sm p-5 text-left hover:shadow-lg hover:-translate-y-1 transition-all`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    {card.title}
                  </p>
                  <p className={`text-4xl font-bold ${card.valueColor} mt-2`}>
                    {loading ? "..." : card.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {card.description}
                  </p>
                </div>
                <div className="text-4xl group-hover:scale-110 transition">
                  {card.icon}
                </div>
              </div>
            </button>
          ))}
        </section>

        {/* Products / Orders / Schemes */}
        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-green-900">
              Platform Statistics
            </h2>
            <p className="text-gray-600 mt-1">
              Current products, orders and government scheme records.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformStats.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => navigate(item.path)}
                className={`${item.bg} ${item.border} border rounded-2xl shadow-sm p-5 text-left hover:shadow-lg hover:-translate-y-1 transition-all`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">
                      {item.title}
                    </p>
                    <p className={`text-3xl font-bold ${item.valueColor} mt-2`}>
                      {loading ? "..." : item.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.description}
                    </p>
                  </div>
                  <div className="text-4xl">{item.icon}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Administration */}
        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-green-900">
              Administration
            </h2>
            <p className="text-gray-600 mt-1">
              Select an option to manage the AgriSaathi platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {adminOptions.map((option) => (
              <button
                key={option.title}
                type="button"
                onClick={() => navigate(option.path)}
                className="group bg-white rounded-2xl shadow-sm border border-green-100 p-6 text-left hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
              >
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-4xl group-hover:bg-green-100 transition">
                  {option.icon}
                </div>

                <h3 className="text-xl font-bold text-green-900 mt-5">
                  {option.title}
                </h3>

                <p className="text-gray-600 text-sm mt-2 leading-6">
                  {option.description}
                </p>

                <div className="text-green-700 font-semibold text-sm mt-4">
                  Open →
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Approval Summary */}
        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 mt-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-green-900">
                📋 Approval Summary
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Review pending dealer and KVK registration requests.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/approvals")}
              className="bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-green-800 transition"
            >
              Open Approvals
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-sm text-orange-700">Dealer Requests</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">
                {loading ? "..." : stats.dealerRequests}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-700">KVK Requests</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {loading ? "..." : stats.kvkRequests}
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-sm text-purple-700">Total Pending</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {loading ? "..." : totalPendingApprovals}
              </p>
            </div>
          </div>
        </section>

        {/* Account Summary */}
        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 mt-7">
          <h2 className="text-xl font-bold text-green-900">
            👥 Account Summary
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Registered platform accounts stored under users/.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-green-700">Farmers</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {loading ? "..." : stats.farmers}
              </p>
            </div>

            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-sm text-orange-700">Dealers</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">
                {loading ? "..." : stats.dealers}
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-blue-700">KVK Officers</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {loading ? "..." : stats.kvk}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-700">Admins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? "..." : stats.admins}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}