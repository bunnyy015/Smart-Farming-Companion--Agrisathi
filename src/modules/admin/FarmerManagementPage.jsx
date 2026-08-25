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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <header className="bg-gradient-to-r from-green-900 via-green-800 to-green-600 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Title */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
                👨‍🌾
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Farmer Management
                </h1>

                <p className="text-green-100 mt-1">
                  View and manage registered AgriSaathi farmers.
                </p>
              </div>
            </div>

            {/* TOP ACTIONS */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="bg-white/15 hover:bg-white/25 px-4 py-2.5 rounded-xl font-semibold transition"
              >
                ← Admin Dashboard
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-green-50 transition"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </header>

        {/* PAGE INTRODUCTION */}
        <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl shrink-0">
              🌱
            </div>

            <div>
              <h2 className="text-xl font-bold text-green-900">
                Farmer Administration
              </h2>

              <p className="text-gray-600 mt-1 leading-6">
                Select an option below to view registered farmers or manage
                farmer accounts.
              </p>
            </div>
          </div>
        </section>

        {/* MANAGEMENT OPTIONS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Farmer Management Options
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Choose the section you want to open.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {options.map((option) => (
              <button
                key={option.path}
                type="button"
                onClick={() => navigate(option.path)}
                className="group bg-white rounded-2xl shadow-sm border border-green-100 p-6 text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-3xl shrink-0">
                      {option.icon}
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-green-900 group-hover:text-green-700 transition">
                        {option.title}
                      </h3>

                      <p className="text-sm text-gray-500 mt-1">
                        Farmer administration
                      </p>
                    </div>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-700 font-bold group-hover:bg-green-100 transition">
                    →
                  </div>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-5">
                  <p className="text-gray-600 leading-6">
                    {option.description}
                  </p>
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-green-700 font-semibold">
                  Open
                  <span className="group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* POLICY / INFORMATION */}
        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mt-7">
          <h2 className="font-bold text-blue-900">
            ℹ️ Farmer Management
          </h2>

          <ul className="text-sm text-blue-800 mt-2 space-y-1.5 list-disc pl-5">
            <li>
              Registered farmer accounts can be viewed from the farmer list.
            </li>

            <li>
              Farmer account management is handled separately from dealer
              management.
            </li>

            <li>
              Existing farmer information is preserved while managing the
              account.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}