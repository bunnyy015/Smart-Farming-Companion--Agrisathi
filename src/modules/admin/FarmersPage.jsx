import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function FarmersPage() {
  const [farmers, setFarmers] = useState([]);

  useEffect(() => {
    loadFarmers();
  }, []);

  async function loadFarmers() {
    const snapshot = await get(ref(database, "users"));

    if (snapshot.exists()) {
      const users = snapshot.val();

      const farmerList = Object.values(users).filter(
        (user) => user.role === "farmer"
      );

      setFarmers(farmerList);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        👨‍🌾 Registered Farmers
      </h1>

      <div className="space-y-4">
        {farmers.map((farmer, index) => (
          <div
            key={index}
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
  );
}