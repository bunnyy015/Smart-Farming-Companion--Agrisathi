import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function FarmersPage() {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);

  useEffect(() => {
    loadFarmers();
  }, []);

  async function loadFarmers() {
    try {
      const snapshot = await get(ref(database, "users"));

      if (snapshot.exists()) {
        const users = snapshot.val();

        const farmerList = Object.values(users).filter(
          (user) => user && user.role === "farmer"
        );

        setFarmers(farmerList);
      } else {
        setFarmers([]);
      }
    } catch (error) {
      console.error("Error loading farmers:", error);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg shadow-sm border border-green-200 hover:bg-green-50 transition font-medium"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold text-green-700 mb-6">
          👨‍🌾 Registered Farmers
        </h1>

        <div className="space-y-4">
          {farmers.map((farmer, index) => (
            <div
              key={farmer.uid || index}
              className="bg-white p-5 rounded-xl shadow"
            >
              <h2 className="font-bold text-lg">
                {farmer.name}
              </h2>

              <p>Email: {farmer.email}</p>
              <p>Phone: {farmer.phone}</p>
              <p>Village: {farmer.village}</p>
              <p>District: {farmer.district}</p>
              <p>Main Crop: {farmer.mainCrop}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}