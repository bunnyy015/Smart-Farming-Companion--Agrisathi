import { useNavigate } from "react-router-dom";

export default function IrrigationPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-green-50 p-4">

      {/* Header */}
      <div className="bg-green-700 text-white p-4 rounded-xl shadow">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm mb-2"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold">
          Irrigation Advice 💧
        </h1>

        <p>Smart water management for crops</p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow p-5 mt-5">
        <h2 className="text-xl font-semibold text-green-700">
          Today's Recommendation
        </h2>

        <p className="mt-3 text-gray-700">
          Soil moisture appears moderate. Irrigate crops during
          early morning or evening to reduce water loss.
        </p>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-2 gap-4 mt-5">

        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold">🌡 Temperature</h3>
          <p>32°C</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold">💧 Soil Moisture</h3>
          <p>Medium</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold">🌧 Rain Forecast</h3>
          <p>20% Chance</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold">🚿 Water Need</h3>
          <p>Normal</p>
        </div>

      </div>

      {/* Farmer Tip */}
      <div className="bg-green-100 border-l-4 border-green-700 p-4 mt-5 rounded">
        <h3 className="font-semibold text-green-800">
          Farmer Tip 🌾
        </h3>

        <p className="mt-2 text-green-700">
          Avoid irrigation during peak afternoon hours.
          Watering early morning improves efficiency.
        </p>
      </div>

    </div>
  );
}