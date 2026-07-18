import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function GovtSchemesPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const schemes = [
    {
      title: "PM Kisan Samman Nidhi",
      category: "Financial Support",
      benefit: "₹6000 yearly support for eligible farmers.",
      eligibility: "Small and marginal farmers with valid land records.",
      documents: "Aadhaar, bank account, land details.",
      icon: "💰",
    },
    {
      title: "Pradhan Mantri Fasal Bima Yojana",
      category: "Crop Insurance",
      benefit: "Crop loss protection due to natural calamities.",
      eligibility: "Farmers growing notified crops in notified areas.",
      documents: "Aadhaar, bank account, crop details, land details.",
      icon: "🛡️",
    },
    {
      title: "Kisan Credit Card",
      category: "Loan Support",
      benefit: "Short-term crop loan at lower interest.",
      eligibility: "Farmers, tenant farmers, sharecroppers.",
      documents: "Aadhaar, land records, bank details.",
      icon: "🏦",
    },
    {
      title: "Soil Health Card Scheme",
      category: "Soil Testing",
      benefit: "Soil nutrient report and fertilizer advice.",
      eligibility: "All farmers.",
      documents: "Farmer details and land details.",
      icon: "🌱",
    },
    {
      title: "PM Krishi Sinchayee Yojana",
      category: "Irrigation",
      benefit: "Support for better irrigation and water usage.",
      eligibility: "Farmers needing irrigation improvement.",
      documents: "Land records, Aadhaar, bank details.",
      icon: "💧",
    },
    {
      title: "eNAM",
      category: "Market Support",
      benefit: "Online agricultural market platform.",
      eligibility: "Farmers selling produce in registered markets.",
      documents: "Farmer ID, bank account, produce details.",
      icon: "📈",
    },
  ];

  const filteredSchemes = schemes.filter((scheme) => {
    const text = `
      ${scheme.title}
      ${scheme.category}
      ${scheme.benefit}
      ${scheme.eligibility}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  function speakScheme(scheme) {
    const message = `${scheme.title}. Benefit: ${scheme.benefit}. Eligibility: ${scheme.eligibility}. Required documents: ${scheme.documents}`;

    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = "en-IN";
    speech.rate = 0.9;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-green-700 text-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm mb-3"
          >
            ← Back to Dashboard
          </button>

          <h1 className="text-4xl font-bold">
            🏛️ Government Schemes
          </h1>

          <p className="text-green-100 mt-2">
            Find useful government schemes for farmers.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search scheme, insurance, loan, irrigation..."
            className="w-full border border-gray-300 rounded-lg p-3"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {filteredSchemes.map((scheme) => (
            <div
              key={scheme.title}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="text-5xl mb-3">{scheme.icon}</div>

              <h2 className="text-2xl font-bold text-green-700">
                {scheme.title}
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                {scheme.category}
              </p>

              <div className="mt-4 space-y-2 text-gray-700">
                <p>
                  <b>Benefit:</b> {scheme.benefit}
                </p>

                <p>
                  <b>Eligibility:</b> {scheme.eligibility}
                </p>

                <p>
                  <b>Documents:</b> {scheme.documents}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  onClick={() => speakScheme(scheme)}
                  className="bg-blue-600 text-white py-3 rounded-lg font-semibold"
                >
                  🔊 Speak
                </button>

                <button
                  onClick={() =>
                    alert("Apply link will be added in final deployment.")
                  }
                  className="bg-green-700 text-white py-3 rounded-lg font-semibold"
                >
                  Apply Info
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredSchemes.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-green-700">
              No schemes found
            </h2>

            <p className="text-gray-600 mt-2">
              Try searching with loan, insurance, irrigation, market or soil.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}