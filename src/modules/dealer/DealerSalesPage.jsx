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
import "./DealerTheme.css";

export default function DealerSalesPage() {
  const navigate = useNavigate();

  const [sales, setSales] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);

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

  async function openSaleDetails(sale) {
    try {
      let fullSale = { ...sale };

      if (sale.orderId) {
        const orderSnapshot = await get(
          ref(database, `dealerOrders/${sale.orderId}`)
        );

        if (orderSnapshot.exists()) {
          fullSale = {
            ...orderSnapshot.val(),
            ...sale,
          };
        }
      }

      if (fullSale.farmerUid) {
        let farmer = {};

        try {
          const farmerSnapshot = await get(
            ref(
              database,
              `farmers/${fullSale.farmerUid}`
            )
          );

          if (farmerSnapshot.exists()) {
            farmer = farmerSnapshot.val();
          }
        } catch (farmerError) {
          console.error(
            "Farmer profile access error:",
            farmerError
          );
        }

        const generatedAddress = [
          farmer.village,
          farmer.mandal,
          farmer.district,
          farmer.state,
        ]
          .filter(Boolean)
          .join(", ");

        fullSale = {
          ...fullSale,

          farmerName:
            fullSale.farmerName ||
            farmer.fullName ||
            farmer.farmerName ||
            farmer.name ||
            "Farmer",

          farmerPhone:
            fullSale.farmerPhone ||
            farmer.phone ||
            farmer.mobile ||
            farmer.phoneNumber ||
            "",

          farmerDistrict:
            fullSale.farmerDistrict ||
            farmer.district ||
            "",

          farmerState:
            fullSale.farmerState ||
            farmer.state ||
            "",

          deliveryAddress:
            fullSale.deliveryAddress &&
            fullSale.deliveryAddress !==
              "Address not added"
              ? fullSale.deliveryAddress
              : farmer.deliveryAddress ||
                farmer.address ||
                generatedAddress ||
                "",
        };
      }

      setSelectedSale(fullSale);
    } catch (error) {
      console.error("Sale details error:", error);
      setSelectedSale(sale);
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
      <div className="dealer-theme min-h-screen bg-green-50 flex items-center justify-center p-4">
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
    <div className="dealer-theme min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {selectedSale && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Completed sale details
                  </p>

                  <h2 className="text-xl font-bold text-green-900">
                    {selectedSale.productName || "Farm Product"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 font-bold"
                  aria-label="Close sale details"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <section className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-sm text-gray-500">
                    Farmer
                  </p>

                  <p className="font-bold text-green-900 mt-1">
                    {selectedSale.farmerName || "Farmer"}
                  </p>

                  {selectedSale.farmerPhone && (
                    <a
                      href={`tel:${selectedSale.farmerPhone}`}
                      className="inline-flex mt-3 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold"
                    >
                      📞 Call Farmer
                    </a>
                  )}
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">
                      Quantity
                    </p>

                    <p className="font-bold mt-1">
                      {Number(selectedSale.quantity || 0)}{" "}
                      {selectedSale.unit || "units"}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">
                      Total amount
                    </p>

                    <p className="font-bold text-green-800 mt-1">
                      {formatCurrency(selectedSale.totalAmount)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">
                      Price per unit
                    </p>

                    <p className="font-bold mt-1">
                      {formatCurrency(selectedSale.price)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">
                      Payment
                    </p>

                    <p className="font-bold mt-1">
                      {selectedSale.paymentMode || "Cash on Delivery"}
                    </p>
                  </div>
                </section>

                <section className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500">
                    Farmer location
                  </p>

                  <p className="font-semibold mt-1">
                    {[
                      selectedSale.farmerDistrict,
                      selectedSale.farmerState,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not available"}
                  </p>
                </section>

                <section className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500">
                    Delivery address
                  </p>

                  <p className="font-semibold mt-1">
                    {selectedSale.deliveryAddress || "Not available"}
                  </p>
                </section>

                <section className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500">
                    Order reference
                  </p>

                  <p className="font-semibold mt-1 break-all">
                    {selectedSale.orderId || "Not available"}
                  </p>
                </section>

                <section className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500">
                    Completed on
                  </p>

                  <p className="font-semibold mt-1">
                    {formatDate(selectedSale.completedAt)}
                  </p>
                </section>

                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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
            <div className="divide-y divide-green-100 overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
              {filteredSales.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => openSaleDetails(sale)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-700 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto_auto] sm:gap-5 sm:px-5"
                  aria-label={`View completed sale: ${sale.productName || "Farm Product"} for ${sale.farmerName || "Farmer"}`}
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-green-900">
                      {sale.productName || "Farm Product"}
                    </h3>
                    <p className="mt-1 truncate text-sm text-gray-600">
                      {sale.farmerName || "Farmer"}
                      <span className="px-1.5 text-gray-400" aria-hidden="true">·</span>
                      {Number(sale.quantity || 0)} {sale.unit || "units"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 sm:hidden">
                      {formatDate(sale.completedAt)}
                    </p>
                  </div>

                  <p className="hidden text-sm text-gray-500 sm:block">
                    {formatDate(sale.completedAt)}
                  </p>

                  <p className="text-right font-bold text-green-800">
                    {formatCurrency(sale.totalAmount)}
                  </p>

                  <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:justify-end sm:gap-3">
                    {sale.legacyRecord && (
                      <span className="text-xs text-amber-700">
                        Recovered
                      </span>
                    )}
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                      Completed
                    </span>
                    <span className="text-lg text-green-700" aria-hidden="true">
                      ›
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
