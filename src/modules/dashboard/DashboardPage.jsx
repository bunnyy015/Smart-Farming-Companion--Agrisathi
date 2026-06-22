import { useNavigate } from "react-router-dom";
import { t } from "../../utils/language";

export default function DashboardPage() {
  const navigate = useNavigate();

  const features = [
    {
      key: "weather",
      icon: "🌦",
      path: "/weather",
    },
    {
      key: "cropDisease",
      icon: "🌾",
      path: "/crop-disease",
    },
    {
      key: "irrigationAdvice",
      icon: "💧",
      path: "",
    },
    {
      key: "animalCare",
      icon: "🐄",
      path: "/animal-care",
    },
   {
  key: "marketPrices",
  icon: "📈",
  path: "/market-prices",
},
    {
      key: "govtSchemes",
      icon: "🏛",
      path: "",
    },
   {
  key: "farmerProfile",
  icon: "👤",
  path: "/profile",
},
    {
      key: "settings",
      icon: "⚙",
      path: "",
    },
  ];

  function handleFeatureClick(item) {
    if (item.path) {
      navigate(item.path);
    } else {
      alert(`${t(item.key)} page will be added next`);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-4">
      <div className="bg-green-700 text-white p-4 rounded-xl shadow">
        <h1 className="text-2xl font-bold">
          AgriSathi
        </h1>

        <p className="text-sm mt-1">
          {t("smartFarmingCompanion")}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-4">
        <h2 className="text-xl font-semibold text-green-700">
          {t("welcomeFarmer")}
        </h2>

        <p className="text-gray-600 mt-2">
          {t("chooseService")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        {features.map((item) => (
          <div
            key={item.key}
            onClick={() => handleFeatureClick(item)}
            className="bg-white rounded-xl shadow p-6 text-center hover:bg-green-100 cursor-pointer transition"
          >
            <div className="text-4xl">
              {item.icon}
            </div>

            <p className="mt-3 font-medium">
              {t(item.key)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
