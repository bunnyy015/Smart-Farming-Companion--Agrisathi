import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const MANDI_RESOURCE_ID =
  "9ef84268-d588-465a-a308-a864a43d0070";

const RECORD_LIMIT = 1000;
const SELLING_POINT_RADIUS = 50000;

const STATE_NAMES = {
  telangana: "Telangana",
  "andhra pradesh": "Andhra Pradesh",
  maharashtra: "Maharashtra",
  karnataka: "Karnataka",
  "tamil nadu": "Tamil Nadu",
  tamilnadu: "Tamil Nadu",
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
  chhattisgarh: "Chhattisgarh",
  jharkhand: "Jharkhand",
  assam: "Assam",
  goa: "Goa",
};

const CATEGORY_ICONS = {
  cereals: "🌾",
  pulses: "🫘",
  vegetables: "🥬",
  fruits: "🍎",
  spices: "🌶️",
  oilseeds: "🌻",
  fibre: "🧶",
  other: "🌱",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeStateName(value) {
  const normalized = normalizeText(value);

  return STATE_NAMES[normalized] || String(value || "").trim();
}

function normalizeDistrictName(value) {
  return String(value || "")
    .replace(/\s+district$/i, "")
    .trim();
}

function numberValue(value) {
  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function getCropCategory(commodity) {
  const value = normalizeText(commodity);

  const cereals = [
    "paddy",
    "rice",
    "wheat",
    "maize",
    "jowar",
    "bajra",
    "ragi",
    "barley",
    "millet",
    "sorghum",
  ];

  const pulses = [
    "gram",
    "dal",
    "tur",
    "arhar",
    "red gram",
    "green gram",
    "black gram",
    "lentil",
    "moong",
    "urad",
    "chickpea",
  ];

  const vegetables = [
    "tomato",
    "onion",
    "potato",
    "brinjal",
    "cabbage",
    "cauliflower",
    "carrot",
    "beans",
    "chilli",
    "cucumber",
    "okra",
    "ladies finger",
    "pumpkin",
    "gourd",
  ];

  const fruits = [
    "mango",
    "banana",
    "apple",
    "orange",
    "grapes",
    "papaya",
    "watermelon",
    "guava",
    "pomegranate",
    "lemon",
  ];

  const spices = [
    "turmeric",
    "pepper",
    "coriander",
    "cumin",
    "ginger",
    "garlic",
    "cardamom",
    "chillies",
  ];

  const oilseeds = [
    "groundnut",
    "soyabean",
    "soybean",
    "sunflower",
    "mustard",
    "sesamum",
    "sesame",
    "castor",
  ];

  const fibre = ["cotton", "jute"];

  if (cereals.some((item) => value.includes(item))) {
    return "cereals";
  }

  if (pulses.some((item) => value.includes(item))) {
    return "pulses";
  }

  if (vegetables.some((item) => value.includes(item))) {
    return "vegetables";
  }

  if (fruits.some((item) => value.includes(item))) {
    return "fruits";
  }

  if (spices.some((item) => value.includes(item))) {
    return "spices";
  }

  if (oilseeds.some((item) => value.includes(item))) {
    return "oilseeds";
  }

  if (fibre.some((item) => value.includes(item))) {
    return "fibre";
  }

  return "other";
}

function getCommodityIcon(commodity) {
  return CATEGORY_ICONS[getCropCategory(commodity)] || "🌱";
}

function parseArrivalDate(value) {
  if (!value) {
    return 0;
  }

  const text = String(value).trim();

  const parts = text.split(/[/-]/);

  if (parts.length === 3) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    const third = Number(parts[2]);

    if (
      Number.isFinite(first) &&
      Number.isFinite(second) &&
      Number.isFinite(third)
    ) {
      const year =
        third < 100 ? 2000 + third : third;

      return new Date(
        year,
        second - 1,
        first
      ).getTime();
    }
  }

  const timestamp = new Date(text).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function calculateDistance(
  firstLatitude,
  firstLongitude,
  secondLatitude,
  secondLongitude
) {
  const earthRadius = 6371;

  const latitudeDifference =
    ((secondLatitude - firstLatitude) * Math.PI) /
    180;

  const longitudeDifference =
    ((secondLongitude - firstLongitude) * Math.PI) /
    180;

  const firstLatitudeRadians =
    (firstLatitude * Math.PI) / 180;

  const secondLatitudeRadians =
    (secondLatitude * Math.PI) / 180;

  const calculation =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDifference / 2) ** 2;

  const angle =
    2 *
    Math.atan2(
      Math.sqrt(calculation),
      Math.sqrt(1 - calculation)
    );

  return earthRadius * angle;
}

function buildGovernmentMandiUrl({
  state,
  district,
  offset = 0,
}) {
  const apiKey =
    import.meta.env.VITE_DATA_GOV_API_KEY;

  const parameters = new URLSearchParams({
    "api-key": apiKey,
    format: "json",
    limit: String(RECORD_LIMIT),
    offset: String(offset),
  });

  if (state) {
    parameters.set(
      "filters[state]",
      normalizeStateName(state)
    );
  }

  if (district) {
    parameters.set(
      "filters[district]",
      normalizeDistrictName(district)
    );
  }

  return (
    `https://api.data.gov.in/resource/` +
    `${MANDI_RESOURCE_ID}?${parameters.toString()}`
  );
}

async function fetchGovernmentRecords({
  state,
  district,
}) {
  const response = await fetch(
    buildGovernmentMandiUrl({
      state,
      district,
    })
  );

  if (!response.ok) {
    throw new Error(
      "Government mandi service request failed."
    );
  }

  const result = await response.json();

  return Array.isArray(result?.records)
    ? result.records
    : [];
}

export default function MarketPricesPage() {
  const navigate = useNavigate();

  const [farmer, setFarmer] = useState(null);

  const [location, setLocation] = useState(null);
  const [detectedPlace, setDetectedPlace] =
    useState(null);

  const [prices, setPrices] = useState([]);
  const [sellingPoints, setSellingPoints] =
    useState([]);

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("all");

  const [selectedDistrict, setSelectedDistrict] =
    useState("");

  const [selectedMarket, setSelectedMarket] =
    useState("");

  const [sortMode, setSortMode] =
    useState("latest");

  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] =
    useState(false);
  const [loadingSellingPoints, setLoadingSellingPoints] =
    useState(false);
  const [detectingLocation, setDetectingLocation] =
    useState(false);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    initializePage();
  }, []);

  const districts = useMemo(() => {
    return [
      ...new Set(
        prices
          .map((item) => item.district)
          .filter(Boolean)
      ),
    ].sort((first, second) =>
      first.localeCompare(second)
    );
  }, [prices]);

  const markets = useMemo(() => {
    return [
      ...new Set(
        prices
          .filter(
            (item) =>
              !selectedDistrict ||
              normalizeText(item.district) ===
                normalizeText(selectedDistrict)
          )
          .map((item) => item.market)
          .filter(Boolean)
      ),
    ].sort((first, second) =>
      first.localeCompare(second)
    );
  }, [prices, selectedDistrict]);

  const filteredPrices = useMemo(() => {
    const query = normalizeText(searchText);

    const results = prices.filter((item) => {
      if (
        selectedCategory !== "all" &&
        item.category !== selectedCategory
      ) {
        return false;
      }

      if (
        selectedDistrict &&
        normalizeText(item.district) !==
          normalizeText(selectedDistrict)
      ) {
        return false;
      }

      if (
        selectedMarket &&
        normalizeText(item.market) !==
          normalizeText(selectedMarket)
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        item.commodity,
        item.variety,
        item.market,
        item.district,
        item.state,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

    return [...results].sort((first, second) => {
      if (sortMode === "highest") {
        return (
          second.modalPrice - first.modalPrice
        );
      }

      if (sortMode === "lowest") {
        return first.modalPrice - second.modalPrice;
      }

      if (sortMode === "crop") {
        return first.commodity.localeCompare(
          second.commodity
        );
      }

      return (
        second.arrivalTimestamp -
        first.arrivalTimestamp
      );
    });
  }, [
    prices,
    searchText,
    selectedCategory,
    selectedDistrict,
    selectedMarket,
    sortMode,
  ]);

  const groupedCropSummary = useMemo(() => {
    const cropMap = new Map();

    filteredPrices.forEach((item) => {
      const key = normalizeText(item.commodity);

      if (!cropMap.has(key)) {
        cropMap.set(key, {
          commodity: item.commodity,
          icon: item.icon,
          category: item.category,
          records: [],
        });
      }

      cropMap.get(key).records.push(item);
    });

    return Array.from(cropMap.values())
      .map((group) => {
        const records = group.records;

        const highest = records.reduce(
          (best, item) =>
            item.modalPrice > best.modalPrice
              ? item
              : best,
          records[0]
        );

        const lowest = records.reduce(
          (best, item) =>
            item.modalPrice < best.modalPrice
              ? item
              : best,
          records[0]
        );

        const average =
          records.reduce(
            (sum, item) =>
              sum + item.modalPrice,
            0
          ) / records.length;

        return {
          ...group,
          highest,
          lowest,
          average,
          marketsCount: new Set(
            records.map((item) => item.market)
          ).size,
        };
      })
      .sort((first, second) =>
        first.commodity.localeCompare(
          second.commodity
        )
      );
  }, [filteredPrices]);

  const overallStatistics = useMemo(() => {
    const allModalPrices = filteredPrices
      .map((item) => item.modalPrice)
      .filter((value) => value > 0);

    const uniqueCrops = new Set(
      filteredPrices.map((item) =>
        normalizeText(item.commodity)
      )
    ).size;

    const uniqueMarkets = new Set(
      filteredPrices.map((item) =>
        normalizeText(item.market)
      )
    ).size;

    const highestRecord =
      filteredPrices.length > 0
        ? filteredPrices.reduce(
            (best, item) =>
              item.modalPrice > best.modalPrice
                ? item
                : best,
            filteredPrices[0]
          )
        : null;

    const averagePrice =
      allModalPrices.length > 0
        ? allModalPrices.reduce(
            (sum, value) => sum + value,
            0
          ) / allModalPrices.length
        : 0;

    return {
      crops: uniqueCrops,
      markets: uniqueMarkets,
      highestRecord,
      averagePrice,
    };
  }, [filteredPrices]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 6000);
  }

  async function initializePage() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const profileSnapshot = await get(
        ref(database, `users/${currentUser.uid}`)
      );

      if (
        !profileSnapshot.exists() ||
        profileSnapshot.val().role !== "farmer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });
        return;
      }

      const farmerProfile = {
        uid: currentUser.uid,
        ...profileSnapshot.val(),
      };

      setFarmer(farmerProfile);

      await detectLocationAndLoadData(
        farmerProfile
      );
    } catch (error) {
      console.error(
        "Market page initialization error:",
        error
      );

      showMessage(
        "error",
        "Market information could not be loaded."
      );

      setLoading(false);
    }
  }

  async function detectLocationAndLoadData(
    farmerProfile = farmer
  ) {
    if (!navigator.geolocation) {
      const profileState =
        farmerProfile?.state || "";

      const profileDistrict =
        farmerProfile?.district || "";

      if (profileState) {
        await loadAllCropPrices({
          state: profileState,
          district: profileDistrict,
        });
      }

      showMessage(
        "warning",
        "Location is unavailable. Showing prices from your saved profile."
      );

      setLoading(false);
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(currentLocation);

        try {
          const place =
            await reverseGeocodeLocation(
              currentLocation
            );

          setDetectedPlace(place);

          const state =
            place.state ||
            farmerProfile?.state ||
            "";

          const district =
            place.district ||
            farmerProfile?.district ||
            "";

          await Promise.all([
            loadAllCropPrices({
              state,
              district,
            }),

            loadNearbySellingPoints(
              currentLocation
            ),
          ]);
        } catch (error) {
          console.error(
            "Detected location loading error:",
            error
          );

          const profileState =
            farmerProfile?.state || "";

          const profileDistrict =
            farmerProfile?.district || "";

          if (profileState) {
            await loadAllCropPrices({
              state: profileState,
              district: profileDistrict,
            });
          }

          showMessage(
            "warning",
            "Exact location could not be identified. Showing prices from your saved profile."
          );
        } finally {
          setDetectingLocation(false);
          setLoading(false);
        }
      },

      async () => {
        const profileState =
          farmerProfile?.state || "";

        const profileDistrict =
          farmerProfile?.district || "";

        if (profileState) {
          await loadAllCropPrices({
            state: profileState,
            district: profileDistrict,
          });
        }

        showMessage(
          "warning",
          "Allow location access to find nearby markets. Saved profile location is being used."
        );

        setDetectingLocation(false);
        setLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  }

  async function reverseGeocodeLocation({
    latitude,
    longitude,
  }) {
    const parameters = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    });

    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?${parameters.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        "Location identification failed."
      );
    }

    const result = await response.json();

    const administrative =
      result?.localityInfo?.administrative || [];

    function findAdministrative(keywords) {
      return (
        administrative.find((item) => {
          const value = normalizeText(
            `${item.name || ""} ${
              item.description || ""
            }`
          );

          return keywords.some((keyword) =>
            value.includes(keyword)
          );
        })?.name || ""
      );
    }

    return {
      village:
        result.locality ||
        result.city ||
        farmer?.village ||
        "",

      mandal:
        findAdministrative([
          "mandal",
          "taluk",
          "tehsil",
          "subdistrict",
          "sub-district",
        ]) ||
        farmer?.mandal ||
        "",

      district:
        normalizeDistrictName(
          findAdministrative(["district"]) ||
            result.city ||
            farmer?.district ||
            ""
        ),

      state:
        normalizeStateName(
          result.principalSubdivision ||
            findAdministrative(["state"]) ||
            farmer?.state ||
            ""
        ),

      postcode: result.postcode || "",
      country: result.countryName || "",
    };
  }

  async function loadAllCropPrices({
    state,
    district,
  }) {
    const apiKey =
      import.meta.env.VITE_DATA_GOV_API_KEY;

    if (!apiKey) {
      showMessage(
        "error",
        "Add VITE_DATA_GOV_API_KEY to the project .env file."
      );

      setPrices([]);
      return;
    }

    setLoadingPrices(true);

    try {
      const normalizedState =
        normalizeStateName(state);

      const normalizedDistrict =
        normalizeDistrictName(district);

      let records = [];

      if (normalizedDistrict) {
        records =
          await fetchGovernmentRecords({
            state: normalizedState,
            district: normalizedDistrict,
          });
      }

      if (records.length === 0) {
        records =
          await fetchGovernmentRecords({
            state: normalizedState,
            district: "",
          });

        if (normalizedDistrict) {
          showMessage(
            "info",
            `No current records were found for ${normalizedDistrict}. Showing all markets in ${normalizedState}.`
          );
        }
      }

      const preparedRecords = records
        .map((record, index) => {
          const commodity =
            record.commodity ||
            record.Commodity ||
            "Crop";

          return {
            id: [
              record.market,
              record.commodity,
              record.variety,
              record.arrival_date,
              index,
            ].join("-"),

            state:
              record.state ||
              record.State ||
              normalizedState,

            district:
              record.district ||
              record.District ||
              "",

            market:
              record.market ||
              record.Market ||
              "Market",

            commodity,

            variety:
              record.variety ||
              record.Variety ||
              "Common",

            grade:
              record.grade ||
              record.Grade ||
              "",

            arrivalDate:
              record.arrival_date ||
              record.Arrival_Date ||
              "",

            arrivalTimestamp:
              parseArrivalDate(
                record.arrival_date ||
                  record.Arrival_Date
              ),

            minimumPrice: numberValue(
              record.min_price ||
                record.Min_Price
            ),

            maximumPrice: numberValue(
              record.max_price ||
                record.Max_Price
            ),

            modalPrice: numberValue(
              record.modal_price ||
                record.Modal_Price
            ),

            category:
              getCropCategory(commodity),

            icon: getCommodityIcon(commodity),
          };
        })
        .filter(
          (record) =>
            record.commodity &&
            record.modalPrice > 0
        );

      const deduplicated = Array.from(
        new Map(
          preparedRecords.map((record) => [
            [
              normalizeText(record.state),
              normalizeText(record.district),
              normalizeText(record.market),
              normalizeText(record.commodity),
              normalizeText(record.variety),
              record.arrivalDate,
            ].join("|"),

            record,
          ])
        ).values()
      );

      setPrices(deduplicated);

      setSelectedDistrict(
        normalizedDistrict &&
          deduplicated.some(
            (record) =>
              normalizeText(record.district) ===
              normalizeText(normalizedDistrict)
          )
          ? normalizedDistrict
          : ""
      );

      setSelectedMarket("");

      if (deduplicated.length === 0) {
        showMessage(
          "warning",
          "No current government mandi prices were found for this location."
        );
      }
    } catch (error) {
      console.error(
        "Government price error:",
        error
      );

      setPrices([]);

      showMessage(
        "error",
        "Government mandi prices could not be loaded."
      );
    } finally {
      setLoadingPrices(false);
    }
  }

  async function loadNearbySellingPoints(
    currentLocation = location
  ) {
    if (!currentLocation) {
      showMessage(
        "warning",
        "Location is required to search nearby selling points."
      );

      return;
    }

    setLoadingSellingPoints(true);

    try {
      const { latitude, longitude } =
        currentLocation;

      const overpassQuery = `
[out:json][timeout:35];
(
  node["amenity"="marketplace"](around:${SELLING_POINT_RADIUS},${latitude},${longitude});
  way["amenity"="marketplace"](around:${SELLING_POINT_RADIUS},${latitude},${longitude});
  relation["amenity"="marketplace"](around:${SELLING_POINT_RADIUS},${latitude},${longitude});

  node["name"~"mandi|market yard|agriculture market|agricultural market|rythu bazar|farmer market",i](around:${SELLING_POINT_RADIUS},${latitude},${longitude});
  way["name"~"mandi|market yard|agriculture market|agricultural market|rythu bazar|farmer market",i](around:${SELLING_POINT_RADIUS},${latitude},${longitude});
  relation["name"~"mandi|market yard|agriculture market|agricultural market|rythu bazar|farmer market",i](around:${SELLING_POINT_RADIUS},${latitude},${longitude});

  node["industrial"="rice_mill"](around:${SELLING_POINT_RADIUS},${latitude},${longitude});
  way["industrial"="rice_mill"](around:${SELLING_POINT_RADIUS},${latitude},${longitude});

  node["name"~"rice mill|flour mill|oil mill|cotton mill|dal mill|seed market",i](around:${SELLING_POINT_RADIUS},${latitude},${longitude});
  way["name"~"rice mill|flour mill|oil mill|cotton mill|dal mill|seed market",i](around:${SELLING_POINT_RADIUS},${latitude},${longitude});
);
out center tags;
`;

      const response = await fetch(
        "https://overpass-api.de/api/interpreter",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: `data=${encodeURIComponent(
            overpassQuery
          )}`,
        }
      );

      if (!response.ok) {
        throw new Error(
          "Nearby market search failed."
        );
      }

      const result = await response.json();

      const prepared = (
        result?.elements || []
      )
        .map((element) => {
          const pointLatitude =
            element.lat ||
            element.center?.lat;

          const pointLongitude =
            element.lon ||
            element.center?.lon;

          if (
            !pointLatitude ||
            !pointLongitude
          ) {
            return null;
          }

          const tags = element.tags || {};

          const name =
            tags.name ||
            tags["name:en"] ||
            "Nearby Selling Point";

          const distance =
            calculateDistance(
              latitude,
              longitude,
              pointLatitude,
              pointLongitude
            );

          let type = "Market";

          const combinedName =
            normalizeText(name);

          if (
            combinedName.includes("rice mill")
          ) {
            type = "Rice Mill";
          } else if (
            combinedName.includes("oil mill")
          ) {
            type = "Oil Mill";
          } else if (
            combinedName.includes("cotton mill")
          ) {
            type = "Cotton Mill";
          } else if (
            combinedName.includes("dal mill")
          ) {
            type = "Dal Mill";
          } else if (
            combinedName.includes("flour mill")
          ) {
            type = "Flour Mill";
          } else if (
            tags.amenity === "marketplace"
          ) {
            type = "Marketplace";
          }

          const address = [
            tags["addr:street"],
            tags["addr:place"],
            tags["addr:city"],
            tags["addr:district"],
          ]
            .filter(Boolean)
            .join(", ");

          return {
            id: `${element.type}-${element.id}`,
            name,
            type,
            latitude: pointLatitude,
            longitude: pointLongitude,
            distance,
            address,
            phone:
              tags.phone ||
              tags["contact:phone"] ||
              "",
            openingHours:
              tags.opening_hours || "",
          };
        })
        .filter(Boolean)
        .sort(
          (first, second) =>
            first.distance - second.distance
        )
        .slice(0, 25);

      setSellingPoints(prepared);

      if (prepared.length === 0) {
        showMessage(
          "info",
          "No mapped selling points were found nearby. Use the map search option."
        );
      }
    } catch (error) {
      console.error(
        "Nearby selling points error:",
        error
      );

      setSellingPoints([]);

      showMessage(
        "warning",
        "Nearby selling points are temporarily unavailable. You can still search through maps."
      );
    } finally {
      setLoadingSellingPoints(false);
    }
  }

  function openDirections(point) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function openGeneralMapSearch() {
    const crop =
      farmer?.mainCrop || "crop";

    const area =
      detectedPlace?.district ||
      farmer?.district ||
      "";

    const searchQuery =
      `${crop} mandi agriculture market mill ${area}`.trim();

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        searchQuery
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function getSellingAdvice(summary) {
    if (!summary?.highest) {
      return {
        label: "Price unavailable",
        className:
          "bg-gray-100 text-gray-700",
      };
    }

    const difference =
      summary.highest.modalPrice -
      summary.average;

    const differencePercentage =
      summary.average > 0
        ? (difference / summary.average) * 100
        : 0;

    if (differencePercentage >= 8) {
      return {
        label: "Good market price",
        className:
          "bg-green-100 text-green-700",
      };
    }

    if (differencePercentage >= 3) {
      return {
        label: "Compare markets",
        className:
          "bg-yellow-100 text-yellow-800",
      };
    }

    return {
      label: "Check before selling",
      className:
        "bg-blue-100 text-blue-700",
    };
  }

  const categories = [
    {
      value: "all",
      label: "All Crops",
      icon: "🛍️",
    },
    {
      value: "cereals",
      label: "Grains",
      icon: "🌾",
    },
    {
      value: "pulses",
      label: "Pulses",
      icon: "🫘",
    },
    {
      value: "vegetables",
      label: "Vegetables",
      icon: "🥬",
    },
    {
      value: "fruits",
      label: "Fruits",
      icon: "🍎",
    },
    {
      value: "spices",
      label: "Spices",
      icon: "🌶️",
    },
    {
      value: "oilseeds",
      label: "Oilseeds",
      icon: "🌻",
    },
    {
      value: "fibre",
      label: "Fibre",
      icon: "🧶",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">
            📈
          </div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            {detectingLocation
              ? "Detecting your market area"
              : "Loading market prices"}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-green-800 to-emerald-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() =>
              navigate("/dashboard")
            }
            className="text-green-100 font-semibold"
          >
            ← Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                📈 Local Crop Prices
              </h1>

              <p className="text-green-100 mt-1">
                Government mandi prices for all
                available crops.
              </p>
            </div>

            <button
              type="button"
              disabled={detectingLocation}
              onClick={() =>
                detectLocationAndLoadData(
                  farmer
                )
              }
              className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-60"
            >
              {detectingLocation
                ? "Detecting..."
                : "📍 Refresh Location"}
            </button>
          </div>

          <div className="bg-white/15 rounded-xl p-3 mt-4 text-sm">
            📍{" "}
            {detectedPlace
              ? [
                  detectedPlace.village,
                  detectedPlace.mandal,
                  detectedPlace.district,
                  detectedPlace.state,
                ]
                  .filter(Boolean)
                  .join(", ")
              : [
                  farmer?.village,
                  farmer?.district,
                  farmer?.state,
                ]
                  .filter(Boolean)
                  .join(", ") ||
                "Saved farmer location"}
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Crops
            </p>

            <p className="text-2xl font-bold text-green-800 mt-2">
              {overallStatistics.crops}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Markets
            </p>

            <p className="text-2xl font-bold text-blue-800 mt-2">
              {overallStatistics.markets}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Price Records
            </p>

            <p className="text-2xl font-bold text-purple-800 mt-2">
              {filteredPrices.length}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Average Price
            </p>

            <p className="text-xl font-bold text-orange-800 mt-2">
              {formatCurrency(
                overallStatistics.averagePrice
              )}
            </p>

            <p className="text-xs text-gray-500">
              per quintal
            </p>
          </article>
        </section>

        {farmer?.mainCrop && (
          <section className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm text-yellow-800">
                  Your main crop
                </p>

                <h2 className="text-xl font-bold text-yellow-900 mt-1">
                  🌾 {farmer.mainCrop}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSearchText(farmer.mainCrop);
                  setSelectedCategory("all");
                }}
                className="bg-yellow-700 text-white px-4 py-2.5 rounded-xl font-semibold self-start"
              >
                Show Prices
              </button>
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <label
            htmlFor="crop-price-search"
            className="font-semibold text-gray-800"
          >
            🔍 Search any crop
          </label>

          <input
            id="crop-price-search"
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Cotton, paddy, tomato, maize..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-green-600"
          />

          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <select
              value={selectedDistrict}
              onChange={(event) => {
                setSelectedDistrict(
                  event.target.value
                );

                setSelectedMarket("");
              }}
              className="border border-gray-300 rounded-xl px-4 py-3"
            >
              <option value="">
                All Districts
              </option>

              {districts.map((district) => (
                <option
                  key={district}
                  value={district}
                >
                  {district}
                </option>
              ))}
            </select>

            <select
              value={selectedMarket}
              onChange={(event) =>
                setSelectedMarket(
                  event.target.value
                )
              }
              className="border border-gray-300 rounded-xl px-4 py-3"
            >
              <option value="">
                All Markets
              </option>

              {markets.map((market) => (
                <option
                  key={market}
                  value={market}
                >
                  {market}
                </option>
              ))}
            </select>

            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(event.target.value)
              }
              className="border border-gray-300 rounded-xl px-4 py-3"
            >
              <option value="latest">
                Latest Records
              </option>

              <option value="highest">
                Highest Price
              </option>

              <option value="lowest">
                Lowest Price
              </option>

              <option value="crop">
                Crop Name
              </option>
            </select>
          </div>
        </section>

        <section className="flex gap-2 overflow-x-auto py-5">
          {categories.map((category) => (
            <button
              type="button"
              key={category.value}
              onClick={() =>
                setSelectedCategory(
                  category.value
                )
              }
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${
                selectedCategory ===
                category.value
                  ? "bg-green-700 text-white"
                  : "bg-white border border-green-200 text-green-800"
              }`}
            >
              {category.icon}{" "}
              {category.label}
            </button>
          ))}
        </section>

        {loadingPrices ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">
              📊
            </div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              Loading government prices
            </h2>
          </section>
        ) : groupedCropSummary.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">
              🌾
            </div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              No crop prices found
            </h2>

            <p className="text-gray-600 mt-2">
              Change the crop, market or
              district filter.
            </p>
          </section>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-green-900">
                  🌾 Crop Price Summary
                </h2>

                <span className="text-sm text-gray-500">
                  {groupedCropSummary.length} crops
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {groupedCropSummary.map(
                  (summary) => {
                    const advice =
                      getSellingAdvice(
                        summary
                      );

                    return (
                      <article
                        key={summary.commodity}
                        className="bg-white rounded-2xl border border-green-100 shadow-sm p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-bold text-green-900">
                              {summary.icon}{" "}
                              {summary.commodity}
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                              {
                                summary.marketsCount
                              }{" "}
                              markets available
                            </p>
                          </div>

                          <span
                            className={`${advice.className} px-3 py-1 rounded-full text-xs font-semibold`}
                          >
                            {advice.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                          <div className="bg-red-50 rounded-xl p-3">
                            <p className="text-xs text-gray-500">
                              Lowest
                            </p>

                            <p className="font-bold text-red-800 mt-1">
                              {formatCurrency(
                                summary.lowest
                                  .modalPrice
                              )}
                            </p>
                          </div>

                          <div className="bg-yellow-50 rounded-xl p-3">
                            <p className="text-xs text-gray-500">
                              Average
                            </p>

                            <p className="font-bold text-yellow-800 mt-1">
                              {formatCurrency(
                                summary.average
                              )}
                            </p>
                          </div>

                          <div className="bg-green-50 rounded-xl p-3">
                            <p className="text-xs text-gray-500">
                              Highest
                            </p>

                            <p className="font-bold text-green-800 mt-1">
                              {formatCurrency(
                                summary.highest
                                  .modalPrice
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="bg-green-50 rounded-xl p-3 mt-4">
                          <p className="text-xs text-gray-500">
                            Best listed market
                          </p>

                          <p className="font-bold text-green-900 mt-1">
                            🏪{" "}
                            {
                              summary.highest
                                .market
                            }
                          </p>

                          <p className="text-sm text-gray-600 mt-1">
                            📍{" "}
                            {
                              summary.highest
                                .district
                            }
                          </p>

                          <p className="text-sm font-semibold text-green-800 mt-1">
                            {formatCurrency(
                              summary.highest
                                .modalPrice
                            )}{" "}
                            per quintal
                          </p>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </section>

            <section className="mt-7">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-green-900">
                  📋 All Market Records
                </h2>

                <span className="text-sm text-gray-500">
                  {filteredPrices.length} records
                </span>
              </div>

              <div className="space-y-4">
                {filteredPrices.map((item) => (
                  <article
                    key={item.id}
                    className="bg-white rounded-2xl border border-green-100 shadow-sm p-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-green-900">
                          {item.icon}{" "}
                          {item.commodity}
                        </h2>

                        <p className="text-sm text-gray-500 mt-1">
                          Variety:{" "}
                          {item.variety ||
                            "Common"}
                        </p>

                        <p className="text-sm text-gray-600 mt-2">
                          🏪 {item.market}
                        </p>

                        <p className="text-sm text-gray-600">
                          📍 {item.district},{" "}
                          {item.state}
                        </p>

                        <p className="text-xs text-gray-500 mt-2">
                          Date:{" "}
                          {item.arrivalDate ||
                            "Not available"}
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-xl p-4 md:min-w-44">
                        <p className="text-sm text-gray-500">
                          Modal Price
                        </p>

                        <p className="text-2xl font-bold text-green-800 mt-1">
                          {formatCurrency(
                            item.modalPrice
                          )}
                        </p>

                        <p className="text-xs text-gray-500">
                          per quintal
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          Minimum
                        </p>

                        <p className="font-bold text-red-800 mt-1">
                          {formatCurrency(
                            item.minimumPrice
                          )}
                        </p>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          Maximum
                        </p>

                        <p className="font-bold text-blue-800 mt-1">
                          {formatCurrency(
                            item.maximumPrice
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-green-900">
                📍 Where to Sell
              </h2>

              <p className="text-sm text-gray-600 mt-1">
                Nearby markets and crop-processing
                mills.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  !location ||
                  loadingSellingPoints
                }
                onClick={() =>
                  loadNearbySellingPoints(
                    location
                  )
                }
                className="border border-green-700 text-green-700 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
              >
                {loadingSellingPoints
                  ? "Searching..."
                  : "Refresh Nearby"}
              </button>

              <button
                type="button"
                onClick={openGeneralMapSearch}
                className="bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold"
              >
                Search on Maps
              </button>
            </div>
          </div>

          {loadingSellingPoints ? (
            <div className="bg-white rounded-2xl shadow-sm p-7 text-center mt-4">
              Searching nearby selling points...
            </div>
          ) : sellingPoints.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-7 text-center mt-4">
              <div className="text-5xl">
                🏪
              </div>

              <h3 className="text-xl font-bold text-green-900 mt-4">
                No mapped markets found nearby
              </h3>

              <p className="text-gray-600 mt-2">
                Use map search to find additional
                mandis and mills.
              </p>

              <button
                type="button"
                onClick={openGeneralMapSearch}
                className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold mt-5"
              >
                Open Map Search
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {sellingPoints.map((point) => (
                <article
                  key={point.id}
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-green-900">
                        🏪 {point.name}
                      </h3>

                      <p className="text-sm text-gray-600 mt-1">
                        {point.type}
                      </p>
                    </div>

                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                      {point.distance.toFixed(1)}{" "}
                      km
                    </span>
                  </div>

                  {point.address && (
                    <p className="text-sm text-gray-600 mt-3">
                      📍 {point.address}
                    </p>
                  )}

                  {point.openingHours && (
                    <p className="text-sm text-gray-600 mt-2">
                      🕒 {point.openingHours}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        openDirections(point)
                      }
                      className="bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold"
                    >
                      🧭 Directions
                    </button>

                    {point.phone && (
                      <a
                        href={`tel:${point.phone}`}
                        className="border border-blue-300 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl font-semibold"
                      >
                        📞 Call
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mt-4 text-sm">
            Confirm the buyer, price, weighing method,
            payment terms and market charges before
            transporting produce.
          </div>
        </section>

        <p className="text-xs text-center text-gray-500 mt-7">
          Price source: Government of India
          Agmarknet data. Nearby locations use
          OpenStreetMap data and may not include every
          rural market or mill.
        </p>
      </div>
    </div>
  );
}