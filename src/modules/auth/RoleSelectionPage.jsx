import { useNavigate } from "react-router-dom";

export default function RoleSelectionPage() {
  const navigate = useNavigate();

  const selectRole = (role) => {
    localStorage.setItem("role", role);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          🌾 AgriSaathi
        </h1>

        <p className="text-gray-600 mt-2">
          Select your role to continue
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 w-full max-w-4xl">
        <div
          onClick={() => selectRole("farmer")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition"
        >
          <div className="text-5xl mb-3">👨‍🌾</div>
          <h2 className="text-xl font-bold">Farmer</h2>
          <p className="text-gray-600 mt-2">
            Crop care, weather, market prices and irrigation.
          </p>
        </div>

        <div
          onClick={() => selectRole("admin")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition"
        >
          <div className="text-5xl mb-3">🛡️</div>
          <h2 className="text-xl font-bold">Admin</h2>
          <p className="text-gray-600 mt-2">
            Manage users, alerts, schemes and reports.
          </p>
        </div>

        <div
          onClick={() => selectRole("kvk")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition"
        >
          <div className="text-5xl mb-3">🏛️</div>
          <h2 className="text-xl font-bold">KVK Officer</h2>
          <p className="text-gray-600 mt-2">
            Handle SOS requests and farmer support.
          </p>
        </div>

        <div
          onClick={() => selectRole("dealer")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition"
        >
          <div className="text-5xl mb-3">🏪</div>
          <h2 className="text-xl font-bold">Dealer</h2>
          <p className="text-gray-600 mt-2">
            Manage products, stock and orders.
          </p>
        </div>
      </div>
    </div>
  );
}