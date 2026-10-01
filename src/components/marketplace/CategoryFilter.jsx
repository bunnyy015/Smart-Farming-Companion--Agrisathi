import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";

const categories = [
  {
    value: "all",
    labelKey: "categoryAll",
    icon: "🛍️",
  },
  {
    value: "Seeds",
    labelKey: "categorySeeds",
    icon: "🌾",
  },
  {
    value: "Fertilizer",
    labelKey: "categoryFertilizer",
    icon: "🧪",
  },
  {
    value: "Pesticide",
    labelKey: "categoryPesticide",
    icon: "🛡️",
  },
  {
    value: "Tools",
    labelKey: "categoryTools",
    icon: "🛠️",
  },
  {
    value: "Animal Feed",
    labelKey: "categoryFeed",
    icon: "🐄",
  },
];

export default function CategoryFilter({
  selectedCategory,
  onSelect,
}) {
  const language = useLanguage();

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

            {t(category.labelKey, {}, language)}
          </button>
        );
      })}
    </div>
  );
}
