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

export default function DashboardPage() {
  const navigate = useNavigate();

  const [notificationIds, setNotificationIds] =
    useState([]);

  const [loadingNotifications, setLoadingNotifications] =
    useState(true);

  useEffect(() => {
    loadNotificationCount();
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

      const readIds = saved
        ? JSON.parse(saved)
        : [];

      return notificationIds.filter(
        (id) => !readIds.includes(id)
      ).length;
    } catch {
      return notificationIds.length;
    }
  }, [notificationIds]);

  async function loadNotificationCount() {
    setLoadingNotifications(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(currentUser.uid)
      );

      const snapshot = await get(ordersQuery);

      if (!snapshot.exists()) {
        setNotificationIds([]);
        return;
      }

      const supportedStatuses = [
        "accepted",
        "rejected",
        "delivered_by_dealer",
        "received_by_farmer",
        "payment_received",
        "completed",
        "cancelled",
      ];

      const ids = Object.entries(
        snapshot.val()
      )
        .filter(([, order]) =>
          supportedStatuses.includes(
            order.status
          )
        )
        .map(
          ([id, order]) =>
            `order-${id}-${order.status}`
        );

      setNotificationIds(ids);
    } catch (error) {
      console.error(
        "Farmer notification count error:",
        error
      );

      setNotificationIds([]);
    } finally {
      setLoadingNotifications(false);
    }
  }

  const mainFeatures = [
    {
      title: "Crop Disease",
      subtitle: "Scan a plant",
      icon: "🌿",
      path: "/crop-disease",
    },

    {
      title: "Weather",
      subtitle: "Farm forecast",
      icon: "🌦️",
      path: "/weather",
    },

    {
      title: "Local Dealers",
      subtitle: "Seeds and fertilizers",
      icon: "🏪",
      path: "/farmer/dealer-products",
    },

    {
      title: "My Orders",
      subtitle: "Track purchases",
      icon: "🛒",
      path: "/farmer/orders",
    },
  ];

  const services = [
    {
      title: "Market Prices",
      subtitle: "Local mandi prices",
      icon: "📈",
      path: "/market-prices",
    },

    {
      title: "Government Schemes",
      subtitle: "Farmer benefits",
      icon: "🏛️",
      path: "/govt-schemes",
    },

    {
      title: "Community",
      subtitle: "Ask and share",
      icon: "👥",
      path: "/community",
    },

    {
      title: "My Profile",
      subtitle: "Farm details",
      icon: "👤",
      path: "/profile",
    },
  ];

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl p-5 shadow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                🌾 AgriSaathi
              </h1>

              <p className="text-green-100 mt-1">
                Your crop farming companion
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/farmer/notifications"
                )
              }
              className="relative bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold"
            >
              🔔 Alerts

              {!loadingNotifications &&
                unreadNotifications > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications > 99
                      ? "99+"
                      : unreadNotifications}
                  </span>
                )}
            </button>
          </div>

          <div className="bg-white/15 rounded-xl p-3 mt-4">
            <p className="font-semibold">
              👋 Welcome Farmer
            </p>

            <p className="text-sm text-green-100 mt-1">
              Get crop guidance, weather,
              market prices and local products.
            </p>
          </div>
        </header>

        <section className="bg-white rounded-2xl shadow p-5 mt-5 text-center">
          <h2 className="text-xl font-bold text-green-800">
            🎤 Ask AgriSaathi
          </h2>

          <p className="text-gray-600 text-sm mt-1">
            Tap and speak in your language.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/farmer/voice")
            }
            className="w-20 h-20 rounded-full bg-green-700 text-white text-3xl mt-4 shadow hover:bg-green-800"
            aria-label="Open voice assistant"
          >
            🎤
          </button>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {mainFeatures.map((feature) => (
            <button
              type="button"
              key={feature.path}
              onClick={() =>
                navigate(feature.path)
              }
              className="bg-white rounded-2xl shadow p-4 text-center hover:shadow-lg transition"
            >
              <div className="text-3xl">
                {feature.icon}
              </div>

              <h2 className="font-bold text-gray-800 mt-2">
                {feature.title}
              </h2>

              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {feature.subtitle}
              </p>
            </button>
          ))}
        </section>

        <section className="mt-7">
          <h2 className="text-xl font-bold text-green-800 mb-3">
            Farming Services
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {services.map((service) => (
              <button
                type="button"
                key={service.path}
                onClick={() =>
                  navigate(service.path)
                }
                className="bg-white rounded-2xl shadow p-4 text-left hover:shadow-lg transition"
              >
                <span className="text-2xl">
                  {service.icon}
                </span>

                <p className="font-semibold text-gray-800 mt-2">
                  {service.title}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {service.subtitle}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-6">
          <h2 className="text-lg font-bold text-green-800">
            🩺 Need veterinary help?
          </h2>

          <p className="text-sm text-gray-600 mt-2">
            A simple nearby veterinary
            hospitals and doctor contact page
            will be added separately.
          </p>
        </section>
      </div>
    </div>
  );
}