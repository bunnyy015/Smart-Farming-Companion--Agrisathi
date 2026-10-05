import { useEffect, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

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
import "./DealerTheme.css";

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

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function DealerProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showLowStockOnly =
    searchParams.get("filter") === "low-stock";

  const [products, setProducts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(
    () => searchParams.get("add") === "1"
  );
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [existingImageUrl, setExistingImageUrl] =
    useState("");
  const [existingPublicId, setExistingPublicId] =
    useState("");

  const [deleteTarget, setDeleteTarget] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    return () => {
      if (
        imagePreview &&
        imagePreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

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

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!allowedImageTypes.includes(file.type)) {
      showMessage(
        "warning",
        "Select a JPG, PNG or WEBP image."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage(
        "warning",
        "Product image must be smaller than 5 MB."
      );

      event.target.value = "";
      return;
    }

    if (
      imagePreview &&
      imagePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMessage(null);
  }

  function resetForm() {
    if (
      imagePreview &&
      imagePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(imagePreview);
    }

    setEditingId("");
    setForm(emptyForm);

    setImageFile(null);
    setImagePreview("");
    setExistingImageUrl("");
    setExistingPublicId("");
  }

  function closeProductForm() {
    resetForm();
    setFormOpen(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("add");
      return next;
    });
  }

  function openAddForm() {
    resetForm();
    setFormOpen(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("filter");
      next.set("add", "1");
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadProducts() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", {
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
      console.error(
        "Dealer products error:",
        error
      );

      showMessage(
        "error",
        "Products could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadImageToCloudinary(file) {
    if (!file) {
      return {
        imageUrl: existingImageUrl,
        imagePublicId: existingPublicId,
      };
    }

    const cloudName =
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary configuration is missing."
      );
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          "Image upload failed."
      );
    }

    return {
      imageUrl: data.secure_url || "",
      imagePublicId: data.public_id || "",
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const productName =
      form.productName.trim();

    const category =
      form.category.trim();

    const unit =
      form.unit.trim();

    const price =
      Number(form.price);

    const quantity =
      Number(form.quantity);

    const lowStockLevel =
      Number(form.lowStockLevel);

    if (!productName) {
      showMessage(
        "warning",
        "Enter the product name."
      );

      return;
    }

    if (!category) {
      showMessage(
        "warning",
        "Select a category."
      );

      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      showMessage(
        "warning",
        "Enter a valid price."
      );

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
      showMessage(
        "warning",
        "Enter the product unit."
      );

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
        navigate("/login", {
          replace: true,
        });

        return;
      }

      const now =
        new Date().toISOString();

      if (editingId) {
        const existingProduct =
          products.find(
            (product) =>
              product.id === editingId
          );

        const uploadedImage =
          await uploadImageToCloudinary(
            imageFile
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
            description:
              form.description.trim(),

            imageUrl:
              uploadedImage.imageUrl || "",

            imagePublicId:
              uploadedImage.imagePublicId || "",

            dealerUid:
              currentUser.uid,

            reservedQuantity:
              Number(
                existingProduct
                  ?.reservedQuantity || 0
              ),

            soldQuantity:
              Number(
                existingProduct
                  ?.soldQuantity || 0
              ),

            status:
              quantity > 0
                ? "available"
                : "out_of_stock",

            updatedAt: now,
          }
        );

        showMessage(
          "success",
          "Product updated."
        );
      } else {
        const productReference = push(
          ref(
            database,
            `dealerProducts/${currentUser.uid}`
          )
        );

        const uploadedImage =
          await uploadImageToCloudinary(
            imageFile
          );

        await set(productReference, {
          productName,
          category,
          brand: form.brand.trim(),
          price,
          quantity,
          unit,
          lowStockLevel,
          description:
            form.description.trim(),

          imageUrl:
            uploadedImage.imageUrl || "",

          imagePublicId:
            uploadedImage.imagePublicId || "",

          dealerUid:
            currentUser.uid,

          reservedQuantity: 0,
          soldQuantity: 0,

          status:
            quantity > 0
              ? "available"
              : "out_of_stock",

          createdAt: now,
          updatedAt: now,
        });

        showMessage(
          "success",
          "Product added."
        );
      }

      closeProductForm();
      await loadProducts();
    } catch (error) {
      console.error(
        "Save product error:",
        error
      );

      const messageText =
        String(error?.message || "");

      if (
        messageText
          .toLowerCase()
          .includes("cloudinary")
      ) {
        showMessage(
          "error",
          "Cloudinary setup is missing."
        );
      } else if (
        messageText
          .toLowerCase()
          .includes("upload preset")
      ) {
        showMessage(
          "error",
          "Cloudinary upload preset is incorrect."
        );
      } else if (
        messageText
          .toLowerCase()
          .includes("permission denied")
      ) {
        showMessage(
          "error",
          "Firebase permission denied."
        );
      } else {
        showMessage(
          "error",
          messageText ||
            "Product could not be saved."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product) {
    setFormOpen(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("filter");
      next.delete("add");
      return next;
    });
    setEditingId(product.id);

    setForm({
      productName:
        product.productName || "",

      category:
        product.category || "",

      brand:
        product.brand || "",

      price:
        String(product.price ?? ""),

      quantity:
        String(product.quantity ?? ""),

      unit:
        product.unit || "",

      lowStockLevel:
        String(
          product.lowStockLevel ?? 5
        ),

      description:
        product.description || "",
    });

    if (
      imagePreview &&
      imagePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);

    setImagePreview(
      product.imageUrl || ""
    );

    setExistingImageUrl(
      product.imageUrl || ""
    );

    setExistingPublicId(
      product.imagePublicId || ""
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function requestDelete(product) {
    if (
      Number(
        product.reservedQuantity || 0
      ) > 0
    ) {
      showMessage(
        "warning",
        "This product has accepted orders and cannot be deleted."
      );

      return;
    }

    setDeleteTarget(product);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      await remove(
        ref(
          database,
          `dealerProducts/${currentUser.uid}/${deleteTarget.id}`
        )
      );

      if (
        editingId === deleteTarget.id
      ) {
        closeProductForm();
      }

      setDeleteTarget(null);

      showMessage(
        "success",
        "Product deleted."
      );

      await loadProducts();
    } catch (error) {
      console.error(
        "Delete product error:",
        error
      );

      showMessage(
        "error",
        "Product could not be deleted."
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="dealer-theme min-h-screen bg-green-50 flex items-center justify-center">
        <p className="text-xl font-bold text-green-700">
          Loading products...
        </p>
      </div>
    );
  }

  const availableCategories = Array.from(
    new Set([
      ...agricultureCategories,
      ...products.map((product) => String(product.category || "").trim()).filter(Boolean),
    ])
  );

  const visibleProducts = (showLowStockOnly
    ? products.filter((product) => {
        const available = Number(product.quantity || 0);
        const lowStockLevel = Number(
          product.lowStockLevel || 5
        );

        return available <= lowStockLevel;
      })
    : products).filter((product) =>
    categoryFilter === "all" ||
    String(product.category || "").trim().toLowerCase() === categoryFilter.toLowerCase()
  );

  return (
    <div className="dealer-theme min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() =>
            setMessage(null)
          }
        />

        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5">
              <h2 className="text-xl font-bold text-gray-900">
                Delete product?
              </h2>

              <p className="text-gray-600 mt-2">
                Delete{" "}
                <strong>
                  {deleteTarget.productName}
                </strong>
                ?
              </p>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() =>
                    setDeleteTarget(null)
                  }
                  className="border border-gray-300 rounded-xl py-3 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="bg-red-600 text-white rounded-xl py-3 font-semibold disabled:bg-gray-400"
                >
                  {deleting
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="bg-white rounded-2xl shadow p-5 mb-5">
          <button
            type="button"
            onClick={() =>
              navigate("/dealer")
            }
            className="text-green-700 font-semibold"
          >
            ← Dealer Dashboard
          </button>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-green-800">
                {showLowStockOnly ? "⚠️ Low Stock Items" : "📦 Products & Stock"}
              </h1>
              <p className="text-gray-600 mt-2">
                {showLowStockOnly ? "Showing only products at or below their low-stock level." : "Manage agricultural products and stock."}
              </p>
            </div>
            {!showLowStockOnly && (
              <button type="button" onClick={openAddForm} className="shrink-0 bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-xl font-semibold">
                + Add Product
              </button>
            )}
          </div>
        </header>

        <section className="bg-white rounded-2xl shadow p-4 mb-5">
          <label htmlFor="product-category-filter" className="block text-sm font-semibold text-gray-700 mb-2">Filter by agricultural category</label>
          <select id="product-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full sm:max-w-sm border rounded-xl px-4 py-3 bg-white">
            <option value="all">All categories</option>
            {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </section>

        <div className={formOpen && !showLowStockOnly ? "grid lg:grid-cols-3 gap-5" : "block"}>
          <section
            className={`bg-white rounded-2xl shadow p-5 ${!formOpen || showLowStockOnly ? "hidden" : ""}`}
          >
            <h2 className="text-xl font-bold text-green-800">
              {editingId
                ? "Update Product"
                : "Add Product"}
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
                <option value="">
                  Select category
                </option>

                {availableCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <input
                name="brand"
                value={form.brand}
                onChange={handleChange}
                placeholder="Brand"
                className="w-full border rounded-xl px-4 py-3"
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Product image
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="w-full border border-dashed border-green-400 bg-green-50 rounded-xl p-3"
                />

                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG or WEBP. Maximum 5 MB.
                </p>
              </div>

              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Product preview"
                  className="w-full h-48 object-contain bg-gray-50 border rounded-xl"
                />
              )}

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
                  onClick={closeProductForm}
                  className="w-full border border-gray-300 py-3 rounded-xl font-semibold"
                >
                  Cancel
                </button>
              )}
            </form>
          </section>

          <section
            className={`space-y-4 ${formOpen && !showLowStockOnly ? "lg:col-span-2" : ""}`}
          >
            {visibleProducts.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center">
                <div className="text-4xl">
                  📦
                </div>

                <p className="text-gray-600 mt-3">
                  {showLowStockOnly
                    ? "No products are currently low in stock."
                    : "No products added yet."}
                </p>
              </div>
            ) : (
              visibleProducts.map((product) => {
                const available = Number(
                  product.quantity || 0
                );

                const reserved = Number(
                  product.reservedQuantity || 0
                );

                const sold = Number(
                  product.soldQuantity || 0
                );

                const lowStockLevel =
                  Number(
                    product.lowStockLevel || 0
                  );

                const lowStock =
                  available <= lowStockLevel;

                return (
                  <article
                    key={product.id}
                    className="bg-white rounded-2xl shadow p-5"
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-36">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={
                              product.productName
                            }
                            className="w-full h-36 object-contain bg-gray-50 border rounded-xl"
                          />
                        ) : (
                          <div className="w-full h-36 bg-green-50 rounded-xl flex items-center justify-center text-4xl">
                            📦
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-xl font-bold text-green-800">
                                {
                                  product.productName
                                }
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
                              ₹
                              {Number(
                                product.price || 0
                              ).toFixed(2)}{" "}
                              / {product.unit}
                            </p>

                            {product.description && (
                              <p className="text-sm text-gray-600 mt-2">
                                {
                                  product.description
                                }
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 self-start">
                            <button
                              type="button"
                              onClick={() =>
                                editProduct(product)
                              }
                              className="bg-blue-600 text-white px-4 py-2 rounded-xl"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                requestDelete(
                                  product
                                )
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
