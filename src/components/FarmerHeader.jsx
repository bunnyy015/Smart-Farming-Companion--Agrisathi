function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good Morning";
  }

  if (hour < 17) {
    return "Good Afternoon";
  }

  return "Good Evening";
}

function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return "🌧️";
  }

  if ([95, 96, 99].includes(code)) {
    return "⛈️";
  }

  return "🌦️";
}

export default function FarmerHeader({
  farmer,
  weather,
  weatherLoading,
  unreadNotifications,
  onNotifications,
}) {
  const farmerName =
    farmer?.name ||
    farmer?.fullName ||
    farmer?.farmerName ||
    "Farmer";

  const location = [
    farmer?.village,
    farmer?.district,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <header className="bg-gradient-to-br from-green-800 via-green-700 to-green-600 text-white rounded-b-3xl px-4 pt-5 pb-6 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-green-100">
            {getGreeting()}
          </p>

          <h1 className="text-2xl font-bold truncate mt-1">
            👋 {farmerName}
          </h1>

          <p className="text-sm text-green-100 mt-2 truncate">
            📍 {location || "Farm location not added"}
          </p>
        </div>

        <button
          type="button"
          onClick={onNotifications}
          className="relative w-12 h-12 shrink-0 rounded-full bg-white/15 flex items-center justify-center text-xl"
          aria-label="Open notifications"
        >
          🔔

          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadNotifications > 99
                ? "99+"
                : unreadNotifications}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white/15 border border-white/10 rounded-2xl p-4 mt-5">
        {weatherLoading ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />

            <p className="text-sm text-green-100">
              Loading local weather...
            </p>
          </div>
        ) : weather ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-green-100">
                Current weather
              </p>

              <p className="text-3xl font-bold mt-1">
                {Math.round(
                  Number(weather.temperature || 0)
                )}
                °C
              </p>

              <p className="text-xs text-green-100 mt-1">
                {weather.location}
              </p>
            </div>

            <div className="text-right">
              <div className="text-5xl">
                {getWeatherIcon(weather.code)}
              </div>

              <p className="text-xs text-green-100 mt-1">
                Humidity {weather.humidity ?? "--"}%
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-semibold">
              🌦️ Weather unavailable
            </p>

            <p className="text-sm text-green-100 mt-1">
              Allow location access for local farm weather.
            </p>
          </div>
        )}
      </div>
    </header>
  );
}