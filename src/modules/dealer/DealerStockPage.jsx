import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, update } from "firebase/database";
import { auth, database } from "../../firebase";

export default function DealerStockPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStock();
  }, []);

  async function loadStock() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const snapshot = await get(
        ref(database, `dealerProducts/${currentUser.uid}`)
      );

      if (!snapshot.exists()) {
        setProducts([]);
        return;
      }

      const data = snapshot.val();

      const list = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));

      setProducts(list.reverse());
    } catch (error) {
      console.error(error);
      alert("Failed to load stock.");
    } finally {
      setLoading(false);
    }
  }

  async function updateQuantity(productId, currentQuantity, changeValue) {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const newQuantity = Number(currentQuantity) + Number(changeValue);

      if (newQuantity < 0) {
        alert("Stock cannot be less than zero.");
        return;
      }

      await update(
        ref(database, `dealerProducts/${currentUser.uid}/${productId}`),
        {
          quantity: newQuantity,
          status: newQuantity > 0 ? "available" : "out-of-stock",
          updatedAt: new Date().toISOString(),
        }
      );

      loadStock();
    } catch (error) {
      console.error(error);
      alert("Failed to update stock.");
    }
  }

  function getStockStatus(quantity) {
    const qty = Number(quantity);

    if (qty === 0) {
      return {
        label: "Out of Stock",
        className: "bg-red-100 text-red-700",
      };
    }

    if (qty <= 5) {
      return {
        label: "Low Stock",
        className: "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      label: "Available",
      className: "bg-green-100 text-green-700",
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading stock...
        </h1>
      </div>
    );
  }

  const totalProducts = products.length;
  const availableProducts = products.filter(
    (product) => Number(product.quantity) > 5
  ).length;
  const lowStockProducts = products.filter(
    (product) =>
      Number(product.quantity) > 0 && Number(product.quantity) <= 5
  ).length;
  const outOfStockProducts = products.filter(
    (product) => Number(product.quantity) === 0
  ).length;

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
            📋 Stock Management
          </h1>

          <p className="text-gray-600 mt-2">
            Track product quantity and availability.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Total Products</p>
            <h2 className="text-3xl font-bold text-green-700">
              {totalProducts}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Available</p>
            <h2 className="text-3xl font-bold text-green-700">
              {availableProducts}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Low Stock</p>
            <h2 className="text-3xl font-bold text-yellow-600">
              {lowStockProducts}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Out of Stock</p>
            <h2 className="text-3xl font-bold text-red-600">
              {outOfStockProducts}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-green-700 mb-4">
            Stock List
          </h2>

          {products.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-600 mb-4">
                No products found. Add products first.
              </p>

              <button
                onClick={() => navigate("/dealer/products")}
                className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold"
              >
                Add Product
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => {
                const stockStatus = getStockStatus(product.quantity);

                return (
                  <div
                    key={product.id}
                    className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div>
                      <h3 className="text-xl font-bold text-green-700">
                        {product.productName}
                      </h3>

                      <p className="text-sm text-gray-600">
                        {product.category} | {product.brand || "No brand"}
                      </p>

                      <p className="text-sm text-gray-600 mt-1">
                        Price: ₹{product.price} / {product.unit}
                      </p>

                      <p className="text-sm text-gray-600">
                        Current Stock:{" "}
                        <span className="font-bold">
                          {product.quantity} {product.unit}
                        </span>
                      </p>

                      <span
                        className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${stockStatus.className}`}
                      >
                        {stockStatus.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(product.id, product.quantity, -1)
                        }
                        className="bg-red-600 text-white px-4 py-2 rounded-lg"
                      >
                        -1
                      </button>

                      <button
                        onClick={() =>
                          updateQuantity(product.id, product.quantity, 1)
                        }
                        className="bg-green-700 text-white px-4 py-2 rounded-lg"
                      >
                        +1
                      </button>

                      <button
                        onClick={() =>
                          updateQuantity(product.id, product.quantity, 5)
                        }
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                      >
                        +5
                      </button>

                      <button
                        onClick={() => navigate("/dealer/products")}
                        className="border border-gray-300 px-4 py-2 rounded-lg font-semibold"
                      >
                        Edit Product
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}