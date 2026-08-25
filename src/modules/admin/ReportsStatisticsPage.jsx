import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const EMPTY_REPORT = {
  farmers: 0,
  dealers: 0,
  admins: 0,
  totalUsers: 0,
  dealerRequests: 0,
  products: 0,
  orders: 0,
  schemes: 0,
  availableProducts: 0,
  outOfStockProducts: 0,
  lowStockProducts: 0,
  totalStock: 0,
  reservedStock: 0,
  soldStock: 0,
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function getArrayFromFirebase(data) {
  if (!isObject(data)) {
    return [];
  }

  return Object.entries(data).map(([id, value]) => ({
    id,
    ...(isObject(value) ? value : {}),
  }));
}

function countNestedRecords(data) {
  if (!isObject(data)) {
    return 0;
  }

  let total = 0;

  Object.values(data).forEach((group) => {
    if (!isObject(group)) {
      total += 1;
      return;
    }

    total += Object.keys(group).length;
  });

  return total;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getOrderStatus(order) {
  const possibleStatus =
    order?.status ||
    order?.orderStatus ||
    order?.paymentStatus ||
    "";

  return normalize(possibleStatus) || "unknown";
}

function getProductCategory(product) {
  return (
    String(
      product?.category ||
        product?.productCategory ||
        "Other"
    ).trim() || "Other"
  );
}

function getProductQuantity(product) {
  return Number(
    product?.quantity ??
      product?.availableQuantity ??
      0
  );
}

function getReservedQuantity(product) {
  return Number(
    product?.reservedQuantity ?? 0
  );
}

function getSoldQuantity(product) {
  return Number(
    product?.soldQuantity ?? 0
  );
}

export default function ReportsStatisticsPage() {
  const navigate = useNavigate();

  const [report, setReport] = useState(
    EMPTY_REPORT
  );

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dealerRequests, setDealerRequests] =
    useState([]);
  const [schemes, setSchemes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [orderFilter, setOrderFilter] =
    useState("all");

  useEffect(() => {
    loadReports();
  }, []);

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });
  }

  async function readFirstExisting(paths) {
    for (const path of paths) {
      try {
        const snapshot = await get(
          ref(database, path)
        );

        if (snapshot.exists()) {
          return snapshot.val();
        }
      } catch (error) {
        console.warn(
          `Unable to read ${path}:`,
          error
        );
      }
    }

    return null;
  }

  async function loadReports() {
    try {
      setLoading(true);

      /*
       * USERS
       * users/{uid}
       */
      const usersSnapshot = await get(
        ref(database, "users")
      );

      const loadedUsers = usersSnapshot.exists()
        ? getArrayFromFirebase(
            usersSnapshot.val()
          )
        : [];

      /*
       * DEALER REQUESTS
       */
      const dealerRequestsSnapshot =
        await get(
          ref(database, "dealerRequests")
        );

      const loadedDealerRequests =
        dealerRequestsSnapshot.exists()
          ? getArrayFromFirebase(
              dealerRequestsSnapshot.val()
            )
          : [];

      /*
       * PRODUCTS
       *
       * Existing dealer structure:
       *
       * dealerProducts/{dealerUid}/{productId}
       */
      const productsSnapshot = await get(
        ref(database, "dealerProducts")
      );

      const loadedProducts = [];

      if (productsSnapshot.exists()) {
        const dealerGroups =
          productsSnapshot.val();

        Object.entries(dealerGroups).forEach(
          ([dealerUid, dealerProducts]) => {
            if (!isObject(dealerProducts)) {
              return;
            }

            Object.entries(
              dealerProducts
            ).forEach(
              ([productId, product]) => {
                if (!isObject(product)) {
                  return;
                }

                loadedProducts.push({
                  id: productId,
                  dealerUid,
                  ...product,
                });
              }
            );
          }
        );
      }

      /*
       * ORDERS
       *
       * Primary: dealerOrders
       * Fallback: orders
       */
      const ordersData =
        await readFirstExisting([
          "dealerOrders",
          "orders",
        ]);

      let loadedOrders = [];

      if (ordersData) {
        if (isObject(ordersData)) {
          const directOrders =
            getArrayFromFirebase(
              ordersData
            );

          const looksNested =
            directOrders.length > 0 &&
            directOrders.every(
              (item) =>
                isObject(item) &&
                !item.status &&
                !item.orderStatus &&
                Object.values(item).some(
                  (value) => isObject(value)
                )
            );

          if (looksNested) {
            loadedOrders = [];

            Object.entries(
              ordersData
            ).forEach(
              ([groupId, group]) => {
                if (!isObject(group)) {
                  return;
                }

                Object.entries(group).forEach(
                  ([orderId, order]) => {
                    if (!isObject(order)) {
                      return;
                    }

                    loadedOrders.push({
                      id: orderId,
                      groupId,
                      ...order,
                    });
                  }
                );
              }
            );
          } else {
            loadedOrders =
              directOrders;
          }
        }
      }

      /*
       * GOVERNMENT SCHEMES
       */
      const schemesData =
        await readFirstExisting([
          "governmentSchemes",
          "schemes",
        ]);

      const loadedSchemes =
        schemesData
          ? getArrayFromFirebase(
              schemesData
            )
          : [];

      /*
       * USER COUNTS
       */
      let farmers = 0;
      let dealers = 0;
      let admins = 0;

      loadedUsers.forEach((user) => {
        const role = normalize(user.role);
        const status = normalize(
          user.status
        );

        const active =
          !status ||
          status === "approved" ||
          status === "active";

        if (role === "farmer") {
          farmers++;
        }

        if (role === "dealer" && active) {
          dealers++;
        }

        if (role === "admin" && active) {
          admins++;
        }
      });

      /*
       * PRODUCT STATISTICS
       */
      let availableProducts = 0;
      let outOfStockProducts = 0;
      let lowStockProducts = 0;
      let totalStock = 0;
      let reservedStock = 0;
      let soldStock = 0;

      loadedProducts.forEach(
        (product) => {
          const quantity =
            getProductQuantity(product);

          const reserved =
            getReservedQuantity(product);

          const sold =
            getSoldQuantity(product);

          const lowStockLevel =
            Number(
              product.lowStockLevel ?? 5
            );

          totalStock += quantity;
          reservedStock += reserved;
          soldStock += sold;

          if (
            quantity > 0
          ) {
            availableProducts++;
          } else {
            outOfStockProducts++;
          }

          if (
            quantity <= lowStockLevel
          ) {
            lowStockProducts++;
          }
        }
      );

      /*
       * SAVE REPORT
       */
      setUsers(loadedUsers);
      setProducts(loadedProducts);
      setOrders(loadedOrders);
      setDealerRequests(
        loadedDealerRequests
      );
      setSchemes(loadedSchemes);

      setReport({
        farmers,
        dealers,
        admins,
        totalUsers:
          loadedUsers.length,
        dealerRequests:
          loadedDealerRequests.length,
        products:
          loadedProducts.length,
        orders:
          loadedOrders.length,
        schemes:
          loadedSchemes.length,
        availableProducts,
        outOfStockProducts,
        lowStockProducts,
        totalStock,
        reservedStock,
        soldStock,
      });

      setMessage(null);
    } catch (error) {
      console.error(
        "Reports statistics error:",
        error
      );

      showMessage(
        "error",
        "Unable to load reports. Check Firebase database access and rules."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadReports();
  }

  function handleLogout() {
    localStorage.removeItem("role");

    navigate("/role-selection", {
      replace: true,
    });
  }

  /*
   * USER ROLE DATA
   */
  const userRoleData = useMemo(
    () => [
      {
        label: "Farmers",
        value: report.farmers,
        color: "bg-green-500",
        text: "text-green-700",
      },
      {
        label: "Dealers",
        value: report.dealers,
        color: "bg-orange-500",
        text: "text-orange-700",
      },
      {
        label: "Admins",
        value: report.admins,
        color: "bg-gray-500",
        text: "text-gray-700",
      },
    ],
    [report]
  );

  const largestUserRole =
    Math.max(
      report.farmers,
      report.dealers,
      report.admins,
      1
    );

  /*
   * PRODUCT CATEGORY STATISTICS
   */
  const categoryData = useMemo(() => {
    const counts = {};

    products.forEach((product) => {
      const category =
        getProductCategory(product);

      counts[category] =
        (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort(
        (a, b) => b.value - a.value
      );
  }, [products]);

  const largestCategory =
    Math.max(
      ...categoryData.map(
        (item) => item.value
      ),
      1
    );

  /*
   * ORDER STATUS STATISTICS
   */
  const orderStatusData = useMemo(() => {
    const counts = {};

    orders.forEach((order) => {
      const status =
        getOrderStatus(order);

      counts[status] =
        (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort(
        (a, b) => b.value - a.value
      );
  }, [orders]);

  /*
   * RECENT USERS
   */
  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => {
        const first =
          new Date(
            b.createdAt ||
              b.registeredAt ||
              b.updatedAt ||
              0
          ).getTime();

        const second =
          new Date(
            a.createdAt ||
              a.registeredAt ||
              a.updatedAt ||
              0
          ).getTime();

        return first - second;
      })
      .slice(0, 8);
  }, [users]);

  /*
   * LOW STOCK PRODUCTS
   */
  const lowStockProducts = useMemo(() => {
    return products
      .filter((product) => {
        const quantity =
          getProductQuantity(product);

        const level =
          Number(
            product.lowStockLevel ?? 5
          );

        return quantity <= level;
      })
      .sort(
        (a, b) =>
          getProductQuantity(a) -
          getProductQuantity(b)
      )
      .slice(0, 8);
  }, [products]);

  /*
   * ORDER FILTER
   */
  const filteredOrders = useMemo(() => {
    const term =
      searchTerm.trim().toLowerCase();

    return orders
      .filter((order) => {
        const status =
          getOrderStatus(order);

        if (
          orderFilter !== "all" &&
          status !== orderFilter
        ) {
          return false;
        }

        if (!term) {
          return true;
        }

        const searchable = [
          order.id,
          order.orderId,
          order.customerName,
          order.farmerName,
          order.farmerEmail,
          order.dealerName,
          order.status,
          order.orderStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      })
      .slice(0, 15);
  }, [
    orders,
    orderFilter,
    searchTerm,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-green-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <StatusMessage
          message={message}
          onClose={() =>
            setMessage(null)
          }
        />

        {/* HEADER */}
        <header className="bg-gradient-to-r from-green-950 via-green-800 to-green-600 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>
              <button
                type="button"
                onClick={() =>
                  navigate("/admin")
                }
                className="text-green-100 hover:text-white text-sm font-semibold mb-3"
              >
                ← Admin Dashboard
              </button>

              <h1 className="text-3xl md:text-4xl font-bold">
                Reports & Statistics
              </h1>

              <p className="text-green-100 mt-2">
                Monitor AgriSathi platform activity,
                users, products and orders.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                onClick={handleRefresh}
                disabled={
                  loading || refreshing
                }
                className="bg-white/15 hover:bg-white/25 px-5 py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {refreshing
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="bg-white text-green-800 px-5 py-3 rounded-xl font-semibold hover:bg-green-50"
              >
                Logout
              </button>

            </div>
          </div>
        </header>

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">

          <ReportCard
            title="Total Users"
            value={report.totalUsers}
            icon="👥"
            description="Registered accounts"
            color="green"
            loading={loading}
          />

          <ReportCard
            title="Products"
            value={report.products}
            icon="📦"
            description="Dealer product listings"
            color="cyan"
            loading={loading}
          />

          <ReportCard
            title="Orders"
            value={report.orders}
            icon="🛒"
            description="Platform orders"
            color="blue"
            loading={loading}
          />

          <ReportCard
            title="Schemes"
            value={report.schemes}
            icon="🌾"
            description="Government schemes"
            color="yellow"
            loading={loading}
          />

        </section>

        {/* USER STATISTICS */}
        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 mb-6">

          <div className="mb-5">
            <h2 className="text-2xl font-bold text-green-900">
              👥 User Statistics
            </h2>

            <p className="text-gray-600 mt-1">
              Distribution of registered platform users.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">

            {userRoleData.map((item) => (
              <div
                key={item.label}
                className="border border-gray-100 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">
                    {item.label}
                  </span>

                  <span
                    className={`text-2xl font-bold ${item.text}`}
                  >
                    {loading
                      ? "..."
                      : formatNumber(
                          item.value
                        )}
                  </span>
                </div>

                <div className="h-3 bg-gray-100 rounded-full mt-4 overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all`}
                    style={{
                      width: `${
                        (item.value /
                          largestUserRole) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}

          </div>
        </section>

        {/* DEALER REQUESTS + PRODUCT STOCK */}
        <section className="grid lg:grid-cols-2 gap-6 mb-6">

          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 md:p-6">

            <h2 className="text-xl font-bold text-orange-900">
              🏪 Dealer Requests
            </h2>

            <p className="text-gray-600 text-sm mt-1">
              Current dealer registration requests.
            </p>

            <div className="mt-5 flex items-center justify-between bg-orange-50 rounded-2xl p-5">

              <div>
                <p className="text-sm text-orange-700">
                  Pending Requests
                </p>

                <p className="text-4xl font-bold text-orange-900 mt-1">
                  {loading
                    ? "..."
                    : formatNumber(
                        report.dealerRequests
                      )}
                </p>
              </div>

              <div className="text-5xl">
                📋
              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/admin/dealer-requests"
                )
              }
              className="w-full mt-4 bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700"
            >
              Manage Dealer Requests →
            </button>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-cyan-100 p-5 md:p-6">

            <h2 className="text-xl font-bold text-cyan-900">
              📦 Product Stock
            </h2>

            <p className="text-gray-600 text-sm mt-1">
              Current inventory overview.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-5">

              <MiniStat
                label="Available"
                value={
                  report.availableProducts
                }
                className="bg-green-50 text-green-800"
                loading={loading}
              />

              <MiniStat
                label="Low Stock"
                value={
                  report.lowStockProducts
                }
                className="bg-yellow-50 text-yellow-800"
                loading={loading}
              />

              <MiniStat
                label="Out of Stock"
                value={
                  report.outOfStockProducts
                }
                className="bg-red-50 text-red-800"
                loading={loading}
              />

            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">

              <MiniStat
                label="Total Stock"
                value={report.totalStock}
                className="bg-blue-50 text-blue-800"
                loading={loading}
              />

              <MiniStat
                label="Reserved"
                value={report.reservedStock}
                className="bg-purple-50 text-purple-800"
                loading={loading}
              />

              <MiniStat
                label="Sold"
                value={report.soldStock}
                className="bg-orange-50 text-orange-800"
                loading={loading}
              />

            </div>

          </div>

        </section>

        {/* PRODUCT CATEGORIES */}
        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 mb-6">

          <div className="mb-5">
            <h2 className="text-2xl font-bold text-green-900">
              🛒 Product Categories
            </h2>

            <p className="text-gray-600 mt-1">
              Distribution of dealer products by category.
            </p>
          </div>

          {categoryData.length === 0 ? (
            <EmptyState
              icon="📦"
              text="No product category data available."
            />
          ) : (
            <div className="space-y-4">

              {categoryData.map(
                (item) => (
                  <div key={item.label}>

                    <div className="flex justify-between text-sm mb-1">

                      <span className="font-semibold text-gray-700">
                        {item.label}
                      </span>

                      <span className="font-bold text-green-800">
                        {item.value}
                      </span>

                    </div>

                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">

                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{
                          width: `${
                            (item.value /
                              largestCategory) *
                            100
                          }%`,
                        }}
                      />

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* ORDER STATISTICS */}
        <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5 md:p-6 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">

            <div>
              <h2 className="text-2xl font-bold text-blue-900">
                🛍️ Order Statistics
              </h2>

              <p className="text-gray-600 mt-1">
                Current order status distribution.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/admin/orders")
              }
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700"
            >
              Open Orders →
            </button>

          </div>

          {orderStatusData.length === 0 ? (
            <EmptyState
              icon="🛒"
              text="No order data available."
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {orderStatusData.map(
                (item) => (
                  <div
                    key={item.label}
                    className="bg-blue-50 rounded-2xl p-5"
                  >

                    <p className="text-sm text-blue-700 capitalize">
                      {item.label.replace(
                        /_/g,
                        " "
                      )}
                    </p>

                    <p className="text-3xl font-bold text-blue-900 mt-1">
                      {item.value}
                    </p>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* LOW STOCK ALERTS */}
        <section className="bg-white rounded-2xl shadow-sm border border-red-100 p-5 md:p-6 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">

            <div>
              <h2 className="text-2xl font-bold text-red-900">
                ⚠️ Low Stock Alerts
              </h2>

              <p className="text-gray-600 mt-1">
                Products that reached their configured low-stock level.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/admin/products")
              }
              className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-red-700"
            >
              View Products →
            </button>

          </div>

          {lowStockProducts.length === 0 ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-green-800">
              No low-stock products currently detected.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">

              {lowStockProducts.map(
                (product) => (
                  <div
                    key={`${product.dealerUid}-${product.id}`}
                    className="border border-red-100 rounded-2xl p-4"
                  >

                    <div className="flex justify-between gap-4">

                      <div>
                        <h3 className="font-bold text-gray-900">
                          {product.productName ||
                            "Unnamed product"}
                        </h3>

                        <p className="text-sm text-gray-500 mt-1">
                          {product.category ||
                            "Other"}
                        </p>
                      </div>

                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold h-fit">
                        Low stock
                      </span>

                    </div>

                    <div className="flex justify-between mt-4">

                      <span className="text-sm text-gray-500">
                        Available
                      </span>

                      <span className="font-bold text-red-700">
                        {getProductQuantity(
                          product
                        )}{" "}
                        {product.unit || ""}
                      </span>

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* RECENT USERS */}
        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 mb-6">

          <div className="mb-5">
            <h2 className="text-2xl font-bold text-green-900">
              👤 Recent Registrations
            </h2>

            <p className="text-gray-600 mt-1">
              Recently registered platform accounts.
            </p>
          </div>

          {recentUsers.length === 0 ? (
            <EmptyState
              icon="👥"
              text="No registered users available."
            />
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead>
                  <tr className="border-b border-gray-200">

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Name
                    </th>

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Role
                    </th>

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Email
                    </th>

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Registered
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {recentUsers.map(
                    (user) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-100"
                      >

                        <td className="py-3 px-3 font-semibold text-gray-800">
                          {user.name ||
                            user.fullName ||
                            "Unknown"}
                        </td>

                        <td className="py-3 px-3">

                          <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold capitalize">
                            {user.role ||
                              "Unknown"}
                          </span>

                        </td>

                        <td className="py-3 px-3 text-sm text-gray-600">
                          {user.email ||
                            "—"}
                        </td>

                        <td className="py-3 px-3 text-sm text-gray-600">
                          {formatDate(
                            user.createdAt ||
                              user.registeredAt
                          )}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* ORDER TABLE */}
        <section className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 md:p-6 mb-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">

            <div>
              <h2 className="text-2xl font-bold text-indigo-900">
                📋 Order Activity
              </h2>

              <p className="text-gray-600 mt-1">
                Search and inspect recent platform orders.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search orders..."
                className="border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200"
              />

              <select
                value={orderFilter}
                onChange={(event) =>
                  setOrderFilter(
                    event.target.value
                  )
                }
                className="border border-gray-300 rounded-xl px-4 py-2.5"
              >
                <option value="all">
                  All statuses
                </option>

                {orderStatusData.map(
                  (item) => (
                    <option
                      key={item.label}
                      value={item.label}
                    >
                      {item.label.replace(
                        /_/g,
                        " "
                      )}
                    </option>
                  )
                )}
              </select>

            </div>

          </div>

          {filteredOrders.length === 0 ? (
            <EmptyState
              icon="📋"
              text="No matching orders found."
            />
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead>
                  <tr className="border-b border-gray-200">

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Order
                    </th>

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Farmer
                    </th>

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Dealer
                    </th>

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Status
                    </th>

                    <th className="py-3 px-3 text-sm text-gray-500">
                      Date
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredOrders.map(
                    (order, index) => {
                      const status =
                        getOrderStatus(
                          order
                        );

                      return (
                        <tr
                          key={
                            order.id ||
                            index
                          }
                          className="border-b border-gray-100"
                        >

                          <td className="py-3 px-3 font-semibold text-gray-800">
                            {order.orderId ||
                              order.id ||
                              `Order ${index + 1}`}
                          </td>

                          <td className="py-3 px-3 text-sm text-gray-600">
                            {order.customerName ||
                              order.farmerName ||
                              "—"}
                          </td>

                          <td className="py-3 px-3 text-sm text-gray-600">
                            {order.dealerName ||
                              "—"}
                          </td>

                          <td className="py-3 px-3">

                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold capitalize">
                              {status.replace(
                                /_/g,
                                " "
                              )}
                            </span>

                          </td>

                          <td className="py-3 px-3 text-sm text-gray-600">
                            {formatDate(
                              order.createdAt ||
                                order.orderDate ||
                                order.updatedAt
                            )}
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* GOVERNMENT SCHEMES */}
        <section className="bg-white rounded-2xl shadow-sm border border-yellow-100 p-5 md:p-6 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

            <div>
              <h2 className="text-2xl font-bold text-yellow-900">
                🌾 Government Schemes
              </h2>

              <p className="text-gray-600 mt-1">
                Government schemes currently available in AgriSathi.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/admin/schemes")
              }
              className="bg-yellow-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-yellow-700"
            >
              Manage Schemes →
            </button>

          </div>

          <div className="mt-5 bg-yellow-50 rounded-2xl p-5">

            <p className="text-sm text-yellow-700">
              Total schemes
            </p>

            <p className="text-4xl font-bold text-yellow-900 mt-1">
              {loading
                ? "..."
                : formatNumber(
                    report.schemes
                  )}
            </p>

          </div>

        </section>

        {/* FOOTER ACTIONS */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">

          <QuickAction
            icon="👨‍🌾"
            title="Farmers"
            path="/admin/farmers"
            navigate={navigate}
          />

          <QuickAction
            icon="🏪"
            title="Dealers"
            path="/admin/dealers"
            navigate={navigate}
          />

          <QuickAction
            icon="📦"
            title="Products"
            path="/admin/products"
            navigate={navigate}
          />

          <QuickAction
            icon="🛒"
            title="Orders"
            path="/admin/orders"
            navigate={navigate}
          />

        </section>

      </div>
    </div>
  );
}

/* ==============================
   REUSABLE COMPONENTS
============================== */

function ReportCard({
  title,
  value,
  icon,
  description,
  color,
  loading,
}) {
  const colors = {
    green:
      "bg-green-50 border-green-100 text-green-800",
    cyan:
      "bg-cyan-50 border-cyan-100 text-cyan-800",
    blue:
      "bg-blue-50 border-blue-100 text-blue-800",
    yellow:
      "bg-yellow-50 border-yellow-100 text-yellow-800",
  };

  return (
    <div
      className={`${colors[color] || colors.green} border rounded-2xl shadow-sm p-5`}
    >
      <div className="flex justify-between gap-3">

        <div>
          <p className="text-sm font-semibold opacity-80">
            {title}
          </p>

          <p className="text-4xl font-bold mt-2">
            {loading
              ? "..."
              : formatNumber(value)}
          </p>

          <p className="text-xs opacity-70 mt-1">
            {description}
          </p>
        </div>

        <div className="text-4xl">
          {icon}
        </div>

      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  className,
  loading,
}) {
  return (
    <div
      className={`${className} rounded-xl p-3 text-center`}
    >
      <p className="text-xs opacity-70">
        {label}
      </p>

      <p className="text-xl font-bold mt-1">
        {loading
          ? "..."
          : formatNumber(value)}
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  text,
}) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center">

      <div className="text-4xl">
        {icon}
      </div>

      <p className="text-gray-600 mt-3">
        {text}
      </p>

    </div>
  );
}

function QuickAction({
  icon,
  title,
  path,
  navigate,
}) {
  return (
    <button
      type="button"
      onClick={() =>
        navigate(path)
      }
      className="bg-white border border-green-100 rounded-2xl p-5 text-left shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all"
    >
      <div className="text-3xl">
        {icon}
      </div>

      <p className="font-bold text-green-900 mt-3">
        {title}
      </p>

      <p className="text-sm text-gray-500 mt-1">
        Open management
      </p>
    </button>
  );
}