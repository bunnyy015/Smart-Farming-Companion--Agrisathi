import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { database, getAuthUser } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";
import {
  getCurrentLocation,
  getLocationErrorTranslationKey,
  reverseGeocodeCoordinates,
} from "../../services/currentLocationService";
import {
  fetchWeatherForecast,
  selectNextTwelveHours,
} from "../../services/weatherService";

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

  return {
    ...deviceLocation,
    village: place?.locality || place?.city || t("coordinatesLocationLabel", {
      latitude: Number(deviceLocation.latitude).toFixed(5),
      longitude: Number(deviceLocation.longitude).toFixed(5),
    }, language),
    mandal: findArea(["mandal", "taluk", "tehsil", "subdistrict", "sub-district"]),
    district: findArea(["district"]),
    state: place?.principalSubdivision || findArea(["state"]),
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

export default function WeatherPage() {
  const navigate = useNavigate();
  const language = useLanguage();
  const [location, setLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [message, setMessage] = useState(null);

  const hourlyForecast = useMemo(
    () => selectNextTwelveHours(forecast),
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

      const deviceLocation = await getCurrentLocation({
        onProgress: (fix) => {
          if (isActive()) {
            setLocation(locationFromCoordinates(null, fix, language));
          }
        },
      });
      if (!isActive()) return;

      setLocation(locationFromCoordinates(null, deviceLocation, language));

      const [weatherResult, placeResult] = await Promise.allSettled([
        fetchWeatherForecast(deviceLocation),
        reverseGeocodeCoordinates(deviceLocation),
      ]);
      if (!isActive()) return;
      if (weatherResult.status === "rejected") throw weatherResult.reason;

      const weatherData = weatherResult.value;
      setForecast(weatherData);

      if (placeResult.status === "fulfilled") {
        setLocation(locationFromCoordinates(placeResult.value, deviceLocation, language));
      } else {
        setMessage({
          type: "warning",
          text: t("locationCoordinatesOnly", {}, language),
        });
      }
    } catch (error) {
      if (!isActive()) return;
      console.error("Weather page location/forecast error:", error);
      const text = error?.code === "LOW_ACCURACY"
        ? error.message
        : t(getLocationErrorTranslationKey(error), {}, language);
      setMessage({ type: "warning", text });
    } finally {
      if (isActive()) {
        setDetectingLocation(false);
        setLoading(false);
      }
    }
  }, [language, navigate]);

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

  return (
    <main className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl">
        <StatusMessage message={message} onClose={() => setMessage(null)} />

        <header className="rounded-2xl bg-gradient-to-r from-blue-800 to-green-700 p-5 text-white shadow">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="font-semibold text-blue-100 hover:text-white"
          >
            {t("dashboardLink", {}, language)}
          </button>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">{t("farmWeather", {}, language)}</h1>
              <p className="mt-1 text-blue-100">{t("next12Hours", {}, language)}</p>
            </div>
            <button
              type="button"
              onClick={() => detectAndLoadWeather()}
              disabled={detectingLocation}
              className="rounded-xl bg-white px-4 py-2.5 font-semibold text-blue-800 disabled:opacity-60"
            >
              {detectingLocation ? t("detecting", {}, language) : t("refreshLocation", {}, language)}
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-white/15 p-3 text-sm">
            <div>📍 {location
              ? [location.village, location.mandal, location.district, location.state].filter(Boolean).join(", ")
              : t("locationNotDetected", {}, language)}</div>
            {location && (
              <p className="mt-1 text-xs text-blue-100">
                {t("coordinatesLocationLabel", {
                  latitude: Number(location.latitude).toFixed(5),
                  longitude: Number(location.longitude).toFixed(5),
                }, language)}
                {" · ±"}{Math.round(Number(location.accuracy))}{" m"}
              </p>
            )}
          </div>
        </header>

        {loading ? (
          <section className="mt-5 rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />
            <p className="mt-4 font-semibold text-green-900">
              {detectingLocation ? t("detectingLocation", {}, language) : t("weatherLoading", {}, language)}
            </p>
            <p className="mt-1 text-sm text-gray-500">{t("locationAccuracyHelp", {}, language)}</p>
          </section>
        ) : currentWeather ? (
          <>
            <section className="mt-5 grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm lg:col-span-2">
                <div className="flex items-center gap-5">
                  <div className="text-7xl" aria-hidden="true">{currentCondition.icon}</div>
                  <div>
                    <p className="text-sm text-gray-500">{t("currentTemperature", {}, language)}</p>
                    <p className="mt-1 text-5xl font-bold text-blue-900">
                      {formatMetric(currentWeather.temperature_2m, "°C")}
                    </p>
                    <p className="mt-2 font-semibold text-gray-700">{currentCondition.label}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {t("feelsLike", {}, language)} {formatMetric(currentWeather.apparent_temperature, "°C")}
                    </p>
                  </div>
                </div>
              </article>
              <article className="grid grid-cols-2 gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-xs text-gray-500">{t("humidity", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-blue-900">{formatMetric(currentWeather.relative_humidity_2m, "%")}</p>
                </div>
                <div className="rounded-xl bg-cyan-50 p-3">
                  <p className="text-xs text-gray-500">{t("rainLabel", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-cyan-900">{formatMetric(currentWeather.rain, " mm")}</p>
                </div>
                <div className="rounded-xl bg-green-50 p-3">
                  <p className="text-xs text-gray-500">{t("windLabel", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-green-900">{formatMetric(currentWeather.wind_speed_10m, " km/h")}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs text-gray-500">{t("windGustLabel", {}, language)}</p>
                  <p className="mt-1 text-xl font-bold text-amber-900">{formatMetric(currentWeather.wind_gusts_10m, " km/h")}</p>
                </div>
              </article>
            </section>

            <section className="mt-5 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-green-950">{t("next12Hours", {}, language)}</h2>
                <span className="text-xs text-gray-500">{hourlyForecast.length} {t("hourlyForecastHours", {}, language)}</span>
              </div>
              {hourlyForecast.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                  {hourlyForecast.map((hour) => {
                    const condition = weatherDetails(hour.weatherCode, language, hour.isDay);
                    return (
                      <article key={hour.time} className="rounded-xl border border-green-100 bg-green-50/70 p-3 text-center">
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
          </>
        ) : (
          <section className="mt-5 rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
            <div className="text-5xl" aria-hidden="true">📍</div>
            <h2 className="mt-3 text-xl font-bold text-green-950">{t("weatherUnavailable", {}, language)}</h2>
            <p className="mt-2 text-gray-600">{message?.text || t("enableLocationWeather", {}, language)}</p>
            <button
              type="button"
              onClick={() => detectAndLoadWeather()}
              disabled={detectingLocation}
              className="mt-5 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
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
