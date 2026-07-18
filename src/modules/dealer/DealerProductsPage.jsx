import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, push, set, update, remove } from "firebase/database";
import { auth, database } from "../../firebase";

export default function DealerProductsPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    productName: "",
    category: "",
    brand: "",
    price: "",
    quantity: "",
    unit: "",
    description: "",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function loadProducts() {
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
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.productName.trim()) {
      alert("Please enter product name.");
      return;
    }

    if (!form.category.trim()) {
      alert("Please select category.");
      return;
    }

    if (!form.price.trim()) {
      alert("Please enter price.");
      return;
    }

    if (!form.quantity.trim()) {
      alert("Please enter quantity.");
      return;
    }

    if (!form.unit.trim()) {
      alert("Please enter unit.");
      return;
    }

    try {
      setLoading(true);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      if (editingId) {
        await update(
          ref(database, `dealerProducts/${currentUser.uid}/${editingId}`),
          {
            productName: form.productName,
            category: form.category,
            brand: form.brand,
            price: Number(form.price),
            quantity: Number(form.quantity),
            unit: form.unit,
            description: form.description,
            updatedAt: new Date().toISOString(),
          }
        );

        alert("Product updated successfully.");
      } else {
        const productRef = push(
          ref(database, `dealerProducts/${currentUser.uid}`)
        );

        await set(productRef, {
          productName: form.productName,
          category: form.category,
          brand: form.brand,
          price: Number(form.price),
          quantity: Number(form.quantity),
          unit: form.unit,
          description: form.description,
          dealerUid: currentUser.uid,
          status: "available",
          createdAt: new Date().toISOString(),
        });

        alert("Product added successfully.");
      }

      setForm({
        productName: "",
        category: "",
        brand: "",
        price: "",
        quantity: "",
        unit: "",
        description: "",
      });

      setEditingId(null);
      loadProducts();
    } catch (error) {
      console.error(error);
      alert("Failed to save product.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(product) {
    setEditingId(product.id);

    setForm({
      productName: product.productName || "",
      category: product.category || "",
      brand: product.brand || "",
      price: product.price || "",
      quantity: product.quantity || "",
      unit: product.unit || "",
      description: product.description || "",
    });
  }

  async function handleDelete(productId) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmDelete) return;

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      await remove(
        ref(database, `dealerProducts/${currentUser.uid}/${productId}`)
      );

      alert("Product deleted successfully.");
      loadProducts();
    } catch (error) {
      console.error(error);
      alert("Failed to delete product.");
    }
  }

  function cancelEdit() {
    setEditingId(null);

    setForm({
      productName: "",
      category: "",
      brand: "",
      price: "",
      quantity: "",
      unit: "",
      description: "",
    });
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
            📦 Product Management
          </h1>

          <p className="text-gray-600 mt-2">
            Add, update and delete dealer products.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-1">
            <h2 className="text-2xl font-bold text-green-700 mb-4">
              {editingId ? "Update Product" : "Add Product"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                name="productName"
                placeholder="Product Name"
                value={form.productName}
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              >
                <option value="">Select Category</option>
                <option value="Seeds">Seeds</option>
                <option value="Fertilizer">Fertilizer</option>
                <option value="Pesticide">Pesticide</option>
                <option value="Tools">Tools</option>
                <option value="Animal Feed">Animal Feed</option>
              </select>

              <input
                name="brand"
                placeholder="Brand"
                value={form.brand}
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

              <input
                name="price"
                type="number"
                placeholder="Price"
                value={form.price}
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

              <input
                name="quantity"
                type="number"
                placeholder="Quantity"
                value={form.quantity}
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

              <input
                name="unit"
                placeholder="Unit example: kg, bag, packet, piece"
                value={form.unit}
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

              <textarea
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={handleChange}
                className="w-full border p-3 rounded-lg"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold"
              >
                {loading
                  ? "Saving..."
                  : editingId
                  ? "Update Product"
                  : "Add Product"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full border border-gray-300 py-3 rounded-lg font-semibold"
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-green-700 mb-4">
                Product List
              </h2>

              {products.length === 0 ? (
                <p className="text-gray-600">
                  No products added yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {products.map((product) => (
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
                          Quantity: {product.quantity} {product.unit}
                        </p>

                        <p className="text-sm text-gray-500 mt-1">
                          {product.description}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDelete(product.id)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}