import { useEffect, useState } from "react";

import {
  getLanguage,
  getSpeechLocale,
  subscribeLanguageChange,
  t,
} from "../utils/language";

function formatPrice(value, language) {
  return Number(value || 0).toLocaleString(
    getSpeechLocale(language),
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  );
}

export default function MarketAlertCard({
  cropName,
  marketRecord,
  loading,
  onOpenMarket,
}) {
  const [language, setCurrentLanguage] = useState(
    getLanguage()
  );

  useEffect(() => {
    return subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });
  }, []);

  if (loading) {
    return (
      <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-4 mt-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-green-200 border-t-green-700 animate-spin" />

          <p className="text-sm text-gray-600">
            {t(
              "loadingMarketPrice",
              {},
              language
            )}
          </p>
        </div>
      </section>
    );
  }

  if (!marketRecord) {
    return (
      <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-4 mt-5">
        <div className="flex items-start gap-3">
          <div className="text-3xl">📈</div>

          <div className="flex-1">
            <p className="text-xs text-gray-500">
              {t("marketPrice", {}, language)}
            </p>

            <h2 className="font-bold text-green-900 mt-1">
              {cropName ||
                t("cropPrices", {}, language)}
            </h2>

            <p className="text-sm text-gray-600 mt-1">
              {t(
                "noCurrentMarketRecord",
                {},
                language
              )}
            </p>

            <button
              type="button"
              onClick={onOpenMarket}
              className="text-sm font-bold text-green-700 mt-3"
            >
              {t(
                "viewMarketPrices",
                {},
                language
              )}{" "}
              →
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-4 mt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            {t(
              "localMarketPrice",
              {},
              language
            )}
          </p>

          <h2 className="text-lg font-bold text-green-900 mt-1">
            🌾 {marketRecord.commodity || cropName}
          </h2>

          <p className="text-sm text-gray-600 mt-1 truncate">
            🏪{" "}
            {marketRecord.market ||
              t("localMandi", {}, language)}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            📍{" "}
            {marketRecord.district ||
              t("nearbyMarket", {}, language)}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Government mandi data · arrival date: {marketRecord.updatedAt || "not available"}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-green-800">
            {formatPrice(
              marketRecord.modalPrice,
              language
            )}
          </p>

          <p className="text-xs text-gray-500">
            {t("perQuintal", {}, language)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-red-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">
            {t("minimum", {}, language)}
          </p>

          <p className="font-bold text-red-700 mt-1">
            {formatPrice(
              marketRecord.minimumPrice,
              language
            )}
          </p>
        </div>

        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">
            {t("maximum", {}, language)}
          </p>

          <p className="font-bold text-blue-700 mt-1">
            {formatPrice(
              marketRecord.maximumPrice,
              language
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenMarket}
        className="w-full bg-green-50 text-green-800 py-3 rounded-xl font-semibold mt-4"
      >
        {t(
          "compareAllMarkets",
          {},
          language
        )}
      </button>
    </section>
  );
}
