import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref, remove } from "firebase/database";
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
  return `₹${Number(value || 0).toFixed(2)}`;
}

function getStockStatus(quantity, lowStockLevel) {
  const stock = Number(quantity || 0);
  const lowLevel = Number(lowStockLevel || 5);
  if (stock <= 0) return { label: "Out of stock", className: "bg-red-100 text-red-700" };
  if (stock <= lowLevel) return { label: "Low stock", className: "bg-yellow-100 text-yellow-800" };
  return { label: "In stock", className: "bg-emerald-100 text-emerald-700" };
}

function getProductImage(product) {
  return [product?.imageUrl, product?.imageURL, product?.image, product?.productImage, product?.productImageUrl, product?.photoURL, product?.photoUrl]
    .find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function getDealerInfo(product, dealerUsers) {
  const dealer = dealerUsers?.[product.dealerUid] || {};
  return {
    name: product.dealerName || dealer.dealerName || dealer.shopName || dealer.businessName || dealer.name || dealer.fullName || "Dealer",
    phone: product.dealerPhone || dealer.dealerPhone || dealer.phone || dealer.phoneNumber || "",
    district: product.dealerDistrict || dealer.dealerDistrict || dealer.district || "",
    state: product.dealerState || dealer.dealerState || dealer.state || "",
    village: product.dealerVillage || dealer.dealerVillage || dealer.village || "",
  };
}

function ProductImage({ product, large = false }) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getProductImage(product);
  return (
    <div className={`${large ? "h-56 w-full" : "h-12 w-12"} flex shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-100`}>
      {imageUrl && !imageError ? (
        <img src={imageUrl} alt={product.productName || "Product"} loading="lazy" onError={() => setImageError(true)} className="h-full w-full object-cover" />
      ) : <span className={large ? "text-6xl" : "text-2xl"}>{getCategoryIcon(product.category)}</span>}
    </div>
  );
}

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [dealerUsers, setDealerUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [productsSnapshot, usersSnapshot] = await Promise.all([
        get(ref(database, "dealerProducts")),
        get(ref(database, "users")),
      ]);
      const dealerInformation = {};
      if (usersSnapshot.exists()) {
        Object.entries(usersSnapshot.val() || {}).forEach(([uid, user]) => {
          if (user && typeof user === "object" && normalize(user.role) === "dealer") dealerInformation[uid] = user;
        });
      }
      setDealerUsers(dealerInformation);
      const productList = [];
      if (productsSnapshot.exists()) {
        Object.entries(productsSnapshot.val() || {}).forEach(([dealerUid, dealerProducts]) => {
          if (!dealerProducts || typeof dealerProducts !== "object") return;
          Object.entries(dealerProducts).forEach(([id, product]) => {
            if (product && typeof product === "object") productList.push({ id, dealerUid, ...product });
          });
        });
      }
      setProducts(productList);
    } catch (error) {
      console.error("Admin products loading error:", error);
      setErrorMessage("Unable to load dealer products. Please check Firebase database access and rules.");
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [products]);
  const filteredProducts = useMemo(() => {
    const search = normalize(searchTerm);
    return products.filter((product) => {
      const dealer = getDealerInfo(product, dealerUsers);
      const searchFields = [product.productName, product.category, product.brand, dealer.name, dealer.district, dealer.state, dealer.phone];
      const quantity = Number(product.quantity || 0);
      const lowStockLevel = Number(product.lowStockLevel || 5);
      const matchesStock = stockFilter === "all"
        || (stockFilter === "in-stock" && quantity > lowStockLevel)
        || (stockFilter === "low-stock" && quantity > 0 && quantity <= lowStockLevel)
        || (stockFilter === "out-of-stock" && quantity <= 0);
      return (!search || searchFields.some((value) => normalize(value).includes(search)))
        && (categoryFilter === "all" || normalize(product.category) === normalize(categoryFilter))
        && matchesStock;
    });
  }, [products, dealerUsers, searchTerm, categoryFilter, stockFilter]);

  const statistics = useMemo(() => products.reduce((result, product) => {
    const quantity = Number(product.quantity || 0);
    const lowLevel = Number(product.lowStockLevel || 5);
    result.totalQuantity += quantity;
    if (quantity <= 0) result.outOfStock++;
    else if (quantity <= lowLevel) result.lowStock++;
    return result;
  }, { totalQuantity: 0, lowStock: 0, outOfStock: 0 }), [products]);

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("all");
    setStockFilter("all");
  }

  async function handleDeleteProduct(product) {
    if (!window.confirm(`Are you sure you want to delete "${product.productName || "this product"}"?`)) return;
    const key = `${product.dealerUid}/${product.id}`;
    try {
      setDeletingId(key);
      setActionMessage("");
      await remove(ref(database, `dealerProducts/${key}`));
      setProducts((current) => current.filter((item) => `${item.dealerUid}/${item.id}` !== key));
      setSelectedProduct(null);
      setActionMessage("Product deleted successfully.");
    } catch (error) {
      console.error("Product delete error:", error);
      setActionMessage("Unable to delete product. Please check Firebase database rules.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-3xl shadow-inner">🛒</div>
              <div><h1 className="text-3xl font-bold md:text-4xl">Product Management</h1><p className="mt-1 text-indigo-200">View and manage dealer products.</p></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate("/admin")} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-semibold transition hover:bg-white/20">← Admin Dashboard</button>
              <button type="button" onClick={loadProducts} disabled={loading} className="rounded-xl bg-white px-4 py-2.5 font-semibold text-indigo-900 transition hover:bg-indigo-50 disabled:opacity-50">{loading ? "Loading..." : "↻ Refresh"}</button>
            </div>
          </div>
        </header>

        {actionMessage && <div role="status" className="mb-4 flex items-center justify-between rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"><p>{actionMessage}</p><button type="button" onClick={() => setActionMessage("")} aria-label="Dismiss message">×</button></div>}
        {errorMessage && <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700">{errorMessage} <button type="button" onClick={loadProducts} className="ml-2 font-semibold underline">Try again</button></div>}

        <section aria-label="Product statistics" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[["Total Products", products.length, "🛒", "bg-white border-indigo-100", "text-indigo-900", "bg-indigo-50"], ["Total Stock", statistics.totalQuantity, "📦", "bg-emerald-50 border-emerald-100", "text-emerald-800", "bg-white/70"], ["Low Stock", statistics.lowStock, "⚠️", "bg-yellow-50 border-yellow-100", "text-yellow-800", "bg-white/70"], ["Out of Stock", statistics.outOfStock, "🚫", "bg-red-50 border-red-100", "text-red-800", "bg-white/70"]].map(([label, value, icon, cardClass, valueClass, iconClass]) => <div key={label} className={`flex items-center justify-between gap-3 rounded-2xl border p-5 shadow-sm ${cardClass}`}><div><p className="text-sm font-medium text-gray-600">{label}</p><p className={`mt-2 text-3xl font-bold ${valueClass}`}>{loading ? "..." : value}</p></div><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${iconClass}`}>{icon}</span></div>)}
        </section>

        <section className="mb-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_190px_190px_auto] lg:items-end">
          <label className="text-sm font-semibold text-gray-700">Search Products
            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name, category, brand or dealer..." className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
          </label>
          <label className="text-sm font-semibold text-gray-700">Category
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500">
              <option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">Stock Status
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500">
              <option value="all">All stock</option><option value="in-stock">In stock</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option>
            </select>
          </label>
          <button type="button" onClick={clearFilters} className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50">Clear</button>
          </div>
          <p className="mt-4 text-sm text-gray-500">Showing <strong className="text-gray-700">{filteredProducts.length}</strong> of <strong className="text-gray-700">{products.length}</strong> products</p>
        </section>

        <div className="overflow-x-auto rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="bg-indigo-50 text-xs uppercase tracking-wide text-indigo-950"><tr><th className="px-4 py-3 font-semibold">Product</th><th className="px-4 py-3 font-semibold">Dealer</th><th className="px-4 py-3 font-semibold">Price</th><th className="px-4 py-3 font-semibold">Stock</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Actions</th></tr></thead>
          {loading ? <tbody><tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading dealer products...</td></tr></tbody>
            : filteredProducts.length === 0 ? <tbody><tr><td colSpan="6" className="p-10 text-center"><p className="font-semibold text-slate-800">No products found</p><button type="button" onClick={clearFilters} className="mt-2 text-sm text-indigo-700 underline">Clear filters</button></td></tr></tbody>
              : <tbody className="divide-y divide-indigo-100">{filteredProducts.map((product) => {
                const key = `${product.dealerUid}/${product.id}`;
                const dealer = getDealerInfo(product, dealerUsers);
                const status = getStockStatus(product.quantity, product.lowStockLevel);
                return <tr key={key} className="hover:bg-indigo-50/60">
                  <td className="px-4 py-3"><button type="button" onClick={() => setSelectedProduct(product)} className="flex min-w-0 items-center gap-3 text-left hover:text-indigo-800">
                    <ProductImage product={product} /><span className="min-w-0"><span className="block font-semibold text-gray-900">{product.productName || "Unnamed product"}</span><span className="block text-sm text-gray-500">{product.category || "Uncategorized"}{product.brand ? ` · ${product.brand}` : ""}</span></span>
                  </button>
                  </td><td className="px-4 py-3 text-gray-700">{dealer.name}</td><td className="px-4 py-3 font-semibold text-gray-900">{formatPrice(product.price)} / {product.unit || "unit"}</td><td className="px-4 py-3 text-gray-700">{Number(product.quantity || 0)} {product.unit || "units"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td><td className="px-4 py-3"><button type="button" disabled={deletingId === key} onClick={() => handleDeleteProduct(product)} aria-label={`Delete ${product.productName || "product"}`} title="Delete product" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50">{deletingId === key ? "Deleting..." : "Delete"}</button></td>
                </tr>;
              })}</tbody>}
          </table>
        </div>
      </div>

      {selectedProduct && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedProduct(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="product-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <ProductImage product={selectedProduct} large />
          <div className="flex items-start justify-between gap-4 bg-slate-900 p-5 text-white"><div><h2 id="product-title" className="text-xl font-bold">{selectedProduct.productName || "Unnamed product"}</h2><p className="mt-1 text-slate-300">{selectedProduct.category || "Uncategorized"}</p></div><button type="button" onClick={() => setSelectedProduct(null)} aria-label="Close details" className="rounded px-2 py-1 hover:bg-white/10">×</button></div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3"><div className="rounded bg-slate-50 p-3"><p className="text-xs text-slate-500">Price</p><p className="mt-1 font-bold">{formatPrice(selectedProduct.price)} / {selectedProduct.unit || "unit"}</p></div><div className="rounded bg-slate-50 p-3"><p className="text-xs text-slate-500">Available stock</p><p className="mt-1 font-bold">{Number(selectedProduct.quantity || 0)} {selectedProduct.unit || "units"}</p></div></div>
            {selectedProduct.brand && <p><span className="text-sm text-slate-500">Brand</span><br />{selectedProduct.brand}</p>}
            {selectedProduct.description && <p><span className="text-sm text-slate-500">Description</span><br /><span className="whitespace-pre-wrap">{selectedProduct.description}</span></p>}
            {(() => { const dealer = getDealerInfo(selectedProduct, dealerUsers); return <div className="rounded bg-slate-50 p-3"><p className="font-semibold">Dealer information</p><p className="mt-1">{dealer.name}</p>{dealer.phone && <p className="text-sm text-slate-600">{dealer.phone}</p>}<p className="text-sm text-slate-600">{[dealer.village, dealer.district, dealer.state].filter(Boolean).join(", ")}</p></div>; })()}
            <p className="break-all text-xs text-slate-500">Product ID: {selectedProduct.id}</p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => handleDeleteProduct(selectedProduct)} disabled={deletingId === `${selectedProduct.dealerUid}/${selectedProduct.id}`} className="rounded bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50">Delete product</button><button type="button" onClick={() => setSelectedProduct(null)} className="rounded border border-slate-300 px-4 py-2">Close</button></div>
          </div>
        </section>
      </div>}
    </main>
  );
}
