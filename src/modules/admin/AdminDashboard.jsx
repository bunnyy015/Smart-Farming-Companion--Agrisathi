import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

import { auth, database } from "../../firebase";

const EMPTY_STATS = {
  farmers: 0,
  dealers: 0,
  admins: 0,
  dealerRequests: 0,
  products: 0,
  orders: 0,
  schemes: 0,
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

/*
 * Count Firebase records.
 *
 * Supports:
 *
 * dealerProducts/
 *   dealerUid/
 *     productId/
 *
 * and normal collections:
 *
 * orders/
 *   orderId/
 */
function countCollectionRecords(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return 0;
  }

  const entries = Object.values(data);

  if (!entries.length) {
    return 0;
  }

  const recordLike = entries.filter((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
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

  /*
   * If most top-level entries look like actual records,
   * this is a normal collection.
   */
  if (recordLike >= Math.ceil(entries.length / 2)) {
    return entries.length;
  }

  /*
   * Otherwise assume the collection is grouped,
   * such as dealerProducts/{dealerUid}/{productId}.
   */
  let total = 0;

  entries.forEach((group) => {
    if (
      !group ||
      typeof group !== "object" ||
      Array.isArray(group)
    ) {
      total += 1;
      return;
    }

    total += Object.keys(group).length;
  });

  return total;
}

/*
 * Safely read one Firebase path.
 *
 * A failed optional statistic should not crash
 * the entire Admin Dashboard.
 */
async function safeRead(path) {
  try {
    const snapshot = await get(
      ref(database, path)
    );

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val();
  } catch (error) {
    console.warn(
      `Unable to read Firebase path "${path}":`,
      error
    );

    return null;
  }
}

/*
 * Get pending dealer requests.
 *
 * If a request has a status field, only pending requests
 * are counted.
 *
 * Older records without a status are treated as pending
 * so existing data continues to work.
 */
function countPendingDealerRequests(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return 0;
  }

  return Object.values(data).filter((request) => {
    if (
      !request ||
      typeof request !== "object"
    ) {
      return false;
    }

    const status = normalize(request.status);

    if (!status) {
      return true;
    }

    return (
      status === "pending" ||
      status === "requested" ||
      status === "waiting"
    );
  }).length;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(
    EMPTY_STATS
  );

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  useEffect(() => {
    /*
     * Firebase Auth may take a moment to restore the
     * existing login session.
     *
     * Waiting for onAuthStateChanged prevents database
     * reads from happening while auth.currentUser is
     * temporarily null.
     */
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          setLoading(false);

          navigate("/login", {
            replace: true,
          });

          return;
        }

        await loadStats(currentUser);
      }
    );

    return () => unsubscribe();
  }, [navigate]);

  async function loadStats(user = auth.currentUser) {
    if (!user) {
      setLoading(false);

      navigate("/login", {
        replace: true,
      });

      return;
    }

    try {
      setLoading(true);
      setRefreshing(true);
      setErrorMessage("");

      /*
       * ============================================
       * USERS
       * users/{uid}
       * ============================================
       */

      const usersData =
        await safeRead("users");

      let farmers = 0;
      let dealers = 0;
      let admins = 0;

      if (
        usersData &&
        typeof usersData === "object"
      ) {
        Object.values(usersData).forEach(
          (account) => {
            if (
              !account ||
              typeof account !== "object"
            ) {
              return;
            }

            const role = normalize(
              account.role
            );

            const status = normalize(
              account.status
            );

            /*
             * Farmers
             */
            if (role === "farmer") {
              farmers++;
              return;
            }

            /*
             * Dealers
             *
             * If no status exists, keep the dealer
             * because older accounts may not have
             * a status field.
             */
            if (
              role === "dealer" &&
              (
                !status ||
                status === "approved" ||
                status === "active"
              )
            ) {
              dealers++;
              return;
            }

            /*
             * Admins
             */
            if (
              role === "admin" &&
              (
                !status ||
                status === "approved" ||
                status === "active"
              )
            ) {
              admins++;
            }
          }
        );
      }

      /*
       * ============================================
       * DEALER REQUESTS
       * ============================================
       */

      const dealerRequestsData =
        await safeRead("dealerRequests");

      const dealerRequests =
        countPendingDealerRequests(
          dealerRequestsData
        );

      /*
       * ============================================
       * PRODUCTS
       *
       * Your actual database structure is:
       *
       * dealerProducts/{dealerUid}/{productId}
       * ============================================
       */

      const productsData =
        await safeRead("dealerProducts");

      const products =
        countCollectionRecords(
          productsData
        );

      /*
       * ============================================
       * ORDERS
       *
       * Your actual database structure is:
       *
       * dealerOrders/{orderId}
       * ============================================
       */

      const ordersData =
        await safeRead("dealerOrders");

      const orders =
        countCollectionRecords(
          ordersData
        );

      /*
       * ============================================
       * GOVERNMENT SCHEMES
       *
       * Supports either:
       *
       * governmentSchemes
       *
       * or:
       *
       * schemes
       * ============================================
       */

      let schemesData =
        await safeRead(
          "governmentSchemes"
        );

      if (!schemesData) {
        schemesData =
          await safeRead("schemes");
      }

      const schemes =
        countCollectionRecords(
          schemesData
        );

      /*
       * ============================================
       * UPDATE DASHBOARD
       * ============================================
       */

      setStats({
        farmers,
        dealers,
        admins,
        dealerRequests,
        products,
        orders,
        schemes,
      });

      /*
       * We don't show an error simply because an
       * optional collection is empty.
       *
       * This makes the dashboard usable even while
       * some modules are still being developed.
       */
      setErrorMessage("");
    } catch (error) {
      console.error(
        "Admin dashboard statistics error:",
        error
      );

      setErrorMessage(
        "Some dashboard statistics could not be loaded. Please refresh and check Firebase access if the problem continues."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    loadStats();
  }

  function handleLogout() {
    localStorage.removeItem("role");

    navigate("/role-selection", {
      replace: true,
    });
  }

  const totalPendingApprovals =
    stats.dealerRequests;

  /*
   * ============================================
   * MAIN SUMMARY CARDS
   * ============================================
   */

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
      title: "Dealer Management",
      value: stats.dealers,
      icon: "🏪",
      description: "Approved dealers",
      path: "/admin/dealer-management",
      bg: "bg-orange-50",
      border: "border-orange-100",
      valueColor: "text-orange-800",
    },

    {
      title: "Pending Approvals",
      value: totalPendingApprovals,
      icon: "📋",
      description:
        "Dealer registration requests",
      path: "/admin/dealer-requests",
      bg: "bg-purple-50",
      border: "border-purple-100",
      valueColor: "text-purple-800",
    },

    {
      title: "Total Admins",
      value: stats.admins,
      icon: "🛡️",
      description:
        "Active administrators",
      path: "/admin",
      bg: "bg-blue-50",
      border: "border-blue-100",
      valueColor: "text-blue-800",
    },
  ];

  /*
   * ============================================
   * PLATFORM STATISTICS
   * ============================================
   */

  const platformStats = [
    {
      title: "Products",
      value: stats.products,
      icon: "🛒",
      description:
        "Products listed by dealers",
      bg: "bg-cyan-50",
      border: "border-cyan-100",
      valueColor: "text-cyan-800",
      path: "/admin/products",
    },

    {
      title: "Orders",
      value: stats.orders,
      icon: "📦",
      description:
        "Orders in the platform",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      valueColor: "text-indigo-800",
      path: "/admin/orders",
    },

    {
      title: "Government Schemes",
      value: stats.schemes,
      icon: "🌾",
      description:
        "Agricultural schemes",
      bg: "bg-yellow-50",
      border: "border-yellow-100",
      valueColor: "text-yellow-800",
      path: "/admin/schemes",
    },
  ];

  /*
   * ============================================
   * ADMINISTRATION OPTIONS
   * ============================================
   */

  const adminOptions = [
    {
      title: "Farmers",
      description:
        "View and manage registered farmers.",
      icon: "👨‍🌾",
      path: "/admin/farmers",
    },

    {
      title: "Dealers",
      description:
        "View and manage approved dealers.",
      icon: "🏪",
      path: "/admin/dealers",
    },

    {
      title: "Approvals",
      description:
        "Approve or reject dealer registration requests.",
      icon: "📋",
      path: "/admin/dealer-requests",
    },

    {
      title: "Products",
      description:
        "Monitor products listed by dealers.",
      icon: "🛒",
      path: "/admin/products",
    },

    {
      title: "Orders",
      description:
        "Monitor farmer orders and order status.",
      icon: "📦",
      path: "/admin/orders",
    },

    {
      title: "Government Schemes",
      description:
        "Manage agricultural government schemes.",
      icon: "🌾",
      path: "/admin/schemes",
    },

    {
      title: "Reports & Statistics",
      description:
        "View platform statistics and activity reports.",
      icon: "📊",
      path: "/admin/reports",
    },
    
    {
  title: "Market Prices",
  description:
    "Add, update and manage agricultural market prices.",
  icon: "🌾",
  path: "/admin/market-prices",
},
  ];

  /*
   * ============================================
   * RENDER
   * ============================================
   */

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <header className="bg-gradient-to-r from-indigo-950 via-indigo-800 to-purple-700 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div className="flex items-center gap-3">

              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl shadow-inner">
                🛡️
              </div>

              <div>

                <h1 className="text-3xl md:text-4xl font-bold">
                  Admin Dashboard
                </h1>

                <p className="text-indigo-100 mt-1">
                  Manage the AgriSaathi Platform
                </p>

              </div>

            </div>

            <div className="flex gap-3">

              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="bg-white/15 hover:bg-white/25 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="bg-white text-indigo-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition shadow-sm"
              >
                Logout
              </button>

            </div>

          </div>

        </header>

        {/* ERROR */}

        {errorMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 mb-6">

            <strong>
              Dashboard Notice:
            </strong>{" "}

            {errorMessage}

          </div>
        )}

        {/* MAIN SUMMARY */}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">

          {summaryCards.map((card) => (

            <button
              key={card.title}
              type="button"
              onClick={() =>
                navigate(card.path)
              }
              className={`group ${card.bg} ${card.border} border rounded-2xl shadow-sm p-5 text-left hover:shadow-lg hover:-translate-y-1 transition-all`}
            >

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="text-sm text-gray-600 font-medium">
                    {card.title}
                  </p>

                  <p
                    className={`text-4xl font-bold ${card.valueColor} mt-2`}
                  >
                    {loading
                      ? "..."
                      : card.value}
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

        {/* PLATFORM STATISTICS */}

        <section className="mb-8">

          <div className="mb-5">

            <h2 className="text-2xl font-bold text-indigo-950">
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
                onClick={() =>
                  navigate(item.path)
                }
                className={`${item.bg} ${item.border} border rounded-2xl shadow-sm p-5 text-left hover:shadow-lg hover:-translate-y-1 transition-all`}
              >

                <div className="flex items-start justify-between gap-3">

                  <div>

                    <p className="text-sm text-gray-600 font-medium">
                      {item.title}
                    </p>

                    <p
                      className={`text-3xl font-bold ${item.valueColor} mt-2`}
                    >
                      {loading
                        ? "..."
                        : item.value}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {item.description}
                    </p>

                  </div>

                  <div className="text-4xl">
                    {item.icon}
                  </div>

                </div>

              </button>

            ))}

          </div>

        </section>

        {/* ADMINISTRATION */}

        <section>

          <div className="mb-5">

            <h2 className="text-2xl font-bold text-indigo-950">
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
                onClick={() =>
                  navigate(option.path)
                }
                className="group bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 text-left hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200 transition-all duration-200"
              >

                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-4xl group-hover:bg-indigo-100 group-hover:scale-105 transition">
                  {option.icon}
                </div>

                <h3 className="text-xl font-bold text-indigo-950 mt-5">
                  {option.title}
                </h3>

                <p className="text-gray-600 text-sm mt-2 leading-6">
                  {option.description}
                </p>

                <div className="text-indigo-700 font-semibold text-sm mt-4 group-hover:text-purple-700 transition">
                  Open →
                </div>

              </button>

            ))}

          </div>

        </section>

        {/* APPROVAL SUMMARY */}

        <section className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 md:p-6 mt-7">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>

              <h2 className="text-xl font-bold text-indigo-950">
                📋 Approval Summary
              </h2>

              <p className="text-gray-600 text-sm mt-1">
                Review pending dealer registration requests.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/admin/dealer-requests"
                )
              }
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm"
            >
              Open Approvals
            </button>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">

            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">

              <p className="text-sm text-orange-700">
                Dealer Requests
              </p>

              <p className="text-2xl font-bold text-orange-900 mt-1">
                {loading
                  ? "..."
                  : stats.dealerRequests}
              </p>

            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">

              <p className="text-sm text-purple-700">
                Total Pending
              </p>

              <p className="text-2xl font-bold text-purple-900 mt-1">
                {loading
                  ? "..."
                  : totalPendingApprovals}
              </p>

            </div>

          </div>

        </section>

        {/* ACCOUNT SUMMARY */}

        <section className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 md:p-6 mt-7">

          <h2 className="text-xl font-bold text-indigo-950">
            👥 Account Summary
          </h2>

          <p className="text-gray-600 text-sm mt-1">
            Registered platform accounts stored under users/.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">

            <div className="bg-green-50 rounded-xl p-4">

              <p className="text-sm text-green-700">
                Farmers
              </p>

              <p className="text-2xl font-bold text-green-900 mt-1">
                {loading
                  ? "..."
                  : stats.farmers}
              </p>

            </div>

            <div className="bg-orange-50 rounded-xl p-4">

              <p className="text-sm text-orange-700">
                Dealers
              </p>

              <p className="text-2xl font-bold text-orange-900 mt-1">
                {loading
                  ? "..."
                  : stats.dealers}
              </p>

            </div>

            <div className="bg-gray-50 rounded-xl p-4">

              <p className="text-sm text-gray-700">
                Admins
              </p>

              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading
                  ? "..."
                  : stats.admins}
              </p>

            </div>

          </div>

        </section>

      </div>
    </div>
  );
}