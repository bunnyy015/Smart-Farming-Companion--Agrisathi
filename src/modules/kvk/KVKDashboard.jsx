import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../../firebase";

export default function KVKDashboard() {
  const navigate = useNavigate();

  const [officer, setOfficer] = useState(null);
  const [stats, setStats] = useState({
    activeSOS: 0,
    communityPosts: 0,
    farmers: 0,
    diseaseReports: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const userSnapshot = await get(
        ref(database, `users/${currentUser.uid}`)
      );

      if (!userSnapshot.exists()) {
        navigate("/login");
        return;
      }

      const userData = userSnapshot.val();

      if (userData.role !== "kvk") {
        navigate("/role-selection");
        return;
      }

      setOfficer(userData);

      const sosSnapshot = await get(ref(database, "sosRequests"));
      const usersSnapshot = await get(ref(database, "users"));
      const communitySnapshot = await get(ref(database, "communityPosts"));

      const sosData = sosSnapshot.exists() ? sosSnapshot.val() : {};
      const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};
      const communityData = communitySnapshot.exists()
        ? communitySnapshot.val()
        : {};

      const activeSOS = Object.values(sosData).filter(
        (item) => item.status !== "resolved"
      ).length;

      const farmers = Object.values(usersData).filter(
        (item) => item.role === "farmer"
      ).length;

      const communityPosts = Object.keys(communityData).length;

      const diseaseReports = Object.values(communityData).filter((post) => {
        const text = `${post.title || ""} ${post.description || ""}`.toLowerCase();

        return (
          text.includes("disease") ||
          text.includes("leaf") ||
          text.includes("spots") ||
          text.includes("crop") ||
          text.includes("pest")
        );
      }).length;

      setStats({
        activeSOS,
        communityPosts,
        farmers,
        diseaseReports,
      });
    } catch (error) {
      console.error(error);
      alert("Failed to load KVK dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    localStorage.removeItem("role");
    navigate("/role-selection");
  }

  function comingSoon(feature) {
    alert(`${feature} page will be added next.`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading KVK Dashboard...
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-green-700">
                🏛️ KVK Officer Dashboard
              </h1>

              <p className="text-gray-600 mt-2">
                Welcome, {officer?.officerName || "KVK Officer"}
              </p>

              <p className="text-sm text-gray-500 mt-1">
                {officer?.kvkCenter || "KVK Center"} •{" "}
                {officer?.district || "District not available"}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-4xl mb-3">🚨</div>
            <h3 className="text-gray-500 text-sm">Active SOS</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {stats.activeSOS}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-4xl mb-3">🌾</div>
            <h3 className="text-gray-500 text-sm">Disease Reports</h3>
            <p className="text-3xl font-bold text-green-700 mt-2">
              {stats.diseaseReports}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-4xl mb-3">👨‍🌾</div>
            <h3 className="text-gray-500 text-sm">Farmers</h3>
            <p className="text-3xl font-bold text-green-700 mt-2">
              {stats.farmers}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-gray-500 text-sm">Community Posts</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {stats.communityPosts}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-700 mb-4">
            Officer Details
          </h2>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <p>
              <span className="font-semibold">Officer Name:</span>{" "}
              {officer?.officerName || "Not available"}
            </p>

            <p>
              <span className="font-semibold">Designation:</span>{" "}
              {officer?.designation || "Not available"}
            </p>

            <p>
              <span className="font-semibold">KVK Center:</span>{" "}
              {officer?.kvkCenter || "Not available"}
            </p>

            <p>
              <span className="font-semibold">Employee ID:</span>{" "}
              {officer?.employeeId || "Not available"}
            </p>

            <p>
              <span className="font-semibold">Email:</span>{" "}
              {officer?.email || "Not available"}
            </p>

            <p>
              <span className="font-semibold">Phone:</span>{" "}
              {officer?.phone || "Not available"}
            </p>

            <p>
              <span className="font-semibold">District:</span>{" "}
              {officer?.district || "Not available"}
            </p>

            <p>
              <span className="font-semibold">State:</span>{" "}
              {officer?.state || "Not available"}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <button
            onClick={() => navigate("/kvk/sos")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <h2 className="text-2xl font-bold text-red-600">
              🚨 SOS Requests
            </h2>

            <p className="text-gray-600 mt-2">
              View emergency farmer requests and mark them as resolved.
            </p>
          </button>

          <button
            onClick={() => navigate("/kvk/community")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <h2 className="text-2xl font-bold text-green-700">
              👥 Community Expert Replies
            </h2>

            <p className="text-gray-600 mt-2">
              Reply to farmer questions as a verified KVK expert.
            </p>
          </button>

          <button
            onClick={() => comingSoon("Crop Disease Reports")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <h2 className="text-2xl font-bold text-green-700">
              🌾 Crop Disease Reports
            </h2>

            <p className="text-gray-600 mt-2">
              Monitor crop disease issues reported by farmers.
            </p>
          </button>

          <button
            onClick={() => comingSoon("Advisory Posts")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl transition"
          >
            <h2 className="text-2xl font-bold text-green-700">
              📢 Publish Advisory
            </h2>

            <p className="text-gray-600 mt-2">
              Share crop advice, weather alerts and government announcements.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
