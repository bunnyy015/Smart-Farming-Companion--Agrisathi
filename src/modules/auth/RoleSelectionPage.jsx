import { useNavigate } from "react-router-dom";

export default function RoleSelectionPage() {
  const navigate = useNavigate();

  const selectRole = (role) => {
    localStorage.setItem("role", role);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-green-50 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🌾</div>

        <h1 className="text-4xl font-bold text-green-800">
          AgriSaathi
        </h1>

        <p className="text-gray-600 mt-2">
          Select your role to continue
        </p>
      </div>

      {/* Role Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-6xl">
        {/* Farmer */}
        <button
          type="button"
          onClick={() => selectRole("farmer")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 hover:shadow-xl transition text-center border-2 border-transparent hover:border-green-500"
        >
          <div className="text-6xl mb-4">👨‍🌾</div>

          <h2 className="text-xl font-bold text-green-800">
            Farmer
          </h2>

          <p className="text-gray-600 mt-2 text-sm">
            Crop disease detection, weather, market prices and animal care.
          </p>
        </button>

        {/* KVK Officer */}
        <button
          type="button"
          onClick={() => selectRole("kvk")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 hover:shadow-xl transition text-center border-2 border-transparent hover:border-green-500"
        >
          <div className="text-6xl mb-4">🏛️</div>

          <h2 className="text-xl font-bold text-green-800">
            KVK Officer
          </h2>

          <p className="text-gray-600 mt-2 text-sm">
            Handle SOS requests and provide farmer support.
          </p>
        </button>

        {/* Dealer */}
        <button
          type="button"
          onClick={() => selectRole("dealer")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 hover:shadow-xl transition text-center border-2 border-transparent hover:border-green-500"
        >
          <div className="text-6xl mb-4">🏪</div>

          <h2 className="text-xl font-bold text-green-800">
            Dealer
          </h2>

          <p className="text-gray-600 mt-2 text-sm">
            Manage products, stock and farmer orders.
          </p>
        </button>

        {/* Admin */}
        <button
          type="button"
          onClick={() => selectRole("admin")}
          className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 hover:shadow-xl transition text-center border-2 border-transparent hover:border-green-500"
        >
          <div className="text-6xl mb-4">🛡️</div>

          <h2 className="text-xl font-bold text-green-800">
            Admin
          </h2>

          <p className="text-gray-600 mt-2 text-sm">
            Manage users, approvals, alerts, schemes and reports.
          </p>
        </button>
      </div>
    </div>
  );
}