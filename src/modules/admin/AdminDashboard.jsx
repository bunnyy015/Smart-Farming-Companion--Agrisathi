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
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const usersSnapshot = await get(ref(database, "users"));

      let farmers = 0;
      let kvk = 0;
      let dealers = 0;

      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();

        Object.values(users).forEach((user) => {
          if (user.role === "farmer") farmers++;
          if (user.role === "kvk") kvk++;
          if (user.role === "dealer") dealers++;
        });
      }

      const sosSnapshot = await get(
        ref(database, "sosRequests")
      );

      const sos = sosSnapshot.exists()
        ? Object.keys(sosSnapshot.val()).length
        : 0;

      setStats({
        farmers,
        kvk,
        dealers,
        sos,
      });
    } catch (error) {
      console.error(error);
    }
  }

  const cards = [
    {
      title: "Total Farmers",
      value: stats.farmers,
      icon: "👨‍🌾",
    },
    {
      title: "KVK Officers",
      value: stats.kvk,
      icon: "🏛️",
    },
    {
      title: "Dealers",
      value: stats.dealers,
      icon: "🏪",
    },
    {
      title: "SOS Requests",
      value: stats.sos,
      icon: "🚨",
    },
  ];

  return (
    <div className="min-h-screen bg-green-50 p-6">

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          🛡️ Admin Dashboard
        </h1>

        <p className="text-gray-600 mt-2">
          Manage the AgriSaathi Platform
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-5 mb-8">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="text-4xl mb-3">
              {card.icon}
            </div>

            <h3 className="text-gray-500 text-sm">
              {card.title}
            </h3>

            <p className="text-3xl font-bold text-green-700 mt-2">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">

        <button
          onClick={() => navigate("/admin/farmers")}
          className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
        >
          <h2 className="text-xl font-bold">
            👨‍🌾 View Farmers
          </h2>

          <p className="text-gray-600 mt-2">
            View all registered farmers
          </p>
        </button>

        <button
          onClick={() => navigate("/admin/dealer-requests")}
          className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
        >
          <h2 className="text-xl font-bold">
            🏪 Dealer Requests
          </h2>

          <p className="text-gray-600 mt-2">
            Approve or reject dealer requests
          </p>
        </button>

        <button
          onClick={() => navigate("/admin/kvk-requests")}
          className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
        >
          <h2 className="text-xl font-bold">
            🏛️ KVK Requests
          </h2>

          <p className="text-gray-600 mt-2">
            Approve or reject KVK officer requests
          </p>
        </button>

        <button
          onClick={() => navigate("/admin/sos")}
          className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
        >
          <h2 className="text-xl font-bold">
            🚨 SOS Requests
          </h2>

          <p className="text-gray-600 mt-2">
            Monitor emergency alerts
          </p>
        </button>

      </div>
    </div>
  );
}