import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  get,
  ref,
  runTransaction,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import "./DealerTheme.css";
import "./DealerPageEffects.css";

const agricultureCategories = [
  "Seeds",
  "Fertilizer",
  "Pesticide",
  "Tools",
  "Irrigation",
  "Organic Inputs",
  "Animal Feed",
  "Crop Protection",
  "Plant Growth Regulators",
];

export default function DealerStockPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] =
    useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [adjustments, setAdjustments] = useState({});
  const [walkInProductId, setWalkInProductId] = useState("");
  const [walkInQuantity, setWalkInQuantity] = useState(1);
  const [walkInCustomerName, setWalkInCustomerName] = useState("");
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadStock();
  }, []);

  const filteredProducts = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return products.filter((product) => {
      const available = Number(product.quantity || 0);
      const lowStockLevel = Number(
        product.lowStockLevel ?? 5
      );

      let filterMatches = true;

      if (selectedFilter === "available") {
        filterMatches = available > lowStockLevel;
      }

      if (selectedFilter === "low") {
        filterMatches =
          available > 0 &&
          available <= lowStockLevel;
      }

      if (selectedFilter === "out") {
        filterMatches = available === 0;
      }

      if (!filterMatches) {
        return false;
      }

      if (
        selectedCategory !== "all" &&
        String(product.category || "").trim().toLowerCase() !== selectedCategory
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchableText = [
        product.productName,
        product.category,
        product.brand,
        product.unit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [products, searchText, selectedFilter, selectedCategory]);

  const productCategories = Array.from(
    new Set([
      ...agricultureCategories,
      ...products.map((product) => String(product.category || "").trim()).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const statistics = useMemo(() => {
    const totalProducts = products.length;

    const availableProducts = products.filter(
      (product) =>
        Number(product.quantity || 0) >
        Number(product.lowStockLevel ?? 5)
    ).length;

    const lowStockProducts = products.filter(
      (product) => {
        const quantity = Number(
          product.quantity || 0
        );

        const lowStockLevel = Number(
          product.lowStockLevel ?? 5
        );

        return (
          quantity > 0 &&
          quantity <= lowStockLevel
        );
      }
    ).length;

    const outOfStockProducts = products.filter(
      (product) =>
        Number(product.quantity || 0) === 0
    ).length;

    const totalAvailableUnits = products.reduce(
      (sum, product) =>
        sum + Number(product.quantity || 0),
      0
    );

    const totalReservedUnits = products.reduce(
      (sum, product) =>
        sum +
        Number(product.reservedQuantity || 0),
      0
    );

    const totalSoldUnits = products.reduce(
      (sum, product) =>
        sum + Number(product.soldQuantity || 0),
      0
    );

    return {
      totalProducts,
      availableProducts,
      lowStockProducts,
      outOfStockProducts,
      totalAvailableUnits,
      totalReservedUnits,
      totalSoldUnits,
    };
  }, [products]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadStock() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const userSnapshot = await get(
        ref(database, `users/${currentUser.uid}`)
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

      const snapshot = await get(
        ref(
          database,
          `dealerProducts/${currentUser.uid}`
        )
      );

      if (!snapshot.exists()) {
        setProducts([]);
        return;
      }

      const productList = Object.entries(
        snapshot.val()
      )
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort(
          (first, second) =>
            new Date(second.updatedAt || 0) -
            new Date(first.updatedAt || 0)
        );

      setProducts(productList);
    } catch (error) {
      console.error("Stock loading error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Stock access is blocked by Firebase rules."
          : "Stock information could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function getAdjustment(productId) {
    return adjustments[productId] ?? "";
  }

  function setAdjustment(productId, value) {
    setAdjustments((current) => ({
      ...current,
      [productId]: value,
    }));
  }

  async function changeStock(
    product,
    quantityChange
  ) {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const change = Number(quantityChange);

      if (
        !Number.isInteger(change) ||
        change === 0
      ) {
        showMessage(
          "warning",
          "Enter a valid whole-number stock change."
        );
        return;
      }

      setUpdatingId(product.id);

      let failureReason = "";

      const productReference = ref(
        database,
        `dealerProducts/${currentUser.uid}/${product.id}`
      );

      const transactionResult =
        await runTransaction(
          productReference,
          (currentProduct) => {
            if (!currentProduct) {
              failureReason = "missing";
              return;
            }

            const currentQuantity = Number(
              currentProduct.quantity || 0
            );

            const newQuantity =
              currentQuantity + change;

            if (newQuantity < 0) {
              failureReason = "negative";
              return;
            }

            const newProduct = {
              ...currentProduct,

              quantity: newQuantity,

              reservedQuantity: Number(
                currentProduct.reservedQuantity || 0
              ),

              soldQuantity: Number(
                currentProduct.soldQuantity || 0
              ),

              status:
                newQuantity > 0
                  ? "available"
                  : "out_of_stock",

              updatedAt: new Date().toISOString(),
            };
            const transactionId = `stock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            newProduct.inventoryTransactions = {
              ...(currentProduct.inventoryTransactions || {}),
              [transactionId]: {
                transactionId,
                dealerId: currentUser.uid,
                productId: product.id,
                transactionType: change > 0 ? "stock_added" : "stock_adjustment",
                quantity: Math.abs(change),
                previousPhysicalStock: currentQuantity,
                newPhysicalStock: newQuantity,
                reason: change < 0 ? "Manual stock reduction" : "Stock added",
                createdAt: Date.now(),
                createdBy: currentUser.uid,
              },
            };
            return newProduct;
          }
        );

      if (!transactionResult.committed) {
        showMessage(
          "warning",
          failureReason === "negative"
            ? "Stock cannot be reduced below zero."
            : "This product could not be found."
        );

        return;
      }

      setAdjustment(product.id, "");

      showMessage(
        "success",
        change > 0
          ? `${change} ${
              product.unit || "units"
            } added to stock.`
          : `${Math.abs(change)} ${
              product.unit || "units"
            } removed from stock.`
      );

      await loadStock();
    } catch (error) {
      console.error("Stock update error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Stock update was blocked by Firebase rules."
          : "Stock could not be updated."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function recordWalkInSale() {
    const currentUser = auth.currentUser;
    const quantity = Number(walkInQuantity);
    const product = products.find((item) => item.id === walkInProductId);
    if (!currentUser || !product || !Number.isInteger(quantity) || quantity <= 0) {
      showMessage("warning", "Select a product and enter a valid whole-number quantity.");
      return;
    }
    setUpdatingId(product.id);
    try {
      let failureReason = "";
      const result = await runTransaction(ref(database, `dealerProducts/${currentUser.uid}/${product.id}`), (currentProduct) => {
        if (!currentProduct) { failureReason = "missing"; return; }
        const physical = Number(currentProduct.quantity || 0);
        const reserved = Number(currentProduct.reservedQuantity || 0);
        if (quantity > physical - reserved) { failureReason = "insufficient"; return; }
        const updated = { ...currentProduct, quantity: physical - quantity, soldQuantity: Number(currentProduct.soldQuantity || 0) + quantity, status: physical - quantity > 0 ? "available" : "out_of_stock", updatedAt: new Date().toISOString() };
        const transactionId = `walkin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        updated.inventoryTransactions = { ...(currentProduct.inventoryTransactions || {}), [transactionId]: { transactionId, dealerId: currentUser.uid, productId: product.id, transactionType: "walk_in_sale", quantity, previousPhysicalStock: physical, newPhysicalStock: physical - quantity, customerName: walkInCustomerName.trim() || null, customerPhone: walkInCustomerPhone.trim() || null, createdAt: Date.now(), createdBy: currentUser.uid } };
        return updated;
      }, { applyLocally: false });
      if (!result.committed) {
        showMessage("warning", failureReason === "insufficient" ? "Sale exceeds available unreserved stock." : "Product could not be updated.");
        return;
      }
      setWalkInQuantity(1); setWalkInCustomerName(""); setWalkInCustomerPhone("");
      showMessage("success", `Walk-in sale recorded. Stock reduced by ${quantity} ${product.unit || "units"}.`);
      await loadStock();
    } catch (error) {
      console.error("Walk-in sale error:", error);
      showMessage("error", "Walk-in sale could not be recorded.");
    } finally { setUpdatingId(""); }
  }

  function applyCustomAdjustment(
    product,
    direction
  ) {
    const value = Number(
      getAdjustment(product.id)
    );

    if (
      !Number.isInteger(value) ||
      value <= 0
    ) {
      showMessage(
        "warning",
        "Enter a valid quantity first."
      );
      return;
    }

    changeStock(
      product,
      direction === "add" ? value : -value
    );
  }

  function getStockStatus(product) {
    const available = Number(
      product.quantity || 0
    );

    const lowStockLevel = Number(
      product.lowStockLevel ?? 5
    );

    if (available === 0) {
      return {
        label: "Out of Stock",
        className:
          "bg-red-100 text-red-700",
      };
    }

    if (available <= lowStockLevel) {
      return {
        label: "Low Stock",
        className:
          "bg-yellow-100 text-yellow-800",
      };
    }

    return {
      label: "Available",
      className:
        "bg-green-100 text-green-700",
    };
  }

  const filters = [
    { value: "all", label: "All" },
    { value: "available", label: "Available" },
    { value: "low", label: "Low Stock" },
    { value: "out", label: "Out of Stock" },
  ];

  if (loading) {
    return (
      <div className="dealer-theme dealer-page-effects dealer-page-effects--stock min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">📋</div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            Loading stock
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-theme dealer-page-effects dealer-page-effects--stock min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() => navigate("/dealer")}
            className="text-green-100 font-semibold"
          >
            ← Dealer Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                📋 Stock Management
              </h1>

              <p className="text-green-100 mt-1">
                Available, reserved and sold stock.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadStock}
                className="bg-white/15 text-white px-4 py-2.5 rounded-xl font-semibold"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/dealer/products?add=1")
                }
                className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold"
              >
                Add Product
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Products
            </p>

            <p className="text-2xl font-bold text-green-800 mt-2">
              {statistics.totalProducts}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Available
            </p>

            <p className="text-2xl font-bold text-green-700 mt-2">
              {statistics.availableProducts}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Low Stock
            </p>

            <p className="text-2xl font-bold text-yellow-700 mt-2">
              {statistics.lowStockProducts}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Out of Stock
            </p>

            <p className="text-2xl font-bold text-red-700 mt-2">
              {statistics.outOfStockProducts}
            </p>
          </article>
        </section>

        <section className="grid grid-cols-3 gap-3 mt-4">
          <article className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">
              Available Units
            </p>

            <p className="font-bold text-green-800 mt-1">
              {statistics.totalAvailableUnits}
            </p>
          </article>

          <article className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">
              Reserved Units
            </p>

            <p className="font-bold text-blue-800 mt-1">
              {statistics.totalReservedUnits}
            </p>
          </article>

          <article className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">
              Sold Units
            </p>

            <p className="font-bold text-orange-800 mt-1">
              {statistics.totalSoldUnits}
            </p>
          </article>
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
          <h2 className="text-xl font-bold text-green-900">Record Walk-in Sale</h2>
          <p className="text-sm text-gray-600 mt-1">Records an in-store purchase and deducts only unreserved physical stock.</p>
          <div className="grid gap-3 mt-4 sm:grid-cols-2 lg:grid-cols-5">
            <select aria-label="Product for walk-in sale" value={walkInProductId} onChange={(event) => setWalkInProductId(event.target.value)} className="border rounded-xl px-3 py-2.5">
              <option value="">Select product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.productName} · ₹{Number(product.price || 0)} / {product.unit || "unit"}</option>)}
            </select>
            <input aria-label="Walk-in sale quantity" type="number" min="1" step="1" value={walkInQuantity} onChange={(event) => setWalkInQuantity(event.target.value)} className="border rounded-xl px-3 py-2.5" placeholder="Quantity" />
            <input aria-label="Optional customer name" value={walkInCustomerName} onChange={(event) => setWalkInCustomerName(event.target.value)} className="border rounded-xl px-3 py-2.5" placeholder="Customer name (optional)" />
            <input aria-label="Optional customer phone" value={walkInCustomerPhone} onChange={(event) => setWalkInCustomerPhone(event.target.value)} className="border rounded-xl px-3 py-2.5" placeholder="Phone (optional)" />
            <button type="button" disabled={!walkInProductId || updatingId === walkInProductId} onClick={recordWalkInSale} className="bg-green-700 text-white rounded-xl px-4 py-2.5 font-semibold disabled:opacity-50">{updatingId === walkInProductId ? "Saving…" : "Confirm Sale"}</button>
          </div>
          {walkInProductId && <p className="text-sm text-gray-600 mt-3">Sale total: ₹{Number(products.find((product) => product.id === walkInProductId)?.price || 0) * Number(walkInQuantity || 0)}</p>}
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
          <h2 className="text-xl font-bold text-green-900">Inventory Transaction History</h2>
          <div className="mt-3 divide-y">
            {products.flatMap((product) => Object.values(product.inventoryTransactions || {}).map((transaction) => ({ ...transaction, productName: product.productName }))).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 30).map((transaction) => (
              <div key={transaction.transactionId} className="py-3 flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold">{transaction.productName} · {String(transaction.transactionType || "stock_adjustment").replaceAll("_", " ")}</span>
                <span>{transaction.quantity} units · {new Date(Number(transaction.createdAt || 0)).toLocaleString()}</span>
                {transaction.reason && <span className="text-gray-500">{transaction.reason}</span>}
              </div>
            ))}
            {products.every((product) => Object.keys(product.inventoryTransactions || {}).length === 0) && <p className="py-3 text-sm text-gray-500">No stock movements recorded yet.</p>}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <label
            htmlFor="stock-search"
            className="font-semibold text-gray-800"
          >
            🔍 Search product
          </label>

          <input
            id="stock-search"
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Product name or category"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-green-600"
          />
        </section>

        <section className="flex gap-2 overflow-x-auto py-5">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.value}
              onClick={() =>
                setSelectedFilter(filter.value)
              }
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${
                selectedFilter === filter.value
                  ? "bg-green-700 text-white"
                  : "bg-white border border-green-200 text-green-800"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mb-5">
          <label htmlFor="stock-category-filter" className="block font-semibold text-gray-800 mb-2">
            Filter by agricultural category
          </label>
          <select
            id="stock-category-filter"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="w-full sm:max-w-sm border border-gray-300 rounded-xl px-4 py-3 bg-white"
          >
            <option value="all">All categories</option>
            {productCategories.map((category) => (
              <option key={category} value={category.toLowerCase()}>{category}</option>
            ))}
          </select>
        </section>

        {filteredProducts.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">📦</div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              No products found
            </h2>

            <p className="text-gray-600 mt-2">
              Add products or change the current filter.
            </p>

          <button
              type="button"
              onClick={() =>
                navigate("/dealer/products?add=1")
              }
              className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold mt-5"
            >
              Add Product
            </button>
          </section>
        ) : (
          <section className="space-y-4">
            {filteredProducts.map((product) => {
              const stockStatus =
                getStockStatus(product);

              const updating =
                updatingId === product.id;

              const available = Number(
                product.quantity || 0
              );

              const reserved = Number(
                product.reservedQuantity || 0
              );

              const sold = Number(
                product.soldQuantity || 0
              );

              return (
                <article
                  key={product.id}
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-green-900">
                          {product.productName}
                        </h2>

                        <span
                          className={`${stockStatus.className} px-3 py-1 rounded-full text-xs font-semibold`}
                        >
                          {stockStatus.label}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        {product.category ||
                          "Farm Product"}
                        {product.brand
                          ? ` • ${product.brand}`
                          : ""}
                      </p>

                      <p className="font-semibold text-gray-800 mt-2">
                        ₹
                        {Number(
                          product.price || 0
                        ).toFixed(2)}{" "}
                        / {product.unit || "unit"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          "/dealer/products"
                        )
                      }
                      className="border border-green-700 text-green-700 px-4 py-2 rounded-xl font-semibold self-start"
                    >
                      Edit Product
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">
                        Available
                      </p>

                      <p className="font-bold text-green-800 mt-1">
                        {available}
                      </p>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">
                        Reserved
                      </p>

                      <p className="font-bold text-blue-800 mt-1">
                        {reserved}
                      </p>
                    </div>

                    <div className="bg-orange-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">
                        Sold
                      </p>

                      <p className="font-bold text-orange-800 mt-1">
                        {sold}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 mt-5 pt-5">
                    <p className="font-semibold text-gray-800">
                      Quick Stock Update
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          changeStock(product, 1)
                        }
                        className="bg-green-100 text-green-800 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
                      >
                        +1
                      </button>

                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          changeStock(product, 5)
                        }
                        className="bg-green-100 text-green-800 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
                      >
                        +5
                      </button>

                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          changeStock(product, 10)
                        }
                        className="bg-green-100 text-green-800 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
                      >
                        +10
                      </button>

                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          changeStock(product, -1)
                        }
                        className="bg-red-50 text-red-700 px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
                      >
                        −1
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={getAdjustment(
                          product.id
                        )}
                        disabled={updating}
                        onChange={(event) =>
                          setAdjustment(
                            product.id,
                            event.target.value
                          )
                        }
                        placeholder="Custom quantity"
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3 disabled:bg-gray-100"
                      />

                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          applyCustomAdjustment(
                            product,
                            "add"
                          )
                        }
                        className="bg-green-700 text-white px-4 py-3 rounded-xl font-semibold disabled:bg-gray-400"
                      >
                        Add Stock
                      </button>

                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          applyCustomAdjustment(
                            product,
                            "remove"
                          )
                        }
                        className="border border-red-600 text-red-700 px-4 py-3 rounded-xl font-semibold disabled:opacity-50"
                      >
                        Remove Stock
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
