import { useNavigate } from "react-router-dom";
import { t } from "../../utils/language";

export default function DashboardPage() {
  const navigate = useNavigate();

  const features = [
    {
      key: "community",
      label: "Farmer Community",
      icon: "👥",
      path: "/community",
    },
    {
      key: "weather",
      label: "Weather",
      icon: "🌦",
      path: "/weather",
    },
    {
      key: "irrigationAdvice",
      label: "Irrigation Advice",
      icon: "💧",
      path: "/irrigation",
    },
    {
      key: "animalCare",
      label: "Animal Care",
      icon: "🐄",
      path: "/animal-care",
    },
    {
      key: "marketPrices",
      label: "Market Prices",
      icon: "📈",
      path: "/market-prices",
    },
    {
      key: "dealerProducts",
      label: "Seeds & Fertilizers",
      icon: "🏪",
      path: "/farmer/dealer-products",
    },
    {
      key: "govtSchemes",
      label: "Govt Schemes",
      icon: "🏛️",
      path: "/govt-schemes",
    },
    {
      key: "farmerProfile",
      label: "Farmer Profile",
      icon: "👤",
      path: "/profile",
    },
    {
      key: "sos",
      label: "SOS Help",
      icon: "🚨",
      path: "/sos",
    },
    {
      key: "settings",
      label: "Settings",
      icon: "⚙️",
      path: "",
    },
  ];

  function handleFeatureClick(item) {
    if (item.path) {
      navigate(item.path);
    } else {
      alert(`${item.label || t(item.key)} page will be added next`);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-4">
      <div className="bg-green-700 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-3xl font-bold">🌾 AgriSaathi</h1>

        <p className="mt-2 text-green-100">
          Smart Farming Companion
        </p>

        <div className="mt-4 bg-green-600 rounded-xl p-4">
          <h2 className="text-xl font-semibold">
            👋 Welcome Farmer
          </h2>

          <p className="text-sm mt-1">
            Access farming services, local dealers, schemes and expert support.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div
          onClick={() => navigate("/community")}
          className="bg-white rounded-2xl shadow p-4 text-center cursor-pointer hover:scale-105 transition"
        >
          <div className="text-3xl">👥</div>
          <h3 className="font-bold mt-2">Community</h3>
          <p className="text-sm text-gray-500">Ask Farmers</p>
        </div>

        <div
          onClick={() => navigate("/weather")}
          className="bg-white rounded-2xl shadow p-4 text-center cursor-pointer hover:scale-105 transition"
        >
          <div className="text-3xl">🌦</div>
          <h3 className="font-bold mt-2">Weather</h3>
          <p className="text-sm text-gray-500">Forecast</p>
        </div>

        <div
          onClick={() => navigate("/farmer/dealer-products")}
          className="bg-white rounded-2xl shadow p-4 text-center cursor-pointer hover:scale-105 transition"
        >
          <div className="text-3xl">🏪</div>
          <h3 className="font-bold mt-2">Dealers</h3>
          <p className="text-sm text-gray-500">Local Products</p>
        </div>

        <div
          onClick={() => navigate("/sos")}
          className="bg-white rounded-2xl shadow p-4 text-center cursor-pointer hover:scale-105 transition"
        >
          <div className="text-3xl">🚨</div>
          <h3 className="font-bold mt-2">SOS</h3>
          <p className="text-sm text-gray-500">Emergency</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-green-700 mb-4">
          Farming Services
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map((item) => (
            <div
              key={item.key}
              onClick={() => handleFeatureClick(item)}
              className="bg-white rounded-2xl shadow-lg p-6 text-center cursor-pointer hover:scale-105 transition"
            >
              <div className="text-5xl mb-3">
                {item.icon}
              </div>

              <p className="font-semibold">
                {item.label || t(item.key)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-5 mt-8">
        <h2 className="text-xl font-bold text-green-700">
          📢 Latest Government Schemes
        </h2>

        <div className="mt-4 border-l-4 border-green-600 pl-4">
          <h3 className="font-semibold">
            PM Kisan Scheme
          </h3>

          <p className="text-gray-600 text-sm">
            Financial support for eligible farmers.
          </p>
        </div>

        <div className="mt-4 border-l-4 border-green-600 pl-4">
          <h3 className="font-semibold">
            Crop Insurance
          </h3>

          <p className="text-gray-600 text-sm">
            Protect crops against natural disasters.
          </p>
        </div>
      </div>
    </div>
  );
}