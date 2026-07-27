import QuantitySelector from "./QuantitySelector";

function getCategoryIcon(category) {
  const icons = {
    Seeds: "🌾",
    Fertilizer: "🧪",
    Pesticide: "🛡️",
    Tools: "🛠️",
    "Animal Feed": "🐄",
  };

  return icons[category] || "🌱";
}

export default function MarketplaceProductCard({
  product,
  quantity,
  sending,
  onQuantityChange,
  onRequestOrder,
}) {
  const availableQuantity = Number(
    product.quantity || 0
  );

  const lowStockLevel = Number(
    product.lowStockLevel || 5
  );

  const isLowStock =
    availableQuantity <= lowStockLevel;

  return (
    <article className="bg-white rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-3xl shrink-0">
            {getCategoryIcon(product.category)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-green-900 break-words">
                  {product.productName}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {product.category || "Farm Product"}
                  {product.brand
                    ? ` • ${product.brand}`
                    : ""}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  isLowStock
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {isLowStock ? "Low stock" : "In stock"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-xs text-gray-500">
              Price
            </p>

            <p className="font-bold text-green-900 mt-1">
              ₹{Number(product.price || 0).toFixed(2)}
            </p>

            <p className="text-xs text-gray-500">
              per {product.unit || "unit"}
            </p>
          </div>

          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs text-gray-500">
              Available
            </p>

            <p className="font-bold text-blue-900 mt-1">
              {availableQuantity}
            </p>

            <p className="text-xs text-gray-500">
              {product.unit || "units"}
            </p>
          </div>
        </div>

        {product.description && (
          <p className="text-sm text-gray-600 mt-4 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="border-t border-gray-100 mt-4 pt-4">
          <p className="font-semibold text-gray-800">
            🏪 {product.dealerName}
          </p>

          <p className="text-sm text-gray-500 mt-1">
            📍{" "}
            {product.dealerDistrict ||
              product.dealerState ||
              "Location not available"}
          </p>

          <div className="flex flex-wrap gap-3 mt-3">
            {product.dealerPhone && (
              <a
                href={`tel:${product.dealerPhone}`}
                className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
              >
                📞 Call Dealer
              </a>
            )}

            <span className="inline-flex items-center rounded-xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              ✓ Approved Dealer
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-5">
          <QuantitySelector
            value={quantity}
            minimum={1}
            maximum={availableQuantity}
            disabled={sending}
            onChange={onQuantityChange}
          />

          <button
            type="button"
            disabled={sending || availableQuantity <= 0}
            onClick={onRequestOrder}
            className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {sending
              ? "Sending..."
              : "Request Order"}
          </button>
        </div>
      </div>
    </article>
  );
}