import { useEffect, useState } from "react";
import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from "../utils/language";

function getGreeting(language) {
  const hour = new Date().getHours();
  if (hour < 12) {
    return t("goodMorning", {}, language);
  }
  if (hour < 17) {
    return t("goodAfternoon", {}, language);
  }
  return t("goodEvening", {}, language);
}

export default function FarmerHeader({
  farmer,
  unreadNotifications,
  onNotifications,
  showNotifications = true,
}) {
  const [language, setCurrentLanguage] = useState(getLanguage());

  useEffect(() => {
    return subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });
  }, []);

  const farmerName =
    farmer?.name ||
    farmer?.fullName ||
    farmer?.farmerName ||
    t("farmer", {}, language);

  const location = [
    farmer?.village,
    farmer?.district,
  ]
    .filter(Boolean)
    .join(", ");

  const greeting = getGreeting(language);
  return (
    <header className="bg-gradient-to-br from-green-800 via-green-700 to-green-600 text-white rounded-b-3xl px-4 pt-5 pb-6 shadow-lg">
      {/* Top Row: Greeting + Notifications */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-green-100 font-medium">
            {greeting}
          </p>
          <h1 className="text-2xl font-bold mt-1 truncate max-w-[180px]">
            {farmerName}
          </h1>
          {location && (
            <p className="text-xs text-green-100 mt-0.5 flex items-center gap-1">
              <span>📍</span> {t("profileLocationLabel", {}, language)}: {location}
            </p>
          )}
        </div>

        {showNotifications && (
          <button
            type="button"
            onClick={onNotifications}
            className="relative w-12 h-12 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition"
            aria-label={t("openNotifications", {}, language)}
          >
            <span className="text-2xl">🔔</span>
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
