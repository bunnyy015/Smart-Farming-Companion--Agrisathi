import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  get,
  ref,
  push,
  update,
  remove,
} from "firebase/database";
import { database } from "../../firebase";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getCategoryIcon(category) {
  const icons = {
    seeds: "🌾",
    seed: "🌾",
    fertilizer: "🧪",
    fertilizers: "🧪",
    pesticide: "🛡️",
    pesticides: "🛡️",
    tools: "🛠️",
    "animal feed": "🐄",
    animalfeed: "🐄",
  };

  return icons[normalize(category)] || "🌱";
}

function formatPrice(value) {
  const price = Number(value || 0);
  return `₹${price.toFixed(2)}`;
}

function getStockStatus(quantity, lowStockLevel) {
  const stock = Number(quantity || 0);
  const lowLevel = Number(lowStockLevel || 5);

  if (stock <= 0) {
    return {
      label: "Out of Stock",
      className: "bg-red-100 text-red-700",
    };
  }

  if (stock <= lowLevel) {
    return {
      label: "Low Stock",
      className: "bg-yellow-100 text-yellow-800",
    };
  }

  return {
    label: "In Stock",
    className: "bg-emerald-100 text-emerald-700",
  };
}

function getProductImage(product) {
  const possibleImages = [
    product?.imageUrl,
    product?.imageURL,
    product?.image,
    product?.productImage,
    product?.productImageUrl,
    product?.photoURL,
    product?.photoUrl,
  ];

  const image = possibleImages.find(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0
  );

  return image ? image.trim() : "";
}

function getDealerInfo(product, dealerUsers) {
  const dealer = dealerUsers?.[product.dealerUid] || {};

  const name =
    product.dealerName ||
    dealer.dealerName ||
    dealer.shopName ||
    dealer.businessName ||
    dealer.name ||
    dealer.fullName ||
    "Dealer";

  const phone =
    product.dealerPhone ||
    dealer.dealerPhone ||
    dealer.phone ||
    dealer.phoneNumber ||
    "";

  const district =
    product.dealerDistrict ||
    dealer.dealerDistrict ||
    dealer.district ||
    "";

  const state =
    product.dealerState ||
    dealer.dealerState ||
    dealer.state ||
    "";

  const village =
    product.dealerVillage ||
    dealer.dealerVillage ||
    dealer.village ||
    "";

  return {
    name,
    phone,
    district,
    state,
    village,
  };
}

function ProductImage({ product, large = false }) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = getProductImage(product);
  const showImage = imageUrl && !imageError;

  return (
    <div
      className={`${
        large ? "w-full h-64 md:h-72" : "w-24 h-24"
      } rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0`}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={product.productName || "Product"}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          className={`${
            large ? "text-7xl" : "text-5xl"
          } flex items-center justify-center`}
          aria-label="Product image unavailable"
        >
          {getCategoryIcon(product.category)}
        </div>
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [dealerUsers, setDealerUsers] = useState({});

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  // ADD / EDIT
  const [productFormOpen, setProductFormOpen] =
    useState(false);
  const [editingProduct, setEditingProduct] =
    useState(null);

  const [productForm, setProductForm] = useState({
    dealerUid: "",
    productName: "",
    category: "",
    brand: "",
    price: "",
    quantity: "",
    unit: "",
    lowStockLevel: "5",
    description: "",
    imageUrl: "",
  });

  const [savingProduct, setSavingProduct] =
    useState(false);

  // STOCK UPDATE
  const [stockModalOpen, setStockModalOpen] =
    useState(false);
  const [stockProduct, setStockProduct] =
    useState(null);
  const [newStock, setNewStock] = useState("");
  const [updatingStock, setUpdatingStock] =
    useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [productsSnapshot, usersSnapshot] =
        await Promise.all([
          get(ref(database, "dealerProducts")),
          get(ref(database, "users")),
        ]);

      const dealerInformation = {};

      if (usersSnapshot.exists()) {
        const usersData = usersSnapshot.val() || {};

        Object.entries(usersData).forEach(
          ([uid, user]) => {
            if (
              user &&
              typeof user === "object" &&
              normalize(user.role) === "dealer"
            ) {
              dealerInformation[uid] = user;
            }
          }
        );
      }

      setDealerUsers(dealerInformation);

      if (!productsSnapshot.exists()) {
        setProducts([]);
        return;
      }

      const data = productsSnapshot.val();
      const productList = [];

      Object.entries(data || {}).forEach(
        ([dealerUid, dealerProducts]) => {
          if (
            !dealerProducts ||
            typeof dealerProducts !== "object"
          ) {
            return;
          }

          Object.entries(dealerProducts).forEach(
            ([productId, product]) => {
              if (
                !product ||
                typeof product !== "object"
              ) {
                return;
              }

              productList.push({
                id: productId,
                dealerUid,
                ...product,
              });
            }
          );
        }
      );

      setProducts(productList);
    } catch (error) {
      console.error(
        "Admin products loading error:",
        error
      );

      setErrorMessage(
        "Unable to load dealer products. Please check Firebase database access and rules."
      );
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const categorySet = new Set();

    products.forEach((product) => {
      if (product.category) {
        categorySet.add(product.category);
      }
    });

    return Array.from(categorySet).sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = normalize(searchTerm);

    return products.filter((product) => {
      const dealer =
        dealerUsers?.[product.dealerUid] || {};

      const dealerInfo = getDealerInfo(
        product,
        dealerUsers
      );

      const productName = normalize(
        product.productName
      );

      const category = normalize(
        product.category
      );

      const brand = normalize(product.brand);

      const dealerName = normalize(
        dealerInfo.name
      );

      const dealerDistrict = normalize(
        dealerInfo.district
      );

      const dealerState = normalize(
        dealerInfo.state
      );

      const dealerPhone = normalize(
        dealerInfo.phone
      );

      const matchesSearch =
        !search ||
        productName.includes(search) ||
        category.includes(search) ||
        brand.includes(search) ||
        dealerName.includes(search) ||
        dealerDistrict.includes(search) ||
        dealerState.includes(search) ||
        dealerPhone.includes(search);

      const matchesCategory =
        categoryFilter === "all" ||
        normalize(product.category) ===
          normalize(categoryFilter);

      const quantity = Number(
        product.quantity || 0
      );

      const lowStockLevel = Number(
        product.lowStockLevel || 5
      );

      let matchesStock = true;

      if (stockFilter === "in-stock") {
        matchesStock = quantity > lowStockLevel;
      }

      if (stockFilter === "low-stock") {
        matchesStock =
          quantity > 0 &&
          quantity <= lowStockLevel;
      }

      if (stockFilter === "out-of-stock") {
        matchesStock = quantity <= 0;
      }

      void dealer;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStock
      );
    });
  }, [
    products,
    dealerUsers,
    searchTerm,
    categoryFilter,
    stockFilter,
  ]);

  const statistics = useMemo(() => {
    let totalQuantity = 0;
    let lowStock = 0;
    let outOfStock = 0;

    products.forEach((product) => {
      const quantity = Number(
        product.quantity || 0
      );

      const lowStockLevel = Number(
        product.lowStockLevel || 5
      );

      totalQuantity += quantity;

      if (quantity <= 0) {
        outOfStock++;
      } else if (quantity <= lowStockLevel) {
        lowStock++;
      }
    });

    return {
      total: products.length,
      totalQuantity,
      lowStock,
      outOfStock,
    };
  }, [products]);

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("all");
    setStockFilter("all");
  }

  function handleLogout() {
    localStorage.removeItem("role");

    navigate("/role-selection", {
      replace: true,
    });
  }

  // -----------------------------
  // ADD PRODUCT
  // -----------------------------

  function openAddProduct() {
    setEditingProduct(null);

    setProductForm({
      dealerUid: "",
      productName: "",
      category: "",
      brand: "",
      price: "",
      quantity: "",
      unit: "",
      lowStockLevel: "5",
      description: "",
      imageUrl: "",
    });

    setProductFormOpen(true);
  }

  // -----------------------------
  // EDIT PRODUCT
  // -----------------------------

  function openEditProduct(product) {
    setEditingProduct(product);

    setProductForm({
      dealerUid: product.dealerUid || "",
      productName: product.productName || "",
      category: product.category || "",
      brand: product.brand || "",
      price: product.price ?? "",
      quantity: product.quantity ?? "",
      unit: product.unit || "",
      lowStockLevel:
        product.lowStockLevel ?? "5",
      description: product.description || "",
      imageUrl:
        product.imageUrl ||
        product.imageURL ||
        product.image ||
        product.productImage ||
        product.productImageUrl ||
        "",
    });

    setSelectedProduct(null);
    setProductFormOpen(true);
  }

  // -----------------------------
  // FORM CHANGE
  // -----------------------------

  function handleProductFormChange(event) {
    const { name, value } = event.target;

    setProductForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // -----------------------------
  // SAVE PRODUCT
  // -----------------------------

  async function handleSaveProduct(event) {
    event.preventDefault();

    if (!productForm.dealerUid) {
      setActionMessage(
        "Please select a dealer."
      );
      return;
    }

    if (!productForm.productName.trim()) {
      setActionMessage(
        "Please enter product name."
      );
      return;
    }

    if (!productForm.category.trim()) {
      setActionMessage(
        "Please enter product category."
      );
      return;
    }

    if (
      productForm.price === "" ||
      Number(productForm.price) < 0
    ) {
      setActionMessage(
        "Please enter a valid price."
      );
      return;
    }

    if (
      productForm.quantity === "" ||
      Number(productForm.quantity) < 0
    ) {
      setActionMessage(
        "Please enter a valid quantity."
      );
      return;
    }

    try {
      setSavingProduct(true);
      setActionMessage("");

      const dealerInfo =
        dealerUsers[productForm.dealerUid] || {};

      const productData = {
        productName:
          productForm.productName.trim(),

        category:
          productForm.category.trim(),

        brand:
          productForm.brand.trim(),

        price: Number(productForm.price),

        quantity: Number(
          productForm.quantity
        ),

        unit:
          productForm.unit.trim() || "unit",

        lowStockLevel: Number(
          productForm.lowStockLevel || 5
        ),

        description:
          productForm.description.trim(),

        imageUrl:
          productForm.imageUrl.trim(),

        dealerUid:
          productForm.dealerUid,

        dealerName:
          dealerInfo.dealerName ||
          dealerInfo.shopName ||
          dealerInfo.businessName ||
          dealerInfo.name ||
          dealerInfo.fullName ||
          "Dealer",

        dealerPhone:
          dealerInfo.dealerPhone ||
          dealerInfo.phone ||
          dealerInfo.phoneNumber ||
          "",

        dealerDistrict:
          dealerInfo.dealerDistrict ||
          dealerInfo.district ||
          "",

        dealerState:
          dealerInfo.dealerState ||
          dealerInfo.state ||
          "",

        dealerVillage:
          dealerInfo.dealerVillage ||
          dealerInfo.village ||
          "",

        updatedAt: new Date().toISOString(),
      };

      if (editingProduct) {
        const productRef = ref(
          database,
          `dealerProducts/${editingProduct.dealerUid}/${editingProduct.id}`
        );

        await update(productRef, productData);

        setActionMessage(
          "Product updated successfully."
        );
      } else {
        const productRef = push(
          ref(
            database,
            `dealerProducts/${productForm.dealerUid}`
          )
        );

        await update(productRef, {
          ...productData,
          createdAt: new Date().toISOString(),
        });

        setActionMessage(
          "Product added successfully."
        );
      }

      setProductFormOpen(false);
      setEditingProduct(null);

      await loadProducts();
    } catch (error) {
      console.error(
        "Product save error:",
        error
      );

      setActionMessage(
        "Unable to save product. Please check Firebase database rules."
      );
    } finally {
      setSavingProduct(false);
    }
  }

  // -----------------------------
  // DELETE PRODUCT
  // -----------------------------

  async function handleDeleteProduct(product) {
    const productName =
      product.productName ||
      "this product";

    const confirmed = window.confirm(
      `Are you sure you want to delete "${productName}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionMessage("");

      const productRef = ref(
        database,
        `dealerProducts/${product.dealerUid}/${product.id}`
      );

      await remove(productRef);

      setSelectedProduct(null);

      setActionMessage(
        "Product deleted successfully."
      );

      await loadProducts();
    } catch (error) {
      console.error(
        "Product delete error:",
        error
      );

      setActionMessage(
        "Unable to delete product. Please check Firebase database rules."
      );
    }
  }

  // -----------------------------
  // OPEN STOCK MODAL
  // -----------------------------

  function openStockModal(product) {
    setStockProduct(product);
    setNewStock(
      String(product.quantity ?? 0)
    );
    setStockModalOpen(true);
    setSelectedProduct(null);
  }

  // -----------------------------
  // UPDATE STOCK
  // -----------------------------

  async function handleUpdateStock(event) {
    event.preventDefault();

    if (
      newStock === "" ||
      Number(newStock) < 0
    ) {
      setActionMessage(
        "Please enter a valid stock quantity."
      );
      return;
    }

    try {
      setUpdatingStock(true);
      setActionMessage("");

      const productRef = ref(
        database,
        `dealerProducts/${stockProduct.dealerUid}/${stockProduct.id}`
      );

      await update(productRef, {
        quantity: Number(newStock),
        updatedAt: new Date().toISOString(),
      });

      setStockModalOpen(false);
      setStockProduct(null);

      setActionMessage(
        "Stock updated successfully."
      );

      await loadProducts();
    } catch (error) {
      console.error(
        "Stock update error:",
        error
      );

      setActionMessage(
        "Unable to update stock. Please check Firebase database rules."
      );
    } finally {
      setUpdatingStock(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
                🛒
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Product Management
                </h1>

                <p className="text-indigo-200 mt-1">
                  Monitor and manage products and dealers on the AgriSaathi platform
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition font-semibold"
              >
                ← Dashboard
              </button>

              <button
                type="button"
                onClick={loadProducts}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition font-semibold disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : "↻ Refresh"}
              </button>

              <button
                type="button"
                onClick={openAddProduct}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition font-semibold"
              >
                + Add Product
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 transition font-semibold"
              >
                Logout
              </button>

            </div>
          </div>
        </header>

        {/* ACTION MESSAGE */}
        {actionMessage && (
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-800 flex items-center justify-between gap-4">

            <p className="font-semibold">
              {actionMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                setActionMessage("")
              }
              className="text-xl font-bold"
            >
              ×
            </button>

          </div>
        )}

        {/* ERROR */}
        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">

            <p className="font-bold">
              Product Management Error
            </p>

            <p className="text-sm mt-1">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={loadProducts}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Try Again
            </button>

          </div>
        )}

        {/* STATISTICS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  Total Products
                </p>

                <p className="text-3xl font-bold text-indigo-900 mt-2">
                  {loading
                    ? "..."
                    : statistics.total}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl">
                🛒
              </div>

            </div>
          </div>

          <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  Total Stock
                </p>

                <p className="text-3xl font-bold text-blue-900 mt-2">
                  {loading
                    ? "..."
                    : statistics.totalQuantity}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">
                📦
              </div>

            </div>
          </div>

          <div className="bg-white border border-yellow-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  Low Stock
                </p>

                <p className="text-3xl font-bold text-yellow-700 mt-2">
                  {loading
                    ? "..."
                    : statistics.lowStock}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center text-2xl">
                ⚠️
              </div>

            </div>
          </div>

          <div className="bg-white border border-red-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  Out of Stock
                </p>

                <p className="text-3xl font-bold text-red-700 mt-2">
                  {loading
                    ? "..."
                    : statistics.outOfStock}
                </p>
              </div>

              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-2xl">
                🚫
              </div>

            </div>
          </div>

        </section>

        {/* FILTERS */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">

          <div className="flex flex-col lg:flex-row gap-4">

            <div className="flex-1">

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search Products
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search product, category, brand or dealer..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />

            </div>

            <div className="w-full lg:w-56">

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category
              </label>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
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

            </div>

            <div className="w-full lg:w-56">

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Stock Status
              </label>

              <select
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">
                  All Stock
                </option>

                <option value="in-stock">
                  In Stock
                </option>

                <option value="low-stock">
                  Low Stock
                </option>

                <option value="out-of-stock">
                  Out of Stock
                </option>

              </select>

            </div>

            <div className="flex items-end">

              <button
                type="button"
                onClick={clearFilters}
                className="w-full lg:w-auto rounded-xl border border-gray-300 bg-gray-50 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Clear
              </button>

            </div>

          </div>
        </section>

        {/* RESULT COUNT */}
        <div className="flex items-center justify-between mb-4">

          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Dealer Products
            </h2>

            <p className="text-gray-500 text-sm mt-1">
              Showing {filteredProducts.length} of{" "}
              {products.length} products
            </p>
          </div>

        </div>

        {/* LOADING */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">

            <div className="text-4xl mb-3 animate-pulse">
              🛒
            </div>

            <p className="font-semibold text-slate-700">
              Loading dealer products...
            </p>

            <p className="text-sm text-gray-500 mt-1">
              Please wait.
            </p>

          </div>
        )}

        {/* EMPTY */}
        {!loading &&
          filteredProducts.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">

              <div className="text-5xl mb-4">
                🔍
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                No products found
              </h3>

              <p className="text-gray-500 mt-2">
                Try changing your search or filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-white font-semibold hover:bg-indigo-700"
              >
                Clear Filters
              </button>

            </div>
          )}

        {/* PRODUCTS */}
        {!loading &&
          filteredProducts.length > 0 && (
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

              {filteredProducts.map((product) => {

                const stockStatus =
                  getStockStatus(
                    product.quantity,
                    product.lowStockLevel
                  );

                const dealerInfo =
                  getDealerInfo(
                    product,
                    dealerUsers
                  );

                return (
                  <article
                    key={`${product.dealerUid}-${product.id}`}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden"
                  >

                    {/* PRODUCT IMAGE */}
                    <ProductImage product={product} />

                    <div className="p-5">

                      {/* PRODUCT HEADER */}
                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <h3 className="text-lg font-bold text-slate-900 break-words">
                            {product.productName ||
                              "Unnamed Product"}
                          </h3>

                          <p className="text-sm text-gray-500 mt-1">
                            {product.category ||
                              "Uncategorized"}
                          </p>

                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${stockStatus.className}`}
                        >
                          {stockStatus.label}
                        </span>

                      </div>

                      {/* PRODUCT INFORMATION */}
                      <div className="grid grid-cols-2 gap-3 mt-5">

                        <div className="rounded-xl bg-slate-50 p-3">

                          <p className="text-xs text-gray-500">
                            Price
                          </p>

                          <p className="text-lg font-bold text-indigo-900 mt-1">
                            {formatPrice(
                              product.price
                            )}
                          </p>

                          <p className="text-xs text-gray-500">
                            per{" "}
                            {product.unit ||
                              "unit"}
                          </p>

                        </div>

                        <div className="rounded-xl bg-blue-50 p-3">

                          <p className="text-xs text-gray-500">
                            Available
                          </p>

                          <p className="text-lg font-bold text-blue-900 mt-1">
                            {Number(
                              product.quantity || 0
                            )}
                          </p>

                          <p className="text-xs text-gray-500">
                            {product.unit ||
                              "units"}
                          </p>

                        </div>

                      </div>

                      {/* BRAND */}
                      {product.brand && (
                        <div className="mt-4">

                          <p className="text-xs text-gray-500">
                            Brand
                          </p>

                          <p className="font-semibold text-gray-800 mt-1">
                            {product.brand}
                          </p>

                        </div>
                      )}

                      {/* DEALER INFORMATION */}
                      <div className="border-t border-gray-100 mt-4 pt-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl">
                            🏪
                          </div>

                          <div className="min-w-0">

                            <p className="text-xs text-gray-500">
                              Provided by dealer
                            </p>

                            <p className="font-bold text-slate-800 truncate">
                              {dealerInfo.name}
                            </p>

                          </div>

                        </div>

                        {dealerInfo.district ||
                        dealerInfo.state ? (
                          <p className="text-sm text-gray-500 mt-2">
                            📍{" "}
                            {[
                              dealerInfo.village,
                              dealerInfo.district,
                              dealerInfo.state,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        ) : null}

                        {dealerInfo.phone && (
                          <p className="text-sm text-gray-500 mt-1">
                            📞{" "}
                            {dealerInfo.phone}
                          </p>
                        )}

                      </div>

                      {/* DESCRIPTION */}
                      {product.description && (
                        <p className="text-sm text-gray-600 mt-4 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      {/* IMAGE STATUS */}
                      <div className="mt-4">

                        {getProductImage(product) ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            🖼️ Product image available
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            🌱 No product image
                          </span>
                        )}

                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="grid grid-cols-2 gap-2 mt-5">

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProduct(
                              product
                            )
                          }
                          className="rounded-xl bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-700 transition"
                        >
                          View Details
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openEditProduct(product)
                          }
                          className="rounded-xl bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 transition"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openStockModal(product)
                          }
                          className="rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 transition"
                        >
                          📦 Stock
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteProduct(
                              product
                            )
                          }
                          className="rounded-xl bg-red-600 text-white py-3 font-semibold hover:bg-red-700 transition"
                        >
                          🗑️ Delete
                        </button>

                      </div>

                    </div>
                  </article>
                );
              })}

            </section>
          )}

        {/* PRODUCT DETAILS MODAL */}
        {selectedProduct && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() =>
              setSelectedProduct(null)
            }
          >

            <div
              className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <ProductImage
                product={selectedProduct}
                large
              />

              <div className="bg-gradient-to-r from-indigo-950 to-indigo-700 text-white p-6">

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <h2 className="text-2xl font-bold">
                      {selectedProduct.productName ||
                        "Unnamed Product"}
                    </h2>

                    <p className="text-indigo-200 mt-1">
                      {selectedProduct.category ||
                        "Uncategorized"}
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedProduct(null)
                    }
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-xl"
                    aria-label="Close"
                  >
                    ×
                  </button>

                </div>

              </div>

              <div className="p-6 space-y-4">

                <div className="grid grid-cols-2 gap-3">

                  <div className="bg-indigo-50 rounded-xl p-4">

                    <p className="text-xs text-gray-500">
                      Price
                    </p>

                    <p className="text-xl font-bold text-indigo-900 mt-1">
                      {formatPrice(
                        selectedProduct.price
                      )}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      per{" "}
                      {selectedProduct.unit ||
                        "unit"}
                    </p>

                  </div>

                  <div className="bg-blue-50 rounded-xl p-4">

                    <p className="text-xs text-gray-500">
                      Quantity
                    </p>

                    <p className="text-xl font-bold text-blue-900 mt-1">
                      {Number(
                        selectedProduct.quantity ||
                          0
                      )}{" "}
                      {selectedProduct.unit ||
                        "units"}
                    </p>

                  </div>

                </div>

                {selectedProduct.brand && (
                  <div>

                    <p className="text-sm text-gray-500">
                      Brand
                    </p>

                    <p className="font-semibold text-gray-800 mt-1">
                      {selectedProduct.brand}
                    </p>

                  </div>
                )}

                {(() => {

                  const dealerInfo =
                    getDealerInfo(
                      selectedProduct,
                      dealerUsers
                    );

                  return (
                    <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4">

                      <p className="text-sm text-orange-700 font-semibold">
                        Dealer Information
                      </p>

                      <p className="font-bold text-gray-900 mt-2">
                        🏪 {dealerInfo.name}
                      </p>

                      {(dealerInfo.village ||
                        dealerInfo.district ||
                        dealerInfo.state) && (
                        <p className="text-sm text-gray-600 mt-1">
                          📍{" "}
                          {[
                            dealerInfo.village,
                            dealerInfo.district,
                            dealerInfo.state,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}

                      {dealerInfo.phone && (
                        <p className="text-sm text-gray-600 mt-1">
                          📞{" "}
                          {dealerInfo.phone}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mt-3">
                        Dealer UID
                      </p>

                      <p className="text-xs text-gray-600 bg-white rounded-xl p-3 mt-1 break-all border border-orange-100">
                        {selectedProduct.dealerUid}
                      </p>

                    </div>
                  );

                })()}

                {selectedProduct.description && (
                  <div>

                    <p className="text-sm text-gray-500">
                      Description
                    </p>

                    <p className="text-gray-700 mt-1 leading-6">
                      {selectedProduct.description}
                    </p>

                  </div>
                )}

                {getProductImage(
                  selectedProduct
                ) && (
                  <div>

                    <p className="text-sm text-gray-500">
                      Product Image
                    </p>

                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 mt-1 break-all">
                      {getProductImage(
                        selectedProduct
                      )}
                    </p>

                  </div>
                )}

                <div>

                  <p className="text-sm text-gray-500">
                    Product ID
                  </p>

                  <p className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 mt-1 break-all">
                    {selectedProduct.id}
                  </p>

                </div>

                <div className="grid grid-cols-3 gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      openEditProduct(
                        selectedProduct
                      )
                    }
                    className="rounded-xl bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700"
                  >
                    ✏️ Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openStockModal(
                        selectedProduct
                      )
                    }
                    className="rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700"
                  >
                    📦 Stock
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteProduct(
                        selectedProduct
                      )
                    }
                    className="rounded-xl bg-red-600 text-white py-3 font-semibold hover:bg-red-700"
                  >
                    🗑️ Delete
                  </button>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedProduct(null)
                  }
                  className="w-full rounded-xl bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition"
                >
                  Close
                </button>

              </div>
            </div>
          </div>
        )}

        {/* ADD / EDIT PRODUCT MODAL */}
        {productFormOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
            onClick={() =>
              setProductFormOpen(false)
            }
          >

            <div
              className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <div className="bg-gradient-to-r from-indigo-950 to-indigo-700 text-white p-6">

                <div className="flex items-center justify-between">

                  <div>

                    <h2 className="text-2xl font-bold">
                      {editingProduct
                        ? "Edit Product"
                        : "Add Product"}
                    </h2>

                    <p className="text-indigo-200 mt-1">
                      {editingProduct
                        ? "Update product information"
                        : "Add a new product to the dealer inventory"}
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setProductFormOpen(false)
                    }
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-xl"
                  >
                    ×
                  </button>

                </div>

              </div>

              <form
                onSubmit={handleSaveProduct}
                className="p-6"
              >

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* DEALER */}
                  <div className="md:col-span-2">

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Dealer *
                    </label>

                    <select
                      name="dealerUid"
                      value={productForm.dealerUid}
                      onChange={
                        handleProductFormChange
                      }
                      disabled={
                        Boolean(editingProduct)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      required
                    >

                      <option value="">
                        Select Dealer
                      </option>

                      {Object.entries(
                        dealerUsers
                      ).map(
                        ([uid, dealer]) => {

                          const dealerName =
                            dealer.dealerName ||
                            dealer.shopName ||
                            dealer.businessName ||
                            dealer.name ||
                            dealer.fullName ||
                            "Dealer";

                          return (
                            <option
                              key={uid}
                              value={uid}
                            >
                              {dealerName}
                            </option>
                          );
                        }
                      )}

                    </select>

                  </div>

                  {/* PRODUCT NAME */}
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Product Name *
                    </label>

                    <input
                      type="text"
                      name="productName"
                      value={
                        productForm.productName
                      }
                      onChange={
                        handleProductFormChange
                      }
                      placeholder="Enter product name"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />

                  </div>

                  {/* CATEGORY */}
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category *
                    </label>

                    <input
                      type="text"
                      name="category"
                      value={
                        productForm.category
                      }
                      onChange={
                        handleProductFormChange
                      }
                      placeholder="Seeds, Fertilizer, Tools..."
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />

                  </div>

                  {/* BRAND */}
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Brand
                    </label>

                    <input
                      type="text"
                      name="brand"
                      value={
                        productForm.brand
                      }
                      onChange={
                        handleProductFormChange
                      }
                      placeholder="Enter brand"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                  </div>

                  {/* PRICE */}
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Price *
                    </label>

                    <input
                      type="number"
                      name="price"
                      min="0"
                      step="0.01"
                      value={
                        productForm.price
                      }
                      onChange={
                        handleProductFormChange
                      }
                      placeholder="0.00"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />

                  </div>

                  {/* QUANTITY */}
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantity *
                    </label>

                    <input
                      type="number"
                      name="quantity"
                      min="0"
                      value={
                        productForm.quantity
                      }
                      onChange={
                        handleProductFormChange
                      }
                      placeholder="0"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />

                  </div>

                  {/* UNIT */}
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Unit
                    </label>

                    <input
                      type="text"
                      name="unit"
                      value={
                        productForm.unit
                      }
                      onChange={
                        handleProductFormChange
                      }
                      placeholder="kg, litre, piece..."
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                  </div>

                  {/* LOW STOCK LEVEL */}
                  <div>

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Low Stock Level
                    </label>

                    <input
                      type="number"
                      name="lowStockLevel"
                      min="0"
                      value={
                        productForm.lowStockLevel
                      }
                      onChange={
                        handleProductFormChange
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                  </div>

                  {/* IMAGE URL */}
                  <div className="md:col-span-2">

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Product Image URL
                    </label>

                    <input
                      type="url"
                      name="imageUrl"
                      value={
                        productForm.imageUrl
                      }
                      onChange={
                        handleProductFormChange
                      }
                      placeholder="https://example.com/product.jpg"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                  </div>

                  {/* DESCRIPTION */}
                  <div className="md:col-span-2">

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>

                    <textarea
                      name="description"
                      value={
                        productForm.description
                      }
                      onChange={
                        handleProductFormChange
                      }
                      rows="4"
                      placeholder="Enter product description..."
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />

                  </div>

                </div>

                {/* FORM BUTTONS */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">

                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="flex-1 rounded-xl bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingProduct
                      ? "Saving..."
                      : editingProduct
                      ? "Update Product"
                      : "Add Product"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setProductFormOpen(false)
                    }
                    className="flex-1 rounded-xl bg-gray-100 text-gray-700 py-3 font-semibold hover:bg-gray-200"
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </div>
          </div>
        )}

        {/* STOCK UPDATE MODAL */}
        {stockModalOpen && stockProduct && (
          <div
            className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
            onClick={() =>
              setStockModalOpen(false)
            }
          >

            <div
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <div className="bg-gradient-to-r from-emerald-900 to-emerald-600 text-white p-6 rounded-t-3xl">

                <div className="flex items-center justify-between">

                  <div>

                    <h2 className="text-2xl font-bold">
                      Update Stock
                    </h2>

                    <p className="text-emerald-100 mt-1">
                      {stockProduct.productName}
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setStockModalOpen(false)
                    }
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-xl"
                  >
                    ×
                  </button>

                </div>

              </div>

              <form
                onSubmit={handleUpdateStock}
                className="p-6"
              >

                <div className="bg-slate-50 rounded-2xl p-4 mb-5">

                  <p className="text-sm text-gray-500">
                    Current Stock
                  </p>

                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {Number(
                      stockProduct.quantity || 0
                    )}{" "}
                    {stockProduct.unit ||
                      "units"}
                  </p>

                </div>

                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Stock Quantity
                </label>

                <input
                  type="number"
                  min="0"
                  value={newStock}
                  onChange={(event) =>
                    setNewStock(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />

                <div className="flex gap-3 mt-6">

                  <button
                    type="submit"
                    disabled={updatingStock}
                    className="flex-1 rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {updatingStock
                      ? "Updating..."
                      : "Update Stock"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setStockModalOpen(false)
                    }
                    className="flex-1 rounded-xl bg-gray-100 text-gray-700 py-3 font-semibold hover:bg-gray-200"
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}