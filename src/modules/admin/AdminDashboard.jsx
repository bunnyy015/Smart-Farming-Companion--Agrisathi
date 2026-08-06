import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    farmers: 0,
    kvk: 0,
    dealers: 0,
    sos: 0,
    pendingDealers: 0,
    pendingKvk: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    try {
      setLoading(true);

      const usersSnapshot = await get(
        ref(database, "users")
      );

      let farmers = 0;
      let kvk = 0;
      let dealers = 0;

      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();

        Object.values(users).forEach((user) => {
          if (!user) return;

          if (user.role === "farmer") {
            farmers++;
          }

          if (
            user.role === "kvk" &&
            user.status === "approved"
          ) {
            kvk++;
          }

          if (
            user.role === "dealer" &&
            user.status === "approved"
          ) {
            dealers++;
          }
        });
      }

      const dealerRequestsSnapshot = await get(
        ref(database, "dealerRequests")
      );

      const kvkRequestsSnapshot = await get(
        ref(database, "kvkRequests")
      );

      const sosSnapshot = await get(
        ref(database, "sosRequests")
      );

      const pendingDealers =
        dealerRequestsSnapshot.exists()
          ? Object.keys(
              dealerRequestsSnapshot.val()
            ).length
          : 0;

      const pendingKvk =
        kvkRequestsSnapshot.exists()
          ? Object.keys(
              kvkRequestsSnapshot.val()
            ).length
          : 0;

      const sos = sosSnapshot.exists()
        ? Object.keys(
            sosSnapshot.val()
          ).length
        : 0;

      setStats({
        farmers,
        kvk,
        dealers,
        sos,
        pendingDealers,
        pendingKvk,
      });
    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    {
      title: "Total Farmers",
      value: stats.farmers,
      icon: "👨‍🌾",
      path: "/admin/farmers",
    },
    {
      title: "KVK Officers",
      value: stats.kvk,
      icon: "🏛️",
      path: "/admin/kvk-officers",
    },
    {
      title: "Dealers",
      value: stats.dealers,
      icon: "🏪",
      path: "/admin/dealers",
    },
    {
      title: "SOS Requests",
      value: stats.sos,
      icon: "🚨",
      path: "/admin/sos",
    },
  ];

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg shadow-sm border border-green-200 hover:bg-green-50 transition font-medium"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold">
            🛡️ Admin Dashboard
          </h1>

          <p className="text-green-100 mt-2">
            Manage the AgriSaathi Platform
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {cards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => navigate(card.path)}
              className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 text-left hover:shadow-md hover:border-green-300 transition"
            >
              <div className="flex items-center justify-between">
                <div className="text-3xl">
                  {card.icon}
                </div>

                <span className="text-green-600 text-sm">
                  View →
                </span>
              </div>

              <p className="text-gray-500 text-sm mt-3">
                {card.title}
              </p>

              <p className="text-3xl font-bold text-green-700 mt-1">
                {loading ? "—" : card.value}
              </p>
            </button>
          ))}
        </div>

        {/* Management Buttons */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Farmers */}
          <button
            type="button"
            onClick={() =>
              navigate("/admin/farmers")
            }
            className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 text-left hover:shadow-md transition"
          >
            <h2 className="text-xl font-bold">
              👨‍🌾 View Farmers
            </h2>

            <p className="text-gray-600 mt-1">
              View all registered farmers
            </p>
          </button>

          {/* Dealer Requests */}
          <button
            type="button"
            onClick={() =>
              navigate("/admin/dealer-requests")
            }
            className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 text-left hover:shadow-md transition"
          >
            <h2 className="text-xl font-bold">
              🏪 Dealer Requests
            </h2>

            <p className="text-gray-600 mt-1">
              {stats.pendingDealers} pending dealer request
              {stats.pendingDealers !== 1
                ? "s"
                : ""}
            </p>
          </button>

          {/* KVK Requests */}
          <button
            type="button"
            onClick={() =>
              navigate("/admin/kvk-requests")
            }
            className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 text-left hover:shadow-md transition"
          >
            <h2 className="text-xl font-bold">
              🏛️ KVK Requests
            </h2>

            <p className="text-gray-600 mt-1">
              {stats.pendingKvk} pending KVK request
              {stats.pendingKvk !== 1
                ? "s"
                : ""}
            </p>
          </button>

          {/* SOS */}
          <button
            type="button"
            onClick={() =>
              navigate("/admin/sos")
            }
            className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 text-left hover:shadow-md transition"
          >
            <h2 className="text-xl font-bold">
              🚨 SOS Requests
            </h2>

            <p className="text-gray-600 mt-1">
              Monitor emergency alerts
            </p>
          </button>

        </div>
      </div>
    </div>
  );
}