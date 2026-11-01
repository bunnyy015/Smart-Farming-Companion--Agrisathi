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
  marketRecords = [],
  loading,
  onOpenMarket,
  showAction = true,
}) {
  const records = marketRecords.length ? marketRecords : marketRecord ? [marketRecord] : [];
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

  if (!records.length) {
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

            {showAction && onOpenMarket && (
              <button
                type="button"
                onClick={onOpenMarket}
                className="text-sm font-bold text-green-700 mt-3"
              >
                {t("viewMarketPrices", {}, language)} →
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-4 mt-5">
      <p className="text-xs text-gray-500">{t("localMarketPrice", {}, language)}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {records.map((record, index) => (
          <article key={`${record.crop || record.commodity}-${record.market}-${index}`} className="rounded-xl border border-green-100 bg-green-50/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-bold text-green-900">🌾 {record.commodity || record.crop || cropName}</h2>
                {!record.unavailable && <>
                  <p className="mt-1 truncate text-xs text-gray-600">🏪 {record.market || t("localMandi", {}, language)}</p>
                  <p className="mt-1 text-xs text-gray-500">📍 {record.district || t("nearbyMarket", {}, language)}</p>
                </>}
              </div>
              <div className="shrink-0 text-right">
                {record.unavailable ? <p className="max-w-36 text-xs text-gray-500">{t("noCurrentMarketRecord", {}, language)}</p> : <>
                  <p className="text-sm font-bold text-green-800">{formatPrice(record.modalPrice, language)} / {t("perQuintal", {}, language)}</p>
                </>}
              </div>
            </div>
            {(record.minimumPrice > 0 || record.maximumPrice > 0) && (
              <p className="mt-2 text-xs text-gray-600">{t("minimum", {}, language)} {formatPrice(record.minimumPrice, language)} · {t("maximum", {}, language)} {formatPrice(record.maximumPrice, language)}</p>
            )}
            {record.arrival_date && <p className="mt-1 text-xs text-gray-500">{record.arrival_date}</p>}
          </article>
        ))}
      </div>

      {showAction && onOpenMarket && (
        <button
          type="button"
          onClick={onOpenMarket}
          className="w-full bg-green-50 text-green-800 py-3 rounded-xl font-semibold mt-4"
        >
          {t("compareAllMarkets", {}, language)}
        </button>
      )}
    </section>
  );
}
