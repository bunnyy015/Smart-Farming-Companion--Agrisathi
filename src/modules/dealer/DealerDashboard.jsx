import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

export default function DealerDashboard() {
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    localStorage.removeItem("role");
    navigate("/role-selection");
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-green-700">
              🏪 Dealer Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Manage products, stock, farmer orders and sales
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-5 py-3 rounded-lg font-semibold"
          >
            Logout
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <button
            onClick={() => navigate("/dealer/products")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
          >
            <h2 className="text-2xl font-bold text-green-700">
              📦 Product Management
            </h2>
            <p className="text-gray-600 mt-2">
              Add, update and delete seeds, fertilizers and tools.
            </p>
          </button>

          <button
            onClick={() => navigate("/dealer/stock")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
          >
            <h2 className="text-2xl font-bold text-green-700">
              📋 Stock Management
            </h2>
            <p className="text-gray-600 mt-2">
              Track product quantity and stock status.
            </p>
          </button>

          <button
            onClick={() => navigate("/dealer/orders")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
          >
            <h2 className="text-2xl font-bold text-green-700">
              🛒 Farmer Orders
            </h2>
            <p className="text-gray-600 mt-2">
              View, accept, reject and complete farmer orders.
            </p>
          </button>

          <button
            onClick={() => navigate("/dealer/sales")}
            className="bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-xl"
          >
            <h2 className="text-2xl font-bold text-green-700">
              📈 Sales Reports
            </h2>
            <p className="text-gray-600 mt-2">
              Monitor completed sales and revenue.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}