import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentLocation } from "../../services/currentLocationService";

const SEARCH_RADIUS_METERS = 25000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const serviceCache = new Map();
const inFlightSearches = new Map();

const CATEGORIES = [
  "Soil Testing / Soil Health Lab",
  "MRO / Revenue Office",
  "Agriculture Department Office",
  "Agricultural Extension / Officer",
  "Horticulture Department",
  "Krishi Vigyan Kendra (KVK)",
  "Government Seed / Fertilizer Center",
  "Agricultural University / Research Center",
  "Farmer Service / Assistance Center",
  "Other Government Agriculture Support",
];

const AGRICULTURE_NAME = "soil.?test|soil health|soil lab|krishi vigyan|\\bkvk\\b|agri|horticultur|mandal revenue|\\bmro\\b|tahsildar|tehsildar|taluk office|revenue office|extension|seed (center|centre|store)|fertili[sz]er|farmer service|rythu seva|research (station|center|centre)|agricultural universit|farm science";

function queryForLocation({ latitude, longitude }) {
  const around = `(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})`;
  return `[out:json][timeout:25];
(
  nwr["name"~"${AGRICULTURE_NAME}",i]${around};
  nwr["office"~"agriculture|research",i]${around};
  nwr["amenity"~"research_institute|community_centre",i]${around};
  nwr["government"="agriculture"]${around};
);
out center tags 300;`;
}

function distanceInKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = radians(to.latitude - from.latitude);
  const lonDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) *
    Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categoryFor(tags) {
  const name = String(tags.name || tags["name:en"] || "");
  const text = `${name} ${tags.office || ""} ${tags.amenity || ""} ${tags.government || ""}`.toLowerCase();
  if (/soil.?test|soil health|soil lab/.test(text)) return CATEGORIES[0];
  if (/mandal revenue|\bmro\b|tahsildar|tehsildar|taluk office|revenue office/.test(text)) return CATEGORIES[1];
  if (/horticultur/.test(text)) return CATEGORIES[4];
  if (/krishi vigyan|\bkvk\b/.test(text)) return CATEGORIES[5];
  if (/seed (center|centre|store)|fertili[sz]er/.test(text)) return CATEGORIES[6];
  if (/agricultural universit|research (station|center|centre)|research_institute/.test(text)) return CATEGORIES[7];
  if (/extension|agriculture officer|agricultural officer/.test(text)) return CATEGORIES[3];
  if (/farmer service|rythu seva|farmer assistance|farmer support/.test(text)) return CATEGORIES[8];
  if (/agri|agriculture/.test(text)) return CATEGORIES[2];
  if (tags.government === "agriculture") return CATEGORIES[9];
  return null;
}

function formatAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean)
    .join(" ");
  return [street, tags["addr:suburb"] || tags["addr:neighbourhood"], tags["addr:city"] || tags["addr:town"] || tags["addr:village"], tags["addr:district"], tags["addr:state"], tags["addr:postcode"]]
    .filter(Boolean)
    .join(", ");
}

function normalizePhone(value) {
  const phone = String(value || "").trim();
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? phone : "";
}

function prepareServices(elements, origin) {
  const found = new Map();
  for (const element of elements || []) {
    const tags = element.tags || {};
    const name = String(tags.name || tags["name:en"] || "").trim();
    const category = categoryFor(tags);
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    if (!name || !category || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const distance = distanceInKm(origin, { latitude, longitude });
    if (distance * 1000 > SEARCH_RADIUS_METERS) continue;
    const id = `${element.type}/${element.id}`;
    found.set(id, {
      id,
      name,
      category,
      latitude,
      longitude,
      distance,
      address: formatAddress(tags),
      phone: normalizePhone(tags.phone || tags["contact:phone"]),
      openingHours: tags.opening_hours || "",
    });
  }
  return [...found.values()].sort((first, second) => first.distance - second.distance);
}

function cacheKey(location) {
  return `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

async function searchNearbyServices(location) {
  const key = cacheKey(location);
  const cached = serviceCache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.services;
  if (inFlightSearches.has(key)) return inFlightSearches.get(key);

  const request = (async () => {
    const timeoutSignal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(30000)
      : undefined;
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: `data=${encodeURIComponent(queryForLocation(location))}`,
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });
    if (!response.ok) throw new Error(`Nearby places service returned ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data.elements)) throw new Error("Nearby places service returned invalid data.");
    const services = prepareServices(data.elements, location);
    serviceCache.set(key, { services, savedAt: Date.now() });
    return services;
  })();

  inFlightSearches.set(key, request);
  try {
    return await request;
  } finally {
    inFlightSearches.delete(key);
  }
}

function formatDistance(distance) {
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`;
}

function openManualMapsSearch(place) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`agriculture services ${place}`)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function NearbyServicesPage() {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [services, setServices] = useState([]);
  const [category, setCategory] = useState("all");
  const [manualPlace, setManualPlace] = useState("");
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadServices() {
    setStatus("loading");
    setErrorMessage("");
    try {
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);
      const results = await searchNearbyServices(currentLocation);
      setServices(results);
      setStatus("ready");
    } catch (error) {
      const denied = error?.code === 1;
      setErrorMessage(denied
        ? "Location permission was denied. Enable location access for this site in your browser or device settings, then try again."
        : error?.code === "UNSUPPORTED"
          ? "This device or browser does not support location. Enter a town or village below to search in Maps."
          : error?.name === "TimeoutError" || error?.code === 3
            ? "Location or nearby search timed out. Check your location settings and connection, then try again."
            : "Nearby services could not be loaded right now. Check your connection and try again.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadServices();
    // Search only when this lazy-loaded farmer page is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleServices = useMemo(
    () => category === "all" ? services : services.filter((service) => service.category === category),
    [category, services]
  );

  return (
    <main className="min-h-screen bg-[#f3f8f2] px-4 py-5 text-slate-900 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 rounded-3xl bg-gradient-to-r from-green-800 via-green-700 to-emerald-600 p-5 text-white shadow-lg sm:p-7">
          <button type="button" onClick={() => navigate("/dashboard")} className="mb-4 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10">← Farmer dashboard</button>
          <h1 className="text-2xl font-bold sm:text-3xl">Nearby Agriculture Services</h1>
          <p className="mt-2 max-w-3xl text-sm text-green-50 sm:text-base">Find mapped agricultural offices and farmer support within 25 km of your device location.</p>
          {location && <p className="mt-3 text-xs text-green-100">Using device location · {location.accuracy < 1000 ? `±${Math.round(location.accuracy)} m accuracy` : `±${(location.accuracy / 1000).toFixed(1)} km accuracy`}</p>}
        </header>

        {status === "loading" && (
          <section role="status" aria-live="polite" className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto mb-3 block h-9 w-9 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />
            <p className="font-semibold text-green-900">Finding mapped services near your current location…</p>
            <p className="mt-1 text-sm text-slate-600">Your coordinates are used for this search and are not saved to your account.</p>
          </section>
        )}

        {status === "error" && (
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold text-amber-900">Location needed to find nearby services</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{errorMessage}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={loadServices} className="min-h-11 rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-800">Enable location and retry</button>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5">
              <label htmlFor="manual-service-place" className="block text-sm font-semibold text-slate-800">Or search Maps by town / village</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id="manual-service-place" value={manualPlace} onChange={(event) => setManualPlace(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && manualPlace.trim()) openManualMapsSearch(manualPlace.trim()); }} placeholder="Enter a place name" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3" />
                <button type="button" disabled={!manualPlace.trim()} onClick={() => openManualMapsSearch(manualPlace.trim())} className="min-h-11 rounded-xl border border-green-700 px-4 font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50">Search Maps</button>
              </div>
              <p className="mt-2 text-xs text-slate-500">This opens an external map search. No places are shown here unless they are returned from the mapped data source.</p>
            </div>
          </section>
        )}

        {status === "ready" && (
          <>
            <section className="mb-4 flex flex-col justify-between gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
              <p className="text-sm font-medium text-slate-700">{services.length} mapped {services.length === 1 ? "service" : "services"} found within 25 km</p>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3">
                  <option value="all">All categories</option>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </section>

            {visibleServices.length === 0 ? (
              <section className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
                <div aria-hidden="true" className="mb-3 text-4xl">📍</div>
                <h2 className="font-bold text-green-950">No nearby services found</h2>
                <p className="mt-2 text-sm text-slate-600">No mapped services in this category were found within 25 km. Map coverage may be incomplete.</p>
              </section>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {visibleServices.map((service) => (
                  <li key={service.id} className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words text-lg font-bold text-green-950">{service.name}</h2>
                        <span className="mt-2 inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">{service.category}</span>
                      </div>
                      <span className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm font-bold text-slate-700">{formatDistance(service.distance)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-slate-600">{service.address || "Address not listed in OpenStreetMap."}</p>
                    {service.openingHours && <p className="mt-2 text-sm text-slate-600"><span className="font-semibold">Listed hours:</span> {service.openingHours}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">Get Directions</a>
                      {service.phone && <a href={`tel:${service.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">Call {service.phone}</a>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 text-xs leading-5 text-slate-500">Places and contact details come from OpenStreetMap contributors via Overpass. Coverage and opening details depend on community mapping. <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>
          </>
        )}
      </div>
    </main>
  );
}
