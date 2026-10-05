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

function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "⛅";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return "🌧️";
  }
  if ([95, 96, 99].includes(code)) {
    return "⛈️";
  }
  return "🌤️";
}

export default function FarmerHeader({
  farmer,
  weather,
  weatherLoading,
  weatherMessage = "",
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
  const weatherIcon = weather ? getWeatherIcon(weather.code) : "🌤️";

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

      {/* Weather Card */}
      <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mt-4">
        {weatherLoading ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <p className="text-sm text-green-100">
              {t("loadingLocalWeather", {}, language)}
            </p>
          </div>
        ) : weather ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-100">
                {t("currentWeather", {}, language)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl">{weatherIcon}</span>
                <span className="text-2xl font-bold">
                  {Math.round(weather.temperature)}°
                </span>
              </div>
              <p className="text-xs text-green-100 mt-1">
                {weather.location}
              </p>
            </div>
            <div className="text-right">
              <div className="text-5xl">
                {weatherIcon}
              </div>
              <p className="text-xs text-green-100 mt-1">
                {t("humidity", {}, language)}{" "}
                {weather.humidity ?? "--"}%
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-semibold">
              🌤️ {t("weatherUnavailable", {}, language)}
            </p>
            <p className="text-sm text-green-100 mt-1">
              {weatherMessage || t("allowLocationForWeather", {}, language)}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
