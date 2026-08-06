import { useEffect, useMemo, useState } from "react";

import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from "../utils/language";

export default function QuickActions({ onNavigate }) {
  const [language, setCurrentLanguage] = useState(
    getLanguage()
  );

  useEffect(() => {
    return subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });
  }, []);

  const actions = useMemo(
    () => [
      {
        title: t("scanCrop", {}, language),
        subtitle: t("checkDisease", {}, language),
        icon: "🌿",
        path: "/crop-disease",
      },
      {
        title: t("dealerProducts", {}, language),
        subtitle: t("buyProducts", {}, language),
        icon: "🏪",
        path: "/farmer/dealer-products",
      },
      {
        title: t("prices", {}, language),
        subtitle: t("checkMandi", {}, language),
        icon: "📈",
        path: "/market-prices",
      },
      {
        title: t("orders", {}, language),
        subtitle: t(
          "trackPurchase",
          {},
          language
        ),
        icon: "🛒",
        path: "/farmer/orders",
      },
    ],
    [language]
  );

  return (
    <section className="mt-5">
      <h2 className="text-lg font-bold text-green-900">
        {t("whatDoYouNeed", {}, language)}
      </h2>

      <div className="grid grid-cols-2 gap-3 mt-3">
        {actions.map((action) => (
          <button
            type="button"
            key={action.path}
            onClick={() =>
              onNavigate(action.path)
            }
            className="min-h-28 bg-white border border-green-100 rounded-2xl shadow-sm p-4 text-left active:scale-95 transition"
          >
            <div className="text-3xl">
              {action.icon}
            </div>

            <h3 className="font-bold text-gray-900 mt-2">
              {action.title}
            </h3>

            <p className="text-xs text-gray-500 mt-1">
              {action.subtitle}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
