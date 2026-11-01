import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
} from "firebase/database";
import { signOut } from "firebase/auth";
import { ArrowRight, Bell, CloudRain, Droplet, LayoutGrid, LogOut, MapPin, RefreshCw, Sprout, Thermometer, Wind } from "lucide-react";
import { auth, database, getAuthUser } from "../../firebase";
import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from "../../utils/language";
import LanguageSelector from "../../components/LanguageSelector";
import VoiceAssistantCard from "../../components/VoiceAssistantCard";
import PushNotificationTest from "../../components/PushNotificationTest";
import { sortOrdersNewestFirst } from "../../utils/orderSorting";
import { getCurrentLocation } from "../../services/currentLocationService";
import { fetchWeatherForecast, selectNextTwelveHours } from "../../services/weatherService";
import "./dashboard.css";

function formatForecastTime(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").slice(-5);
  return date.toLocaleTimeString(language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN", {
    hour: "numeric",
  });
}

function formatMetric(value, suffix = "") {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}${suffix}` : `--${suffix}`;
}

function greetingFor(language) {
  const hour = new Date().getHours();
  return t(hour < 12 ? "goodMorning" : hour < 17 ? "goodAfternoon" : "goodEvening", {}, language);
}

function forecastIcon(code, isDay) {
  const numericCode = Number(code);
  if (Number(isDay) === 0 && numericCode <= 2) {
    return numericCode === 2 ? "☁️🌙" : "🌙";
  }
  return ({ 0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌧️", 61: "🌦️", 63: "🌧️", 65: "🌧️", 71: "🌨️", 73: "🌨️", 75: "❄️", 80: "🌦️", 81: "🌧️", 82: "⛈️", 95: "⛈️", 96: "⛈️", 99: "⛈️" })[numericCode] || "🌤️";
}

const WEATHER_CONDITIONS = {
  0: ["conditionClearSky", "☀️"], 1: ["conditionMostlyClear", "🌤️"],
  2: ["conditionPartlyCloudy", "⛅"], 3: ["conditionCloudy", "☁️"],
  45: ["conditionFog", "🌫️"], 48: ["conditionFog", "🌫️"],
  51: ["conditionLightDrizzle", "🌦️"], 53: ["conditionDrizzle", "🌦️"], 55: ["conditionHeavyDrizzle", "🌧️"],
  61: ["conditionLightRain", "🌦️"], 63: ["conditionRain", "🌧️"], 65: ["conditionHeavyRain", "🌧️"],
  71: ["conditionLightSnow", "🌨️"], 73: ["conditionSnow", "🌨️"], 75: ["conditionHeavySnow", "❄️"],
  80: ["conditionRainShowers", "🌦️"], 81: ["conditionRainShowers", "🌧️"], 82: ["conditionHeavyShowers", "⛈️"],
  95: ["conditionThunderstorm", "⛈️"], 96: ["conditionThunderstorm", "⛈️"], 99: ["conditionSevereThunderstorm", "⛈️"],
};

function currentWeatherDetails(code, isDay, language) {
  const [label, icon] = WEATHER_CONDITIONS[Number(code)] || ["conditionWeather", "🌤️"];
  const nightIcons = { 0: "🌙", 1: "🌙", 2: "☁️🌙" };
  return { label: t(label, {}, language), icon: Number(isDay) === 0 ? nightIcons[Number(code)] || icon : icon };
}

// Order statuses that trigger notifications
const SUPPORTED_ORDER_STATUSES = [
  "accepted",
  "rejected",
  "delivered_by_dealer",
  "received_by_farmer",
  "payment_received",
  "completed",
];

const FARMER_FEATURES = [
  { key: "profile", titleKey: "farmerProfile", descriptionKey: "featureProfileDescription", icon: "👤", path: "/profile" },
  { key: "marketplace", titleKey: "dealerProducts", descriptionKey: "featureMarketplaceDescription", icon: "🏪", path: "/farmer/dealer-products" },
  { key: "orders", titleKey: "orders", descriptionKey: "featureOrdersDescription", icon: "📦", path: "/farmer/orders" },
  { key: "cropHealth", titleKey: "cropDisease", descriptionKey: "featureCropHealthDescription", icon: "🌿", path: "/crop-disease" },
  { key: "weather", titleKey: "weather", descriptionKey: "featureWeatherDescription", icon: "🌦️", path: "/weather" },
  { key: "marketPrices", titleKey: "marketPrices", descriptionKey: "featureMarketPricesDescription", icon: "📈", path: "/market-prices" },
  { key: "schemes", titleKey: "govtSchemes", descriptionKey: "featureSchemesDescription", icon: "📋", path: "/govt-schemes" },
  { key: "community", titleKey: "community", descriptionKey: "featureCommunityDescription", icon: "👥", path: "/community" },
  { key: "nearbyServices", titleKey: "nearbyServices", descriptionKey: "featureNearbyServicesDescription", icon: "📍", external: true },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState(null);
  const [notificationIds, setNotificationIds] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [dashboardWeather, setDashboardWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  const [weatherRetry, setWeatherRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [language, setCurrentLanguage] = useState(getLanguage());

  async function loadOrderInformation(farmerUid) {
    try {
      try {
        const savedReadIds = localStorage.getItem(`farmerNotificationReads_${farmerUid}`);
        const parsedReadIds = savedReadIds ? JSON.parse(savedReadIds) : [];
        setReadNotificationIds(Array.isArray(parsedReadIds) ? parsedReadIds : []);
      } catch (error) {
        console.error("Farmer notification read state error:", error);
        setReadNotificationIds([]);
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(farmerUid)
      );
      const snapshot = await get(ordersQuery);
      if (!snapshot.exists()) {
        setNotificationIds([]);
        return;
      }

      const orders = sortOrdersNewestFirst(Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value })));
      let deletedNotificationIds = [];
      try {
        const savedDeletedIds = localStorage.getItem(`farmerNotificationDeletes_${farmerUid}`);
        const parsedDeletedIds = savedDeletedIds ? JSON.parse(savedDeletedIds) : [];
        deletedNotificationIds = Array.isArray(parsedDeletedIds) ? parsedDeletedIds : [];
      } catch (error) {
        console.error("Farmer notification deletion state error:", error);
      }

      setNotificationIds(
        orders
          .map((order) => ({
            ...order,
            normalizedStatus: String(order.status || order.orderStatus || "")
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "_"),
          }))
          .filter((order) => SUPPORTED_ORDER_STATUSES.includes(order.normalizedStatus))
          .map((order) => `order-${order.id}-${order.normalizedStatus}`)
          .filter((notificationId) => !deletedNotificationIds.includes(notificationId))
      );
    } catch (error) {
      console.error("Order summary error:", error);
      setNotificationIds([]);
    }
  }

  async function initializeDashboard() {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await getAuthUser();
      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const [userSnapshot, farmerSnapshot] = await Promise.all([
        get(ref(database, `users/${currentUser.uid}`)),
        get(ref(database, `farmers/${currentUser.uid}`)),
      ]);

      if (!userSnapshot.exists()) {
        setError(t("dashboardProfileMissing", {}, getLanguage()));
        setLoading(false);
        return;
      }

      const userData = userSnapshot.val();
      if (userData.role !== "farmer") {
        navigate("/role-selection", { replace: true });
        return;
      }

      const farmerProfile = {
        uid: currentUser.uid,
        ...userData,
        ...(farmerSnapshot.exists() ? farmerSnapshot.val() : {}),
        role: userData.role,
      };

      setFarmer(farmerProfile);
      void loadOrderInformation(currentUser.uid).catch((summaryError) => {
        console.error("Dashboard summary loading error:", summaryError);
      });
    } catch (dashboardError) {
      console.error("Dashboard error:", dashboardError);
      setError(t("dashboardLoadError", {}, getLanguage()));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const startupTimer = window.setTimeout(() => {
      void initializeDashboard();
    }, 0);
    const unsubscribeLanguage = subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });
    return () => {
      window.clearTimeout(startupTimer);
      unsubscribeLanguage();
    };
    // This effect initializes once; initializeDashboard reads current language on errors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!farmer?.uid) return undefined;
    let active = true;
    const controller = new AbortController();
    (async () => {
      try {
        const location = await getCurrentLocation();
        const weather = await fetchWeatherForecast({ ...location, signal: controller.signal });
        if (!weather?.current) throw new Error("Weather provider returned no current conditions.");
        if (active) {
          setDashboardWeather({
            hours: selectNextTwelveHours(weather).slice(0, 5),
            current: weather.current,
            location,
            village: [farmer.village, farmer.district].filter(Boolean).join(", "),
          });
        }
      } catch (weatherError) {
        if (weatherError?.name !== "AbortError") {
          console.warn("Dashboard weather unavailable:", weatherError);
          if (active) {
            setDashboardWeather(null);
            setWeatherError(true);
          }
        }
      } finally {
        if (active) setWeatherLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [farmer?.uid, farmer?.village, farmer?.district, weatherRetry]);

  const unreadNotifications = useMemo(
    () =>
      notificationIds.filter(
        (notificationId) => !readNotificationIds.includes(notificationId)
      ).length,
    [notificationIds, readNotificationIds]
  );

  useEffect(() => {
    function refreshReadNotificationIds() {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setReadNotificationIds([]);
        return;
      }

      try {
        const saved = localStorage.getItem(
          `farmerNotificationReads_${currentUser.uid}`
        );
        const parsed = saved ? JSON.parse(saved) : [];
        setReadNotificationIds(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error("Farmer notification read state error:", error);
        setReadNotificationIds([]);
      }
    }

    function handleStorageChange(event) {
      const currentUser = auth.currentUser;
      if (
        currentUser &&
        event.key === `farmerNotificationReads_${currentUser.uid}`
      ) {
        refreshReadNotificationIds();
      }
    }

    refreshReadNotificationIds();
    window.addEventListener(
      "farmer-notification-reads-updated",
      refreshReadNotificationIds
    );
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "farmer-notification-reads-updated",
        refreshReadNotificationIds
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
      sessionStorage.removeItem("role");
      navigate("/role-selection", { replace: true });
    } catch (logoutError) {
      console.error("Farmer logout error:", logoutError);
      setError("Unable to log out right now. Please try again.");
    }
  }

  function handleRetry() {
    initializeDashboard();
  }

  function handleWeatherRetry() {
    setDashboardWeather(null);
    setWeatherError(false);
    setWeatherLoading(true);
    setWeatherRetry((attempt) => attempt + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto relative">
            <div className="absolute inset-0 rounded-full border-4 border-green-200" />
            <div className="absolute inset-0 rounded-full border-4 border-t-green-700 animate-spin" />
          </div>
          <p className="font-semibold text-green-800 mt-4">
            {t("openingAgriSaathi", {}, language)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {t("dashboardLoading", {}, language)}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">
            {t("dashboardErrorTitle", {}, language)}
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 bg-green-700 text-white px-4 py-3 rounded-xl font-semibold hover:bg-green-800 transition"
            >
              🔄 {t("retry", {}, language)}
            </button>
            <button
              type="button"
              onClick={() => navigate("/role-selection")}
              className="flex-1 border border-gray-300 px-4 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
            >
              ← {t("back", {}, language)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell min-h-screen">
      <main className="mx-auto w-full max-w-[1680px] space-y-4 px-3 py-4 sm:space-y-5 sm:px-5 sm:py-5 lg:px-7">
        <header className="dashboard-hero relative overflow-hidden rounded-2xl px-4 py-4 text-white shadow-lg sm:px-6 sm:py-5 lg:px-8">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lime-200">
                <Sprout size={27} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold tracking-wide">AGRISAATHI</p>
                <p className="text-sm text-green-50">Farmer Portal</p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <button type="button" onClick={() => void initializeDashboard()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-[var(--agri-text)] shadow-sm transition hover:bg-white disabled:opacity-60">
                <RefreshCw size={16} aria-hidden="true" /> {loading ? t("refreshing", {}, language) : t("refresh", {}, language)}
              </button>
              <button type="button" onClick={() => navigate("/farmer/notifications")} className="relative inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[var(--agri-text)] shadow-sm transition hover:bg-green-50" aria-label={`${t("notifications", {}, language)}${unreadNotifications > 0 ? `, ${unreadNotifications} ${t("unread", {}, language)}` : ""}`}>
                <Bell size={17} className="text-amber-600" aria-hidden="true" /> {t("notifications", {}, language)}
                {unreadNotifications > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
              </button>
              <LanguageSelector compact />
              <button type="button" onClick={handleLogout} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-[var(--agri-text)] shadow-sm transition hover:bg-white">
                <LogOut size={16} aria-hidden="true" /> {t("logout", {}, language)}
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-4 sm:mt-6 sm:pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-300/20 text-3xl text-lime-200"><Sprout size={32} aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-sm text-green-50">{greetingFor(language)}</p>
                <h1 className="truncate text-xl font-bold sm:text-2xl">{farmer?.name || farmer?.fullName || farmer?.farmerName || t("farmer", {}, language)}</h1>
                {(farmer?.village || farmer?.district) && <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-green-50"><MapPin size={13} className="shrink-0" aria-hidden="true" /><span className="truncate">{t("profileLocationLabel", {}, language)}: {[farmer.village, farmer.district].filter(Boolean).join(", ")}</span></p>}
                <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-green-500/50 px-3 py-1 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-lime-300" />Farmer Account Active</span>
              </div>
            </div>
              <p className="max-w-xs text-left text-xs italic text-green-50 md:text-right md:text-sm">Better Farming,<br /><span className="text-lg font-semibold not-italic text-white sm:text-xl">Brighter Future</span> <span className="text-lime-300">◆</span></p>
          </div>
        </header>

        <section className="dashboard-feature-grid grid min-w-0 items-stretch gap-4 lg:gap-5">
          <article className="flex min-w-0 flex-col rounded-2xl border border-[var(--agri-border)] bg-white/95 p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--agri-text)]">⛅ {t("weather", {}, language)}</h2>
                <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-[var(--agri-muted)]"><MapPin size={13} className="shrink-0" aria-hidden="true" /><span className="truncate">{dashboardWeather?.village || [farmer?.village, farmer?.district].filter(Boolean).join(", ") || (dashboardWeather?.location ? `${dashboardWeather.location.latitude.toFixed(3)}, ${dashboardWeather.location.longitude.toFixed(3)}` : t("detectingLocation", {}, language))}</span></p>
              </div>
              <button type="button" onClick={() => navigate("/weather")} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--agri-green)] hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700">
                {t("weather", {}, language)} <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
            {weatherLoading ? (
              <div className="grid flex-1 content-start gap-3">
                <div className="h-24 animate-pulse rounded-xl bg-green-50" />
                <div className="h-20 animate-pulse rounded-xl bg-green-50" />
                <div className="h-16 animate-pulse rounded-xl bg-green-50" />
              </div>
            ) : dashboardWeather?.current ? (
              <>
                {(() => {
                  const current = dashboardWeather.current;
                  const details = currentWeatherDetails(current.weather_code, current.is_day, language);
                  const metrics = [
                    { label: t("feelsLike", {}, language), value: formatMetric(current.apparent_temperature, "°C"), Icon: Thermometer },
                    { label: t("humidity", {}, language), value: formatMetric(current.relative_humidity_2m, "%"), Icon: Droplet },
                    { label: t("windLabel", {}, language).replace(/^[^\p{L}\p{N}]+/u, ""), value: formatMetric(current.wind_speed_10m, " km/h"), Icon: Wind },
                    { label: t("rainLabel", {}, language).replace(/^[^\p{L}\p{N}]+/u, ""), value: formatMetric(current.rain ?? current.precipitation, " mm"), Icon: CloudRain },
                  ];
                  return <>
                    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] xl:items-center">
                      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-green-50/80 px-3 py-2.5">
                        <span className="text-4xl" aria-hidden="true">{details.icon}</span>
                        <div className="min-w-0"><p className="text-3xl font-bold leading-tight text-[var(--agri-text)]">{formatMetric(current.temperature_2m, "°C")}</p><p className="truncate text-sm text-[var(--agri-muted)]">{details.label}</p></div>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                        {metrics.map(({ label, value, Icon }) => <div key={label} className="min-w-0 rounded-xl bg-green-50/80 px-2.5 py-2"><dt className="flex items-center gap-1 truncate text-[11px] text-[var(--agri-muted)]"><Icon size={14} className="shrink-0 text-[var(--agri-green)]" aria-hidden="true" />{label}</dt><dd className="mt-1 truncate pl-5 text-sm font-bold text-[var(--agri-text)]">{value}</dd></div>)}
                      </dl>
                    </div>
                    <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto border-t border-green-100 pt-3 pb-1">
                      {dashboardWeather.hours.map((hour) => (
                        <article key={hour.time} className="flex min-w-[68px] flex-1 flex-col items-center rounded-lg px-2 py-1.5 text-center even:bg-green-50/70">
                          <p className="whitespace-nowrap text-xs font-medium text-[var(--agri-muted)]">{formatForecastTime(hour.time, language)}</p>
                          <span className="my-1 text-lg" aria-hidden="true">{forecastIcon(hour.weatherCode, hour.isDay)}</span>
                          <p className="text-sm font-bold text-[var(--agri-text)]">{formatMetric(hour.temperature, "°")}</p>
                        </article>
                      ))}
                    </div>
                  </>;
                })()}
              </>
            ) : weatherError ? (
              <div className="flex min-h-40 flex-1 flex-col items-center justify-center rounded-xl bg-amber-50/70 px-4 py-5 text-center">
                <p className="text-sm text-[var(--agri-muted)]">{t("weatherUnavailable", {}, language)}</p>
                <button type="button" onClick={handleWeatherRetry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--agri-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--agri-forest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2">
                  <RefreshCw size={15} aria-hidden="true" /> {t("retry", {}, language)}
                </button>
              </div>
            ) : null}
          </article>

          <VoiceAssistantCard onOpen={() => navigate("/farmer/voice")} />
        </section>

        <PushNotificationTest />

        <section className="rounded-2xl border border-[var(--agri-border)] bg-white/80 p-4 shadow-sm sm:p-5" aria-labelledby="farmer-features-heading">
          <div className="mb-4 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
            <div>
              <h2
                id="farmer-features-heading"
                className="flex items-center gap-2 text-xl font-bold text-[var(--agri-text)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-[var(--agri-green)]"><LayoutGrid size={18} aria-hidden="true" /></span>
                {t("farmerFeaturesTitle", {}, language)}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("farmerFeaturesDescription", {}, language)}
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--agri-green)]">
              {FARMER_FEATURES.length} {t("availableFeatures", {}, language)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {FARMER_FEATURES.map((feature) => {
              const title = t(feature.titleKey, {}, language);
              const description = t(feature.descriptionKey, {}, language);

              return (
                <button
                  type="button"
                  key={feature.key}
                  onClick={() =>
                  feature.external
                      ? navigate("/farmer/nearby-services")
                      : navigate(feature.path)
                  }
                  className="group flex min-h-[92px] min-w-0 items-center gap-3 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-card)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 sm:p-3.5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100/70 text-2xl">
                    {feature.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-bold text-[var(--agri-text)]">
                        {title}
                      </span>
                      <ArrowRight size={16} className="mt-0.5 shrink-0 text-[var(--agri-forest)] transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-[var(--agri-muted)]">
                      {description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
