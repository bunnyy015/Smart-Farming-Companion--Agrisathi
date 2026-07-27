import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  get,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const emptyForm = {
  productName: "",
  category: "",
  brand: "",
  price: "",
  quantity: "",
  unit: "",
  lowStockLevel: "5",
  description: "",
};

export default function DealerProductsPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function loadProducts() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const snapshot = await get(
        ref(database, `dealerProducts/${currentUser.uid}`)
      );

      if (!snapshot.exists()) {
        setProducts([]);
        return;
      }

      const list = Object.entries(snapshot.val())
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort(
          (first, second) =>
            new Date(second.createdAt || 0) -
            new Date(first.createdAt || 0)
        );

      setProducts(list);
    } catch (error) {
      console.error("Dealer products error:", error);
      showMessage("error", "Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const productName = form.productName.trim();
    const category = form.category.trim();
    const unit = form.unit.trim();
    const price = Number(form.price);
    const quantity = Number(form.quantity);
    const lowStockLevel = Number(form.lowStockLevel);

    if (!productName) {
      showMessage("warning", "Enter the product name.");
      return;
    }

    if (!category) {
      showMessage("warning", "Select a category.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      showMessage("warning", "Enter a valid price.");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      showMessage(
        "warning",
        "Quantity must be a whole number."
      );
      return;
    }

    if (!unit) {
      showMessage("warning", "Enter the product unit.");
      return;
    }

    if (
      !Number.isInteger(lowStockLevel) ||
      lowStockLevel < 0
    ) {
      showMessage(
        "warning",
        "Enter a valid low-stock level."
      );
      return;
    }

    try {
      setSaving(true);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const now = new Date().toISOString();

      if (editingId) {
        const existingProduct = products.find(
          (product) => product.id === editingId
        );

        await update(
          ref(
            database,
            `dealerProducts/${currentUser.uid}/${editingId}`
          ),
          {
            productName,
            category,
            brand: form.brand.trim(),
            price,
            quantity,
            unit,
            lowStockLevel,
            description: form.description.trim(),

            dealerUid: currentUser.uid,

            reservedQuantity: Number(
              existingProduct?.reservedQuantity || 0
            ),

            soldQuantity: Number(
              existingProduct?.soldQuantity || 0
            ),

            status:
              quantity > 0 ? "available" : "out_of_stock",

            updatedAt: now,
          }
        );

        showMessage("success", "Product updated.");
      } else {
        const productReference = push(
          ref(
            database,
            `dealerProducts/${currentUser.uid}`
          )
        );

        await set(productReference, {
          productName,
          category,
          brand: form.brand.trim(),
          price,
          quantity,
          unit,
          lowStockLevel,
          description: form.description.trim(),

          dealerUid: currentUser.uid,

          reservedQuantity: 0,
          soldQuantity: 0,

          status:
            quantity > 0 ? "available" : "out_of_stock",

          createdAt: now,
          updatedAt: now,
        });

        showMessage("success", "Product added.");
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      console.error("Save product error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Product permission denied. Check Firebase rules."
          : "Product could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product) {
    setEditingId(product.id);

    setForm({
      productName: product.productName || "",
      category: product.category || "",
      brand: product.brand || "",
      price: String(product.price ?? ""),
      quantity: String(product.quantity ?? ""),
      unit: product.unit || "",
      lowStockLevel: String(
        product.lowStockLevel ?? 5
      ),
      description: product.description || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteProduct(product) {
    if (Number(product.reservedQuantity || 0) > 0) {
      showMessage(
        "warning",
        "This product has accepted orders and cannot be deleted."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${product.productName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      await remove(
        ref(
          database,
          `dealerProducts/${currentUser.uid}/${product.id}`
        )
      );

      showMessage("success", "Product deleted.");
      await loadProducts();
    } catch (error) {
      console.error("Delete product error:", error);
      showMessage("error", "Product could not be deleted.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <p className="text-xl font-bold text-green-700">
          Loading products...
        </p>
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

        <header className="bg-white rounded-2xl shadow p-5 mb-5">
          <button
            type="button"
            onClick={() => navigate("/dealer")}
            className="text-green-700 font-semibold"
          >
            ← Dealer Dashboard
          </button>

          <h1 className="text-3xl font-bold text-green-800 mt-3">
            📦 Products & Stock
          </h1>

          <p className="text-gray-600 mt-2">
            Add products and keep stock information updated.
          </p>
        </header>

        <div className="grid lg:grid-cols-3 gap-5">
          <section className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-xl font-bold text-green-800">
              {editingId ? "Update Product" : "Add Product"}
            </h2>

            <form
              onSubmit={handleSubmit}
              className="space-y-3 mt-4"
            >
              <input
                name="productName"
                value={form.productName}
                onChange={handleChange}
                placeholder="Product name"
                className="w-full border rounded-xl px-4 py-3"
              />

              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Select category</option>
                <option value="Seeds">Seeds</option>
                <option value="Fertilizer">
                  Fertilizer
                </option>
                <option value="Pesticide">
                  Pesticide
                </option>
                <option value="Tools">Tools</option>
                <option value="Animal Feed">
                  Animal Feed
                </option>
              </select>

              <input
                name="brand"
                value={form.brand}
                onChange={handleChange}
                placeholder="Brand"
                className="w-full border rounded-xl px-4 py-3"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="Price"
                  className="w-full border rounded-xl px-4 py-3"
                />

                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={handleChange}
                  placeholder="Available"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <input
                name="unit"
                value={form.unit}
                onChange={handleChange}
                placeholder="Unit: kg, bag, packet"
                className="w-full border rounded-xl px-4 py-3"
              />

              <input
                name="lowStockLevel"
                type="number"
                min="0"
                step="1"
                value={form.lowStockLevel}
                onChange={handleChange}
                placeholder="Low-stock warning level"
                className="w-full border rounded-xl px-4 py-3"
              />

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Short description"
                rows="3"
                className="w-full border rounded-xl px-4 py-3"
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold disabled:bg-gray-400"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Product"
                  : "Add Product"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full border border-gray-300 py-3 rounded-xl font-semibold"
                >
                  Cancel
                </button>
              )}
            </form>
          </section>

          <section className="lg:col-span-2 space-y-4">
            {products.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center">
                <div className="text-4xl">📦</div>
                <p className="text-gray-600 mt-3">
                  No products added yet.
                </p>
              </div>
            ) : (
              products.map((product) => {
                const available = Number(
                  product.quantity || 0
                );

                const reserved = Number(
                  product.reservedQuantity || 0
                );

                const sold = Number(
                  product.soldQuantity || 0
                );

                const lowStockLevel = Number(
                  product.lowStockLevel || 0
                );

                const lowStock =
                  available <= lowStockLevel;

                return (
                  <article
                    key={product.id}
                    className="bg-white rounded-2xl shadow p-5"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-green-800">
                            {product.productName}
                          </h2>

                          {lowStock && (
                            <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                              Low stock
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-500 mt-1">
                          {product.category}
                          {product.brand
                            ? ` • ${product.brand}`
                            : ""}
                        </p>

                        <p className="font-semibold mt-2">
                          ₹{Number(product.price || 0).toFixed(2)} /{" "}
                          {product.unit}
                        </p>
                      </div>

                      <div className="flex gap-2 self-start">
                        <button
                          type="button"
                          onClick={() => editProduct(product)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteProduct(product)
                          }
                          className="border border-red-600 text-red-700 px-4 py-2 rounded-xl"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          Available
                        </p>
                        <p className="font-bold text-green-700">
                          {available}
                        </p>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          Reserved
                        </p>
                        <p className="font-bold text-blue-700">
                          {reserved}
                        </p>
                      </div>

                      <div className="bg-orange-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          Sold
                        </p>
                        <p className="font-bold text-orange-700">
                          {sold}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </div>
    </div>
  );
}