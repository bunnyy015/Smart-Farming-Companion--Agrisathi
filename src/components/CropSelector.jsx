import { useMemo, useState } from "react";
import { CROP_CATALOG } from "../data/cropCatalog";
import useLanguage from "../utils/useLanguage";
import { t } from "../utils/language";

const CATEGORIES = ["All", ...new Set(CROP_CATALOG.map((crop) => crop.category))];

export default function CropSelector({ selectedCrops, onChange, disabled = false }) {
  const language = useLanguage();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const visibleCrops = useMemo(() => CROP_CATALOG.filter((crop) =>
    (category === "All" || crop.category === category) &&
    crop.name.toLowerCase().includes(search.trim().toLowerCase())
  ), [category, search]);

  const localizedCrop = (name) => {
    const key = `crop${name.replace(/[^a-z0-9]+/gi, "")}`;
    const aliases = { redgram: "cropRedGram", greengram: "cropGreenGram", blackgram: "cropBlackGram" };
    return t(aliases[name.toLowerCase().replace(/\s+/g, "")] || key, {}, language);
  };

  function toggleCrop(name) {
    if (selectedCrops.includes(name)) {
      onChange(selectedCrops.filter((crop) => crop !== name));
    } else {
      onChange([...selectedCrops, name]);
    }
  }

  return (
    <section aria-labelledby="crop-selection-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-green-700">{t("cropStep", {}, language)}</p>
          <h2 id="crop-selection-title" className="mt-1 text-2xl font-bold text-green-950">{t("whatDoYouGrow", {}, language)}</h2>
          <p className="mt-1 text-sm text-gray-600">{t("chooseCrops", {}, language)}</p>
        </div>
        <p className="rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-900" aria-live="polite">
          {selectedCrops.length} {t("selectedCount", {}, language)}
        </p>
      </div>
      <label className="mt-4 block text-sm font-medium text-gray-700">
        {t("searchCrops", {}, language)}
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder={t("searchByCropName", {}, language)} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={t("cropCategories", {}, language)}>
        {CATEGORIES.map((item) => (
          <button key={item} type="button" disabled={disabled} onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${category === item ? "border-green-700 bg-green-700 text-white" : "border-green-200 bg-white text-green-900"}`}>
            {t(`category${item}`, {}, language)}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label={t("selectCrops", {}, language)}>
        {visibleCrops.map((crop) => {
          const selected = selectedCrops.includes(crop.name);
          return (
            <button key={crop.name} type="button" disabled={disabled} aria-pressed={selected} onClick={() => toggleCrop(crop.name)} className={`flex min-h-24 items-center gap-3 rounded-xl border p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${selected ? "border-green-700 bg-green-50 ring-2 ring-green-600" : "border-gray-200 bg-white hover:border-green-400"}`}>
              {crop.image ? <img src={crop.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-2xl">{crop.icon}</span>}
              <span className="min-w-0"><span className="block font-semibold text-gray-900">{localizedCrop(crop.name)}</span><span className="text-xs text-gray-500">{t(`category${crop.category}`, {}, language)}</span></span>
              {selected && <span className="ml-auto text-green-800" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
      {!visibleCrops.length && <p className="py-8 text-center text-sm text-gray-600">{t("noCropsMatch", {}, language)}</p>}
    </section>
  );
}
