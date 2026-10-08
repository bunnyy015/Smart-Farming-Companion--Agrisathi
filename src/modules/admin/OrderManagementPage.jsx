import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

import { auth, database } from "../../firebase";

const STATUS_OPTIONS = [
  "all",
  "pending",
  "completed",
  "successful",
  "rejected",
];

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getOrderStatus(order) {
  const possibleStatuses = [
    order?.status,
    order?.orderStatus,
    order?.paymentStatus,
    order?.deliveryStatus,
  ];

  for (const value of possibleStatuses) {
    const status = normalize(value);

    if (status) {
      return status;
    }
  }

  return "pending";
}

function getStatusCategory(order) {
  const status = getOrderStatus(order);

  if (
    [
      "completed",
      "complete",
      "delivered",
      "success",
      "successful",
      "paid",
      "payment completed",
    ].includes(status)
  ) {
    return "completed";
  }

  if (
    [
      "rejected",
      "reject",
      "declined",
      "denied",
    ].includes(status)
  ) {
    return "rejected";
  }

  if (
    [
      "success",
      "successful",
      "completed",
      "complete",
      "delivered",
      "paid",
      "payment completed",
    ].includes(status)
  ) {
    return "successful";
  }

  return "pending";
}

function getOrderDate(order) {
  const possibleValues = [
    order?.createdAt,
    order?.orderDate,
    order?.createdDate,
    order?.timestamp,
    order?.date,
    order?.orderedAt,
  ];

  for (const value of possibleValues) {
    if (!value) {
      continue;
    }

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }

    if (
      typeof value === "number" ||
      /^\d+$/.test(String(value))
    ) {
      const numericDate = new Date(
        Number(value)
      );

      if (!Number.isNaN(numericDate.getTime())) {
        return numericDate;
      }
    }
  }

  return null;
}

function formatDate(order) {
  const date = getOrderDate(order);

  if (!date) {
    return "Date not available";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(order) {
  const date = getOrderDate(order);

  if (!date) {
    return "Date not available";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderId(order, uid) {
  return (
    order?.orderId ||
    order?.id ||
    order?.orderID ||
    uid ||
    "Unknown"
  );
}

function getFarmerName(order) {
  return (
    order?.farmerName ||
    order?.customerName ||
    order?.buyerName ||
    order?.userName ||
    order?.farmer?.name ||
    "Farmer"
  );
}

function getDealerName(order) {
  return (
    order?.dealerName ||
    order?.sellerName ||
    order?.shopName ||
    order?.dealer?.name ||
    "Dealer"
  );
}

function getProductName(order) {
  return (
    order?.productName ||
    order?.product ||
    order?.itemName ||
    order?.name ||
    "Product"
  );
}

function getQuantity(order) {
  return (
    order?.quantity ??
    order?.qty ??
    order?.orderQuantity ??
    1
  );
}

function getPrice(order) {
  const possiblePrices = [
    order?.totalAmount,
    order?.totalPrice,
    order?.amount,
    order?.orderTotal,
    order?.price,
  ];

  for (const value of possiblePrices) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const number = Number(value);

      if (!Number.isNaN(number)) {
        return number;
      }
    }
  }

  return 0;
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString(
    "en-IN"
  )}`;
}

function getRating(order) {
  const rating = Number(
    order?.rating ??
      order?.reviewRating ??
      order?.farmerRating ??
      order?.customerRating ??
      0
  );

  if (
    Number.isNaN(rating) ||
    rating < 0
  ) {
    return 0;
  }

  return Math.min(rating, 5);
}

function getFromLocation(order) {
  return (
    order?.from ||
    order?.fromLocation ||
    order?.sellerLocation ||
    order?.dealerAddress ||
    order?.dealer?.address ||
    order?.dealerVillage ||
    "Not available"
  );
}

function getToLocation(order) {
  return (
    order?.to ||
    order?.toLocation ||
    order?.deliveryAddress ||
    order?.shippingAddress ||
    order?.farmerAddress ||
    order?.farmer?.address ||
    "Not available"
  );
}

function getPhone(order) {
  return (
    order?.farmerPhone ||
    order?.customerPhone ||
    order?.phone ||
    order?.mobile ||
    ""
  );
}

function getPaymentMethod(order) {
  return (
    order?.paymentMethod ||
    order?.paymentType ||
    "Not specified"
  );
}

function getStatusLabel(category) {
  switch (category) {
    case "completed":
      return "Completed";

    case "successful":
      return "Successful";

    case "rejected":
      return "Rejected";

    case "pending":
    default:
      return "Pending";
  }
}

function getStatusClasses(category) {
  switch (category) {
    case "completed":
      return {
        badge:
          "bg-green-100 text-green-800 border-green-200",
        dot: "bg-green-500",
      };

    case "successful":
      return {
        badge:
          "bg-blue-100 text-blue-800 border-blue-200",
        dot: "bg-blue-500",
      };

    case "rejected":
      return {
        badge:
          "bg-red-100 text-red-800 border-red-200",
        dot: "bg-red-500",
      };

    case "pending":
    default:
      return {
        badge:
          "bg-amber-100 text-amber-800 border-amber-200",
        dot: "bg-amber-500",
      };
  }
}

function normalizeOrders(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return [];
  }

  const orders = [];

  Object.entries(data).forEach(
    ([uid, value]) => {
      if (
        !value ||
        typeof value !== "object"
      ) {
        return;
      }

      /*
       * Normal structure:
       *
       * dealerOrders/
       *   orderId/
       *     farmerName
       *     dealerName
       *     productName
       *
       * This is handled directly.
       */

      const looksLikeOrder =
        value.orderId ||
        value.productName ||
        value.customerName ||
        value.farmerName ||
        value.dealerName ||
        value.totalAmount ||
        value.orderStatus ||
        value.status;

      if (looksLikeOrder) {
        orders.push({
          uid,
          ...value,
        });

        return;
      }

      /*
       * Also support grouped structures such as:
       *
       * dealerOrders/
       *   dealerUid/
       *     orderId/
       *       ...
       */

      Object.entries(value).forEach(
        ([nestedId, nestedOrder]) => {
          if (
            !nestedOrder ||
            typeof nestedOrder !==
              "object"
          ) {
            return;
          }

          orders.push({
            uid: nestedId,
            dealerUid: uid,
            ...nestedOrder,
          });
        }
      );
    }
  );

  return orders;
}

function StatCard({
  title,
  value,
  icon,
  description,
  className,
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-600">
            {title}
          </p>

          <p className="text-3xl font-bold text-gray-900 mt-2">
            {value}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {description}
          </p>
        </div>

        <div className="text-3xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function OrderManagementPage() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [sortOption, setSortOption] =
    useState("newest");

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          if (!currentUser) {
            navigate("/login", {
              replace: true,
            });

            return;
          }

          await loadOrders();
        }
      );

    return () => unsubscribe();
  }, [navigate]);

  async function loadOrders() {
    try {
      setRefreshing(true);
      setErrorMessage("");

      const snapshot = await get(
        ref(database, "dealerOrders")
      );

      if (!snapshot.exists()) {
        setOrders([]);
        return;
      }

      const data = snapshot.val();

      const normalized =
        normalizeOrders(data);

      setOrders(normalized);
    } catch (error) {
      console.error(
        "Admin order management error:",
        error
      );

      setErrorMessage(
        "Orders could not be loaded. Please refresh and check Firebase access if the problem continues."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const statistics = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let successful = 0;
    let rejected = 0;

    let ratingTotal = 0;
    let ratingCount = 0;

    let totalSales = 0;

    orders.forEach((order) => {
      const category =
        getStatusCategory(order);

      if (category === "pending") {
        pending++;
      }

      if (category === "completed") {
        completed++;
        totalSales += getPrice(order);
      }

      if (category === "successful") {
        successful++;
        totalSales += getPrice(order);
      }

      if (category === "rejected") {
        rejected++;
      }

      const rating = getRating(order);

      if (rating > 0) {
        ratingTotal += rating;
        ratingCount++;
      }
    });

    const averageRating =
      ratingCount > 0
        ? ratingTotal / ratingCount
        : 0;

    return {
      total: orders.length,
      pending,
      completed,
      successful,
      rejected,
      ratingCount,
      averageRating,
      totalSales,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search =
      searchTerm
        .trim()
        .toLowerCase();

    let result = orders.filter(
      (order) => {
        const category =
          getStatusCategory(order);

        const matchesStatus =
          statusFilter === "all" ||
          category === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!search) {
          return true;
        }

        const searchableText = [
          getOrderId(order, order.uid),
          getFarmerName(order),
          getDealerName(order),
          getProductName(order),
          getFromLocation(order),
          getToLocation(order),
          getPaymentMethod(order),
          getOrderStatus(order),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          search
        );
      }
    );

    result.sort((a, b) => {
      const dateA =
        getOrderDate(a)?.getTime() || 0;

      const dateB =
        getOrderDate(b)?.getTime() || 0;

      const priceA = getPrice(a);
      const priceB = getPrice(b);

      if (sortOption === "oldest") {
        return dateA - dateB;
      }

      if (sortOption === "amount-high") {
        return priceB - priceA;
      }

      if (sortOption === "amount-low") {
        return priceA - priceB;
      }

      return dateB - dateA;
    });

    return result;
  }, [
    orders,
    searchTerm,
    statusFilter,
    sortOption,
  ]);

  function handleRefresh() {
    loadOrders();
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setSortOption("newest");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* =========================================
            HEADER
        ========================================= */}

        <header className="bg-gradient-to-r from-indigo-950 via-indigo-800 to-purple-700 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div className="flex items-start gap-4">

              <button
                type="button"
                onClick={() =>
                  navigate("/admin")
                }
                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold transition"
              >
                ← Admin
              </button>

              <div>
                <div className="flex items-center gap-3">

                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
                    📦
                  </div>

                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold">
                      Order Management
                    </h1>

                    <p className="text-indigo-100 mt-1">
                      Monitor and analyze all AgriSaathi orders
                    </p>
                  </div>

                </div>
              </div>

            </div>

            <div className="flex gap-3">

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white/15 hover:bg-white/25 border border-white/20 px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

            </div>

          </div>

        </header>

        {/* =========================================
            ERROR
        ========================================= */}

        {errorMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 mb-6">
            <strong>
              Order Management Notice:
            </strong>{" "}
            {errorMessage}
          </div>
        )}

        {/* =========================================
            MAIN STATISTICS
        ========================================= */}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">

          <StatCard
            title="Total Orders"
            value={
              loading
                ? "..."
                : statistics.total
            }
            icon="📦"
            description="All orders recorded"
            className="bg-white border-indigo-100"
          />

          <StatCard
            title="Pending"
            value={
              loading
                ? "..."
                : statistics.pending
            }
            icon="⏳"
            description="Waiting for completion"
            className="bg-amber-50 border-amber-100"
          />

          <StatCard
            title="Completed"
            value={
              loading
                ? "..."
                : statistics.completed
            }
            icon="✅"
            description="Successfully completed"
            className="bg-green-50 border-green-100"
          />

          <StatCard
            title="Rejected"
            value={
              loading
                ? "..."
                : statistics.rejected
            }
            icon="❌"
            description="Rejected orders"
            className="bg-red-50 border-red-100"
          />

        </section>

        {/* =========================================
            SECOND STATISTICS ROW
        ========================================= */}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">

          <StatCard
            title="Successful"
            value={
              loading
                ? "..."
                : statistics.successful
            }
            icon="🏆"
            description="Successful transactions"
            className="bg-blue-50 border-blue-100"
          />

          <StatCard
            title="Average Rating"
            value={
              loading
                ? "..."
                : statistics.ratingCount > 0
                ? `${statistics.averageRating.toFixed(
                    1
                  )} / 5`
                : "No rating"
            }
            icon="⭐"
            description={`${statistics.ratingCount} rated orders`}
            className="bg-purple-50 border-purple-100"
          />

          <StatCard
            title="Order Value"
            value={
              loading
                ? "..."
                : formatCurrency(
                    statistics.totalSales
                  )
            }
            icon="💰"
            description="Completed/successful orders"
            className="bg-indigo-50 border-indigo-100"
          />

        </section>

        {/* =========================================
            ORDER FLOW SUMMARY
        ========================================= */}

        <section className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 md:p-6 mb-7">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <h2 className="text-xl font-bold text-indigo-950">
                Order Overview
              </h2>

              <p className="text-gray-600 text-sm mt-1">
                Current distribution of orders by status.
              </p>
            </div>

            <div className="text-sm font-semibold text-indigo-700">
              {filteredOrders.length} shown
            </div>

          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">

            {[
              {
                label: "Pending",
                value:
                  statistics.pending,
                color:
                  "bg-amber-50 text-amber-800 border-amber-100",
              },
              {
                label: "Completed",
                value:
                  statistics.completed,
                color:
                  "bg-green-50 text-green-800 border-green-100",
              },
              {
                label: "Successful",
                value:
                  statistics.successful,
                color:
                  "bg-blue-50 text-blue-800 border-blue-100",
              },
              {
                label: "Rejected",
                value:
                  statistics.rejected,
                color:
                  "bg-red-50 text-red-800 border-red-100",
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  setStatusFilter(
                    item.label.toLowerCase()
                  )
                }
                className={`${item.color} border rounded-xl p-4 text-left hover:shadow-sm transition`}
              >
                <p className="text-xs font-medium">
                  {item.label}
                </p>

                <p className="text-2xl font-bold mt-1">
                  {loading
                    ? "..."
                    : item.value}
                </p>
              </button>
            ))}

          </div>

        </section>

        {/* =========================================
            FILTERS
        ========================================= */}

        <section className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 mb-6">

          <div className="flex flex-col lg:flex-row gap-4">

            <div className="flex-1">

              <label className="block text-sm font-semibold text-indigo-950 mb-2">
                Search Orders
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search order, farmer, dealer, product, location..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />

            </div>

            <div className="w-full lg:w-52">

              <label className="block text-sm font-semibold text-indigo-950 mb-2">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status === "all"
                        ? "All Orders"
                        : status
                            .charAt(0)
                            .toUpperCase() +
                          status.slice(1)}
                    </option>
                  )
                )}
              </select>

            </div>

            <div className="w-full lg:w-52">

              <label className="block text-sm font-semibold text-indigo-950 mb-2">
                Sort By
              </label>

              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(
                    event.target.value
                  )
                }
                className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="newest">
                  Newest First
                </option>

                <option value="oldest">
                  Oldest First
                </option>

                <option value="amount-high">
                  Highest Amount
                </option>

                <option value="amount-low">
                  Lowest Amount
                </option>
              </select>

            </div>

            <div className="flex items-end">

              <button
                type="button"
                onClick={clearFilters}
                className="w-full lg:w-auto px-5 py-3 rounded-xl border border-indigo-200 text-indigo-700 font-semibold hover:bg-indigo-50 transition"
              >
                Clear
              </button>

            </div>

          </div>

        </section>

        {/* =========================================
            ORDERS
        ========================================= */}

        <section className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">

          <div className="p-5 md:p-6 border-b border-gray-100">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

              <div>
                <h2 className="text-xl font-bold text-indigo-950">
                  All Orders
                </h2>

                <p className="text-gray-600 text-sm mt-1">
                  Review the complete order journey from farmer to dealer.
                </p>
              </div>

              <div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-xl text-sm font-semibold">
                {loading
                  ? "Loading..."
                  : `${filteredOrders.length} Orders`}
              </div>

            </div>

          </div>

          {loading ? (
            <div className="p-10 text-center">

              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-700 rounded-full animate-spin mx-auto" />

              <p className="text-gray-600 mt-4">
                Loading orders...
              </p>

            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-10 text-center">

              <div className="text-5xl">
                📦
              </div>

              <h3 className="text-xl font-bold text-gray-800 mt-4">
                No Orders Found
              </h3>

              <p className="text-gray-500 mt-2">
                No orders match the selected filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition"
              >
                Show All Orders
              </button>

            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {filteredOrders.map(
                (order, index) => {
                  const category =
                    getStatusCategory(
                      order
                    );

                  const statusClasses =
                    getStatusClasses(
                      category
                    );

                  return (
                    <div
                      key={
                        order.uid ||
                        order.orderId ||
                        index
                      }
                      className="p-5 md:p-6 hover:bg-indigo-50/30 transition"
                    >

                      <div className="flex flex-col xl:flex-row xl:items-center gap-5">

                        {/* ORDER ID */}

                        <div className="xl:w-48 shrink-0">

                          <p className="text-xs text-gray-500 font-medium">
                            Order ID
                          </p>

                          <p className="font-bold text-indigo-950 mt-1 break-all">
                            {getOrderId(
                              order,
                              order.uid
                            )}
                          </p>

                          <p className="text-xs text-gray-500 mt-2">
                            {formatDate(
                              order
                            )}
                          </p>

                        </div>

                        {/* FARMER */}

                        <div className="flex-1">

                          <p className="text-xs text-gray-500 font-medium">
                            Farmer
                          </p>

                          <p className="font-bold text-gray-900 mt-1">
                            {getFarmerName(
                              order
                            )}
                          </p>

                          <p className="text-sm text-gray-500 mt-1">
                            To:{" "}
                            {getToLocation(
                              order
                            )}
                          </p>

                        </div>

                        {/* DEALER */}

                        <div className="flex-1">

                          <p className="text-xs text-gray-500 font-medium">
                            Dealer
                          </p>

                          <p className="font-bold text-gray-900 mt-1">
                            {getDealerName(
                              order
                            )}
                          </p>

                          <p className="text-sm text-gray-500 mt-1">
                            From:{" "}
                            {getFromLocation(
                              order
                            )}
                          </p>

                        </div>

                        {/* PRODUCT */}

                        <div className="flex-1">

                          <p className="text-xs text-gray-500 font-medium">
                            Product
                          </p>

                          <p className="font-bold text-gray-900 mt-1">
                            {getProductName(
                              order
                            )}
                          </p>

                          <p className="text-sm text-gray-500 mt-1">
                            Quantity:{" "}
                            {getQuantity(
                              order
                            )}
                          </p>

                        </div>

                        {/* AMOUNT */}

                        <div className="xl:w-32">

                          <p className="text-xs text-gray-500 font-medium">
                            Amount
                          </p>

                          <p className="font-bold text-indigo-800 mt-1">
                            {formatCurrency(
                              getPrice(order)
                            )}
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            {getPaymentMethod(
                              order
                            )}
                          </p>

                        </div>

                        {/* STATUS */}

                        <div className="xl:w-32">

                          <p className="text-xs text-gray-500 font-medium mb-2">
                            Status
                          </p>

                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${statusClasses.badge}`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${statusClasses.dot}`}
                            />

                            {getStatusLabel(
                              category
                            )}
                          </span>

                        </div>

                        {/* ACTION */}

                        <div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedOrder(
                                order
                              )
                            }
                            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
                          >
                            View
                          </button>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

      {/* =========================================
          ORDER DETAILS MODAL
      ========================================= */}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl">

            <div className="bg-gradient-to-r from-indigo-950 via-indigo-800 to-purple-700 text-white p-6">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-indigo-200 text-sm">
                    Order Details
                  </p>

                  <h2 className="text-2xl font-bold mt-1 break-all">
                    {getOrderId(
                      selectedOrder,
                      selectedOrder.uid
                    )}
                  </h2>

                  <p className="text-indigo-100 text-sm mt-2">
                    {formatDateTime(
                      selectedOrder
                    )}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedOrder(
                      null
                    )
                  }
                  className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-xl font-bold"
                  aria-label="Close"
                >
                  ×
                </button>

              </div>

            </div>

            <div className="p-6">

              {/* STATUS */}

              <div className="mb-6">

                {(() => {
                  const category =
                    getStatusCategory(
                      selectedOrder
                    );

                  const classes =
                    getStatusClasses(
                      category
                    );

                  return (
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-bold text-sm ${classes.badge}`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${classes.dot}`}
                      />

                      {getStatusLabel(
                        category
                      )}
                    </span>
                  );
                })()}

              </div>

              {/* ORDER JOURNEY */}

              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6">

                <h3 className="font-bold text-indigo-950">
                  Order Journey
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

                  <div className="bg-white rounded-xl p-4">

                    <p className="text-xs text-gray-500">
                      From Dealer
                    </p>

                    <p className="font-semibold text-gray-900 mt-1">
                      {getFromLocation(
                        selectedOrder
                      )}
                    </p>

                  </div>

                  <div className="bg-white rounded-xl p-4">

                    <p className="text-xs text-gray-500">
                      To Farmer
                    </p>

                    <p className="font-semibold text-gray-900 mt-1">
                      {getToLocation(
                        selectedOrder
                      )}
                    </p>

                  </div>

                </div>

              </div>

              {/* DETAILS GRID */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Farmer
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {getFarmerName(
                      selectedOrder
                    )}
                  </p>

                  {getPhone(
                    selectedOrder
                  ) && (
                    <p className="text-sm text-gray-500 mt-1">
                      Phone:{" "}
                      {getPhone(
                        selectedOrder
                      )}
                    </p>
                  )}

                </div>

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Dealer
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {getDealerName(
                      selectedOrder
                    )}
                  </p>

                </div>

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Product
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {getProductName(
                      selectedOrder
                    )}
                  </p>

                </div>

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Quantity
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {getQuantity(
                      selectedOrder
                    )}
                  </p>

                </div>

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Order Amount
                  </p>

                  <p className="font-bold text-indigo-800 mt-1">
                    {formatCurrency(
                      getPrice(
                        selectedOrder
                      )
                    )}
                  </p>

                </div>

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Payment Method
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {getPaymentMethod(
                      selectedOrder
                    )}
                  </p>

                </div>

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Rating
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {getRating(
                      selectedOrder
                    ) > 0
                      ? `${getRating(
                          selectedOrder
                        )} / 5 ⭐`
                      : "Not rated"}
                  </p>

                </div>

                <div className="border border-gray-100 rounded-xl p-4">

                  <p className="text-xs text-gray-500">
                    Current Status
                  </p>

                  <p className="font-semibold text-gray-900 mt-1">
                    {getOrderStatus(
                      selectedOrder
                    ) || "Pending"}
                  </p>

                </div>

              </div>

              {/* CLOSE */}

              <div className="flex justify-end mt-6">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedOrder(
                      null
                    )
                  }
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition"
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
