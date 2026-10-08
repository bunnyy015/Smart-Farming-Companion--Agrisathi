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
import { auth, database, getAuthUser } from "../../firebase";
import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from "../../utils/language";
import LanguageSelector from "../../components/LanguageSelector";
import FarmerHeader from "../../components/FarmerHeader";
import TodayAdviceCard from "../../components/TodayAdviceCard";
import MarketAlertCard from "../../components/MarketAlertCard";
import VoiceAssistantCard from "../../components/VoiceAssistantCard";
import {
  getCurrentLocation,
  getLocationErrorTranslationKey,
  reverseGeocodeCoordinates,
} from "../../services/currentLocationService";
import { clearWeatherContext } from "../../utils/weatherContext";

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
  const [weather, setWeather] = useState(null);
  const [weatherLocationMessage, setWeatherLocationMessage] = useState("");
  const [notificationIds, setNotificationIds] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [latestOrder, setLatestOrder] = useState(null);
  const [marketRecord, setMarketRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(true);
  const [error, setError] = useState(null);
  const [language, setCurrentLanguage] = useState(getLanguage());

  useEffect(() => {
    initializeDashboard();
    return subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });
  }, []);

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
        setError(t("dashboardProfileMissing", {}, language));
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

      // Load secondary dashboard cards in the background so they don't
      // delay showing the dashboard shell and navigation.
      void Promise.all([
        loadOrderInformation(currentUser.uid),
        loadWeather(),
        loadMarketRecord(farmerProfile),
      ]).catch((summaryError) => {
        console.error("Dashboard summary loading error:", summaryError);
      });

    } catch (error) {
      console.error("Dashboard error:", error);
      setError(t("dashboardLoadError", {}, language));
    } finally {
      setLoading(false);
    }
  }

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

  async function loadOrderInformation(farmerUid) {
    try {
      try {
        const savedReadIds = localStorage.getItem(
          `farmerNotificationReads_${farmerUid}`
        );
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
        setLatestOrder(null);
        return;
      }

      const orders = Object.entries(snapshot.val())
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort(
          (first, second) =>
            new Date(second.updatedAt || second.createdAt || 0) -
            new Date(first.updatedAt || first.createdAt || 0)
        );

      let deletedNotificationIds = [];
      try {
        const savedDeletedIds = localStorage.getItem(
          `farmerNotificationDeletes_${farmerUid}`
        );
        const parsedDeletedIds = savedDeletedIds
          ? JSON.parse(savedDeletedIds)
          : [];
        deletedNotificationIds = Array.isArray(parsedDeletedIds)
          ? parsedDeletedIds
          : [];
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
          .filter((order) =>
            SUPPORTED_ORDER_STATUSES.includes(order.normalizedStatus)
          )
          .map((order) => `order-${order.id}-${order.normalizedStatus}`)
          .filter((notificationId) =>
            !deletedNotificationIds.includes(notificationId)
          )
      );

      setLatestOrder(
        orders.find((order) => {
          const status = String(order.status || order.orderStatus || "")
            .trim()
            .toLowerCase()
            .replaceAll(" ", "_");

          const paid =
            ["payment_received", "completed", "complete", "paid", "payment_completed"].includes(status) ||
            order.dealerPaymentReceived === true ||
            order.paymentStatus === "paid" ||
            order.paymentStatus === "completed";

          const statusIsInHistory =
            ["accepted", "rejected"].includes(status) ||
            Boolean(
              order.acceptedAt ||
                order.dealerAcceptedAt ||
                order.rejectedAt
            );

          return !order.farmerArchived && !paid && !statusIsInHistory;
        }) || null
      );

    } catch (error) {
      console.error("Order summary error:", error);
      setNotificationIds([]);
      setLatestOrder(null);
    }
  }

  async function loadWeather() {
    setWeatherLoading(true);
    setWeatherLocationMessage("");
    setWeather(null);
    clearWeatherContext();
    let locationDetected = false;
    try {
      const { latitude, longitude } = await getCurrentLocation();
      locationDetected = true;
      const parameters = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: [
          "temperature_2m",
          "weather_code",
          "relative_humidity_2m",
          "wind_speed_10m",
          "rain",
        ].join(","),
        hourly: "precipitation_probability",
        forecast_days: "1",
        timezone: "auto",
      });

      const [response, placeResult] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${parameters.toString()}`),
        reverseGeocodeCoordinates({ latitude, longitude })
          .then((place) => ({ place }))
          .catch((error) => ({ error })),
      ]);

      if (!response.ok) {
        throw new Error(`Weather request failed (${response.status}).`);
      }

      const result = await response.json();
      const place = placeResult.place;
      const location = [
        place?.locality || place?.city,
        place?.principalSubdivision,
      ].filter(Boolean).join(", ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      if (!place) {
        setWeatherLocationMessage(t("locationCoordinatesOnly", {}, language));
      }

      const futureRainValues =
        result.hourly?.precipitation_probability || [];
      const rainProbability = futureRainValues.length > 0
        ? Math.max(...futureRainValues.slice(0, 12).map((value) => Number(value || 0)))
        : 0;

      setWeather({
        temperature: result.current?.temperature_2m,
        code: result.current?.weather_code,
        humidity: result.current?.relative_humidity_2m,
        wind: result.current?.wind_speed_10m,
        rain: result.current?.rain,
        rainProbability,
        location,
      });
    } catch (error) {
      console.error("Weather/location error:", error);
      setWeather(null);
      setWeatherLocationMessage(
        t(
          locationDetected
            ? "localWeatherFailed"
            : getLocationErrorTranslationKey(error),
          {},
          language
        )
      );
    } finally {
      setWeatherLoading(false);
    }
  }

  async function loadMarketRecord(farmerProfile) {
    setMarketLoading(true);
    try {
      const snapshot = await get(ref(database, "marketPrices"));

      if (!snapshot.exists()) {
        setMarketRecord(null);
        return;
      }

      const records = [];

      function readRecords(node) {
        if (!node || typeof node !== "object") {
          return;
        }

        const commodity =
          node.commodity ||
          node.cropName ||
          node.crop ||
          node.productName;

        const modalPrice = Number(
          node.modalPrice ||
          node.modal_price ||
          node.price ||
          node.marketPrice ||
          0
        );

        if (commodity && modalPrice > 0) {
          records.push({
            commodity,
            market: node.market || node.marketName || node.mandi || "",
            district: node.district || "",
            modalPrice,
            minimumPrice: Number(
              node.minimumPrice ||
              node.minPrice ||
              node.min_price ||
              0
            ),
            maximumPrice: Number(
              node.maximumPrice ||
              node.maxPrice ||
              node.max_price ||
              0
            ),
            updatedAt: node.updatedAt || node.date || node.arrivalDate || "",
          });
          return;
        }

        Object.values(node).forEach(readRecords);
      }

      readRecords(snapshot.val());

      const mainCrop = String(
        farmerProfile.mainCrop || ""
      ).toLowerCase();

      const matchingRecords = records
        .filter((record) =>
          String(record.commodity || "")
            .toLowerCase()
            .includes(mainCrop)
        )
        .sort(
          (first, second) =>
            new Date(second.updatedAt || 0) -
            new Date(first.updatedAt || 0)
        );

      setMarketRecord(matchingRecords[0] || records[0] || null);

    } catch (error) {
      console.error("Market summary error:", error);
      setMarketRecord(null);
    } finally {
      setMarketLoading(false);
    }
  }

  function getOrderStatus(order) {
    const statuses = {
      pending: {
        label: t("waitingForDealer", {}, language),
        className: "bg-yellow-100 text-yellow-800",
        icon: "⏳",
      },
      accepted: {
        label: t("dealerAccepted", {}, language),
        className: "bg-blue-100 text-blue-800",
        icon: "✅",
      },
      rejected: {
        label: t("orderRejected", {}, language),
        className: "bg-red-100 text-red-700",
        icon: "❌",
      },
      delivered_by_dealer: {
        label: t("markedDelivered", {}, language),
        className: "bg-purple-100 text-purple-800",
        icon: "📦",
      },
      received_by_farmer: {
        label: t("deliveryConfirmed", {}, language),
        className: "bg-indigo-100 text-indigo-800",
        icon: "✓",
      },
      payment_received: {
        label: t("paymentConfirmed", {}, language),
        className: "bg-orange-100 text-orange-800",
        icon: "💰",
      },
      completed: {
        label: t("completed", {}, language),
        className: "bg-green-100 text-green-800",
        icon: "🎉",
      },
    };

    return (
      statuses[order?.status] || {
        label: t("orderUpdate", {}, language),
        className: "bg-gray-100 text-gray-700",
        icon: "📋",
      }
    );
  }

  function handleRetry() {
    initializeDashboard();
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

  const orderStatus = getOrderStatus(latestOrder);

  return (
    <div className="min-h-screen bg-[#f3f8f2] text-slate-900">
      <main className="mx-auto w-full max-w-[1680px] space-y-6 px-4 py-5 sm:px-6 lg:space-y-8 lg:px-10 lg:py-8">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-800 via-green-700 to-emerald-600 px-5 py-6 text-white shadow-xl sm:px-8 sm:py-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-8 h-48 w-48 rounded-full bg-lime-300/10" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-3xl shadow-sm sm:h-18 sm:w-18">
                🌱
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-100 sm:text-sm">
                  AGRISAATHI FARMER PORTAL
                </p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl md:text-4xl">
                  {t("dashboardPageTitle", {}, language)}
                </h1>
                <p className="mt-1 text-sm text-green-100 sm:text-base">
                  Manage your farm, orders, weather and farmer services.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => initializeDashboard()}
                disabled={loading}
                className="rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 font-semibold transition hover:bg-white/25 disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "↻ Refresh"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/farmer/notifications")}
                className="relative rounded-xl bg-white px-4 py-2.5 font-semibold text-green-800 shadow-sm transition hover:bg-green-50"
                aria-label={`${t("notifications", {}, language)}${
                  unreadNotifications > 0
                    ? `, ${unreadNotifications} ${t("unread", {}, language)}`
                    : ""
                }`}
              >
                🔔 {t("notifications", {}, language)}
                {unreadNotifications > 0 && (
                  <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>
              <LanguageSelector compact />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-white/35 px-4 py-2.5 font-semibold transition hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="relative mt-6">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-lime-300" />
              Farmer Account Active
            </span>
          </div>
        </header>

        <FarmerHeader
          farmer={farmer}
          weather={weather}
          weatherLoading={weatherLoading}
          weatherMessage={weatherLocationMessage}
          unreadNotifications={unreadNotifications}
          showNotifications={false}
        />

        <VoiceAssistantCard
          onOpen={() => navigate("/farmer/voice")}
        />

        <section className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <TodayAdviceCard
              weather={weather}
              showWeatherAction={false}
            />
          </div>
          <div className="lg:col-span-5">
            <MarketAlertCard
              cropName={farmer?.mainCrop}
              marketRecord={marketRecord}
              loading={marketLoading}
              showAction={false}
            />
          </div>
        </section>

        {latestOrder && (
          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {t("latestOrder", {}, language)}
              </p>
              <h2 className="mt-1 truncate text-lg font-bold text-green-950">
                {latestOrder.productName || t("farmProduct", {}, language)}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("quantity", {}, language)}: {latestOrder.quantity || 0}{" "}
                {latestOrder.unit || ""}
                {latestOrder.dealerName && (
                  <span>
                    <span aria-hidden="true"> · </span>
                    {t("orderFrom", {}, language)} {latestOrder.dealerName}
                  </span>
                )}
              </p>
            </div>
            <span
              className={`${orderStatus.className} shrink-0 rounded-full px-3 py-2 text-sm font-semibold`}
            >
              {orderStatus.icon} {orderStatus.label}
            </span>
          </section>
        )}

        <section aria-labelledby="farmer-features-heading">
          <div className="mb-4 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
            <div>
              <h2
                id="farmer-features-heading"
                className="text-xl font-bold text-green-950"
              >
                {t("farmerFeaturesTitle", {}, language)}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("farmerFeaturesDescription", {}, language)}
              </p>
            </div>
            <span className="text-sm font-medium text-slate-500">
              {FARMER_FEATURES.length} {t("availableFeatures", {}, language)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {FARMER_FEATURES.map((feature, index) => {
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
                  className="group flex min-h-36 items-start gap-4 rounded-xl border border-green-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-2xl">
                    {feature.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-bold text-green-950">
                        {title}
                      </span>
                      <span className="text-xs font-semibold text-green-700">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600">
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
