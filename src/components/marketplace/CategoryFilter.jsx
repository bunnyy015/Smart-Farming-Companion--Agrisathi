const categories = [
  {
    value: "all",
    label: "All",
    icon: "🛍️",
  },
  {
    value: "Seeds",
    label: "Seeds",
    icon: "🌾",
  },
  {
    value: "Fertilizer",
    label: "Fertilizer",
    icon: "🧪",
  },
  {
    value: "Pesticide",
    label: "Pesticide",
    icon: "🛡️",
  },
  {
    value: "Tools",
    label: "Tools",
    icon: "🛠️",
  },
  {
    value: "Animal Feed",
    label: "Feed",
    icon: "🐄",
  },
];

export default function CategoryFilter({
  selectedCategory,
  onSelect,
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((category) => {
        const active =
          selectedCategory === category.value;

        return (
          <button
            type="button"
            key={category.value}
            onClick={() => onSelect(category.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-green-700 text-white shadow"
                : "bg-white border border-green-200 text-green-800 hover:bg-green-50"
            }`}
          >
            <span className="mr-1">
              {category.icon}
            </span>

            {category.label}
          </button>
        );
      })}
    </div>
  );
}