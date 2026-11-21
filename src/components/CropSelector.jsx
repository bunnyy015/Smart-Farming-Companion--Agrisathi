import { useMemo, useState } from "react";
import { CROP_CATALOG } from "../data/cropCatalog";
import useLanguage from "../utils/useLanguage";
import { t } from "../utils/language";

const CATEGORIES = ["All", ...new Set(CROP_CATALOG.map((crop) => crop.category))];

export default function CropSelector({ selectedCrops, onChange, disabled = false }) {
  const language = useLanguage();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [customCrop, setCustomCrop] = useState("");
  const safeSelectedCrops = Array.isArray(selectedCrops) ? selectedCrops : [];
  const visibleCrops = useMemo(() => CROP_CATALOG.filter((crop) =>
    (category === "All" || crop.category === category) &&
    crop.name.toLowerCase().includes(search.trim().toLowerCase())
  ), [category, search]);

  const localizedCrop = (name) => {
    const key = `crop${name.replace(/[^a-z0-9]+/gi, "")}`;
    const aliases = { redgram: "cropRedGram", greengram: "cropGreenGram", blackgram: "cropBlackGram" };
    const translationKey = aliases[name.toLowerCase().replace(/\s+/g, "")] || key;
    const translated = t(translationKey, {}, language);
    return translated === translationKey ? name : translated;
  };

  function toggleCrop(name) {
    if (safeSelectedCrops.includes(name)) {
      onChange(safeSelectedCrops.filter((crop) => crop !== name));
    } else {
      onChange([...safeSelectedCrops, name]);
    }
  }

  function addCustomCrop() {
    const name = customCrop.trim().replace(/\s+/g, " ");
    if (!name || safeSelectedCrops.some((crop) => crop.toLowerCase() === name.toLowerCase())) return;
    onChange([...safeSelectedCrops, name]);
    setCustomCrop("");
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
          {safeSelectedCrops.length} {t("selectedCount", {}, language)}
        </p>
      </div>
      <label className="mt-4 block text-sm font-medium text-gray-700">
        {t("searchCrops", {}, language)}
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder={t("searchByCropName", {}, language)} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={t("cropCategories", {}, language)}>
        {CATEGORIES.map((item) => (
          <button key={item} type="button" disabled={disabled} onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${category === item ? "border-green-700 bg-green-700 text-white" : "border-green-200 bg-white text-green-900"}`}>
            {(() => { const key = `category${item}`; const translated = t(key, {}, language); return translated === key ? item : translated; })()}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label={t("selectCrops", {}, language)}>
        {visibleCrops.map((crop) => {
          const selected = safeSelectedCrops.includes(crop.name);
          return (
            <button key={crop.name} type="button" disabled={disabled} aria-pressed={selected} onClick={() => toggleCrop(crop.name)} className={`flex min-h-24 items-center gap-3 rounded-xl border p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${selected ? "border-green-700 bg-green-50 ring-2 ring-green-600" : "border-gray-200 bg-white hover:border-green-400"}`}>
              {crop.image ? <img src={crop.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-2xl">{crop.icon}</span>}
              <span className="min-w-0"><span className="block font-semibold text-gray-900">{localizedCrop(crop.name)}</span><span className="text-xs text-gray-500">{(() => { const key = `category${crop.category}`; const translated = t(key, {}, language); return translated === key ? crop.category : translated; })()}</span></span>
              {selected && <span className="ml-auto text-green-800" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
      {!visibleCrops.length && <p className="py-8 text-center text-sm text-gray-600">{t("noCropsMatch", {}, language)}</p>}
      <div className="mt-4 rounded-xl border border-dashed border-green-300 bg-green-50/70 p-4">
        <label htmlFor="custom-crop-name" className="block text-sm font-semibold text-green-950">Can’t find your crop? Add it here.</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="custom-crop-name" type="text" value={customCrop} onChange={(event) => setCustomCrop(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomCrop(); } }} disabled={disabled} maxLength={60} placeholder="Enter a crop name" className="min-w-0 flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700" />
          <button type="button" onClick={addCustomCrop} disabled={disabled || !customCrop.trim()} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">Add crop</button>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-green-100 bg-white p-4">
        <h3 className="text-sm font-bold text-green-950">Selected crops ({safeSelectedCrops.length})</h3>
        {safeSelectedCrops.length ? <ul className="mt-2 flex flex-wrap gap-2">{safeSelectedCrops.map((crop) => <li key={crop}><button type="button" disabled={disabled} onClick={() => toggleCrop(crop)} aria-label={`Remove ${crop}`} className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-900 transition hover:border-red-300 hover:bg-red-50 hover:text-red-800 disabled:opacity-60">{localizedCrop(crop)} <span aria-hidden="true">×</span></button></li>)}</ul> : <p className="mt-2 text-sm text-gray-600">No crops selected yet.</p>}
      </div>
    </section>
  );
}
