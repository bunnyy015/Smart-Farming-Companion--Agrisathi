import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
} from "firebase/database";
import { auth, database } from "../../firebase";
import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from "../../utils/language";

import FarmerHeader from "../../components/FarmerHeader";
import VoiceAssistantCard from "../../components/VoiceAssistantCard";
import QuickActions from "../../components/QuickActions";
import TodayAdviceCard from "../../components/TodayAdviceCard";
import MarketAlertCard from "../../components/MarketAlertCard";

const SUPPORTED_ORDER_STATUSES = [
  "accepted",
  "rejected",
  "delivered_by_dealer",
  "received_by_farmer",
  "payment_received",
  "completed",
  "cancelled",
];

export default function DashboardPage() {
  const navigate = useNavigate();

  const [farmer, setFarmer] = useState(null);
  const [weather, setWeather] = useState(null);
  const [notificationIds, setNotificationIds] = useState([]);
  const [latestOrder, setLatestOrder] = useState(null);
  const [marketRecord, setMarketRecord] = useState(null);

  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(true);
  const [language, setCurrentLanguage] = useState(
    getLanguage()
  );

  useEffect(() => {
    initializeDashboard();

    return subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });
  }, []);

  const unreadNotifications = useMemo(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return 0;
    }

    try {
      const saved = localStorage.getItem(
        `farmerNotificationReads_${currentUser.uid}`
      );

      const readIds = saved ? JSON.parse(saved) : [];

      return notificationIds.filter(
        (notificationId) => !readIds.includes(notificationId)
      ).length;
    } catch {
      return notificationIds.length;
    }
  }, [notificationIds]);

  async function initializeDashboard() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const [userSnapshot, farmerSnapshot] =
        await Promise.all([
          get(
            ref(
              database,
              `users/${currentUser.uid}`
            )
          ),
          get(
            ref(
              database,
              `farmers/${currentUser.uid}`
            )
          ),
        ]);

      if (
        !userSnapshot.exists() ||
        userSnapshot.val().role !== "farmer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });
        return;
      }

      const farmerProfile = {
        uid: currentUser.uid,
        ...userSnapshot.val(),
        ...(farmerSnapshot.exists()
          ? farmerSnapshot.val()
          : {}),
        role: userSnapshot.val().role,
      };

      setFarmer(farmerProfile);

      await Promise.all([
        loadOrderInformation(currentUser.uid),
        loadWeather(farmerProfile),
        loadMarketRecord(farmerProfile),
      ]);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderInformation(farmerUid) {
    try {
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
            new Date(
              second.updatedAt || second.createdAt || 0
            ) -
            new Date(
              first.updatedAt || first.createdAt || 0
            )
        );

      setNotificationIds(
        orders
          .filter((order) =>
            SUPPORTED_ORDER_STATUSES.includes(order.status)
          )
          .map(
            (order) =>
              `order-${order.id}-${order.status}`
          )
      );

      setLatestOrder(orders[0] || null);
    } catch (error) {
      console.error("Order summary error:", error);
      setNotificationIds([]);
      setLatestOrder(null);
    }
  }

  async function loadWeather(farmerProfile) {
    setWeatherLoading(true);

    if (!navigator.geolocation) {
      setWeatherLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const parameters = new URLSearchParams({
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude),
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

          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?${parameters.toString()}`
          );

          if (!response.ok) {
            throw new Error("Weather request failed.");
          }

          const result = await response.json();

          const futureRainValues =
            result.hourly?.precipitation_probability || [];

          const rainProbability =
            futureRainValues.length > 0
              ? Math.max(
                  ...futureRainValues
                    .slice(0, 12)
                    .map((value) => Number(value || 0))
                )
              : 0;

          setWeather({
            temperature:
              result.current?.temperature_2m,
            code: result.current?.weather_code,
            humidity:
              result.current?.relative_humidity_2m,
            wind:
              result.current?.wind_speed_10m,
            rain: result.current?.rain,
            rainProbability,
            location:
              farmerProfile.village ||
              farmerProfile.district ||
              "Your farm",
          });
        } catch (error) {
          console.error("Weather error:", error);
          setWeather(null);
        } finally {
          setWeatherLoading(false);
        }
      },
      () => {
        setWeather(null);
        setWeatherLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  }

  async function loadMarketRecord(farmerProfile) {
    setMarketLoading(true);

    try {
      const snapshot = await get(
        ref(database, "marketPrices")
      );

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
            market:
              node.market ||
              node.marketName ||
              node.mandi ||
              "",
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
            updatedAt:
              node.updatedAt ||
              node.date ||
              node.arrivalDate ||
              "",
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

      setMarketRecord(
        matchingRecords[0] || records[0] || null
      );
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
      },
      accepted: {
        label: t("dealerAccepted", {}, language),
        className: "bg-blue-100 text-blue-800",
      },
      rejected: {
        label: t("orderRejected", {}, language),
        className: "bg-red-100 text-red-700",
      },
      delivered_by_dealer: {
        label: t("markedDelivered", {}, language),
        className: "bg-purple-100 text-purple-800",
      },
      received_by_farmer: {
        label: t("deliveryConfirmed", {}, language),
        className: "bg-indigo-100 text-indigo-800",
      },
      payment_received: {
        label: t("paymentConfirmed", {}, language),
        className: "bg-orange-100 text-orange-800",
      },
      completed: {
        label: t("completed", {}, language),
        className: "bg-green-100 text-green-800",
      },
      cancelled: {
        label: t("cancelled", {}, language),
        className: "bg-gray-100 text-gray-700",
      },
    };

    return (
      statuses[order?.status] || {
        label: t("orderUpdate", {}, language),
        className: "bg-gray-100 text-gray-700",
      }
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />

          <p className="font-semibold text-green-800 mt-4">
            {t("openingAgriSaathi", {}, language)}
          </p>
        </div>
      </div>
    );
  }

  const orderStatus = getOrderStatus(latestOrder);

  return (
    <div className="min-h-screen bg-green-50 pb-24">
      <main className="w-full max-w-md mx-auto">
        <FarmerHeader
          farmer={farmer}
          weather={weather}
          weatherLoading={weatherLoading}
          unreadNotifications={unreadNotifications}
          onNotifications={() =>
            navigate("/farmer/notifications")
          }
        />

        <div className="px-4">
          <VoiceAssistantCard
            onOpen={() => navigate("/farmer/voice")}
          />

          <QuickActions onNavigate={navigate} />

          <TodayAdviceCard
            weather={weather}
            onOpenWeather={() => navigate("/weather")}
          />

          <MarketAlertCard
            cropName={farmer?.mainCrop}
            marketRecord={marketRecord}
            loading={marketLoading}
            onOpenMarket={() =>
              navigate("/market-prices")
            }
          />

          {latestOrder && (
            <section className="bg-white border border-blue-100 rounded-2xl shadow-sm p-4 mt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">
                    {t("latestOrder", {}, language)}
                  </p>

                  <h2 className="font-bold text-green-900 mt-1">
                    {latestOrder.productName ||
                      t("farmProduct", {}, language)}
                  </h2>

                  <p className="text-sm text-gray-600 mt-1">
                    {t("quantity", {}, language)}: {latestOrder.quantity || 0}{" "}
                    {latestOrder.unit || ""}
                  </p>
                </div>

                <span
                  className={`${orderStatus.className} px-3 py-1.5 rounded-full text-xs font-semibold`}
                >
                  {orderStatus.label}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate("/farmer/orders")
                }
                className="w-full bg-blue-50 text-blue-800 py-3 rounded-xl font-semibold mt-4"
              >
                {t("trackOrder", {}, language)}
              </button>
            </section>
          )}

          <section className="grid grid-cols-4 gap-2 mt-5">
            {[
              ["🌦️", t("weather", {}, language), "/weather"],
              ["🏛️", t("schemes", {}, language), "/govt-schemes"],
              ["👥", t("community", {}, language), "/community"],
              ["👤", t("profile", {}, language), "/profile"],
            ].map(([icon, title, path]) => (
              <button
                type="button"
                key={path}
                onClick={() => navigate(path)}
                className="bg-white border border-green-100 rounded-2xl min-h-24 px-2 py-3 text-center shadow-sm"
              >
                <div className="text-2xl">{icon}</div>

                <p className="text-xs font-semibold mt-2">
                  {title}
                </p>
              </button>
            ))}
          </section>

          <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-4 mt-5">
            <h2 className="font-bold text-green-900">
              📍 {t("nearbyServices", {}, language)}
            </h2>

            <p className="text-sm text-gray-600 mt-1">
              {t(
                "nearbyServicesDescription",
                {},
                language
              )}
            </p>

            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `agriculture office soil testing lab farm equipment services near ${
                      farmer?.district ||
                      farmer?.village ||
                      ""
                    }`
                  )}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold mt-4"
            >
              {t("openNearbyServices", {}, language)}
            </button>
          </section>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-40">
          <div className="max-w-md mx-auto bg-white border-t border-gray-200 shadow-2xl px-2 py-2">
            <div className="grid grid-cols-5">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex flex-col items-center py-2 text-green-700"
              >
                <span className="text-xl">🏠</span>
                <span className="text-[11px] font-semibold mt-1">
                  {t("home", {}, language)}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/farmer/orders")
                }
                className="flex flex-col items-center py-2 text-gray-600"
              >
                <span className="text-xl">🛒</span>
                <span className="text-[11px] font-semibold mt-1">
                  {t("orders", {}, language)}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/farmer/voice")
                }
                className="flex flex-col items-center"
              >
                <span className="w-14 h-14 -mt-8 rounded-full bg-green-700 text-white flex items-center justify-center text-2xl shadow-lg border-4 border-green-50">
                  🎤
                </span>

                <span className="text-[11px] font-semibold text-green-700 mt-1">
                  {t("voice", {}, language)}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/community")
                }
                className="flex flex-col items-center py-2 text-gray-600"
              >
                <span className="text-xl">👥</span>
                <span className="text-[11px] font-semibold mt-1">
                  {t("community", {}, language)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex flex-col items-center py-2 text-gray-600"
              >
                <span className="text-xl">👤</span>
                <span className="text-[11px] font-semibold mt-1">
                  {t("profile", {}, language)}
                </span>
              </button>
            </div>
          </div>
        </nav>
      </main>
    </div>
  );
}