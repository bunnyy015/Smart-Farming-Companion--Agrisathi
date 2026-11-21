import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { database, getAuthUser } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";
import {
  getLocationErrorTranslationKey,
  reverseGeocodeCoordinates,
} from "../../services/currentLocationService";
import {
  fetchWeatherForecast,
  selectNextTwentyFourHours,
} from "../../services/weatherService";
import "./WeatherPage.css";

const WEATHER_CONDITIONS = {
  0: ["conditionClearSky", "☀️"],
  1: ["conditionMostlyClear", "🌤️"],
  2: ["conditionPartlyCloudy", "⛅"],
  3: ["conditionCloudy", "☁️"],
  45: ["conditionFog", "🌫️"],
  48: ["conditionFog", "🌫️"],
  51: ["conditionLightDrizzle", "🌦️"],
  53: ["conditionDrizzle", "🌦️"],
  55: ["conditionHeavyDrizzle", "🌧️"],
  61: ["conditionLightRain", "🌦️"],
  63: ["conditionRain", "🌧️"],
  65: ["conditionHeavyRain", "🌧️"],
  71: ["conditionLightSnow", "🌨️"],
  73: ["conditionSnow", "🌨️"],
  75: ["conditionHeavySnow", "❄️"],
  80: ["conditionRainShowers", "🌦️"],
  81: ["conditionRainShowers", "🌧️"],
  82: ["conditionHeavyShowers", "⛈️"],
  95: ["conditionThunderstorm", "⛈️"],
  96: ["conditionThunderstorm", "⛈️"],
  99: ["conditionSevereThunderstorm", "⛈️"],
};

function getDeviceGpsLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error("Geolocation is unsupported"), { code: "UNSUPPORTED" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function weatherDetails(code, language, isDay) {
  const [labelKey, icon] = WEATHER_CONDITIONS[Number(code)] || ["conditionWeather", "🌤️"];
  const nightIcons = { 0: "🌙", 1: "🌙", 2: "☁️🌙" };
  const weatherIcon = Number(isDay) === 0 ? (nightIcons[Number(code)] || icon) : icon;
  return { label: t(labelKey, {}, language), icon: weatherIcon };
}

function locationFromCoordinates(place, deviceLocation, language) {
  const administrative = place?.localityInfo?.administrative || [];
  const findArea = (words) => administrative.find((area) => {
    const name = `${area.name || ""} ${area.description || ""}`.toLowerCase();
    return words.some((word) => name.includes(word));
  })?.name || "";
  const district = findArea(["district"]);
  const state = place?.principalSubdivision || findArea(["state"]);
  const informativeLocality = (place?.localityInfo?.informative || []).find((area) =>
    /village|town|city|suburb|locality|settlement/i.test(`${area.name || ""} ${area.description || ""}`)
  )?.name;
  const placeName = place?.locality || place?.city || place?.town || place?.village ||
    informativeLocality || district || state || t("coordinatesLocationLabel", {
      latitude: Number(deviceLocation.latitude).toFixed(5),
      longitude: Number(deviceLocation.longitude).toFixed(5),
    }, language);

  return {
    ...deviceLocation,
    village: placeName,
    mandal: findArea(["mandal", "taluk", "tehsil", "subdistrict", "sub-district"]),
    district,
    state,
  };
}

function formatHour(value, language) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(-5)
    : date.toLocaleTimeString(language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN", {
        hour: "numeric",
        minute: "2-digit",
      });
}

function formatMetric(value, suffix = "") {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${Math.round(numericValue)}${suffix}` : `--${suffix}`;
}

function getLocalHour(date, timeZone) {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone,
      }).formatToParts(date);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      if (Number.isFinite(hour)) return hour;
    } catch {
      // Fall back to the device clock if the weather API did not return a valid timezone.
    }
  }
  return date.getHours();
}

function weatherTheme(code, isDay, date, timeZone) {
  let conditionTheme = "weather-cloudy";
  if (Number(isDay) === 0) conditionTheme = "weather-night";
  else if ([95, 96, 99].includes(Number(code))) conditionTheme = "weather-storm";
  else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(Number(code))) conditionTheme = "weather-rain";
  else if ([45, 48].includes(Number(code))) conditionTheme = "weather-fog";
  else if ([2, 3].includes(Number(code))) conditionTheme = "weather-cloudy";
  else if (code != null) conditionTheme = "weather-sunny";

  const hour = getLocalHour(date, timeZone);
  const timeTheme = hour >= 5 && hour < 10
    ? "morning"
    : hour >= 10 && hour < 17
      ? "day"
      : hour >= 17 && hour < 21
        ? "evening"
        : "night";
  return `${conditionTheme} weather-time-${timeTheme}`;
}

function localDay(value, language, timeZone) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString(language, { weekday: "short", day: "numeric", month: "short", timeZone });
}

export default function WeatherPage() {
  const navigate = useNavigate();
  const language = useLanguage();
  const [location, setLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [message, setMessage] = useState(null);
  const [themeClock, setThemeClock] = useState(() => Date.now());

  useEffect(() => {
    const clockInterval = window.setInterval(() => setThemeClock(Date.now()), 60_000);
    return () => window.clearInterval(clockInterval);
  }, []);

  const hourlyForecast = useMemo(
    () => selectNextTwentyFourHours(forecast),
    [forecast]
  );

  const detectAndLoadWeather = useCallback(async (isActive = () => true) => {
    setDetectingLocation(true);
    setLoading(true);
    setMessage(null);
    setLocation(null);
    setForecast(null);

    try {
      const currentUser = await getAuthUser();
      if (!isActive()) return;
      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const profileSnapshot = await get(ref(database, `users/${currentUser.uid}`));
      if (!isActive()) return;
      if (!profileSnapshot.exists() || profileSnapshot.val().role !== "farmer") {
        navigate("/role-selection", { replace: true });
        return;
      }

      const deviceLocation = await getDeviceGpsLocation();
      if (!isActive()) return;

      const weatherData = await fetchWeatherForecast(deviceLocation);
      if (!isActive()) return;
      setForecast(weatherData);
      let place = null;
      try { place = await reverseGeocodeCoordinates(deviceLocation); } catch { /* GPS coordinates remain valid when geocoding is unavailable. */ }
      if (!isActive()) return;
      const resolvedLocation = locationFromCoordinates(place, deviceLocation, language);
      setLocation(resolvedLocation);
      sessionStorage.setItem("agrisathiWeatherCache", JSON.stringify({ forecast: weatherData, location: resolvedLocation, cachedAt: Date.now() }));
    } catch (error) {
      if (!isActive()) return;
      console.error("Weather page location/forecast error:", error);
      const cached = sessionStorage.getItem("agrisathiWeatherCache");
      if (cached) {
        try {
          const saved = JSON.parse(cached);
          setForecast(saved.forecast);
          setLocation(saved.location);
          const reason = error?.code === 1 ? `${t("locationPermissionDenied", {}, language)} ` : "";
          setMessage({ type: "warning", text: `${reason}Showing saved weather from ${new Date(saved.cachedAt).toLocaleTimeString()}. Refresh when online.` });
          return;
        } catch { sessionStorage.removeItem("agrisathiWeatherCache"); }
      }
      const text = t(getLocationErrorTranslationKey(error), {}, language);
      setMessage({ type: "warning", text });
    } finally {
      if (isActive()) {
        setDetectingLocation(false);
        setLoading(false);
      }
    }
  }, [language, navigate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void detectAndLoadWeather();
    }, 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [detectAndLoadWeather]);

  useEffect(() => {
    let active = true;
    const startupTimer = window.setTimeout(() => {
      void detectAndLoadWeather(() => active);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(startupTimer);
    };
  }, [detectAndLoadWeather]);

  const currentWeather = forecast?.current;
  const currentCondition = weatherDetails(currentWeather?.weather_code, language, currentWeather?.is_day);
  const hourly = forecast?.hourly;
  const daily = forecast?.daily;
  const currentHourIndex = hourly?.time?.indexOf(forecast?.current?.time) ?? -1;
  const visibilityMeters = currentHourIndex >= 0 ? hourly.visibility?.[currentHourIndex] : null;
  const dateLocale = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN";
  const insights = [];
  if ((hourly?.precipitation_probability?.slice(0, 24) || []).some((value) => Number(value) >= 60)) insights.push("Rain is likely soon. Consider postponing irrigation and check field drainage.");
  if (Number(currentWeather?.temperature_2m) >= 35) insights.push("High temperatures are forecast. Monitor crops for water stress and irrigate during cooler hours if needed.");
  if (Number(currentWeather?.relative_humidity_2m) >= 80) insights.push("Humidity is high. Check crops regularly for signs of fungal disease.");
  if (Number(currentWeather?.wind_speed_10m) >= 25) insights.push("Winds are strong. Avoid pesticide spraying until conditions improve.");
  if ((daily?.precipitation_sum?.slice(0, 3) || []).every((value) => Number(value) < 1)) insights.push("Little rain is expected over the next few days. Check soil moisture before planning irrigation.");
  if (insights.length === 0) insights.push("No major weather-related field risks are indicated by the current forecast. Continue routine crop and soil checks.");

  return (
    <main className={`weather-page min-h-screen p-4 md:p-6 ${weatherTheme(currentWeather?.weather_code, currentWeather?.is_day, new Date(themeClock), forecast?.timezone)}`}>
      <div className="weather-shell mx-auto w-full max-w-7xl">
        <StatusMessage message={message} onClose={() => setMessage(null)} />

        <header className="weather-header rounded-3xl p-5 text-white shadow-lg md:p-7">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="weather-back-link font-semibold"
          >
            {t("dashboardLink", {}, language)}
          </button>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">{t("farmWeather", {}, language)}</h1>
              <p className="mt-1 text-blue-100">{location ? [location.village, location.district, location.state].filter(Boolean).join(", ") : t("next12Hours", {}, language)}</p>
              <p className="mt-1 text-sm text-white/80">{new Date().toLocaleString(dateLocale, { dateStyle: "full", timeStyle: "short" })}</p>
            </div>
            <button
              type="button"
              onClick={() => detectAndLoadWeather()}
              disabled={detectingLocation}
              className="weather-refresh-button rounded-xl px-4 py-2.5 font-semibold disabled:opacity-60"
            >
              {detectingLocation ? t("detecting", {}, language) : "↻ Refresh weather"}
            </button>
          </div>
          <div className="weather-location-banner mt-4 rounded-xl p-3 text-sm">
            <div>📍 {location
              ? [...new Set([location.village, location.mandal, location.district, location.state].filter(Boolean))].join(", ")
              : t("locationNotDetected", {}, language)}</div>
            {location && location.accuracy != null && (
              <p className="mt-1 text-xs text-blue-100">
                GPS accuracy ±{Math.round(Number(location.accuracy))} m · Updated {forecast?.current?.time ? new Date(forecast.current.time).toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit" }) : "--"}
              </p>
            )}
          </div>
        </header>

        {loading ? (
          <section className="weather-state-card mt-5 rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />
            <p className="mt-4 font-semibold text-green-900">
              {detectingLocation ? t("detectingLocation", {}, language) : t("weatherLoading", {}, language)}
            </p>
            <p className="mt-1 text-sm text-gray-500">{t("locationAccuracyHelp", {}, language)}</p>
          </section>
        ) : currentWeather ? (
          <>
            <section className="weather-current-grid mt-5 grid gap-4 lg:grid-cols-3">
              <article className="current-weather-card rounded-3xl p-6 shadow-lg lg:col-span-2">
                <div className="flex items-center gap-5">
                  <div className="weather-current-icon text-7xl" aria-hidden="true">{currentCondition.icon}</div>
                  <div className="weather-current-copy">
                    <p className="text-sm text-gray-500">{t("currentTemperature", {}, language)}</p>
                    <p className="mt-1 text-5xl font-bold text-blue-900">
                      {formatMetric(currentWeather.temperature_2m, "°C")}
                    </p>
                    <p className="mt-2 font-semibold text-gray-700">{currentCondition.label}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {t("feelsLike", {}, language)} {formatMetric(currentWeather.apparent_temperature, "°C")}
                    </p>
                    <p className="mt-2 text-sm font-medium text-gray-600">Today: {formatMetric(Math.max(...(hourly?.temperature_2m?.slice(0, 24) || [currentWeather.temperature_2m]).map(Number)), "°")} / {formatMetric(Math.min(...(hourly?.temperature_2m?.slice(0, 24) || [currentWeather.temperature_2m]).map(Number)), "°")}</p>
                  </div>
                </div>
              </article>
              <article className="weather-details grid grid-cols-2 gap-3 rounded-3xl p-4 shadow-lg">
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">{t("humidity", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-blue-900">{formatMetric(currentWeather.relative_humidity_2m, "%")}</p>
                </div>
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">{t("rainLabel", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-cyan-900">{formatMetric(currentWeather.rain, " mm")}</p>
                </div>
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">{t("windLabel", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-green-900">{formatMetric(currentWeather.wind_speed_10m, " km/h")}</p>
                </div>
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">{t("windGustLabel", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-amber-900">{formatMetric(currentWeather.wind_gusts_10m, " km/h")}</p>
                </div>
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">UV index</p>
                  <p className="mt-1 text-xl font-bold text-violet-900">{formatMetric(currentWeather.uv_index)}</p>
                </div>
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">Pressure</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatMetric(currentWeather.surface_pressure, " hPa")}</p>
                </div>
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">Cloud cover</p>
                  <p className="mt-1 text-xl font-bold text-sky-900">{formatMetric(currentWeather.cloud_cover, "%")}</p>
                </div>
                {visibilityMeters != null && <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">Visibility</p>
                  <p className="mt-1 text-xl font-bold text-indigo-900">{formatMetric(Number(visibilityMeters) / 1000, " km")}</p>
                </div>}
                <div className="weather-stat-tile rounded-xl p-3">
                  <p className="text-xs text-gray-500">Sunrise / sunset</p>
                  <p className="mt-1 text-sm font-bold text-orange-900">{formatHour(daily?.sunrise?.[0], language)} / {formatHour(daily?.sunset?.[0], language)}</p>
                </div>
              </article>
            </section>

            <section className="weather-panel weather-hourly-panel mt-5 rounded-2xl p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-green-950">Next 24 hours</h2>
                <span className="text-xs text-gray-500">{hourlyForecast.length} {t("hourlyForecastHours", {}, language)}</span>
              </div>
              {hourlyForecast.length ? (
                <div className="hourly-scroll flex gap-3 overflow-x-auto pb-2">
                  {hourlyForecast.map((hour) => {
                    const condition = weatherDetails(hour.weatherCode, language, hour.isDay);
                    return (
                      <article key={hour.time} className="weather-hour-card min-w-28 rounded-xl p-3 text-center">
                        <p className="text-sm font-semibold text-gray-600">{formatHour(hour.time, language)}</p>
                        <div className="my-2 text-3xl" aria-hidden="true">{condition.icon}</div>
                        <p className="text-lg font-bold text-blue-900">{formatMetric(hour.temperature, "°")}</p>
                        <p className="mt-1 text-xs text-cyan-800">🌧️ {formatMetric(hour.precipitationProbability, "%")}</p>
                        <p className="mt-1 text-xs text-gray-500">💨 {formatMetric(hour.windSpeed, " km/h")}</p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-600">{t("weatherUnavailable", {}, language)}</p>
              )}
            </section>

            <section className="weather-panel weather-weekly-panel mt-5 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xl font-bold text-green-950">7-day forecast</h2>
              <div className="mt-3 divide-y divide-green-100">
                {(daily?.time || []).map((day, index) => {
                  const condition = weatherDetails(daily.weather_code?.[index], language, 1);
                  return <article key={day} className="weather-day-row grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_2fr_auto_auto]">
                    <span className="font-semibold text-gray-800">{index === 0 ? "Today" : localDay(day, dateLocale, forecast.timezone)}</span>
                    <span className="hidden text-sm text-gray-600 sm:block">{condition.icon} {condition.label} · Rain {formatMetric(daily.precipitation_probability_max?.[index], "%")}</span>
                    <span className="text-sm text-blue-700">{condition.icon} {formatMetric(daily.temperature_2m_min?.[index], "°")}</span>
                    <span className="font-bold text-blue-950">{formatMetric(daily.temperature_2m_max?.[index], "°")}</span>
                    <span className="col-span-3 text-xs text-gray-600 sm:hidden">{condition.label} · Rain {formatMetric(daily.precipitation_probability_max?.[index], "%")}</span>
                  </article>;
                })}
              </div>
            </section>

            <section className="weather-panel weather-insights-panel mt-5 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xl font-bold text-emerald-950">Farming Weather Insights</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {insights.map((insight) => <li key={insight} className="weather-insight-card rounded-xl p-3 text-sm">🌱 {insight}</li>)}
              </ul>
              <p className="mt-3 text-xs text-gray-500">Suggestions are based on this forecast and are not guaranteed outcomes.</p>
            </section>
          </>
        ) : (
          <section className="weather-state-card mt-5 rounded-2xl p-8 text-center shadow-sm">
            <div className="text-5xl" aria-hidden="true">📍</div>
            <h2 className="mt-3 text-xl font-bold text-green-950">{t("weatherUnavailable", {}, language)}</h2>
            <p className="mt-2 text-gray-600">{message?.text || t("enableLocationWeather", {}, language)}</p>
            <button
              type="button"
              onClick={() => detectAndLoadWeather()}
              disabled={detectingLocation}
              className="weather-refresh-button mt-5 rounded-xl px-5 py-3 font-semibold disabled:opacity-60"
            >
              {t("detectMyLocation", {}, language)}
            </button>
          </section>
        )}

        <p className="mt-5 text-center text-xs text-gray-500">Weather data: Open-Meteo. Location: device GPS.</p>
      </div>
    </main>
  );
}
