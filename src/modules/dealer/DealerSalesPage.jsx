import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

export default function DealerSalesPage() {
  const navigate = useNavigate();

  const [sales, setSales] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadSales();
  }, []);

  const filteredSales = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) {
      return sales;
    }

    return sales.filter((sale) => {
      const searchableText = [
        sale.productName,
        sale.farmerName,
        sale.category,
        sale.brand,
        sale.paymentMode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [sales, searchText]);

  const statistics = useMemo(() => {
    const totalRevenue = sales.reduce(
      (sum, sale) =>
        sum + Number(sale.totalAmount || 0),
      0
    );

    const totalQuantity = sales.reduce(
      (sum, sale) =>
        sum + Number(sale.quantity || 0),
      0
    );

    const averageOrderValue =
      sales.length > 0
        ? totalRevenue / sales.length
        : 0;

    const productTotals = {};

    sales.forEach((sale) => {
      const productName =
        sale.productName || "Farm Product";

      productTotals[productName] =
        (productTotals[productName] || 0) +
        Number(sale.quantity || 0);
    });

    const bestSellingProduct =
      Object.entries(productTotals).sort(
        (first, second) =>
          second[1] - first[1]
      )[0]?.[0] || "No sales yet";

    return {
      completedSales: sales.length,
      totalRevenue,
      totalQuantity,
      averageOrderValue,
      bestSellingProduct,
    };
  }, [sales]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadRecordedSales(dealerUid) {
    const salesSnapshot = await get(
      ref(database, `sales/${dealerUid}`)
    );

    if (!salesSnapshot.exists()) {
      return [];
    }

    return Object.entries(salesSnapshot.val()).map(
      ([id, value]) => ({
        id,
        ...value,
      })
    );
  }

  async function loadLegacyCompletedOrders(dealerUid) {
    const dealerOrdersQuery = query(
      ref(database, "dealerOrders"),
      orderByChild("dealerUid"),
      equalTo(dealerUid)
    );

    const ordersSnapshot = await get(
      dealerOrdersQuery
    );

    if (!ordersSnapshot.exists()) {
      return [];
    }

    return Object.entries(ordersSnapshot.val())
      .map(([id, value]) => ({
        id,
        ...value,
      }))
      .filter(
        (order) => order.status === "completed"
      )
      .map((order) => ({
        id: `legacy-${order.id}`,
        orderId: order.id,
        dealerUid: order.dealerUid,
        farmerUid: order.farmerUid,
        farmerName:
          order.farmerName || "Farmer",
        productId: order.productId,
        productName:
          order.productName || "Farm Product",
        category: order.category || "",
        brand: order.brand || "",
        quantity: Number(order.quantity || 0),
        unit: order.unit || "",
        price: Number(order.price || 0),
        totalAmount: Number(
          order.totalAmount || 0
        ),
        paymentMode:
          order.paymentMode ||
          "Cash on Delivery",
        completedAt:
          order.completedAt ||
          order.updatedAt ||
          order.createdAt ||
          "",
        legacyRecord: true,
      }));
  }

  function mergeSales(
    recordedSales,
    legacySales
  ) {
    const saleMap = new Map();

    recordedSales.forEach((sale) => {
      const key =
        sale.orderId || sale.id;

      saleMap.set(key, {
        ...sale,
        legacyRecord: false,
      });
    });

    legacySales.forEach((sale) => {
      const key =
        sale.orderId || sale.id;

      if (!saleMap.has(key)) {
        saleMap.set(key, sale);
      }
    });

    return Array.from(saleMap.values()).sort(
      (first, second) =>
        new Date(second.completedAt || 0) -
        new Date(first.completedAt || 0)
    );
  }

  async function loadSales() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", {
          replace: true,
        });
        return;
      }

      const userSnapshot = await get(
        ref(
          database,
          `users/${currentUser.uid}`
        )
      );

      if (
        !userSnapshot.exists() ||
        userSnapshot.val().role !== "dealer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });
        return;
      }

      const [
        recordedSales,
        legacyCompletedOrders,
      ] = await Promise.all([
        loadRecordedSales(currentUser.uid),
        loadLegacyCompletedOrders(
          currentUser.uid
        ),
      ]);

      setSales(
        mergeSales(
          recordedSales,
          legacyCompletedOrders
        )
      );
    } catch (error) {
      console.error(
        "Dealer sales error:",
        error
      );

      setSales([]);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Sales access is blocked by Firebase rules."
          : "Sales information could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }
    );
  }

  function formatDate(value) {
    if (!value) {
      return "Date not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date not available";
    }

    return date.toLocaleString("en-IN");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">
            📈
          </div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            Loading sales
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() =>
              navigate("/dealer")
            }
            className="text-green-100 font-semibold"
          >
            ← Dealer Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                📈 Sales
              </h1>

              <p className="text-green-100 mt-1">
                Completed orders and revenue.
              </p>
            </div>

            <button
              type="button"
              onClick={loadSales}
              className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold self-start"
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">
                ✅
              </span>

              <span className="text-2xl font-bold text-green-800">
                {statistics.completedSales}
              </span>
            </div>

            <p className="font-semibold text-gray-800 mt-3">
              Completed Sales
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">
                💰
              </span>

              <span className="text-xl font-bold text-green-800">
                {formatCurrency(
                  statistics.totalRevenue
                )}
              </span>
            </div>

            <p className="font-semibold text-gray-800 mt-3">
              Total Revenue
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">
                📦
              </span>

              <span className="text-2xl font-bold text-blue-700">
                {statistics.totalQuantity}
              </span>
            </div>

            <p className="font-semibold text-gray-800 mt-3">
              Quantity Sold
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">
                🧾
              </span>

              <span className="text-xl font-bold text-purple-700">
                {formatCurrency(
                  statistics.averageOrderValue
                )}
              </span>
            </div>

            <p className="font-semibold text-gray-800 mt-3">
              Average Sale
            </p>
          </article>
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <p className="text-sm text-gray-500">
            Best-selling product
          </p>

          <h2 className="text-xl font-bold text-green-900 mt-1">
            🌾{" "}
            {statistics.bestSellingProduct}
          </h2>
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <label
            htmlFor="sales-search"
            className="font-semibold text-gray-800"
          >
            🔍 Search sales
          </label>

          <input
            id="sales-search"
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Product or farmer name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-green-600"
          />
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-green-900">
              Completed Sales
            </h2>

            <span className="text-sm text-gray-500">
              {filteredSales.length} records
            </span>
          </div>

          {filteredSales.length === 0 ? (
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 text-center">
              <div className="text-5xl">
                📊
              </div>

              <h2 className="text-xl font-bold text-green-900 mt-4">
                No completed sales
              </h2>

              <p className="text-gray-600 mt-2">
                Completed farmer orders will
                appear here.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/dealer/orders")
                }
                className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold mt-5"
              >
                View Orders
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSales.map((sale) => (
                <article
                  key={sale.id}
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-green-900">
                        {sale.productName ||
                          "Farm Product"}
                      </h2>

                      <p className="text-sm text-gray-500 mt-1">
                        👨‍🌾{" "}
                        {sale.farmerName ||
                          "Farmer"}
                      </p>

                      <p className="text-sm text-gray-600 mt-2">
                        📦{" "}
                        {Number(
                          sale.quantity || 0
                        )}{" "}
                        {sale.unit || "units"}
                      </p>

                      <p className="text-lg font-bold text-green-800 mt-2">
                        {formatCurrency(
                          sale.totalAmount
                        )}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(
                          sale.completedAt
                        )}
                      </p>
                    </div>

                    <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-semibold self-start">
                      ✅ Completed
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Price
                      </p>

                      <p className="font-semibold mt-1">
                        {formatCurrency(
                          sale.price
                        )}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Payment
                      </p>

                      <p className="font-semibold mt-1">
                        {sale.paymentMode ||
                          "Cash on Delivery"}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Order Reference
                      </p>

                      <p className="font-semibold mt-1 break-all">
                        {sale.orderId ||
                          "Not available"}
                      </p>
                    </div>
                  </div>

                  {sale.legacyRecord && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-3 mt-4 text-sm">
                      This sale was recovered from
                      an older completed order.
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}