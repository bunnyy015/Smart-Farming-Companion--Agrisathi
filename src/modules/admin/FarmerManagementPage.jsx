import { useNavigate } from "react-router-dom";

export default function FarmerManagementPage() {
  const navigate = useNavigate();

  const options = [
    {
      title: "All Farmers",
      description:
        "View registered farmers and their basic account information.",
      icon: "👨‍🌾",
      path: "/admin/farmers",
    },
    {
      title: "Farmers List",
      description:
        "View and manage the complete list of farmer accounts.",
      icon: "📋",
      path: "/admin/farmers-list",
    },
  ];

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="text-green-700 font-semibold mb-5 hover:text-green-900"
        >
          ← Back to Admin Dashboard
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-3xl p-6 md:p-8 shadow-lg mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl">
              👨‍🌾
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-bold">
                Farmer Management
              </h1>

              <p className="text-green-100 mt-1">
                View and manage registered farmers.
              </p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {options.map((option) => (
            <button
              key={option.path}
              type="button"
              onClick={() => navigate(option.path)}
              className="bg-white rounded-2xl shadow-md p-6 text-left border border-green-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-4xl mb-5">
                {option.icon}
              </div>

              <h2 className="text-xl font-bold text-gray-800">
                {option.title}
              </h2>

              <p className="text-gray-600 mt-3 leading-relaxed">
                {option.description}
              </p>

              <div className="mt-5 text-green-700 font-semibold">
                Open →
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}