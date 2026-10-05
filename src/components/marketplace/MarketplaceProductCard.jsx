import QuantitySelector from "./QuantitySelector";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";

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

function translateCategory(category, language) {
  const categoryKeys = {
    Seeds: "categorySeeds",
    Fertilizer: "categoryFertilizer",
    Pesticide: "categoryPesticide",
    Tools: "categoryTools",
    "Animal Feed": "categoryFeed",
  };

  return categoryKeys[category]
    ? t(categoryKeys[category], {}, language)
    : category || t("farmProduct", {}, language);
}

export default function MarketplaceProductCard({
  product,
  quantity,
  sending,
  onQuantityChange,
  onRequestOrder,
  onViewDetails,
}) {
  const language = useLanguage();
  const availableQuantity = Number(product.quantity || 0);
  const lowStockLevel = Number(product.lowStockLevel || 5);
  const isLowStock = availableQuantity <= lowStockLevel;

  return (
    <article className="grid grid-cols-[84px_minmax(0,1fr)] gap-4 rounded-xl border border-green-100 bg-white p-4 shadow-sm transition hover:border-green-300 hover:shadow-md sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5">
      <div className="relative h-28 overflow-hidden rounded-lg border border-green-100 bg-green-50 sm:h-32">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.productName || t("farmProduct", {}, language)}
            className="absolute inset-0 h-full w-full bg-white object-contain"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              const fallback = event.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}

        <div
          className={`${product.imageUrl ? "hidden" : "flex"} absolute inset-0 items-center justify-center bg-green-50`}
        >
          <span className="text-3xl sm:text-5xl" aria-hidden="true">
            {getCategoryIcon(product.category)}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold text-green-950 sm:text-xl">
              {product.productName || t("farmProduct", {}, language)}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {translateCategory(product.category, language)}
              {product.brand ? ` · ${product.brand}` : ""}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isLowStock
                ? "bg-amber-100 text-amber-900"
                : "bg-green-100 text-green-800"
            }`}
          >
            {isLowStock
              ? t("lowStock", {}, language)
              : t("inStock", {}, language)}
          </span>
        </div>

        {product.description && (
          <p className="mt-2 whitespace-pre-line text-sm leading-5 text-gray-600">
            {product.description}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-green-50 p-2.5">
            <p className="text-xs text-gray-500">
              {t("priceLabel", {}, language)}
            </p>
            <p className="mt-1 font-bold text-green-950">
              ₹{Number(product.price || 0).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              {t("perUnit", { unit: product.unit || "unit" }, language)}
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-2.5">
            <p className="text-xs text-gray-500">
              {t("availableLabel", {}, language)}
            </p>
            <p className="mt-1 font-bold text-blue-950">
              {availableQuantity} {product.unit || t("unitsLabel", {}, language)}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-2.5 sm:col-span-2">
            <p className="text-xs text-gray-500">
              {t("dealerLabel", {}, language)}
            </p>
            <p className="mt-1 truncate font-semibold text-gray-800">
              {product.dealerName || t("approvedDealer", {}, language)}
            </p>
            <p className="truncate text-xs text-gray-500">
              {product.dealerDistrict ||
                product.dealerState ||
                t("locationNotAvailable", {}, language)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
            {t("approvedDealer", {}, language)}
          </span>
          {product.dealerPhone && (
            <a
              href={`tel:${product.dealerPhone}`}
              className="inline-flex min-h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              {t("callDealer", {}, language)}
            </a>
          )}
        </div>
      </div>

      <div className="col-span-2 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="min-h-11 w-full rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50 sm:w-auto"
          >
            {t("viewProductDetails", {}, language)}
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
            className="min-h-11 flex-1 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400 sm:flex-initial"
          >
            {sending
              ? t("sendingOrder", {}, language)
              : t("requestOrder", {}, language)}
          </button>
        </div>
      </div>
    </article>
  );
}