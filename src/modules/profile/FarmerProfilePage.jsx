import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../../firebase";
import { t } from "../../utils/language";

export default function FarmerProfilePage() {
  const navigate = useNavigate();

  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const farmerRef = ref(database, "farmers/" + user.uid);
      const snapshot = await get(farmerRef);

      if (snapshot.exists()) {
        setFarmer(snapshot.val());
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-green-50 p-4">
      <div className="bg-green-700 text-white p-4 rounded-xl shadow">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm mb-2"
        >
          Back
        </button>

        <h1 className="text-2xl font-bold">
          {t("farmerProfile")}
        </h1>

        <p>Farmer account information</p>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow p-5 mt-5 text-center">
          Loading profile...
        </div>
      )}

      {!loading && !farmer && (
        <div className="bg-white rounded-xl shadow p-5 mt-5 text-center">
          <p className="text-gray-700">
            No farmer profile found. Please create an account first.
          </p>

          <button
            onClick={() => navigate("/register")}
            className="bg-green-700 text-white px-5 py-3 rounded-lg mt-4 font-semibold"
          >
            Create Account
          </button>
        </div>
      )}

      {farmer && (
        <div className="bg-white rounded-xl shadow p-5 mt-5">
          <div className="text-center">
            <div className="text-6xl">👨‍🌾</div>

            <h2 className="text-2xl font-bold text-green-700 mt-3">
              {farmer.name}
            </h2>

            <p className="text-gray-600">
              {farmer.mainCrop} Farmer
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-semibold">{farmer.email}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-semibold">{farmer.phone}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Village</p>
              <p className="font-semibold">{farmer.village}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">District</p>
              <p className="font-semibold">{farmer.district}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">State</p>
              <p className="font-semibold">{farmer.state}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Main Crop</p>
              <p className="font-semibold">{farmer.mainCrop}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}