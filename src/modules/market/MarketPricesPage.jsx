import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";

const MANDI_RESOURCE_ID =
  "9ef84268-d588-465a-a308-a864a43d0070";
const LGD_API_ROOT =
  "https://lgd-json-api.vercel.app/api";

const RECORD_LIMIT = 1000;
const SELLING_POINT_RADIUS = 50000;

const INDIAN_STATES_AND_TERRITORIES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

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

async function fetchLgdRecords(collection, filters = {}) {
  const records = [];
  let page = 1;
  let pageCount = 1;

  do {
    const parameters = new URLSearchParams({
      ...filters,
      limit: "100",
      page: String(page),
    });
    const response = await fetch(
      `${LGD_API_ROOT}/${collection}?${parameters.toString()}`
    );

    if (!response.ok) {
      throw new Error("Administrative location data is unavailable.");
    }

    const result = await response.json();
    records.push(...(Array.isArray(result?.data) ? result.data : []));
    pageCount = Number(result?.pagination?.pages || 1);
    page += 1;
  } while (page <= pageCount);

  return records;
}

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

function normalizeDistrictKey(value) {
  const district = normalizeDistrictName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const aliases = {
    jagtial: "jagtial",
    jagitial: "jagtial",
    jangaon: "jangaon",
    jangoan: "jangaon",
    komarambheemasifabad: "kumurambheemasifabad",
    kumurambheemasifabad: "kumurambheemasifabad",
    rangareddy: "rangareddy",
    medchalmalkajgiri: "medchalmalkajgiri",
  };

  return aliases[district] || district;
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
    "corn",
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
    "chili",
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
    ((secondLatitude - firstLatitude) * Math.PI) / 180;

  const longitudeDifference =
    ((secondLongitude - firstLongitude) * Math.PI) / 180;

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

  return `https://api.data.gov.in/resource/${MANDI_RESOURCE_ID}?${parameters.toString()}`;
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

function svgToDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildCircleImage(background, inner) {
  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="24" fill="${background}" />
      ${inner}
    </svg>
  `);
}

const CROP_IMAGES = {
  paddy: buildCircleImage(
    "#fef3c7",
    `
      <rect x="0" y="80" width="120" height="40" fill="#86efac"/>
      <path d="M58 18 L58 88" stroke="#65a30d" stroke-width="4" stroke-linecap="round"/>
      <path d="M58 32 C44 22, 36 20, 28 28" stroke="#84cc16" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M58 44 C72 34, 82 30, 92 38" stroke="#84cc16" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M58 54 C42 48, 34 48, 24 58" stroke="#84cc16" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M58 62 C72 56, 84 58, 94 66" stroke="#84cc16" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="73" cy="27" r="3" fill="#facc15"/>
      <circle cx="77" cy="31" r="3" fill="#facc15"/>
      <circle cx="80" cy="35" r="3" fill="#facc15"/>
      <circle cx="84" cy="39" r="3" fill="#facc15"/>
      <circle cx="87" cy="43" r="3" fill="#facc15"/>
      <circle cx="70" cy="34" r="3" fill="#facc15"/>
      <circle cx="74" cy="38" r="3" fill="#facc15"/>
      <circle cx="78" cy="42" r="3" fill="#facc15"/>
    `
  ),

  tomato: buildCircleImage(
    "#fee2e2",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <circle cx="60" cy="58" r="24" fill="#ef4444"/>
      <path d="M60 34 L66 42 L76 40 L72 50 L80 58 L68 58 L60 68 L52 58 L40 58 L48 50 L44 40 L54 42 Z" fill="#16a34a"/>
      <rect x="58" y="22" width="4" height="14" rx="2" fill="#15803d"/>
    `
  ),

  onion: buildCircleImage(
    "#ede9fe",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <path d="M60 28 C78 44 82 54 82 68 C82 81 72 92 60 92 C48 92 38 81 38 68 C38 54 42 44 60 28 Z" fill="#a78bfa"/>
      <path d="M60 28 C54 20 52 14 54 8" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M52 44 C58 54 58 74 52 86" stroke="#c4b5fd" stroke-width="3" fill="none"/>
      <path d="M68 44 C62 54 62 74 68 86" stroke="#c4b5fd" stroke-width="3" fill="none"/>
    `
  ),

  potato: buildCircleImage(
    "#ffedd5",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <ellipse cx="60" cy="62" rx="28" ry="22" fill="#c2410c"/>
      <circle cx="48" cy="58" r="2.5" fill="#7c2d12"/>
      <circle cx="64" cy="50" r="2.5" fill="#7c2d12"/>
      <circle cx="72" cy="66" r="2.5" fill="#7c2d12"/>
      <circle cx="54" cy="72" r="2.5" fill="#7c2d12"/>
    `
  ),

  chilli: buildCircleImage(
    "#dcfce7",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <path d="M38 58 C46 38, 78 32, 84 56 C88 68, 80 82, 60 84 C42 86, 30 74, 38 58 Z" fill="#ef4444"/>
      <path d="M34 54 C38 48, 46 46, 52 48" stroke="#16a34a" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="78" cy="56" r="4" fill="#fca5a5"/>
    `
  ),

  maize: buildCircleImage(
    "#fef9c3",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <ellipse cx="60" cy="56" rx="18" ry="28" fill="#facc15"/>
      <path d="M44 54 C36 40, 34 34, 38 24 C48 32, 54 40, 56 52" fill="#16a34a"/>
      <path d="M76 54 C84 40, 86 34, 82 24 C72 32, 66 40, 64 52" fill="#16a34a"/>
      <g fill="#fde047">
        <circle cx="54" cy="42" r="3"/>
        <circle cx="60" cy="42" r="3"/>
        <circle cx="66" cy="42" r="3"/>
        <circle cx="54" cy="50" r="3"/>
        <circle cx="60" cy="50" r="3"/>
        <circle cx="66" cy="50" r="3"/>
        <circle cx="54" cy="58" r="3"/>
        <circle cx="60" cy="58" r="3"/>
        <circle cx="66" cy="58" r="3"/>
        <circle cx="54" cy="66" r="3"/>
        <circle cx="60" cy="66" r="3"/>
        <circle cx="66" cy="66" r="3"/>
      </g>
    `
  ),

  cotton: buildCircleImage(
    "#eff6ff",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <path d="M60 28 L60 88" stroke="#16a34a" stroke-width="4" stroke-linecap="round"/>
      <path d="M60 44 C48 36, 44 34, 38 38" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M60 54 C72 46, 78 44, 84 48" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="44" cy="38" r="11" fill="#ffffff" stroke="#d1d5db" stroke-width="2"/>
      <circle cx="76" cy="48" r="11" fill="#ffffff" stroke="#d1d5db" stroke-width="2"/>
      <circle cx="60" cy="62" r="13" fill="#ffffff" stroke="#d1d5db" stroke-width="2"/>
    `
  ),

  banana: buildCircleImage(
    "#fef3c7",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <path d="M38 66 C44 38, 70 26, 88 28 C84 58, 62 78, 44 78 C40 78, 38 74, 38 66 Z" fill="#facc15"/>
      <path d="M42 66 C50 46, 68 36, 82 36" stroke="#fde68a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="84" y="27" width="6" height="8" rx="3" fill="#16a34a"/>
    `
  ),

  turmeric: buildCircleImage(
    "#fef3c7",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <ellipse cx="48" cy="62" rx="12" ry="18" fill="#f59e0b"/>
      <ellipse cx="62" cy="56" rx="11" ry="16" fill="#f59e0b"/>
      <ellipse cx="74" cy="64" rx="10" ry="14" fill="#f59e0b"/>
      <path d="M60 24 L60 50" stroke="#16a34a" stroke-width="4" stroke-linecap="round"/>
      <path d="M60 26 C48 18, 42 16, 36 20" stroke="#22c55e" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M60 30 C72 20, 80 18, 88 22" stroke="#22c55e" stroke-width="4" fill="none" stroke-linecap="round"/>
    `
  ),

  generic: buildCircleImage(
    "#dcfce7",
    `
      <rect x="0" y="84" width="120" height="36" fill="#86efac"/>
      <path d="M60 26 C74 38, 80 52, 76 66 C72 80, 52 84, 44 70 C38 60, 44 40, 60 26 Z" fill="#22c55e"/>
      <path d="M60 32 C56 46, 54 60, 54 74" stroke="#15803d" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M58 48 C68 44, 74 40, 78 34" stroke="#15803d" stroke-width="3" fill="none" stroke-linecap="round"/>
    `
  ),
};

function getCropImage(commodity) {
  const value = normalizeText(commodity);

  if (value.includes("paddy") || value.includes("rice")) {
    return CROP_IMAGES.paddy;
  }

  if (value.includes("tomato")) {
    return CROP_IMAGES.tomato;
  }

  if (value.includes("onion")) {
    return CROP_IMAGES.onion;
  }

  if (value.includes("potato")) {
    return CROP_IMAGES.potato;
  }

  if (
    value.includes("chilli") ||
    value.includes("chili")
  ) {
    return CROP_IMAGES.chilli;
  }

  if (
    value.includes("maize") ||
    value.includes("corn")
  ) {
    return CROP_IMAGES.maize;
  }

  if (value.includes("cotton")) {
    return CROP_IMAGES.cotton;
  }

  if (value.includes("banana")) {
    return CROP_IMAGES.banana;
  }

  if (value.includes("turmeric")) {
    return CROP_IMAGES.turmeric;
  }

  const category = getCropCategory(commodity);

  if (category === "cereals") {
    return CROP_IMAGES.paddy;
  }

  if (category === "vegetables") {
    return CROP_IMAGES.tomato;
  }

  if (category === "fruits") {
    return CROP_IMAGES.banana;
  }

  if (category === "spices") {
    return CROP_IMAGES.turmeric;
  }

  if (category === "fibre") {
    return CROP_IMAGES.cotton;
  }

  return CROP_IMAGES.generic;
}

function buildDemoPrices({ state, district, mandals }) {
  const demoCrops = [
    { commodity: "Paddy", basePrice: 2350 },
    { commodity: "Maize", basePrice: 2180 },
    { commodity: "Cotton", basePrice: 7100 },
    { commodity: "Tomato", basePrice: 1800 },
    { commodity: "Turmeric", basePrice: 12600 },
  ];
  const today = new Date();
  const arrivalDate = today.toLocaleDateString("en-IN");
  const arrivalTimestamp = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  return mandals.flatMap((mandal, mandalIndex) =>
    demoCrops.map((crop, cropIndex) => {
      const adjustment = ((mandalIndex * 37 + cropIndex * 19) % 151) - 75;
      const modalPrice = crop.basePrice + adjustment;
      const category = getCropCategory(crop.commodity);

      return {
        id: `demo-${normalizeDistrictKey(district)}-${mandalIndex}-${cropIndex}`,
        state,
        district,
        mandal,
        market: `${mandal} Demo Mandi`,
        commodity: crop.commodity,
        variety: "Demo / Common",
        grade: "Illustrative only",
        arrivalDate,
        arrivalTimestamp,
        minimumPrice: modalPrice - 100,
        maximumPrice: modalPrice + 100,
        modalPrice,
        category,
        image: getCropImage(crop.commodity),
        icon: CATEGORY_ICONS[category] || "🌱",
        isDemo: true,
      };
    })
  );
}

export default function MarketPricesPage() {
  const language = useLanguage();
  const navigate = useNavigate();

  const [farmer, setFarmer] = useState(null);
  const [location, setLocation] = useState(null);
  const [detectedPlace, setDetectedPlace] =
    useState(null);

  const [prices, setPrices] = useState([]);
  const [sellingPoints, setSellingPoints] =
    useState([]);
  const [availableStates, setAvailableStates] =
    useState([]);
  const [availableDistricts, setAvailableDistricts] =
    useState([]);
  const [availableMandals, setAvailableMandals] =
    useState([]);

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("all");
  const [selectedState, setSelectedState] =
    useState("");
  const [selectedDistrict, setSelectedDistrict] =
    useState("");
  const [selectedMandal, setSelectedMandal] =
    useState("");
  const [showDemoPrices, setShowDemoPrices] =
    useState(false);
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
  const [loadingDistricts, setLoadingDistricts] =
    useState(false);
  const [loadingMandals, setLoadingMandals] =
    useState(false);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    initializePage();
  }, []);

  useEffect(() => {
    let active = true;

    fetchLgdRecords("states")
      .then((records) => {
        if (active) {
          setAvailableStates(records);
        }
      })
      .catch((error) => {
        console.error("State list loading error:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const districts = useMemo(() => {
    if (availableDistricts.length > 0) {
      return availableDistricts.map((district) => district.name);
    }

    return [
      ...new Set(
        prices
          .filter(
            (item) =>
              normalizeText(item.state) ===
              normalizeText(selectedState)
          )
          .map((item) => item.district)
          .filter(Boolean)
      ),
    ].sort((first, second) =>
      first.localeCompare(second)
    );
  }, [availableDistricts, prices, selectedState]);

  const stateChoices = useMemo(
    () =>
      availableStates.length > 0
        ? availableStates.map((state) => state.name)
        : INDIAN_STATES_AND_TERRITORIES,
    [availableStates]
  );

  useEffect(() => {
    let active = true;

    async function loadDistricts() {
      if (!selectedState || availableStates.length === 0) {
        setAvailableDistricts([]);
        setLoadingDistricts(false);
        return;
      }

      const stateRecord = availableStates.find(
        (state) =>
          normalizeText(state.name) === normalizeText(selectedState)
      );

      if (!stateRecord) {
        setAvailableDistricts([]);
        setLoadingDistricts(false);
        return;
      }

      setLoadingDistricts(true);
      setAvailableDistricts([]);

      try {
        const records = await fetchLgdRecords("districts", {
          stateCode: stateRecord.code,
        });

        if (active) {
          setAvailableDistricts(records);
        }
      } catch (error) {
        console.error("District list loading error:", error);
      } finally {
        if (active) {
          setLoadingDistricts(false);
        }
      }
    }

    loadDistricts();

    return () => {
      active = false;
    };
  }, [availableStates, selectedState]);

  useEffect(() => {
    if (!selectedDistrict || availableDistricts.length === 0) {
      return;
    }

    const matchingDistrict = availableDistricts.find(
      (district) =>
        normalizeDistrictKey(district.name) ===
        normalizeDistrictKey(selectedDistrict)
    );

    if (matchingDistrict && matchingDistrict.name !== selectedDistrict) {
      setSelectedDistrict(matchingDistrict.name);
    }
  }, [availableDistricts, selectedDistrict]);

  useEffect(() => {
    let active = true;

    async function loadMandals() {
      if (!selectedDistrict || availableDistricts.length === 0) {
        setAvailableMandals([]);
        setLoadingMandals(false);
        return;
      }

      const districtRecord = availableDistricts.find(
        (district) =>
          normalizeDistrictKey(district.name) ===
          normalizeDistrictKey(selectedDistrict)
      );

      if (!districtRecord) {
        setAvailableMandals([]);
        setLoadingMandals(false);
        return;
      }

      setLoadingMandals(true);
      setAvailableMandals([]);

      try {
        const records = await fetchLgdRecords("subdistricts", {
          districtCode: districtRecord.code,
        });

        if (active) {
          setAvailableMandals(records);
        }
      } catch (error) {
        console.error("Mandal list loading error:", error);
      } finally {
        if (active) {
          setLoadingMandals(false);
        }
      }
    }

    loadMandals();

    return () => {
      active = false;
    };
  }, [availableDistricts, selectedDistrict]);

  const mandalOptions = useMemo(() => {
    const currentDistrict = normalizeText(selectedDistrict);
    const currentState = normalizeText(selectedState);

    if (availableMandals.length > 0) {
      return availableMandals.map((mandal) => mandal.name);
    }

    return [
      ...new Set(
        [
          farmer,
          detectedPlace,
        ]
          .filter(
            (place) =>
              place?.mandal &&
              normalizeText(place.state) === currentState &&
              normalizeDistrictKey(place.district) ===
                normalizeDistrictKey(currentDistrict)
          )
          .map((place) => String(place.mandal).trim())
          .filter(Boolean)
      ),
    ].sort((first, second) => first.localeCompare(second));
  }, [
    availableMandals,
    farmer,
    detectedPlace,
    selectedState,
    selectedDistrict,
  ]);

  useEffect(() => {
    setSelectedMandal((currentMandal) =>
      mandalOptions.some(
        (mandal) =>
          normalizeText(mandal) === normalizeText(currentMandal)
      )
        ? currentMandal
        : ""
    );
  }, [mandalOptions]);

  const markets = useMemo(() => {
    return [
      ...new Set(
        prices
          .filter(
            (item) =>
              !selectedDistrict ||
              normalizeDistrictKey(item.district) ===
                normalizeDistrictKey(selectedDistrict)
          )
          .map((item) => item.market)
          .filter(Boolean)
      ),
    ].sort((first, second) =>
      first.localeCompare(second)
    );
  }, [prices, selectedDistrict]);

  const demoPrices = useMemo(
    () =>
      selectedState && selectedDistrict
        ? buildDemoPrices({
            state: selectedState,
            district: selectedDistrict,
            mandals: mandalOptions,
          })
        : [],
    [selectedState, selectedDistrict, mandalOptions]
  );

  const visiblePrices = showDemoPrices ? demoPrices : prices;
  const visibleMarkets = showDemoPrices
    ? [
        ...new Set(demoPrices.map((item) => item.market)),
      ].sort((first, second) => first.localeCompare(second))
    : markets;

  const filteredPrices = useMemo(() => {
    const query = normalizeText(searchText);

    const results = visiblePrices.filter((item) => {
      if (
        selectedCategory !== "all" &&
        item.category !== selectedCategory
      ) {
        return false;
      }

      if (
        selectedDistrict &&
        normalizeDistrictKey(item.district) !==
          normalizeDistrictKey(selectedDistrict)
      ) {
        return false;
      }

      if (
        showDemoPrices &&
        selectedMandal &&
        normalizeText(item.mandal) !== normalizeText(selectedMandal)
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
        item.mandal,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

    return [...results].sort((first, second) => {
      if (sortMode === "highest") {
        return second.modalPrice - first.modalPrice;
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
    visiblePrices,
    searchText,
    selectedCategory,
    selectedDistrict,
    selectedMandal,
    selectedMarket,
    showDemoPrices,
    sortMode,
  ]);

  const groupedCropSummary = useMemo(() => {
    const cropMap = new Map();

    filteredPrices.forEach((item) => {
      const key = normalizeText(item.commodity);

      if (!cropMap.has(key)) {
        cropMap.set(key, {
          commodity: item.commodity,
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
            (sum, item) => sum + item.modalPrice,
            0
          ) / records.length;

        return {
          ...group,
          image: getCropImage(group.commodity),
          icon:
            CATEGORY_ICONS[group.category] || "🌱",
          highest,
          lowest,
          average,
          marketsCount: new Set(
            records.map((item) => item.market)
          ).size,
        };
      })
      .sort((first, second) =>
        first.commodity.localeCompare(second.commodity)
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

      const [userSnapshot, farmerSnapshot] =
        await Promise.all([
          get(ref(database, `users/${currentUser.uid}`)),
          get(ref(database, `farmers/${currentUser.uid}`)),
        ]);

      if (
        !userSnapshot.exists() ||
        userSnapshot.val().role !== "farmer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });
        return;
      }

      const farmerProfile = {
        uid: currentUser.uid,
        ...userSnapshot.val(),
        ...(farmerSnapshot.exists()
          ? farmerSnapshot.val()
          : {}),
        role: userSnapshot.val().role,
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
        t("marketInfoUnavailable", {}, language)
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
        t("locationFallback", {}, language)
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
            t("exactLocationFallback", {}, language)
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
          t("locationPermissionNearby", {}, language)
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

      district: normalizeDistrictName(
        findAdministrative(["district"]) ||
          result.city ||
          farmer?.district ||
          ""
      ),

      state: normalizeStateName(
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
    const normalizedState = normalizeStateName(state);
    setSelectedState(normalizedState);

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
            `No current mandi records are available for ${normalizedDistrict}.`
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

            image: getCropImage(commodity),
            icon:
              CATEGORY_ICONS[
                getCropCategory(commodity)
              ] || "🌱",
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
      setSelectedDistrict(normalizedDistrict);

      setSelectedMarket("");

      if (deduplicated.length === 0) {
        showMessage(
          "warning",
          t("noCurrentMandiPrices", {}, language)
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
        t("govtPricesUnavailable", {}, language)
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
        t("locationRequiredSelling", {}, language)
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

      const prepared = (result?.elements || [])
        .map((element) => {
          const pointLatitude =
            element.lat ||
            element.center?.lat;

          const pointLongitude =
            element.lon ||
            element.center?.lon;

          if (!pointLatitude || !pointLongitude) {
            return null;
          }

          const tags = element.tags || {};
          const name =
            tags.name ||
            tags["name:en"] ||
            t("nearbySellingPlaces", {}, language);

          const distance = calculateDistance(
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
          t("noMappedSellingPoints", {}, language)
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
        t("nearbySellingUnavailable", {}, language)
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
        label: t("cropPriceSummaryUnavailable", {}, language),
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
        label: t("goodMarketPrice", {}, language),
        className:
          "bg-green-100 text-green-700",
      };
    }

    if (differencePercentage >= 3) {
      return {
        label: t("compareMarkets", {}, language),
        className:
          "bg-yellow-100 text-yellow-800",
      };
    }

    return {
      label: t("checkBeforeSelling", {}, language),
      className:
        "bg-blue-100 text-blue-700",
    };
  }

  const categories = [
    {
      value: "all",
      labelKey: "categoryAllCrops",
      icon: "🛍️",
    },
    {
      value: "cereals",
      labelKey: "categoryGrains",
      icon: "🌾",
    },
    {
      value: "pulses",
      labelKey: "categoryPulses",
      icon: "🫘",
    },
    {
      value: "vegetables",
      labelKey: "categoryVegetables",
      icon: "🥬",
    },
    {
      value: "fruits",
      labelKey: "categoryFruits",
      icon: "🍎",
    },
    {
      value: "spices",
      labelKey: "categorySpices",
      icon: "🌶️",
    },
    {
      value: "oilseeds",
      labelKey: "categoryOilseeds",
      icon: "🌻",
    },
    {
      value: "fibre",
      labelKey: "categoryFibre",
      icon: "🧶",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">📈</div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            {detectingLocation
              ? t("detectingMarketArea", {}, language)
              : t("marketLoading", {}, language)}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4">
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
            {t("dashboardLink", {}, language)}
          </button>

          <div className="flex flex-col gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                {t("localCropPricesTitle", {}, language)}
              </h1>

              <p className="text-green-100 mt-1">
                {t("marketPageIntro", {}, language)}
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
              className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-60 self-start"
            >
              {detectingLocation
                ? t("detecting", {}, language)
                : t("refreshLocation", {}, language)}
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
                  farmer?.mandal,
                  farmer?.district,
                  farmer?.state,
                ]
                  .filter(Boolean)
                  .join(", ") ||
                t("savedFarmerLocation", {}, language)}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mt-5">
          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              {t("cropCount", {}, language)}
            </p>

            <p className="text-2xl font-bold text-green-800 mt-2">
              {overallStatistics.crops}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              {t("marketCount", {}, language)}
            </p>

            <p className="text-2xl font-bold text-blue-800 mt-2">
              {overallStatistics.markets}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              {t("priceRecords", {}, language)}
            </p>

            <p className="text-2xl font-bold text-purple-800 mt-2">
              {filteredPrices.length}
            </p>
          </article>

          <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <p className="text-sm text-gray-500">
              {t("averagePrice", {}, language)}
            </p>

            <p className="text-lg font-bold text-orange-800 mt-2">
              {formatCurrency(
                overallStatistics.averagePrice
              )}
            </p>

            <p className="text-xs text-gray-500">
              {t("perQuintal", {}, language)}
            </p>
          </article>
        </section>

        {farmer?.mainCrop && (
          <section className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mt-5">
            <div className="flex items-center gap-3">
              <img
                src={getCropImage(farmer.mainCrop)}
                alt={farmer.mainCrop}
                className="w-14 h-14 rounded-xl object-cover bg-white border border-yellow-200"
              />

              <div className="flex-1">
                <p className="text-sm text-yellow-800">
                  {t("yourMainCrop", {}, language)}
                </p>

                <h2 className="text-xl font-bold text-yellow-900 mt-1">
                  {farmer.mainCrop}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchText(farmer.mainCrop);
                setSelectedCategory("all");
              }}
              className="bg-yellow-700 text-white px-4 py-2.5 rounded-xl font-semibold mt-4 w-full"
            >
              {t("showPrices", {}, language)}
            </button>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-gray-800">
                Price data
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Demo mode creates sample crop prices for every mandal in the selected district.
              </p>
            </div>
            <button
              type="button"
              disabled={!selectedDistrict || mandalOptions.length === 0}
              onClick={() => {
                setShowDemoPrices((current) => !current);
                setSelectedMarket("");
              }}
              className={`px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50 ${
                showDemoPrices
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "bg-green-700 text-white"
              }`}
            >
              {showDemoPrices ? "Show government prices" : "Show demo prices"}
            </button>
          </div>

          {showDemoPrices && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Demo prices are fictional examples for testing only, not live market rates. Select “All mandals” to see examples for every mandal in {selectedDistrict}.
            </div>
          )}

          <label
            htmlFor="crop-price-search"
            className="font-semibold text-gray-800"
          >
            {t("searchAnyCrop", {}, language)}
          </label>

          <input
            id="crop-price-search"
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder={t("cropSearchPlaceholder", {}, language)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-green-600"
          />

          <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
            {categories.map((category) => (
              <button
                type="button"
                key={category.value}
                onClick={() =>
                  setSelectedCategory(category.value)
                }
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${
                  selectedCategory === category.value
                    ? "bg-green-700 text-white"
                    : "bg-green-50 text-green-800 border border-green-200"
                }`}
              >
                {category.icon} {t(category.labelKey, {}, language)}
              </button>
            ))}
          </div>

          <div className="grid gap-3 mt-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              State
              <select
                value={selectedState}
                onChange={(event) => {
                  const nextState = event.target.value;
                  setSelectedState(nextState);
                  setSelectedDistrict("");
                  setSelectedMarket("");
                  setSelectedMandal("");
                  if (nextState) {
                    loadAllCropPrices({ state: nextState, district: "" });
                  } else {
                    setPrices([]);
                  }
                }}
                className="border border-gray-300 rounded-xl px-4 py-3 bg-white"
              >
                <option value="">Select a state</option>
                {stateChoices.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              District
              <select
                value={selectedDistrict}
                onChange={(event) => {
                  const nextDistrict = event.target.value;
                  setSelectedDistrict(nextDistrict);
                  setSelectedMarket("");
                  setSelectedMandal("");
                  loadAllCropPrices({
                    state: selectedState,
                    district: nextDistrict,
                  });
                }}
                disabled={
                  !selectedState ||
                  loadingDistricts ||
                  districts.length === 0
                }
                className="border border-gray-300 rounded-xl px-4 py-3 bg-white disabled:bg-gray-100"
              >
                <option value="">
                  {loadingDistricts ? "Loading districts..." : "All Districts"}
                </option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Mandal / Taluk
              <select
                value={selectedMandal}
                onChange={(event) => setSelectedMandal(event.target.value)}
                disabled={loadingMandals || (!mandalOptions.length && !selectedDistrict)}
                className="border border-gray-300 rounded-xl px-4 py-3 bg-white disabled:bg-gray-100"
              >
                <option value="">
                  {loadingMandals
                    ? "Loading mandals..."
                    : selectedDistrict
                      ? "All mandals"
                      : "Select a district first"}
                </option>
                {mandalOptions.map((mandal) => (
                  <option key={mandal} value={mandal}>
                    {mandal}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-gray-500">
                {mandalOptions.length
                  ? `${mandalOptions.length} mandals listed for this district.`
                  : "Mandal list appears after selecting a district."}
              </span>
            </label>

            <select
              value={selectedMarket}
              onChange={(event) =>
                setSelectedMarket(
                  event.target.value
                )
              }
              className="border border-gray-300 rounded-xl px-4 py-3"
            >
              <option value="">{t("allMarkets", {}, language)}</option>

              {visibleMarkets.map((market) => (
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
                {t("latestRecords", {}, language)}
              </option>
              <option value="highest">
                {t("highestPrice", {}, language)}
              </option>
              <option value="lowest">
                {t("lowestPrice", {}, language)}
              </option>
              <option value="crop">
                {t("cropNameSort", {}, language)}
              </option>
            </select>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-green-900">
              {t("cropPriceSummary", {}, language)}
            </h2>

            {loadingPrices && (
              <p className="text-sm text-gray-500">
                {t("loadingPrices", {}, language)}
              </p>
            )}
          </div>

          {groupedCropSummary.length === 0 ? (
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 text-center">
              <p className="text-gray-600">
                {t("noCropPricesForFilters", {}, language)}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {groupedCropSummary.map((summary) => {
                const advice =
                  getSellingAdvice(summary);

                return (
                  <article
                    key={summary.commodity}
                    className="bg-white rounded-2xl border border-green-100 shadow-sm p-4"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={summary.image}
                        alt={summary.commodity}
                        className="w-16 h-16 rounded-xl object-cover border border-green-100 bg-green-50"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-green-900">
                            {summary.commodity}
                          </h3>

                          <span className="text-sm">
                            {summary.icon}
                          </span>

                          <span
                            className={`${advice.className} px-2.5 py-1 rounded-full text-xs font-semibold`}
                          >
                            {advice.label}
                          </span>
                        </div>

                        <p className="text-sm text-gray-500 mt-1">
                          {summary.records.length} {t("recordCount", {}, language)} •{" "}
                          {summary.marketsCount} {t("marketCountLower", {}, language)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          {t("highest", {}, language)}
                        </p>
                        <p className="font-bold text-green-800 mt-1">
                          {formatCurrency(
                            summary.highest.modalPrice
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {summary.highest.market}
                        </p>
                      </div>

                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          {t("lowest", {}, language)}
                        </p>
                        <p className="font-bold text-red-700 mt-1">
                          {formatCurrency(
                            summary.lowest.modalPrice
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {summary.lowest.market}
                        </p>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          {t("averageLabel", {}, language)}
                        </p>
                        <p className="font-bold text-blue-700 mt-1">
                          {formatCurrency(
                            summary.average
                          )}
                        </p>
                      </div>

                      <div className="bg-yellow-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">
                          {t("bestPlace", {}, language)}
                        </p>
                        <p className="font-bold text-yellow-700 mt-1 text-sm">
                          {summary.highest.market}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchText(summary.commodity);
                        setSelectedCategory("all");
                      }}
                      className="w-full mt-4 bg-green-700 text-white py-2.5 rounded-xl font-semibold"
                    >
                      {t("viewCommodityDetails", { crop: summary.commodity }, language)}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-green-900">
              {t("mandiPriceDetails", {}, language)}
            </h2>

            {loadingPrices && (
              <p className="text-sm text-gray-500">
                {t("refreshing", {}, language)}
              </p>
            )}
          </div>

          {filteredPrices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 text-center">
              <p className="text-gray-600">
                {t("noMarketRecords", {}, language)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPrices.slice(0, 60).map((item) => (
                <article
                  key={item.id}
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-4"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={item.image}
                      alt={item.commodity}
                      className="w-14 h-14 rounded-xl object-cover border border-green-100 bg-green-50"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-green-900">
                          {item.commodity}
                        </h3>

                        <span className="text-sm">
                          {item.icon}
                        </span>

                        {item.isDemo && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                            DEMO
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        {item.variety} • {item.market}
                      </p>

                      <p className="text-sm text-gray-500">
                        {[item.mandal, item.district, item.state]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">
                        {t("minPrice", {}, language)}
                      </p>
                      <p className="font-bold text-gray-800 mt-1">
                        {formatCurrency(
                          item.minimumPrice
                        )}
                      </p>
                    </div>

                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">
                        {t("modalPrice", {}, language)}
                      </p>
                      <p className="font-bold text-green-800 mt-1">
                        {formatCurrency(
                          item.modalPrice
                        )}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">
                        {t("maxPrice", {}, language)}
                      </p>
                      <p className="font-bold text-gray-800 mt-1">
                        {formatCurrency(
                          item.maximumPrice
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      {t("dateLabel", {}, language)} {item.arrivalDate || t("notAvailable", {}, language)}
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${item.market}, ${item.district}, ${item.state}`
                          )}`,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                      className="text-sm bg-blue-600 text-white px-3 py-2 rounded-xl font-semibold"
                    >
                      {t("openMarket", {}, language)}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-green-900">
              {t("nearbySellingPlaces", {}, language)}
            </h2>

            <button
              type="button"
              onClick={openGeneralMapSearch}
              className="bg-green-700 text-white px-4 py-2 rounded-xl font-semibold"
            >
              {t("searchInMaps", {}, language)}
            </button>
          </div>

          {loadingSellingPoints ? (
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 text-center">
              <p className="text-gray-600">
                {t("searchingNearbyPlaces", {}, language)}
              </p>
            </div>
          ) : sellingPoints.length === 0 ? (
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 text-center">
              <p className="text-gray-600">
                {t("noMappedPlaces", {}, language)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sellingPoints.map((point) => (
                <article
                  key={point.id}
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-green-900">
                        {point.name}
                      </h3>

                      <p className="text-sm text-gray-600 mt-1">
                        {point.type}
                      </p>

                      <p className="text-sm text-gray-500 mt-1">
                        {point.address || t("addressNotAvailable", {}, language)}
                      </p>

                      <p className="text-sm text-gray-500 mt-1">
                        {t("distanceLabel", {}, language)} {point.distance.toFixed(1)} km
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        openDirections(point)
                      }
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold"
                    >
                      {t("directions", {}, language)}
                    </button>

                    {point.phone && (
                      <a
                        href={`tel:${point.phone}`}
                        className="bg-green-700 text-white px-4 py-2 rounded-xl font-semibold"
                      >
                        {t("call", {}, language)}
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
