import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { database } from "../../firebase";

const EMPTY_REPORT = {
  farmers: 0,
  dealers: 0,
  kvk: 0,
  admins: 0,
  dealerRequests: 0,
  kvkRequests: 0,
  products: 0,
  orders: 0,
  schemes: 0,
  activeUsers: 0,
  disabledUsers: 0,
  farmerDistricts: {},
  dealerDistricts: {},
  orderStatuses: {},
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function countCollectionRecords(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return 0;
  }

  const entries = Object.values(data);

  if (!entries.length) return 0;

  const recordKeys = [
    "name",
    "title",
    "productName",
    "orderId",
    "customerName",
    "schemeName",
    "description",
    "price",
    "status",
  ];

  const recordLike = entries.filter((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return Object.keys(value).some((key) => recordKeys.includes(key));
  }).length;

  if (recordLike >= Math.ceil(entries.length / 2)) {
    return entries.length;
  }

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

function incrementMap(map, key) {
  const cleanKey = String(key || "").trim();

  if (!cleanKey) return;

  map[cleanKey] = (map[cleanKey] || 0) + 1;
}

function collectRecords(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  const entries = Object.entries(data);

  const recordKeys = [
    "name",
    "title",
    "productName",
    "orderId",
    "customerName",
    "schemeName",
    "description",
    "price",
    "status",
    "district",
    "role",
  ];

  const looksLikeRecord = (value) =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => recordKeys.includes(key));

  if (entries.some(([, value]) => looksLikeRecord(value))) {
    return entries.map(([id, value]) => ({
      id,
      ...(value || {}),
    }));
  }

  const records = [];

  entries.forEach(([groupId, group]) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      return;
    }

    Object.entries(group).forEach(([id, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        records.push({
          id,
          groupId,
          ...value,
        });
      }
    });
  });

  return records;
}

function getStatusLabel(status) {
  const value = normalize(status);

  if (!value) return "Unknown";

  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReportsStatisticsPage() {
  const navigate = useNavigate();

  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        usersSnapshot,
        dealerRequestsSnapshot,
        kvkRequestsSnapshot,
      ] = await Promise.all([
        get(ref(database, "users")),
        get(ref(database, "dealerRequests")),
        get(ref(database, "kvkRequests")),
      ]);

      let farmers = 0;
      let dealers = 0;
      let kvk = 0;
      let admins = 0;
      let activeUsers = 0;
      let disabledUsers = 0;

      const farmerDistricts = {};
      const dealerDistricts = {};

      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();

        Object.values(users || {}).forEach((user) => {
          if (!user || typeof user !== "object") return;

          const role = normalize(user.role);
          const status = normalize(user.status);

          const isDisabled = status === "disabled";

          if (isDisabled) {
            disabledUsers++;
          } else {
            activeUsers++;
          }

          if (role === "farmer") {
            farmers++;
            incrementMap(
              farmerDistricts,
              user.district || user.location
            );
          }

          if (role === "dealer") {
            if (
              !status ||
              status === "approved" ||
              status === "active"
            ) {
              dealers++;
            }

            incrementMap(
              dealerDistricts,
              user.district || user.location
            );
          }

          if (role === "kvk") {
            if (
              !status ||
              status === "approved" ||
              status === "active"
            ) {
              kvk++;
            }
          }

          if (role === "admin") {
            if (
              !status ||
              status === "approved" ||
              status === "active"
            ) {
              admins++;
            }
          }
        });
      }

      const dealerRequests = dealerRequestsSnapshot.exists()
        ? Object.keys(dealerRequestsSnapshot.val() || {}).length
        : 0;

      const kvkRequests = kvkRequestsSnapshot.exists()
        ? Object.keys(kvkRequestsSnapshot.val() || {}).length
        : 0;

      const productsData = await readFirstExistingCollection([
        "products",
        "dealerProducts",
      ]);

      const ordersData = await readFirstExistingCollection([
        "dealerOrders",
        "orders",
      ]);

      const schemesData = await readFirstExistingCollection([
        "governmentSchemes",
        "schemes",
      ]);

      const orders = collectRecords(ordersData);
      const orderStatuses = {};

      orders.forEach((order) => {
        const status =
          order.status ||
          order.orderStatus ||
          order.paymentStatus ||
          "unknown";

        const label = getStatusLabel(status);
        orderStatuses[label] = (orderStatuses[label] || 0) + 1;
      });

      setReport({
        farmers,
        dealers,
        kvk,
        admins,
        dealerRequests,
        kvkRequests,
        products: countCollectionRecords(productsData),
        orders: countCollectionRecords(ordersData),
        schemes: countCollectionRecords(schemesData),
        activeUsers,
        disabledUsers,
        farmerDistricts,
        dealerDistricts,
        orderStatuses,
      });
    } catch (error) {
      console.error("Reports statistics error:", error);

      setErrorMessage(
        "Unable to load reports. Check Firebase database access and database rules."
      );
    } finally {
      setLoading(false);
    }
  }

  const totalUsers =
    report.farmers +
    report.dealers +
    report.kvk +
    report.admins;

  const totalPending =
    report.dealerRequests + report.kvkRequests;

  const farmerDistrictList = useMemo(
    () =>
      Object.entries(report.farmerDistricts).sort(
        ([, a], [, b]) => b - a
      ),
    [report.farmerDistricts]
  );

  const dealerDistrictList = useMemo(
    () =>
      Object.entries(report.dealerDistricts).sort(
        ([, a], [, b]) => b - a
      ),
    [report.dealerDistricts]
  );

  const orderStatusList = useMemo(
    () =>
      Object.entries(report.orderStatuses).sort(
        ([, a], [, b]) => b - a
      ),
    [report.orderStatuses]
  );

  function exportReport() {
    const rows = [
      ["AgriSaathi Reports & Statistics"],
      [],
      ["Metric", "Value"],
      ["Total Users", totalUsers],
      ["Farmers", report.farmers],
      ["Dealers", report.dealers],
      ["KVK Officers", report.kvk],
      ["Admins", report.admins],
      ["Active Users", report.activeUsers],
      ["Disabled Users", report.disabledUsers],
      ["Pending Dealer Requests", report.dealerRequests],
      ["Pending KVK Requests", report.kvkRequests],
      ["Total Pending Approvals", totalPending],
      ["Products", report.products],
      ["Orders", report.orders],
      ["Government Schemes", report.schemes],
      [],
      ["Farmer District", "Count"],
      ...farmerDistrictList,
      [],
      ["Dealer District", "Count"],
      ...dealerDistrictList,
      [],
      ["Order Status", "Count"],
      ...orderStatusList,
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "agrisathi-reports.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const mainCards = [
    {
      title: "Farmers",
      value: report.farmers,
      icon: "👨‍🌾",
      bg: "bg-green-50",
      border: "border-green-100",
      text: "text-green-800",
    },
    {
      title: "Dealers",
      value: report.dealers,
      icon: "🏪",
      bg: "bg-orange-50",
      border: "border-orange-100",
      text: "text-orange-800",
    },
    {
      title: "KVK Officers",
      value: report.kvk,
      icon: "🏛️",
      bg: "bg-blue-50",
      border: "border-blue-100",
      text: "text-blue-800",
    },
    {
      title: "Admins",
      value: report.admins,
      icon: "🛡️",
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-800",
    },
  ];

  const platformCards = [
    {
      title: "Products",
      value: report.products,
      icon: "🛒",
      path: "/admin/products",
    },
    {
      title: "Orders",
      value: report.orders,
      icon: "📦",
      path: "/admin/orders",
    },
    {
      title: "Government Schemes",
      value: report.schemes,
      icon: "🌾",
      path: "/admin/schemes",
    },
    {
      title: "Pending Approvals",
      value: totalPending,
      icon: "📋",
      path: "/admin/approvals",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-gradient-to-r from-green-900 via-green-800 to-green-600 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
                  📊
                </div>

                <div>
                  <h1 className="text-3xl md:text-4xl font-bold">
                    Reports & Statistics
                  </h1>
                  <p className="text-green-100 mt-1">
                    AgriSaathi platform performance and activity overview
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl font-semibold transition"
              >
                ← Dashboard
              </button>

              <button
                type="button"
                onClick={loadReports}
                disabled={loading}
                className="bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={exportReport}
                disabled={loading}
                className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-green-50 transition disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6">
            <strong>Report Error:</strong> {errorMessage}
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {mainCards.map((card) => (
            <div
              key={card.title}
              className={`${card.bg} ${card.border} border rounded-2xl shadow-sm p-5`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    {card.title}
                  </p>
                  <p className={`text-4xl font-bold ${card.text} mt-2`}>
                    {loading ? "..." : card.value}
                  </p>
                </div>

                <div className="text-4xl">{card.icon}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 mb-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-green-900">
                Platform Overview
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Current records available in the AgriSaathi platform.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {platformCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => navigate(card.path)}
                className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left hover:bg-green-50 hover:border-green-200 transition"
              >
                <div className="text-3xl">{card.icon}</div>
                <p className="text-sm text-gray-600 mt-3">
                  {card.title}
                </p>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  {loading ? "..." : card.value}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7">
          <DistrictReport
            title="Farmers by District"
            icon="👨‍🌾"
            data={farmerDistrictList}
            loading={loading}
          />

          <DistrictReport
            title="Dealers by District"
            icon="🏪"
            data={dealerDistrictList}
            loading={loading}
          />
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 mb-7">
          <h2 className="text-2xl font-bold text-green-900">
            📦 Order Status
          </h2>

          <p className="text-gray-600 text-sm mt-1">
            Distribution of orders according to the status stored in Firebase.
          </p>

          {loading ? (
            <div className="text-gray-500 mt-5">Loading order statistics...</div>
          ) : orderStatusList.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-5 text-gray-600 mt-5">
              No order records available.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {orderStatusList.map(([status, count]) => (
                <div
                  key={status}
                  className="bg-indigo-50 border border-indigo-100 rounded-xl p-4"
                >
                  <p className="text-sm text-indigo-700">{status}</p>
                  <p className="text-3xl font-bold text-indigo-900 mt-1">
                    {count}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <MiniStat
            label="Total Users"
            value={totalUsers}
            icon="👥"
          />
          <MiniStat
            label="Active Users"
            value={report.activeUsers}
            icon="✅"
          />
          <MiniStat
            label="Disabled Users"
            value={report.disabledUsers}
            icon="🚫"
          />
          <MiniStat
            label="Pending Approvals"
            value={totalPending}
            icon="⏳"
          />
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6">
          <h2 className="text-xl font-bold text-green-900">
            📋 Approval Breakdown
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <MiniStat
              label="Dealer Requests"
              value={report.dealerRequests}
              icon="🏪"
            />
            <MiniStat
              label="KVK Requests"
              value={report.kvkRequests}
              icon="🏛️"
            />
            <MiniStat
              label="Total Pending"
              value={totalPending}
              icon="📋"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function DistrictReport({ title, icon, data, loading }) {
  const max = data.length
    ? Math.max(...data.map(([, count]) => count))
    : 0;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6">
      <h2 className="text-xl font-bold text-green-900">
        {icon} {title}
      </h2>

      {loading ? (
        <p className="text-gray-500 mt-5">Loading...</p>
      ) : data.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-5 text-gray-600 mt-5">
          District information is not available.
        </div>
      ) : (
        <div className="space-y-4 mt-5">
          {data.slice(0, 10).map(([district, count]) => {
            const percentage = max
              ? Math.max(8, (count / max) * 100)
              : 0;

            return (
              <div key={district}>
                <div className="flex justify-between gap-3 text-sm mb-1">
                  <span className="font-medium text-gray-700">
                    {district}
                  </span>
                  <span className="font-bold text-green-800">
                    {count}
                  </span>
                </div>

                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value, icon }) {
  return (
    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-green-700">{label}</p>
          <p className="text-2xl font-bold text-green-900 mt-1">
            {value}
          </p>
        </div>

        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}