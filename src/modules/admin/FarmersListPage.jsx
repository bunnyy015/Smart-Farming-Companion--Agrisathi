import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function FarmersListPage() {
  const [farmers, setFarmers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFarmers();
  }, []);

  async function loadFarmers() {
    try {
      const snapshot = await get(ref(database, "users"));

      if (!snapshot.exists()) return;

      const data = snapshot.val();

      const farmerList = [];

      Object.entries(data).forEach(([uid, user]) => {
        if (user.role === "farmer") {
          farmerList.push({
            uid,
            ...user,
          });
        }
      });

      setFarmers(farmerList);
    } catch (error) {
      console.error(error);
    }
  }

  const filteredFarmers = farmers.filter((farmer) =>
    (
      farmer.name +
      farmer.email +
      farmer.district +
      farmer.village
    )
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-green-50 p-6">

      <h1 className="text-4xl font-bold text-green-700 mb-6">
        👨‍🌾 Registered Farmers
      </h1>

      <input
        type="text"
        placeholder="Search farmer..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 border rounded-xl p-4"
      />

      <div className="grid md:grid-cols-2 gap-5">

        {filteredFarmers.map((farmer) => (
          <div
            key={farmer.uid}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <h2 className="text-2xl font-bold text-green-700">
              {farmer.name}
            </h2>

            <div className="mt-3 space-y-2">

              <p>
                📧 {farmer.email}
              </p>

              <p>
                📞 {farmer.phone}
              </p>

              <p>
                🏡 {farmer.village}
              </p>

              <p>
                🏙️ {farmer.district}
              </p>

              <p>
                🌱 {farmer.mainCrop}
              </p>

            </div>
          </div>
        ))}

      </div>
    </div>
  );
}