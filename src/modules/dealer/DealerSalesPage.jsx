import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { auth, database } from "../../firebase";

export default function DealerSalesPage() {
  const navigate = useNavigate();

  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const snapshot = await get(ref(database, "dealerOrders"));

      if (!snapshot.exists()) {
        setCompletedOrders([]);
        return;
      }

      const data = snapshot.val();

      const list = Object.entries(data)
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .filter(
          (order) =>
            order.dealerUid === currentUser.uid &&
            order.status === "completed"
        )
        .reverse();

      setCompletedOrders(list);
    } catch (error) {
      console.error(error);
      alert("Failed to load sales reports.");
    } finally {
      setLoading(false);
    }
  }

  const totalSales = completedOrders.length;

  const totalRevenue = completedOrders.reduce((sum, order) => {
    return sum + Number(order.totalAmount || 0);
  }, 0);

  const totalQuantitySold = completedOrders.reduce((sum, order) => {
    return sum + Number(order.quantity || 0);
  }, 0);

  const averageOrderValue =
    totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading sales reports...
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/dealer")}
            className="text-green-700 font-semibold mb-4"
          >
            ← Back to Dealer Dashboard
          </button>

          <h1 className="text-4xl font-bold text-green-700">
            📈 Sales Reports
          </h1>

          <p className="text-gray-600 mt-2">
            View completed orders, total sales and revenue.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Completed Sales</p>
            <h2 className="text-3xl font-bold text-green-700">
              {totalSales}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Total Revenue</p>
            <h2 className="text-3xl font-bold text-green-700">
              ₹{totalRevenue}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Quantity Sold</p>
            <h2 className="text-3xl font-bold text-blue-600">
              {totalQuantitySold}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Average Order</p>
            <h2 className="text-3xl font-bold text-purple-600">
              ₹{averageOrderValue}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-green-700 mb-4">
            Completed Sales List
          </h2>

          {completedOrders.length === 0 ? (
            <p className="text-gray-600">
              No completed sales yet.
            </p>
          ) : (
            <div className="space-y-4">
              {completedOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <h3 className="text-xl font-bold text-green-700">
                      {order.productName || "Product"}
                    </h3>

                    <p className="text-sm text-gray-600 mt-1">
                      Farmer: {order.farmerName || "Not available"}
                    </p>

                    <p className="text-sm text-gray-600">
                      Quantity: {order.quantity || 0} {order.unit || ""}
                    </p>

                    <p className="text-sm text-gray-600">
                      Total Amount: ₹{order.totalAmount || 0}
                    </p>

                    <p className="text-sm text-gray-500 mt-1">
                      Completed At:{" "}
                      {order.updatedAt
                        ? new Date(order.updatedAt).toLocaleString()
                        : "Not available"}
                    </p>
                  </div>

                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
                    Completed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}