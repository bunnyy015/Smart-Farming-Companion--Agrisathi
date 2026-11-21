import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import useLanguage from "../../utils/useLanguage";
import { getLanguage, t } from "../../utils/language";
import { speakLocalizedText } from "../../utils/speechOutput";
import { telanganaDirectory } from "../../data/telanganaAgricultureServices";
import "./NearbyServicesPage.css";

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const radius = 35000;
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

function getDeviceGpsLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error("Geolocation is unsupported"), { code: "UNSUPPORTED" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        timestamp,
      }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
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

function googleMapsDirectionsUrl(item) {
  const hasExactDestination = Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
  const hasUsefulAddress = item.address && !/address not listed|see directory/i.test(item.address);
  const hasUsefulLocality = item.locality && !/district-level contact|exact office address|district contact|see official directory/i.test(item.locality);
  const destination = hasExactDestination
    ? `${item.latitude},${item.longitude}`
    : [hasUsefulAddress ? item.address : null, item.name, hasUsefulLocality ? item.locality : null, item.district, "Telangana", "India"]
      .filter(Boolean).join(", ");
  const params = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
  // Leaving origin unset lets Google Maps use the device's live location and
  // request location permission in Maps when it needs it.
  return `https://www.google.com/maps/dir/?${params.toString()}`;
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
    getDeviceGpsLocation().then(async (point) => {
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

  function getDirections(item) {
    // Open Maps immediately so its own location permission prompt can appear;
    // waiting on a geolocation callback here can leave a blank tab stuck open.
    const mapsWindow = window.open(googleMapsDirectionsUrl(item), "_blank");
    if (!mapsWindow) {
      setRouteMessage("Your browser blocked the Maps tab. Allow pop-ups for this site, then select Get Directions again.");
      return;
    }
    mapsWindow.opener = null;
    setRoute(null);
    setRouteMessage("Google Maps opened. Allow location access in Maps to get directions from your current location.");
  }

  const allCount = visibleLive.length + visibleDirectory.length;
  return <main className="nearby-services-page min-h-screen px-4 py-5 text-slate-900 sm:px-6 lg:px-10"><div className="nearby-services-page__content mx-auto max-w-6xl">
    <header className="nearby-services-hero mb-5 rounded-3xl p-5 text-white sm:p-7"><button type="button" onClick={() => navigate("/dashboard")} className="nearby-services-back mb-4 min-h-11 rounded-lg px-3 font-semibold">← {t("farmerDashboardLabel", {}, language)}</button><h1 className="text-2xl font-bold sm:text-3xl">{t("nearbyServices", {}, language)}</h1><p className="mt-2">{t("findFarmingHelp", {}, language)}</p><p className="nearby-services-status mt-3 text-sm" role="status" aria-live="polite">{message}</p></header>
    <section className="nearby-services-search mb-4 rounded-3xl p-4 sm:p-5"><label htmlFor="nearby-place" className="block text-lg font-bold">{t("findServicesByVillage", {}, language)}</label><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="nearby-place" value={queryText} onChange={(e) => setQueryText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchTypedPlace(); }} placeholder={t("typeOrSpeakPlace", {}, language)} className="nearby-services-field min-h-12 min-w-0 flex-1 rounded-xl px-3 text-base"/><select aria-label={t("voiceInputLanguage", {}, language)} value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)} className="nearby-services-field min-h-12 rounded-xl px-3"><option value="en-IN">English</option><option value="te-IN">తెలుగు</option></select><button type="button" onClick={startRecognition} className="nearby-services-button nearby-services-button--voice min-h-12 rounded-xl px-4 font-bold">🎙 {t("speak", {}, language)}</button><button type="button" disabled={!queryText.trim() || busy} onClick={searchTypedPlace} className="nearby-services-button nearby-services-button--primary min-h-12 rounded-xl px-4 font-bold disabled:opacity-50">{busy ? t("searching", {}, language) : t("searchNearbyServices", {}, language)}</button></div></section>
    <section className="nearby-services-categories mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{groups.map(([id, icon, key]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)} className="nearby-services-category min-h-20 rounded-xl border-2 p-2 font-bold"><span className="block text-2xl">{icon}</span>{t(key, {}, language)}</button>)}</section>
    <section className="nearby-services-map mb-4 overflow-hidden rounded-3xl" aria-label={t("nearbyServicesMap", {}, language)}><MapContainer center={center ? [center.latitude, center.longitude] : [17.8, 79.1]} zoom={center ? 12 : 7} scrollWheelZoom className="h-[360px] w-full"><Recenter center={center}/><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{deviceLocation && <Marker position={[deviceLocation.latitude, deviceLocation.longitude]}><Popup>{t("yourLocation", {}, language)}</Popup></Marker>}{center && <Marker position={[center.latitude, center.longitude]}><Popup>{t("searchLocation", {}, language)}</Popup></Marker>}{visibleLive.map((item) => <Marker key={item.id} position={[item.latitude, item.longitude]} eventHandlers={{ click: () => setSelected(item) }}><Popup><b>{item.name}</b><br/>{t(({ office: "officesExperts", horticulture: "officesExperts", soil: "soilTesting", supply: "seedsFertilizer", equipment: "equipment", veterinary: "veterinary", support: "farmerSupport" })[item.category] || "allServices", {}, language)}</Popup></Marker>)}{route && <Polyline positions={route.coordinates} pathOptions={{ color: "#166534", weight: 6, opacity: 0.85 }} />}</MapContainer></section>
    {selected && <section className="nearby-services-selected mb-4 rounded-3xl p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{localizedServiceItem(selected, language).name}</h2><p className="mt-1">{t(({ office: "officesExperts", horticulture: "officesExperts", soil: "soilTesting", supply: "seedsFertilizer", equipment: "equipment", veterinary: "veterinary", support: "farmerSupport" })[selected.category] || "allServices", {}, language)}{selected.distance != null ? ` · ${selected.distance.toFixed(1)} km ${t("fromSearchPoint", {}, language)}` : ` · ${t("officialDirectoryListing", {}, language)}`}</p><p className="mt-1">{selected.address || [localizedServiceItem(selected, language).locality, selected.district].filter(Boolean).join(", ") || t("addressNotListed", {}, language)}</p></div><button type="button" onClick={() => getDirections(selected)} className="nearby-services-button nearby-services-button--primary min-h-12 rounded-xl px-5 font-bold">{t("getDirections", {}, language)}</button></div>{selected.phone && <a className="nearby-services-call mt-3 inline-flex min-h-11 items-center rounded-lg px-4 py-2 font-bold" href={`tel:${selected.phone}`}>{t("call", {}, language)} {selected.phone}</a>}{routeMessage && <p role="status" aria-live="polite" className="nearby-services-notice mt-3 rounded-lg p-3 text-sm font-semibold">{routeMessage}</p>}</section>}
    <h2 className="nearby-services-results-title mb-3 text-lg font-bold">{t("servicesFound", {}, language)}: {allCount}</h2>{busy && <p role="status" className="nearby-services-notice mb-3 rounded-xl p-4">{t("searchingNearbyServices", {}, language)}</p>}{liveError && <p role="status" className="nearby-services-alert mb-3 rounded-xl p-4">{liveError}</p>}
    <ul className="nearby-services-list grid gap-3 md:grid-cols-2">{visibleLive.map((item) => <li key={item.id} className="nearby-services-card rounded-2xl p-4"><div className="flex justify-between gap-2"><h3 className="text-lg font-bold">{item.name}</h3><b>{item.distance.toFixed(1)} km</b></div><p className="mt-1">{t(({ office: "officesExperts", horticulture: "officesExperts", soil: "soilTesting", supply: "seedsFertilizer", equipment: "equipment", veterinary: "veterinary", support: "farmerSupport" })[item.category] || "allServices", {}, language)} · {t("liveMapListing", {}, language)}</p><p className="mt-1 text-sm">{item.address || t("addressNotListed", {}, language)}</p><div className="nearby-services-actions mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setSelected(item)} className="nearby-services-button nearby-services-button--primary min-h-11 rounded-lg px-4 font-bold">{t("showOnMap", {}, language)}</button><button type="button" onClick={() => listen(item)} className="nearby-services-button nearby-services-button--voice min-h-11 rounded-lg px-4 font-bold">🔊 {t("listen", {}, language)}</button>{item.phone && <a className="nearby-services-call min-h-11 rounded-lg px-4 py-2 font-bold" href={`tel:${item.phone}`}>{t("call", {}, language)}</a>}</div></li>)}</ul>
    {visibleDirectory.length > 0 && <section className="nearby-services-directory mt-5 rounded-3xl p-4 sm:p-5"><h2 className="text-lg font-bold">{t("officialTelanganaServices", {}, language)}</h2><p className="mt-1 text-sm">{t("officialDirectoryInfo", {}, language)}</p><ul className="mt-3 grid gap-3 md:grid-cols-2">{visibleDirectory.map((item) => { const localized = localizedServiceItem(item, language); return <li key={item.id} className="nearby-services-directory-card rounded-2xl p-4"><button type="button" onClick={() => { setSelected(item); setRoute(null); setRouteMessage(""); }} className="text-left"><h3 className="font-bold underline decoration-green-700">{localized.name}</h3></button><p>{localized.locality || item.locality}, {item.district} {t("districtLabel", {}, language)}</p><p className="mt-1 text-sm">{t("officialDirectoryListing", {}, language)} · {localized.kind || item.kind}</p><div className="nearby-services-actions mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setSelected(item); setRoute(null); setRouteMessage(""); }} className="nearby-services-button nearby-services-button--primary min-h-11 rounded-lg px-4 font-bold">{t("detailsDirections", {}, language)}</button>{item.phone && <a className="nearby-services-call inline-flex min-h-11 items-center rounded-lg px-4 font-bold" href={`tel:${item.phone}`}>{t("call", {}, language)} {item.phone}</a>}</div><p className="mt-2 text-xs"><a className="nearby-services-source underline" href={item.source} target="_blank" rel="noreferrer">{t("viewSource", {}, language)}</a></p></li>; })}</ul></section>}
    {!busy && visibleLive.length === 0 && visibleDirectory.length === 0 && <section className="nearby-services-empty mt-4 rounded-3xl p-6 text-center"><div className="mb-2 text-4xl" aria-hidden="true">📍</div><h2 className="font-bold">{t("noServicesCategory", {}, language)}</h2><p className="mt-2 text-sm">{t("tryAnotherCategory", {}, language)}</p></section>}
    <p className="mt-5 text-xs text-slate-600">{t("liveMapData", {}, language)}: OpenStreetMap contributors. {t("coverageMayBeIncomplete", {}, language)}</p>
  </div></main>;
}
