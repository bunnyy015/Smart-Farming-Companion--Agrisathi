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
  onViewDetails,
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
      
      {/* =========================
          PRODUCT IMAGE
      ========================== */}
      <div className="relative bg-green-50 border-b border-green-100">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={
              product.productName ||
              "Agricultural product"
            }
            className="w-full h-52 object-contain bg-white"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";

              const fallback =
                event.currentTarget
                  .nextElementSibling;

              if (fallback) {
                fallback.style.display = "flex";
              }
            }}
          />
        ) : null}

        {/* Image fallback */}
        <div
          className={`${
            product.imageUrl
              ? "hidden"
              : "flex"
          } w-full h-52 items-center justify-center bg-green-50`}
        >
          <div className="text-center">
            <div className="text-6xl">
              {getCategoryIcon(
                product.category
              )}
            </div>

            <p className="text-sm text-gray-500 mt-2">
              No product image
            </p>
          </div>
        </div>

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span className="bg-white/95 backdrop-blur-sm text-green-800 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
            {product.category ||
              "Farm Product"}
          </span>
        </div>

        {/* Stock badge */}
        <div className="absolute top-3 right-3">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
              isLowStock
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-700"
            }`}
          >
            {isLowStock
              ? "Low stock"
              : "In stock"}
          </span>
        </div>
      </div>

      {/* =========================
          PRODUCT INFORMATION
      ========================== */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-green-900 break-words">
                  {product.productName}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {product.category ||
                    "Farm Product"}

                  {product.brand
                    ? ` • ${product.brand}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =========================
            PRICE & STOCK
        ========================== */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-xs text-gray-500">
              Price
            </p>

            <p className="font-bold text-green-900 mt-1">
              ₹
              {Number(
                product.price || 0
              ).toFixed(2)}
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

        {/* =========================
            DESCRIPTION
        ========================== */}
        {product.description && (
          <p className="text-sm text-gray-600 mt-4 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* =========================
            DEALER INFORMATION
        ========================== */}
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
                className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                📞 Call Dealer
              </a>
            )}

            <span className="inline-flex items-center rounded-xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              ✓ Approved Dealer
            </span>
          </div>
        </div>

        {/* =========================
            ACTIONS
        ========================== */}
        <div className="flex flex-col gap-3 mt-5">
          
          {/* View Details */}
          {onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              className="w-full border border-green-700 text-green-700 py-3 rounded-xl font-semibold hover:bg-green-50 transition"
            >
              👁️ View Product Details
            </button>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <QuantitySelector
              value={quantity}
              minimum={1}
              maximum={availableQuantity}
              disabled={sending}
              onChange={onQuantityChange}
            />

            <button
              type="button"
              disabled={
                sending ||
                availableQuantity <= 0
              }
              onClick={onRequestOrder}
              className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {sending
                ? "Sending..."
                : "Request Order"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}