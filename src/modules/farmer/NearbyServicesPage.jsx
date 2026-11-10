import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { getCurrentLocation } from "../../services/currentLocationService";
import useLanguage from "../../utils/useLanguage";
import { getLanguage, t } from "../../utils/language";
import { speakLocalizedText } from "../../utils/speechOutput";
import { telanganaDirectory } from "../../data/telanganaAgricultureServices";

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const radius = 25000;
const SERVICE_CACHE_TTL_MS = 2 * 60 * 1000;
const SERVICE_CACHE_LIMIT = 8;
const serviceCache = new Map();
const serviceRequestsInFlight = new Map();
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const groups = [
  ["all", "🔎", "allServices"], ["soil", "🌱", "soilTesting"], ["office", "🏢", "officesExperts"],
  ["supply", "🌾", "seedsFertilizer"], ["equipment", "🚜", "equipment"], ["veterinary", "🐄", "veterinary"], ["support", "🤝", "farmerSupport"],
];

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo([center.latitude, center.longitude], 12); }, [center, map]);
  return null;
}

function distanceKm(a, b) {
  const r = (n) => n * Math.PI / 180;
  const dLat = r(b.latitude - a.latitude), dLon = r(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normalizeLivePlaces(elements, center) {
  const out = new Map();
  for (const element of elements || []) {
    const tags = element.tags || {};
    const name = tags.name || tags["name:en"];
    const latitude = Number(element.lat ?? element.center?.lat), longitude = Number(element.lon ?? element.center?.lon);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const text = `${name} ${tags.shop || ""} ${tags.amenity || ""} ${tags.office || ""} ${tags.craft || ""}`.toLowerCase();
    let category;
    if (/veterinary/.test(text)) category = "veterinary";
    else if (/soil|laboratory/.test(text)) category = "soil";
    else if (/tractor|machinery|agricultural_engines|equipment/.test(text)) category = "equipment";
    else if (/seed|fertili[sz]er|agrarian/.test(text)) category = "supply";
    else if (/agri|krishi|horticultur|extension|research|kvk/.test(text)) category = "office";
    else continue;
    const distance = distanceKm(center, { latitude, longitude });
    if (distance * 1000 > radius) continue;
    const id = `${element.type}/${element.id}`;
    out.set(id, { id, name, category, latitude, longitude, distance, address: [tags["addr:street"], tags["addr:city"] || tags["addr:village"]].filter(Boolean).join(", "), phone: tags.phone || tags["contact:phone"] || "", origin: "live" });
  }
  return [...out.values()].sort((a, b) => a.distance - b.distance);
}

function isTelangana(point) {
  return point.latitude >= 15.7 && point.latitude <= 19.9 && point.longitude >= 77 && point.longitude <= 81.5;
}

async function geocode(place) {
  const params = new URLSearchParams({ q: `${place}, Telangana, India`, format: "jsonv2", addressdetails: "1", limit: "5", countrycodes: "in", viewbox: "77,19.9,81.5,15.7", bounded: "1" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout?.(12000) });
  if (!response.ok) throw new Error("Place search is temporarily unavailable. Check your connection and try again.");
  const results = await response.json();
  const found = results.find((item) => isTelangana({ latitude: Number(item.lat), longitude: Number(item.lon) }));
  if (!found) throw new Error("We couldn't find that place in Telangana. Add its mandal or district name and try again.");
  return { latitude: Number(found.lat), longitude: Number(found.lon), address: found.address || {}, displayName: found.display_name };
}

async function fetchLiveServices(center) {
  // Keep the cache key precise enough that cached distance values remain
  // representative of the requested point, while preventing duplicate map
  // requests when the same location is loaded again shortly afterward.
  const cacheKey = `${center.latitude.toFixed(5)},${center.longitude.toFixed(5)}`;
  const cached = serviceCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < SERVICE_CACHE_TTL_MS) {
    serviceCache.delete(cacheKey);
    serviceCache.set(cacheKey, cached);
    return cached.services;
  }

  const pending = serviceRequestsInFlight.get(cacheKey);
  if (pending) return pending;

  const around = `(around:${radius},${center.latitude},${center.longitude})`;
  const query = `[out:json][timeout:12];(nwr["name"~"agri|krishi|soil|fertili[sz]er|seed|horticultur|veterinary|tractor|machinery|kvk|extension|farm service",i]${around};nwr["amenity"="veterinary"]${around};nwr["shop"~"agrarian|farm|machinery"]${around};);out center tags 250;`;
  const request = (async () => {
    let lastError;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
          body: `data=${encodeURIComponent(query)}`,
          signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(14000) : undefined,
        });
        if (!response.ok) throw new Error(`Live map server returned ${response.status}.`);
        const data = await response.json();
        if (!Array.isArray(data.elements)) throw new Error("Live map server returned invalid data.");
        const services = normalizeLivePlaces(data.elements, center);
        serviceCache.set(cacheKey, { services, savedAt: Date.now() });
        while (serviceCache.size > SERVICE_CACHE_LIMIT) {
          serviceCache.delete(serviceCache.keys().next().value);
        }
        return services;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(lastError?.name === "TimeoutError"
      ? "Live map servers timed out. Official directory entries are still shown below. Please try again later."
      : "Live map listings could not be reached. Official directory entries are still shown below.");
  })();

  serviceRequestsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (serviceRequestsInFlight.get(cacheKey) === request) {
      serviceRequestsInFlight.delete(cacheKey);
    }
  }
}

function relevantDirectory(address) {
  const detail = [address.state_district, address.county, address.city_district, address.municipality, address.district].filter(Boolean).join(" ").toLowerCase();
  if (!detail) return [];
  return telanganaDirectory.filter((entry) => detail.includes(entry.district.toLowerCase()) || (entry.district === "Hanamkonda" && /warangal|hanamkonda/.test(detail)));
}

function localizedServiceItem(item, language) {
  if (item.id?.startsWith("dao-")) {
    return {
      name: `${item.district} ${t("districtAgricultureOfficer", {}, language)}`,
      kind: t("districtAgricultureOffice", {}, language),
      locality: `${t("districtLevelContact", {}, language)} ${t("exactAddressNotListed", {}, language)}`,
    };
  }
  if (item.id?.startsWith("horti-")) {
    return {
      name: `${item.district} ${t("districtHorticultureOfficer", {}, language)}`,
      kind: t("horticultureOffice", {}, language),
      locality: t("districtContactSeeDirectory", {}, language),
    };
  }
  if (item.id?.startsWith("soil-")) {
    return {
      name: t("soilTestingLaboratory", {}, language),
      kind: item.locality?.includes("AMC")
        ? t("agricultureMarketSoilLab", {}, language)
        : t("agricultureDepartmentSoilLab", {}, language),
    };
  }
  return { name: item.name, kind: item.kind, locality: item.locality };
}

export default function NearbyServicesPage() {
  const navigate = useNavigate();
  const language = useLanguage();
  const [queryText, setQueryText] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState(language === "te" ? "te-IN" : "en-IN");
  const [message, setMessage] = useState("");
  const [center, setCenter] = useState(null);
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeMessage, setRouteMessage] = useState("");
  const [routing, setRouting] = useState(false);
  const [live, setLive] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState(false);
  const [liveError, setLiveError] = useState("");

  async function searchAt(point, label, address = {}) {
    setCenter(point);
    setDirectory(isTelangana(point) ? relevantDirectory(address) : []);
    setSelected(null);
    setRoute(null);
    setRouteMessage("");
    setBusy(true);
    setMessage(t("showingServicesNearPlace", { place: label }, language));
    setLiveError("");
    try { setLive(await fetchLiveServices(point)); }
    catch (error) { setLive([]); setLiveError(t(error.name === "TimeoutError" ? "liveMapTimeout" : "liveMapUnavailable", {}, language)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    getCurrentLocation().then(async (point) => {
      if (!active) return;
      setDeviceLocation(point);
      if (isTelangana(point)) {
        const reverse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${point.latitude}&longitude=${point.longitude}&localityLanguage=en`).then((r) => r.ok ? r.json() : {}).catch(() => ({}));
        if (active) setDirectory(relevantDirectory({ state_district: reverse.localityInfo?.administrative?.[1]?.name, county: reverse.localityInfo?.administrative?.[2]?.name, city_district: reverse.city }));
      }
      if (active) { setCenter(point); setMessage(t("showingNearbyDevice", {}, getLanguage())); setBusy(true); try { setLive(await fetchLiveServices(point)); } catch (error) { setLiveError(t(error.name === "TimeoutError" ? "liveMapTimeout" : "liveMapUnavailable", {}, getLanguage())); } finally { if (active) setBusy(false); } }
    }).catch(() => { if (active) setMessage(t("locationUnavailableSearch", {}, getLanguage())); });
    return () => { active = false; };
  }, []);

  const visibleLive = useMemo(() => category === "all" ? live : live.filter((item) => item.category === category), [live, category]);
  const visibleDirectory = useMemo(() => category === "all" ? directory : directory.filter((item) => category === "office" ? ["office", "horticulture"].includes(item.category) : item.category === category), [directory, category]);

  function startRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setMessage(t("voiceInputUnsupported", {}, language)); return; }
    const recognition = new Recognition();
    recognition.lang = voiceLanguage;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let timer;
    recognition.onstart = () => { setMessage(t("listeningPrompt", {}, language)); timer = window.setTimeout(() => { recognition.stop(); setMessage(t("listeningTimedOut", {}, language)); }, 10000); };
    recognition.onresult = (event) => { const text = event.results?.[0]?.[0]?.transcript?.trim(); if (text) { setQueryText(text); setMessage(t("speechConverted", {}, language)); } else setMessage(t("noSpeechDetected", {}, language)); };
    recognition.onerror = (event) => { window.clearTimeout(timer); const errors = { "not-allowed": "microphonePermissionHelp", "service-not-allowed": "speechBlocked", "audio-capture": "microphoneMissing", "no-speech": "noSpeechDetected", network: "speechInternetNeeded", "language-not-supported": "voiceLanguageUnsupported" }; setMessage(t(errors[event.error] || "voiceInputStopped", {}, language)); };
    recognition.onend = () => window.clearTimeout(timer);
    try { recognition.start(); } catch { setMessage(t("microphoneStartFailed", {}, language)); }
  }

  async function searchTypedPlace() {
    if (!queryText.trim() || busy) return;
    setBusy(true); setMessage(t("findingPlace", {}, language));
    try { const result = await geocode(queryText.trim()); setQueryText(queryText.trim()); await searchAt(result, result.displayName, result.address); }
    catch (error) { setMessage(t(error.name === "TimeoutError" ? "placeSearchTimeout" : "placeSearchFailed", {}, language)); }
    finally { setBusy(false); }
  }

  async function listen(item) {
    const km = item.distance < 1 ? `${Math.round(item.distance * 1000)} meters` : `${item.distance.toFixed(1)} kilometers`;
    await speakLocalizedText(`${item.name}. ${item.category}. ${km} away.`, language);
  }

  async function getDirections(item) {
    if (!deviceLocation) {
      setRouteMessage(t("locationAccessNeeded", {}, language));
      return;
    }
    setRouting(true); setRouteMessage(t("findingRoute", {}, language)); setRoute(null);
    try {
      let destination = item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null;
      if (!destination && item.locality && !/exact office address not listed|district contact/i.test(item.locality)) {
        const placeResult = await geocode(`${item.name} ${item.locality} ${item.district}`);
        if (!placeResult.displayName.toLowerCase().includes(item.district.toLowerCase())) throw new Error("service-location-unverified");
        destination = placeResult;
      }
      if (!destination) throw new Error("directory-address-unverified");
      const coords = `${deviceLocation.longitude},${deviceLocation.latitude};${destination.longitude},${destination.latitude}`;
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal: AbortSignal.timeout?.(15000) });
      if (!response.ok) throw new Error("routing-service-unavailable");
      const data = await response.json();
      if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) throw new Error("road-route-not-found");
      const selectedRoute = data.routes[0];
      setRoute({ coordinates: selectedRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance: selectedRoute.distance, duration: selectedRoute.duration });
      setCenter(destination);
      setRouteMessage(t("routeSummary", { distance: (selectedRoute.distance / 1000).toFixed(1), minutes: Math.max(1, Math.round(selectedRoute.duration / 60)) }, language));
    } catch (error) {
      const errorKeys = { "service-location-unverified": "verifiedServiceLocationRequired", "directory-address-unverified": "directoryAddressUnverified", "routing-service-unavailable": "routingUnavailable", "road-route-not-found": "roadRouteNotFound" };
      setRouteMessage(t(error.name === "TimeoutError" ? "routeSearchTimedOut" : errorKeys[error.message] || "directionsFailed", {}, language));
    } finally { setRouting(false); }
  }

  const allCount = visibleLive.length + visibleDirectory.length;
  return <main className="min-h-screen bg-[#f3f8f2] px-4 py-5 text-slate-900 sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl">
    <header className="mb-5 rounded-3xl bg-gradient-to-r from-green-800 via-green-700 to-emerald-600 p-5 text-white shadow-lg"><button type="button" onClick={() => navigate("/dashboard")} className="mb-4 min-h-11 rounded-lg border border-white/40 px-3 font-semibold">← {t("farmerDashboardLabel", {}, language)}</button><h1 className="text-2xl font-bold sm:text-3xl">{t("nearbyServices", {}, language)}</h1><p className="mt-2">{t("findFarmingHelp", {}, language)}</p><p className="mt-2 text-sm" role="status" aria-live="polite">{message}</p></header>
    <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"><label htmlFor="nearby-place" className="block text-lg font-bold">{t("findServicesByVillage", {}, language)}</label><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="nearby-place" value={queryText} onChange={(e) => setQueryText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchTypedPlace(); }} placeholder={t("typeOrSpeakPlace", {}, language)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base"/><select aria-label={t("voiceInputLanguage", {}, language)} value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3"><option value="en-IN">English</option><option value="te-IN">తెలుగు</option></select><button type="button" onClick={startRecognition} className="min-h-12 rounded-xl border-2 border-amber-600 bg-white px-4 font-bold">🎙 {t("speak", {}, language)}</button><button type="button" disabled={!queryText.trim() || busy} onClick={searchTypedPlace} className="min-h-12 rounded-xl bg-green-700 px-4 font-bold text-white disabled:opacity-50">{busy ? t("searching", {}, language) : t("searchNearbyServices", {}, language)}</button></div></section>
    <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{groups.map(([id, icon, key]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)} className={`min-h-20 rounded-xl border-2 p-2 font-bold ${category === id ? "border-green-700 bg-green-50" : "border-slate-200 bg-white"}`}><span className="block text-2xl">{icon}</span>{t(key, {}, language)}</button>)}</section>
    <section className="mb-4 overflow-hidden rounded-2xl border border-green-100 bg-white" aria-label={t("nearbyServicesMap", {}, language)}><MapContainer center={center ? [center.latitude, center.longitude] : [17.8, 79.1]} zoom={center ? 12 : 7} scrollWheelZoom className="h-[360px] w-full"><Recenter center={center}/><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{deviceLocation && <Marker position={[deviceLocation.latitude, deviceLocation.longitude]}><Popup>{t("yourLocation", {}, language)}</Popup></Marker>}{center && <Marker position={[center.latitude, center.longitude]}><Popup>{t("searchLocation", {}, language)}</Popup></Marker>}{visibleLive.map((item) => <Marker key={item.id} position={[item.latitude, item.longitude]} eventHandlers={{ click: () => setSelected(item) }}><Popup><b>{item.name}</b><br/>{t(({ office: "officesExperts", horticulture: "officesExperts", soil: "soilTesting", supply: "seedsFertilizer", equipment: "equipment", veterinary: "veterinary", support: "farmerSupport" })[item.category] || "allServices", {}, language)}</Popup></Marker>)}{route && <Polyline positions={route.coordinates} pathOptions={{ color: "#166534", weight: 6, opacity: 0.85 }} />}</MapContainer></section>
    {selected && <section className="mb-4 rounded-2xl border-2 border-green-700 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{localizedServiceItem(selected, language).name}</h2><p className="mt-1">{t(({ office: "officesExperts", horticulture: "officesExperts", soil: "soilTesting", supply: "seedsFertilizer", equipment: "equipment", veterinary: "veterinary", support: "farmerSupport" })[selected.category] || "allServices", {}, language)}{selected.distance != null ? ` · ${selected.distance.toFixed(1)} km ${t("fromSearchPoint", {}, language)}` : ` · ${t("officialDirectoryListing", {}, language)}`}</p><p className="mt-1">{selected.address || [localizedServiceItem(selected, language).locality, selected.district].filter(Boolean).join(", ") || t("addressNotListed", {}, language)}</p></div><button type="button" disabled={routing} onClick={() => getDirections(selected)} className="min-h-12 rounded-xl bg-green-700 px-5 font-bold text-white disabled:opacity-50">{routing ? t("findingRoute", {}, language) : t("getDirections", {}, language)}</button></div>{selected.phone && <a className="mt-3 inline-block min-h-11 rounded-lg border-2 border-green-700 px-4 py-2 font-bold text-green-800" href={`tel:${selected.phone}`}>{t("call", {}, language)} {selected.phone}</a>}{routeMessage && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-semibold">{routeMessage}</p>}</section>}
    <h2 className="mb-3 text-lg font-bold">{t("servicesFound", {}, language)}: {allCount}</h2>{busy && <p role="status" className="mb-3 rounded-xl bg-white p-4">{t("searchingNearbyServices", {}, language)}</p>}{liveError && <p role="status" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-4">{liveError}</p>}
    <ul className="grid gap-3 md:grid-cols-2">{visibleLive.map((item) => <li key={item.id} className="rounded-2xl border border-green-100 bg-white p-4"><div className="flex justify-between gap-2"><h3 className="text-lg font-bold">{item.name}</h3><b>{item.distance.toFixed(1)} km</b></div><p className="mt-1">{t(({ office: "officesExperts", horticulture: "officesExperts", soil: "soilTesting", supply: "seedsFertilizer", equipment: "equipment", veterinary: "veterinary", support: "farmerSupport" })[item.category] || "allServices", {}, language)} · {t("liveMapListing", {}, language)}</p><p className="mt-1 text-sm">{item.address || t("addressNotListed", {}, language)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setSelected(item)} className="min-h-11 rounded-lg bg-green-700 px-4 font-bold text-white">{t("showOnMap", {}, language)}</button><button type="button" onClick={() => listen(item)} className="min-h-11 rounded-lg border-2 border-amber-500 px-4 font-bold">🔊 {t("listen", {}, language)}</button>{item.phone && <a className="min-h-11 rounded-lg border px-4 py-2 font-bold" href={`tel:${item.phone}`}>{t("call", {}, language)}</a>}</div></li>)}</ul>
    {visibleDirectory.length > 0 && <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5"><h2 className="text-lg font-bold">{t("officialTelanganaServices", {}, language)}</h2><p className="mt-1 text-sm">{t("officialDirectoryInfo", {}, language)}</p><ul className="mt-3 grid gap-3 md:grid-cols-2">{visibleDirectory.map((item) => { const localized = localizedServiceItem(item, language); return <li key={item.id} className="rounded-xl border bg-white p-4"><button type="button" onClick={() => { setSelected(item); setRoute(null); setRouteMessage(""); }} className="text-left"><h3 className="font-bold underline decoration-green-700">{localized.name}</h3></button><p>{localized.locality || item.locality}, {item.district} {t("districtLabel", {}, language)}</p><p className="mt-1 text-sm">{t("officialDirectoryListing", {}, language)} · {localized.kind || item.kind}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setSelected(item); setRoute(null); setRouteMessage(""); }} className="min-h-11 rounded-lg bg-green-700 px-4 font-bold text-white">{t("detailsDirections", {}, language)}</button>{item.phone && <a className="inline-flex min-h-11 items-center rounded-lg border-2 border-green-700 px-4 font-bold text-green-800" href={`tel:${item.phone}`}>{t("call", {}, language)} {item.phone}</a>}</div><p className="mt-2 text-xs"><a className="underline" href={item.source} target="_blank" rel="noreferrer">{t("viewSource", {}, language)}</a></p></li>; })}</ul></section>}
    {!busy && visibleLive.length === 0 && visibleDirectory.length === 0 && <section className="mt-4 rounded-2xl bg-white p-6 text-center"><h2 className="font-bold">{t("noServicesCategory", {}, language)}</h2><p className="mt-2 text-sm">{t("tryAnotherCategory", {}, language)}</p></section>}
    <p className="mt-5 text-xs text-slate-600">{t("liveMapData", {}, language)}: OpenStreetMap contributors. {t("coverageMayBeIncomplete", {}, language)}</p>
  </div></main>;
}
