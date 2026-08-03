export default function QuickActions({ onNavigate }) {
  const actions = [
    {
      title: "Scan Crop",
      subtitle: "Check disease",
      icon: "🌿",
      path: "/crop-disease",
    },
    {
      title: "Dealers",
      subtitle: "Buy products",
      icon: "🏪",
      path: "/farmer/dealer-products",
    },
    {
      title: "Prices",
      subtitle: "Check mandi",
      icon: "📈",
      path: "/market-prices",
    },
    {
      title: "Orders",
      subtitle: "Track purchase",
      icon: "🛒",
      path: "/farmer/orders",
    },
  ];

  return (
    <section className="mt-5">
      <h2 className="text-lg font-bold text-green-900">
        What do you need?
      </h2>

      <div className="grid grid-cols-2 gap-3 mt-3">
        {actions.map((action) => (
          <button
            type="button"
            key={action.path}
            onClick={() => onNavigate(action.path)}
            className="min-h-28 bg-white border border-green-100 rounded-2xl shadow-sm p-4 text-left active:scale-95 transition"
          >
            <div className="text-3xl">{action.icon}</div>

            <h3 className="font-bold text-gray-900 mt-2">
              {action.title}
            </h3>

            <p className="text-xs text-gray-500 mt-1">
              {action.subtitle}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}