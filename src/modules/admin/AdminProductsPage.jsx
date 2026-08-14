import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const EMPTY_STATS = {
  total: 0,
  available: 0,
  lowStock: 0,
  outOfStock: 0,
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getDealerName(dealer) {
  if (!dealer || typeof dealer !== "object") {
    return "Unknown Dealer";
  }

  return (
    dealer.dealerName ||
    dealer.shopName ||
    dealer.businessName ||
    dealer.name ||
    dealer.fullName ||
    dealer.displayName ||
    dealer.email ||
    "Unknown Dealer"
  );
}

function getProductStatus(product) {
  const quantity = Number(product.quantity || 0);
  const lowStockLevel = Number(product.lowStockLevel || 0);

  if (quantity <= 0) {
    return "out_of_stock";
  }

  if (quantity <= lowStockLevel) {
    return "low_stock";
  }

  return "available";
}

function statusLabel(status) {
  if (status === "out_of_stock") {
    return "Out of Stock";
  }

  if (status === "low_stock") {
    return "Low Stock";
  }

  return "Available";
}

export default function AdminProductsPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [dealers, setDealers] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dealerFilter, setDealerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedProduct, setSelectedProduct] = useState(null);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadProducts(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [productsSnapshot, usersSnapshot] = await Promise.all([
        get(ref(database, "dealerProducts")),
        get(ref(database, "users")),
      ]);

      /*
       * ------------------------------------------
       * USERS / DEALERS
       * ------------------------------------------
       */
      const dealerMap = {};

      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();

        Object.entries(users || {}).forEach(([uid, user]) => {
          if (!user || typeof user !== "object") {
            return;
          }

          if (normalize(user.role) !== "dealer") {
            return;
          }

          dealerMap[uid] = {
            uid,
            ...user,
          };
        });
      }

      setDealers(dealerMap);

      /*
       * ------------------------------------------
       * DEALER PRODUCTS
       *
       * dealerProducts/
       *    dealerUid/
       *       productId/
       *          product information
       * ------------------------------------------
       */
      const productList = [];

      if (productsSnapshot.exists()) {
        const dealerProducts = productsSnapshot.val();

        Object.entries(dealerProducts || {}).forEach(
          ([dealerUid, dealerProductGroup]) => {
            if (
              !dealerProductGroup ||
              typeof dealerProductGroup !== "object"
            ) {
              return;
            }

            Object.entries(dealerProductGroup).forEach(
              ([productId, product]) => {
                if (
                  !product ||
                  typeof product !== "object"
                ) {
                  return;
                }

                const dealer = dealerMap[dealerUid] || {};

                productList.push({
                  id: productId,
                  dealerUid,
                  ...product,

                  dealerName: getDealerName(dealer),

                  computedStatus: getProductStatus(product),
                });
              }
            );
          }
        );
      }

      productList.sort((first, second) => {
        return (
          new Date(second.createdAt || 0) -
          new Date(first.createdAt || 0)
        );
      });

      setProducts(productList);
    } catch (error) {
      console.error(
        "Admin products loading error:",
        error
      );

      showMessage(
        "error",
        "Products could not be loaded. Check Firebase database access."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /*
   * ------------------------------------------
   * FILTER OPTIONS
   * ------------------------------------------
   */

  const categories = useMemo(() => {
    const values = products
      .map((product) => product.category)
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [products]);

  const dealerOptions = useMemo(() => {
    const map = new Map();

    products.forEach((product) => {
      if (!map.has(product.dealerUid)) {
        map.set(product.dealerUid, {
          uid: product.dealerUid,
          name: product.dealerName,
        });
      }
    });

    return [...map.values()].sort((first, second) =>
      first.name.localeCompare(second.name)
    );
  }, [products]);

  /*
   * ------------------------------------------
   * FILTERED PRODUCTS
   * ------------------------------------------
   */

  const filteredProducts = useMemo(() => {
    const searchValue = normalize(search);

    return products.filter((product) => {
      const matchesSearch =
        !searchValue ||
        normalize(product.productName).includes(
          searchValue
        ) ||
        normalize(product.category).includes(
          searchValue
        ) ||
        normalize(product.brand).includes(
          searchValue
        ) ||
        normalize(product.dealerName).includes(
          searchValue
        );

      const matchesCategory =
        categoryFilter === "all" ||
        normalize(product.category) ===
          normalize(categoryFilter);

      const matchesDealer =
        dealerFilter === "all" ||
        product.dealerUid === dealerFilter;

      const matchesStatus =
        statusFilter === "all" ||
        product.computedStatus === statusFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesDealer &&
        matchesStatus
      );
    });
  }, [
    products,
    search,
    categoryFilter,
    dealerFilter,
    statusFilter,
  ]);

  /*
   * ------------------------------------------
   * STATISTICS
   * ------------------------------------------
   */

  const stats = useMemo(() => {
    const result = {
      ...EMPTY_STATS,
    };

    products.forEach((product) => {
      result.total++;

      if (product.computedStatus === "available") {
        result.available++;
      }

      if (product.computedStatus === "low_stock") {
        result.lowStock++;
      }

      if (product.computedStatus === "out_of_stock") {
        result.outOfStock++;
      }
    });

    return result;
  }, [products]);

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setDealerFilter("all");
    setStatusFilter("all");
  }

  function getStatusClasses(status) {
    if (status === "out_of_stock") {
      return "bg-red-100 text-red-700 border-red-200";
    }

    if (status === "low_stock") {
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    }

    return "bg-green-100 text-green-700 border-green-200";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-4xl mb-3">🛒</div>

          <p className="text-xl font-bold text-green-800">
            Loading products...
          </p>

          <p className="text-gray-500 mt-1">
            Reading dealer products from Firebase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {/* ----------------------------------------
            PRODUCT DETAILS MODAL
        ----------------------------------------- */}
        {selectedProduct && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">

              <div className="flex items-center justify-between p-5 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-green-900">
                    Product Details
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Marketplace product information
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedProduct(null)
                  }
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>

              <div className="p-5">

                <div className="grid md:grid-cols-2 gap-5">

                  <div>
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={
                          selectedProduct.productName ||
                          "Product"
                        }
                        className="w-full h-64 object-contain bg-gray-50 border rounded-2xl"
                      />
                    ) : (
                      <div className="w-full h-64 bg-green-50 rounded-2xl flex items-center justify-center text-7xl">
                        📦
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-bold text-green-900">
                        {selectedProduct.productName ||
                          "Unnamed Product"}
                      </h3>

                      <span
                        className={`px-3 py-1 rounded-full border text-xs font-bold ${getStatusClasses(
                          selectedProduct.computedStatus
                        )}`}
                      >
                        {statusLabel(
                          selectedProduct.computedStatus
                        )}
                      </span>
                    </div>

                    <p className="text-gray-500 mt-2">
                      {selectedProduct.category || "No category"}
                      {selectedProduct.brand
                        ? ` • ${selectedProduct.brand}`
                        : ""}
                    </p>

                    <div className="mt-5 space-y-3">

                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          Dealer
                        </p>

                        <p className="font-semibold text-gray-900">
                          {selectedProduct.dealerName}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Price
                          </p>

                          <p className="font-bold text-green-800">
                            ₹
                            {Number(
                              selectedProduct.price || 0
                            ).toFixed(2)}
                            {" / "}
                            {selectedProduct.unit || "unit"}
                          </p>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Available
                          </p>

                          <p className="font-bold text-blue-800">
                            {Number(
                              selectedProduct.quantity || 0
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-purple-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Reserved
                          </p>

                          <p className="font-bold text-purple-800">
                            {Number(
                              selectedProduct.reservedQuantity ||
                                0
                            )}
                          </p>
                        </div>

                        <div className="bg-orange-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Sold
                          </p>

                          <p className="font-bold text-orange-800">
                            {Number(
                              selectedProduct.soldQuantity ||
                                0
                            )}
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {selectedProduct.description && (
                  <div className="mt-5">
                    <h4 className="font-bold text-green-900">
                      Description
                    </h4>

                    <p className="text-gray-600 mt-2 leading-6">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}

                <div className="mt-5 bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500">
                    Dealer UID
                  </p>

                  <p className="text-sm font-mono text-gray-700 break-all">
                    {selectedProduct.dealerUid}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedProduct(null)
                  }
                  className="w-full mt-5 bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------
            HEADER
        ----------------------------------------- */}
        <header className="bg-gradient-to-r from-green-900 via-green-800 to-green-600 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>
              <button
                type="button"
                onClick={() =>
                  navigate("/admin")
                }
                className="text-green-100 hover:text-white font-semibold mb-4"
              >
                ← Admin Dashboard
              </button>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
                  🛒
                </div>

                <div>
                  <h1 className="text-3xl md:text-4xl font-bold">
                    Product Management
                  </h1>

                  <p className="text-green-100 mt-1">
                    Monitor products listed by all dealers.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => loadProducts(true)}
              className="bg-white/15 hover:bg-white/25 px-5 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

          </div>
        </header>

        {/* ----------------------------------------
            STATISTICS
        ----------------------------------------- */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5">
            <p className="text-sm text-gray-500">
              Total Products
            </p>

            <p className="text-3xl font-bold text-green-800 mt-2">
              {stats.total}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5">
            <p className="text-sm text-gray-500">
              Available
            </p>

            <p className="text-3xl font-bold text-green-700 mt-2">
              {stats.available}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-yellow-100 p-5">
            <p className="text-sm text-gray-500">
              Low Stock
            </p>

            <p className="text-3xl font-bold text-yellow-700 mt-2">
              {stats.lowStock}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
            <p className="text-sm text-gray-500">
              Out of Stock
            </p>

            <p className="text-3xl font-bold text-red-700 mt-2">
              {stats.outOfStock}
            </p>
          </div>

        </section>

        {/* ----------------------------------------
            FILTERS
        ----------------------------------------- */}
        <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 mb-6">

          <div className="flex flex-col lg:flex-row gap-3">

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search product, brand or dealer..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
            />

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
              className="border border-gray-300 rounded-xl px-4 py-3 bg-white"
            >
              <option value="all">
                All Categories
              </option>

              {categories.map((category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
            </select>

            <select
              value={dealerFilter}
              onChange={(event) =>
                setDealerFilter(event.target.value)
              }
              className="border border-gray-300 rounded-xl px-4 py-3 bg-white"
            >
              <option value="all">
                All Dealers
              </option>

              {dealerOptions.map((dealer) => (
                <option
                  key={dealer.uid}
                  value={dealer.uid}
                >
                  {dealer.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="border border-gray-300 rounded-xl px-4 py-3 bg-white"
            >
              <option value="all">
                All Stock Status
              </option>

              <option value="available">
                Available
              </option>

              <option value="low_stock">
                Low Stock
              </option>

              <option value="out_of_stock">
                Out of Stock
              </option>
            </select>

          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">

            <p className="text-sm text-gray-500">
              Showing{" "}
              <strong className="text-gray-800">
                {filteredProducts.length}
              </strong>{" "}
              of{" "}
              <strong className="text-gray-800">
                {products.length}
              </strong>{" "}
              products
            </p>

            {(search ||
              categoryFilter !== "all" ||
              dealerFilter !== "all" ||
              statusFilter !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-green-700 font-semibold hover:text-green-900"
              >
                Clear Filters
              </button>
            )}

          </div>
        </section>

        {/* ----------------------------------------
            PRODUCT LIST
        ----------------------------------------- */}
        <section>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center">

              <div className="text-5xl">
                📦
              </div>

              <h2 className="text-xl font-bold text-gray-800 mt-4">
                No products found
              </h2>

              <p className="text-gray-500 mt-2">
                Try changing your search or filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold"
              >
                Clear Filters
              </button>

            </div>
          ) : (
            <div className="space-y-4">

              {filteredProducts.map((product) => {
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
                    key={`${product.dealerUid}-${product.id}`}
                    className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 hover:shadow-md transition"
                  >

                    <div className="flex flex-col lg:flex-row gap-5">

                      {/* Image */}
                      <div className="w-full lg:w-40 shrink-0">

                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={
                              product.productName ||
                              "Product"
                            }
                            className="w-full h-40 object-contain bg-gray-50 border rounded-xl"
                          />
                        ) : (
                          <div className="w-full h-40 bg-green-50 rounded-xl flex items-center justify-center text-5xl">
                            📦
                          </div>
                        )}

                      </div>

                      {/* Product information */}
                      <div className="flex-1">

                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <h2 className="text-xl font-bold text-green-900">
                                {product.productName ||
                                  "Unnamed Product"}
                              </h2>

                              <span
                                className={`px-2.5 py-1 rounded-full border text-xs font-bold ${getStatusClasses(
                                  product.computedStatus
                                )}`}
                              >
                                {statusLabel(
                                  product.computedStatus
                                )}
                              </span>

                            </div>

                            <p className="text-sm text-gray-500 mt-1">
                              {product.category ||
                                "No category"}

                              {product.brand
                                ? ` • ${product.brand}`
                                : ""}
                            </p>

                            <p className="text-sm text-gray-600 mt-3">
                              Dealer:{" "}
                              <strong className="text-gray-800">
                                {product.dealerName}
                              </strong>
                            </p>

                            <p className="text-lg font-bold text-gray-900 mt-2">
                              ₹
                              {Number(
                                product.price || 0
                              ).toFixed(2)}
                              <span className="text-sm font-normal text-gray-500">
                                {" "}
                                / {product.unit || "unit"}
                              </span>
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedProduct(
                                product
                              )
                            }
                            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-xl font-semibold"
                          >
                            View Details
                          </button>

                        </div>

                        {/* Stock information */}
                        <div className="grid grid-cols-3 gap-3 mt-5">

                          <div className="bg-green-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-gray-500">
                              Available
                            </p>

                            <p className="text-xl font-bold text-green-700 mt-1">
                              {available}
                            </p>
                          </div>

                          <div className="bg-blue-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-gray-500">
                              Reserved
                            </p>

                            <p className="text-xl font-bold text-blue-700 mt-1">
                              {reserved}
                            </p>
                          </div>

                          <div className="bg-orange-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-gray-500">
                              Sold
                            </p>

                            <p className="text-xl font-bold text-orange-700 mt-1">
                              {sold}
                            </p>
                          </div>

                        </div>

                        {product.description && (
                          <p className="text-sm text-gray-600 mt-4 line-clamp-2">
                            {product.description}
                          </p>
                        )}

                      </div>
                    </div>
                  </article>
                );
              })}

            </div>
          )}

        </section>

      </div>
    </div>
  );
}