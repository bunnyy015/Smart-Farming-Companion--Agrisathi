import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../../firebase";
import { t } from "../../utils/language";

const MANDI_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const DEFAULT_LIMIT = "50";

const CROP_ALIASES = {
  paddy: ["Paddy(Dhan)(Common)", "Paddy"],
  rice: ["Rice", "Paddy(Dhan)(Common)"],
  dhan: ["Paddy(Dhan)(Common)"],
  maize: ["Maize"],
  corn: ["Maize"],
  cotton: ["Cotton"],
  chilli: ["Green Chilli", "Dry Chillies"],
  chili: ["Green Chilli", "Dry Chillies"],
  tomato: ["Tomato"],
  onion: ["Onion"],
  potato: ["Potato"],
  wheat: ["Wheat"],
  groundnut: ["Groundnut"],
  soybean: ["Soyabean"],
  soyabean: ["Soyabean"],
  turmeric: ["Turmeric"],
  sugarcane: ["Sugarcane"],
};

function normalizeStateName(state) {
  const value = String(state || "").trim().toLowerCase();

  const states = {
    telangana: "Telangana",
    "andhra pradesh": "Andhra Pradesh",
    maharashtra: "Maharashtra",
    karnataka: "Karnataka",
    tamilnadu: "Tamil Nadu",
    "tamil nadu": "Tamil Nadu",
    kerala: "Kerala",
    gujarat: "Gujarat",
    punjab: "Punjab",
    odisha: "Odisha",
    orissa: "Odisha",
    bihar: "Bihar",
    "west bengal": "West Bengal",
    rajasthan: "Rajasthan",
    "uttar pradesh": "Uttar Pradesh",
    "madhya pradesh": "Madhya Pradesh",
    haryana: "Haryana",
  };

  return states[value] || state;
}

function getCropCandidates(crop) {
  const cleanCrop = String(crop || "").trim();
  const key = cleanCrop.toLowerCase();
  const aliases = CROP_ALIASES[key] || [];

  return [...new Set([cleanCrop, ...aliases].filter(Boolean))];
}

function buildMandiUrl({ state, crop, limit = DEFAULT_LIMIT }) {
  const apiKey = import.meta.env.VITE_DATA_GOV_API_KEY;
  const params = new URLSearchParams({
    "api-key": apiKey,
    format: "json",
    limit,
  });

  if (state) {
    params.set("filters[state]", normalizeStateName(state));
  }

  if (crop) {
    params.set("filters[commodity]", crop);
  }

  return `https://api.data.gov.in/resource/${MANDI_RESOURCE_ID}?${params.toString()}`;
}

async function fetchMandiRecords({ state, crop }) {
  const response = await fetch(buildMandiUrl({ state, crop }));

  if (!response.ok) {
    throw new Error("Mandi API request failed.");
  }

  const data = await response.json();
  return data?.records || [];
}

export default function MarketPricesPage() {
  const navigate = useNavigate();
  const geolocationSupported =
    typeof navigator !== "undefined" && "geolocation" in navigator;

  const [farmer, setFarmer] = useState(null);
  const [prices, setPrices] = useState([]);
  const [mills, setMills] = useState([]);
  const [search, setSearch] = useState("");
  const [stateQuery, setStateQuery] = useState("");
  const [cropQuery, setCropQuery] = useState("");
  const [location, setLocation] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingMills, setLoadingMills] = useState(false);
  const [error, setError] = useState("");
  const [priceMessage, setPriceMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState(
    geolocationSupported ? "" : "Location is not supported on this device."
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      try {
        const farmerRef = ref(database, "farmers/" + user.uid);
        const snapshot = await get(farmerRef);

        if (snapshot.exists()) {
          const farmerData = snapshot.val();
          const state = normalizeStateName(farmerData.state);
          const crop = farmerData.mainCrop || "";

          setFarmer(farmerData);
          setStateQuery(state || "");
          setCropQuery(crop);
          fetchMandiPrices({ state, crop });
        }
      } catch {
        setError("Unable to load farmer profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!geolocationSupported) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(currentLocation);
        fetchNearbyMills(currentLocation);
      },
      () => {
        setLocationMessage("Allow location permission to find nearby mills.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [geolocationSupported]);

  async function fetchMandiPrices({ state, crop }) {
    const apiKey = import.meta.env.VITE_DATA_GOV_API_KEY;

    if (!apiKey) {
      setError("Missing data.gov.in API key. Add VITE_DATA_GOV_API_KEY in .env file.");
      return;
    }

    try {
      setLoadingPrices(true);
      setError("");
      setPriceMessage("");

      const normalizedState = normalizeStateName(state);
      const cropCandidates = getCropCandidates(crop);
      let records = [];
      let matchedCrop = cropCandidates[0] || "";

      for (const cropCandidate of cropCandidates) {
        records = await fetchMandiRecords({
          state: normalizedState,
          crop: cropCandidate,
        });

        if (records.length > 0) {
          matchedCrop = cropCandidate;
          break;
        }
      }

      setPrices(records);

      if (records.length > 0 && matchedCrop !== crop) {
        setPriceMessage(`Showing Agmarknet commodity: ${matchedCrop}`);
      }
    } catch {
      setError("Unable to fetch real government mandi prices.");
    } finally {
      setLoadingPrices(false);
    }
  }

  async function fetchNearbyMills(currentLocation) {
    try {
      setLoadingMills(true);
      setLocationMessage("");

      const { latitude, longitude } = currentLocation;

      const query = `
[out:json][timeout:25];
(
  node["name"~"mill|rice mill|flour mill|oil mill|cotton mill|market|mandi", i](around:30000, ${latitude}, ${longitude});
  way["name"~"mill|rice mill|flour mill|oil mill|cotton mill|market|mandi", i](around:30000, ${latitude}, ${longitude});
  relation["name"~"mill|rice mill|flour mill|oil mill|cotton mill|market|mandi", i](around:30000, ${latitude}, ${longitude});
  node["amenity"="marketplace"](around:30000, ${latitude}, ${longitude});
  way["amenity"="marketplace"](around:30000, ${latitude}, ${longitude});
);
out center tags 20;
`;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      if (!response.ok) {
        throw new Error("Overpass API request failed.");
      }

      const data = await response.json();

      const results = (data?.elements || [])
        .map((item) => {
          const lat = item.lat || item.center?.lat;
          const lon = item.lon || item.center?.lon;

          return {
            id: `${item.type}-${item.id}`,
            name: item.tags?.name || "Nearby selling point",
            type:
              item.tags?.industrial ||
              item.tags?.amenity ||
              item.tags?.shop ||
              "mill / market",
            latitude: lat,
            longitude: lon,
          };
        })
        .filter((item) => item.latitude && item.longitude);

      setMills(results);
    } catch {
      setMills([]);
      setLocationMessage("Nearby mill data is temporarily unavailable.");
    } finally {
      setLoadingMills(false);
    }
  }

  function handlePriceSearch(event) {
    event.preventDefault();
    fetchMandiPrices({
      state: stateQuery,
      crop: cropQuery,
    });
  }

  function getGoogleMapsUrl(query) {
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  }

  const filteredPrices = prices.filter((item) => {
    const keyword = search.toLowerCase();

    return (
      String(item.commodity || "").toLowerCase().includes(keyword) ||
      String(item.market || "").toLowerCase().includes(keyword) ||
      String(item.district || "").toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="min-h-screen bg-green-50 p-4">
      <div className="bg-green-700 text-white p-4 rounded-xl shadow">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm mb-2"
        >
          Back
        </button>

        <h1 className="text-2xl font-bold">
          {t("marketPrices")}
        </h1>

        <p>
          Real government mandi prices for your selected state and crop
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mt-4 text-sm">
          {error}
        </div>
      )}

      {loadingProfile && (
        <div className="bg-white rounded-xl shadow p-5 mt-5 text-center">
          Loading farmer details...
        </div>
      )}

      {farmer && (
        <div className="bg-white rounded-xl shadow p-4 mt-5">
          <h2 className="text-lg font-bold text-green-700">
            Farmer Market Area
          </h2>

          <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-gray-500">State</p>
              <p className="font-semibold">{farmer.state}</p>
            </div>

            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-gray-500">District</p>
              <p className="font-semibold">{farmer.district}</p>
            </div>

            <div className="bg-green-50 rounded-lg p-3 col-span-2">
              <p className="text-gray-500">Main Crop</p>
              <p className="font-semibold">{farmer.mainCrop}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handlePriceSearch} className="bg-white rounded-xl shadow p-4 mt-5">
        <h2 className="text-lg font-bold text-green-700">
          Check Mandi Prices
        </h2>

        <div className="grid gap-3 mt-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="State, example: Telangana"
            value={stateQuery}
            onChange={(event) => setStateQuery(event.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            type="text"
            placeholder="Crop, example: Rice"
            value={cropQuery}
            onChange={(event) => setCropQuery(event.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <button
          type="submit"
          disabled={loadingPrices || !stateQuery.trim() || !cropQuery.trim()}
          className="w-full bg-green-700 text-white py-3 rounded-lg mt-3 font-semibold disabled:bg-gray-400"
        >
          {loadingPrices ? "Loading Prices..." : "Update Prices"}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow p-4 mt-5">
        <input
          type="text"
          placeholder="Search crop, market, district"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      <div className="mt-5">
        <h2 className="text-lg font-bold text-green-700">
          Government Mandi Prices
        </h2>

        <p className="text-sm text-gray-600 mt-1">
          Source: data.gov.in Agmarknet mandi price data
        </p>
      </div>

      {priceMessage && (
        <div className="bg-green-100 text-green-800 rounded-xl shadow p-4 mt-4 text-sm">
          {priceMessage}
        </div>
      )}

      {loadingPrices && (
        <div className="bg-white rounded-xl shadow p-5 mt-4 text-center">
          Loading real mandi prices...
        </div>
      )}

      {!loadingPrices && filteredPrices.length === 0 && (
        <div className="bg-white rounded-xl shadow p-5 mt-4 text-center text-gray-600">
          No mandi price found for this crop and state. Try another crop name.
        </div>
      )}

      <div className="space-y-4 mt-4">
        {filteredPrices.map((item, index) => (
          <div
            key={`${item.market}-${item.commodity}-${index}`}
            className="bg-white rounded-xl shadow p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-green-700">
                  {item.commodity}
                </h2>

                <p className="text-gray-600 text-sm mt-1">
                  {item.market}, {item.district}
                </p>

                <p className="text-gray-500 text-sm">
                  {item.state}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">Modal Price</p>
                <p className="text-xl font-bold text-green-700">
                  Rs. {item.modal_price}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">Min Price</p>
                <p className="font-semibold">Rs. {item.min_price}</p>
              </div>

              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">Max Price</p>
                <p className="font-semibold">Rs. {item.max_price}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div>
                <p className="text-gray-500">Variety</p>
                <p className="font-semibold">{item.variety || "NA"}</p>
              </div>

              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-semibold">{item.arrival_date || "NA"}</p>
              </div>
            </div>

            <p className="text-gray-500 text-sm mt-3">
              Price per quintal
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-green-700">
          Nearby Mills / Selling Points
        </h2>

        <p className="text-sm text-gray-600 mt-1">
          Uses your current location to find nearby mills and markets.
        </p>

        {location && (
          <p className="text-xs text-gray-500 mt-1">
            Location detected near {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
          </p>
        )}
      </div>

      {locationMessage && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg mt-4 text-sm">
          {locationMessage}
        </div>
      )}

      {loadingMills && (
        <div className="bg-white rounded-xl shadow p-5 mt-4 text-center">
          Searching nearby mills...
        </div>
      )}

      {!loadingMills && mills.length === 0 && (
        <div className="bg-white rounded-xl shadow p-5 mt-4 text-center">
          <p className="text-gray-600">
            Nearby mill data not found. Use map search below.
          </p>

          <a
            href={getGoogleMapsUrl(`${farmer?.mainCrop || "crop"} mill near me`)}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-green-700 text-white px-5 py-3 rounded-lg mt-4 font-semibold"
          >
            Search Mills on Google Maps
          </a>
        </div>
      )}

      <div className="space-y-4 mt-4">
        {mills.map((mill) => (
          <div
            key={mill.id}
            className="bg-white rounded-xl shadow p-4"
          >
            <h3 className="text-lg font-bold text-green-700">
              {mill.name}
            </h3>

            <p className="text-gray-600 text-sm mt-1">
              Type: {mill.type}
            </p>

            <a
              href={`https://www.google.com/maps?q=${mill.latitude},${mill.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block bg-green-700 text-white px-4 py-2 rounded-lg mt-3 font-semibold"
            >
              Open in Maps
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
