import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Database,
  IndianRupee,
  MapPin,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  Users,
  Wheat,
  X,
} from "lucide-react";

import { database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

/*
|--------------------------------------------------------------------------
| Agmarknet / data.gov.in configuration
|--------------------------------------------------------------------------
| This is the SAME resource used by the Farmer Market Prices page.
*/
const MANDI_RESOURCE_ID =
  "9ef84268-d588-465a-a308-a864a43d0070";

const API_PAGE_LIMIT = 1000;

/*
|--------------------------------------------------------------------------
| Telangana - all 33 districts
|--------------------------------------------------------------------------
*/
const TELANGANA_DISTRICTS = [
  "Adilabad",
  "Bhadradri Kothagudem",
  "Hanamkonda",
  "Hyderabad",
  "Jagtial",
  "Jangaon",
  "Jayashankar Bhupalpally",
  "Jogulamba Gadwal",
  "Kamareddy",
  "Karimnagar",
  "Khammam",
  "Komaram Bheem Asifabad",
  "Mahabubabad",
  "Mahabubnagar",
  "Mancherial",
  "Medak",
  "Medchal-Malkajgiri",
  "Mulugu",
  "Nagarkurnool",
  "Nalgonda",
  "Narayanpet",
  "Nirmal",
  "Nizamabad",
  "Peddapalli",
  "Rajanna Sircilla",
  "Rangareddy",
  "Sangareddy",
  "Siddipet",
  "Suryapet",
  "Vikarabad",
  "Wanaparthy",
  "Warangal",
  "Yadadri Bhuvanagiri",
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function cleanValue(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "";
  }

  return String(value).trim();
}

function normalizeDistrict(value) {
  const district = normalize(value)
    .replace(/\s+/g, " ")
    .replace(/district$/i, "")
    .trim();

  const aliases = {
    rangareddy: "rangareddy",
    "ranga reddy": "rangareddy",
    "ranga reddy district": "rangareddy",

    "komaram bheem asifabad":
      "komaram bheem asifabad",

    "komaram bheem":
      "komaram bheem asifabad",

    "jayashankar bhupalapally":
      "jayashankar bhupalpally",

    "jayashankar bhupalpally":
      "jayashankar bhupalpally",

    "yadadri bhuvanagiri":
      "yadadri bhuvanagiri",

    "yadadri":
      "yadadri bhuvanagiri",

    "medchal malkajgiri":
      "medchal-malkajgiri",

    "medchal-malkajgiri":
      "medchal-malkajgiri",

    "jogulamba gadwal":
      "jogulamba gadwal",

    "jogulamba":
      "jogulamba gadwal",
  };

  return aliases[district] || district;
}

function formatPrice(value) {
  const number = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );

  if (!Number.isFinite(number) || number <= 0) {
    return "Not available";
  }

  return `₹${number.toLocaleString("en-IN")}`;
}

function getNumericPrice(value) {
  const number = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

function formatDate(value) {
  if (!value) {
    return "Date not available";
  }

  const raw = String(value).trim();

  /*
   * Agmarknet commonly returns dates in formats such as:
   * DD/MM/YYYY
   * YYYY-MM-DD
   */
  let date = null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");

    date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
  } else {
    date = new Date(raw);
  }

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  const raw = String(value).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).getTime();
  }

  const timestamp = new Date(raw).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getCropName(record) {
  return cleanValue(
    record?.commodity ||
      record?.cropName ||
      record?.crop ||
      record?.productName
  );
}

function getMarketName(record) {
  return cleanValue(
    record?.market ||
      record?.marketName ||
      record?.mandi
  );
}

function getDistrictName(record) {
  return cleanValue(
    record?.district ||
      record?.districtName
  );
}

function getStateName(record) {
  return cleanValue(record?.state) || "Telangana";
}

function getMinimumPrice(record) {
  return (
    getNumericPrice(
      record?.min_price ??
        record?.minimumPrice ??
        record?.minPrice
    ) ?? null
  );
}

function getMaximumPrice(record) {
  return (
    getNumericPrice(
      record?.max_price ??
        record?.maximumPrice ??
        record?.maxPrice
    ) ?? null
  );
}

function getModalPrice(record) {
  return (
    getNumericPrice(
      record?.modal_price ??
        record?.modalPrice ??
        record?.price ??
        record?.marketPrice
    ) ?? null
  );
}

function getArrivalDate(record) {
  return cleanValue(
    record?.arrival_date ||
      record?.arrivalDate ||
      record?.date
  );
}

function getUnit(record) {
  return (
    cleanValue(
      record?.unit ||
        record?.priceUnit
    ) || "Quintal"
  );
}

/*
|--------------------------------------------------------------------------
| API URL
|--------------------------------------------------------------------------
*/

function buildMandiUrl({
  state = "Telangana",
  limit = API_PAGE_LIMIT,
  offset = 0,
}) {
  const apiKey =
    import.meta.env.VITE_DATA_GOV_API_KEY;

  const params = new URLSearchParams({
    "api-key": apiKey || "",
    format: "json",
    limit: String(limit),
    offset: String(offset),
  });

  params.set(
    "filters[state]",
    state
  );

  return `https://api.data.gov.in/resource/${MANDI_RESOURCE_ID}?${params.toString()}`;
}

/*
|--------------------------------------------------------------------------
| Fetch ALL Telangana mandi records
|--------------------------------------------------------------------------
|
| We paginate instead of requesting only the first 50 records.
| This is important because the Admin page needs state-wide information.
|--------------------------------------------------------------------------
*/

async function fetchAllTelanganaMandiRecords() {
  const apiKey =
    import.meta.env.VITE_DATA_GOV_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing VITE_DATA_GOV_API_KEY."
    );
  }

  const allRecords = [];
  let offset = 0;

  /*
   * Safety limit prevents an accidental endless API loop.
   */
  const MAX_PAGES = 20;

  for (
    let page = 0;
    page < MAX_PAGES;
    page += 1
  ) {
    const response = await fetch(
      buildMandiUrl({
        state: "Telangana",
        limit: API_PAGE_LIMIT,
        offset,
      })
    );

    if (!response.ok) {
      throw new Error(
        `Mandi API request failed with status ${response.status}.`
      );
    }

    const data = await response.json();

    const records = Array.isArray(data?.records)
      ? data.records
      : [];

    allRecords.push(...records);

    if (records.length < API_PAGE_LIMIT) {
      break;
    }

    offset += API_PAGE_LIMIT;
  }

  return allRecords;
}

/*
|--------------------------------------------------------------------------
| Farmer data
|--------------------------------------------------------------------------
*/

async function fetchFarmerInformation() {
  try {
    const snapshot = await get(
      ref(database, "users")
    );

    if (!snapshot.exists()) {
      return [];
    }

    const users = snapshot.val();

    return Object.entries(users)
      .filter(
        ([, user]) =>
          user &&
          typeof user === "object" &&
          normalize(user.role) === "farmer"
      )
      .map(([uid, user]) => ({
        uid,
        ...user,
      }));
  } catch (error) {
    console.error(
      "Unable to load farmer information:",
      error
    );

    return [];
  }
}

/*
|--------------------------------------------------------------------------
| Main component
|--------------------------------------------------------------------------
*/

export default function MarketPriceManagementPage() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [farmers, setFarmers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [selectedDistrict, setSelectedDistrict] =
    useState(null);

  const [selectedCrop, setSelectedCrop] =
    useState(null);

  const [selectedMarket, setSelectedMarket] =
    useState(null);

  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadPageData();
  }, []);

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });
  }

  async function loadPageData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [marketData, farmerData] =
        await Promise.all([
          fetchAllTelanganaMandiRecords(),
          fetchFarmerInformation(),
        ]);

      /*
       * Keep only records that actually contain a crop
       * and a valid current/modal price.
       *
       * This prevents empty API rows from becoming
       * fake market-price records.
       */
      const validRecords = marketData
        .filter((record) => {
          const crop = getCropName(record);
          const modalPrice =
            getModalPrice(record);

          return Boolean(crop) && modalPrice !== null;
        })
        .map((record, index) => ({
          ...record,
          _id:
            record.id ||
            `${getCropName(record)}-${getMarketName(
              record
            )}-${getDistrictName(record)}-${index}`,
        }));

      setRecords(validRecords);
      setFarmers(farmerData);

      if (validRecords.length === 0) {
        showMessage(
          "info",
          "No current Telangana mandi price records were returned by the government market-price API."
        );
      } else if (isRefresh) {
        showMessage(
          "success",
          "Latest Telangana mandi prices refreshed successfully."
        );
      }
    } catch (error) {
      console.error(
        "Market price management error:",
        error
      );

      setRecords([]);

      showMessage(
        "error",
        error?.message?.includes(
          "VITE_DATA_GOV_API_KEY"
        )
          ? "Government mandi-price API key is missing. Check VITE_DATA_GOV_API_KEY in your environment configuration."
          : "Unable to load current government mandi prices. Please check the internet connection and API availability."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /*
   * Search is intentionally global.
   */
  const searchedRecords = useMemo(() => {
    const keyword = normalize(search);

    if (!keyword) {
      return records;
    }

    return records.filter((record) => {
      return [
        getCropName(record),
        getMarketName(record),
        getDistrictName(record),
        getStateName(record),
        record?.variety,
      ]
        .map(normalize)
        .join(" ")
        .includes(keyword);
    });
  }, [records, search]);

  /*
   * Unique crops.
   */
  const crops = useMemo(() => {
    const map = new Map();

    searchedRecords.forEach((record) => {
      const crop = getCropName(record);

      if (!crop) {
        return;
      }

      const key = normalize(crop);

      if (!map.has(key)) {
        map.set(key, crop);
      }
    });

    return [...map.values()].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [searchedRecords]);

  /*
   * Unique markets.
   */
  const markets = useMemo(() => {
    const map = new Map();

    searchedRecords.forEach((record) => {
      const market = getMarketName(record);

      if (!market) {
        return;
      }

      const key = normalize(
        `${market}|${getDistrictName(record)}`
      );

      if (!map.has(key)) {
        map.set(key, {
          name: market,
          district:
            getDistrictName(record),
        });
      }
    });

    return [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [searchedRecords]);

  /*
   * Districts that actually have current API data.
   */
  const districtsWithData = useMemo(() => {
    const set = new Set();

    records.forEach((record) => {
      const district = normalizeDistrict(
        getDistrictName(record)
      );

      if (district) {
        set.add(district);
      }
    });

    return set;
  }, [records]);

  /*
   * Farmer statistics.
   */
  const farmerStatistics = useMemo(() => {
    const farmerCropMap = new Map();

    farmers.forEach((farmer) => {
      const district = normalizeDistrict(
        farmer?.district
      );

      const cropValues = [];

      if (farmer?.mainCrop) {
        cropValues.push(farmer.mainCrop);
      }

      if (Array.isArray(farmer?.crops)) {
        cropValues.push(...farmer.crops);
      }

      if (typeof farmer?.crops === "string") {
        cropValues.push(
          ...farmer.crops.split(",")
        );
      }

      cropValues.forEach((crop) => {
        const cleanCrop = cleanValue(crop);

        if (!cleanCrop) {
          return;
        }

        const key = normalize(cleanCrop);

        if (!farmerCropMap.has(key)) {
          farmerCropMap.set(key, {
            crop: cleanCrop,
            farmers: 0,
          });
        }

        farmerCropMap.get(key).farmers += 1;
      });

      /*
       * Keep district in the farmer object itself.
       */
      void district;
    });

    return {
      totalFarmers: farmers.length,
      cropMap: farmerCropMap,
    };
  }, [farmers]);

  /*
   * Global summary.
   */
  const statistics = useMemo(() => {
    let latestTimestamp = 0;
    let latestDate = "";

    records.forEach((record) => {
      const date = getArrivalDate(record);
      const timestamp = getTimestamp(date);

      if (timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
        latestDate = date;
      }
    });

    return {
      totalDistricts:
        TELANGANA_DISTRICTS.length,

      districtsWithData:
        districtsWithData.size,

      totalRecords:
        records.length,

      totalMarkets:
        markets.length,

      totalCrops:
        crops.length,

      totalFarmers:
        farmers.length,

      latestDate,
    };
  }, [
    records,
    markets,
    crops,
    farmers,
    districtsWithData,
  ]);

  /*
   * District-specific records.
   */
  const districtRecords = useMemo(() => {
    if (!selectedDistrict) {
      return [];
    }

    const target = normalizeDistrict(
      selectedDistrict
    );

    return records
      .filter(
        (record) =>
          normalizeDistrict(
            getDistrictName(record)
          ) === target
      )
      .sort((a, b) => {
        const cropCompare =
          getCropName(a).localeCompare(
            getCropName(b)
          );

        if (cropCompare !== 0) {
          return cropCompare;
        }

        return (
          getMarketName(a).localeCompare(
            getMarketName(b)
          )
        );
      });
  }, [records, selectedDistrict]);

  /*
   * District crops.
   */
  const districtCrops = useMemo(() => {
    const map = new Map();

    districtRecords.forEach((record) => {
      const crop = getCropName(record);

      if (!crop) {
        return;
      }

      const key = normalize(crop);

      if (!map.has(key)) {
        map.set(key, crop);
      }
    });

    return [...map.values()].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [districtRecords]);

  /*
   * District markets.
   */
  const districtMarkets = useMemo(() => {
    const map = new Map();

    districtRecords.forEach((record) => {
      const market = getMarketName(record);

      if (!market) {
        return;
      }

      const key = normalize(market);

      if (!map.has(key)) {
        map.set(key, market);
      }
    });

    return [...map.values()].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [districtRecords]);

  /*
   * Farmer information for selected district.
   */
  const districtFarmers = useMemo(() => {
    if (!selectedDistrict) {
      return [];
    }

    const target = normalizeDistrict(
      selectedDistrict
    );

    return farmers.filter(
      (farmer) =>
        normalizeDistrict(
          farmer?.district
        ) === target
    );
  }, [farmers, selectedDistrict]);

  /*
   * Farmer crops for selected district.
   */
  const districtFarmerCrops = useMemo(() => {
    const map = new Map();

    districtFarmers.forEach((farmer) => {
      const values = [];

      if (farmer?.mainCrop) {
        values.push(farmer.mainCrop);
      }

      if (Array.isArray(farmer?.crops)) {
        values.push(...farmer.crops);
      }

      if (typeof farmer?.crops === "string") {
        values.push(
          ...farmer.crops.split(",")
        );
      }

      values.forEach((crop) => {
        const cleanCrop = cleanValue(crop);

        if (!cleanCrop) {
          return;
        }

        const key = normalize(cleanCrop);

        if (!map.has(key)) {
          map.set(key, {
            crop: cleanCrop,
            count: 0,
          });
        }

        map.get(key).count += 1;
      });
    });

    return [...map.values()].sort(
      (a, b) => b.count - a.count
    );
  }, [districtFarmers]);

  /*
   * Selected crop records.
   */
  const cropRecords = useMemo(() => {
    if (!selectedCrop) {
      return [];
    }

    const target = normalize(selectedCrop);

    return records
      .filter(
        (record) =>
          normalize(
            getCropName(record)
          ) === target
      )
      .sort(
        (a, b) =>
          (getModalPrice(b) || 0) -
          (getModalPrice(a) || 0)
      );
  }, [records, selectedCrop]);

  /*
   * Selected market records.
   */
  const marketRecords = useMemo(() => {
    if (!selectedMarket) {
      return [];
    }

    return records
      .filter((record) => {
        return (
          normalize(
            getMarketName(record)
          ) ===
          normalize(selectedMarket.name) &&
          normalizeDistrict(
            getDistrictName(record)
          ) ===
          normalizeDistrict(
            selectedMarket.district
          )
        );
      })
      .sort(
        (a, b) =>
          (getModalPrice(b) || 0) -
          (getModalPrice(a) || 0)
      );
  }, [records, selectedMarket]);

  /*
   * Loading state.
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-indigo-100 shadow-xl p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Wheat
              size={30}
              className="text-indigo-700 animate-pulse"
            />
          </div>

          <h1 className="text-xl font-bold text-slate-900 mt-5">
            Loading Market Prices
          </h1>

          <p className="text-slate-500 mt-2">
            Fetching the latest Telangana mandi
            prices and farmer information.
          </p>

          <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-2/3 bg-indigo-600 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {/* =====================================================
            HEADER
        ====================================================== */}

        <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner">
                <Wheat size={30} />
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Market Price Management
                </h1>

                <p className="text-indigo-200 mt-1">
                  Monitor real Telangana mandi prices
                  and market information.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate("/admin")
                }
                className="inline-flex items-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2.5 rounded-xl font-semibold transition"
              >
                <ArrowLeft size={18} />
                Admin Dashboard
              </button>

              <button
                type="button"
                onClick={() =>
                  loadPageData(true)
                }
                disabled={refreshing}
                className="inline-flex items-center gap-2 bg-white text-indigo-900 px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-indigo-100">
              <TrendingUp size={15} />
              Government mandi data
            </span>

            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-indigo-100">
              <CalendarDays size={15} />
              Daily market information
            </span>

            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-indigo-100">
              <Database size={15} />
              Read-only Admin view
            </span>
          </div>
        </header>

        {/* =====================================================
            SUMMARY
        ====================================================== */}

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <SummaryCard
            title="Districts"
            value={statistics.totalDistricts}
            subtitle={`${statistics.districtsWithData} with data`}
            icon={MapPin}
          />

          <SummaryCard
            title="Records"
            value={statistics.totalRecords}
            subtitle="Current API records"
            icon={Database}
          />

          <SummaryCard
            title="Markets"
            value={statistics.totalMarkets}
            subtitle="Unique markets"
            icon={Store}
          />

          <SummaryCard
            title="Crops"
            value={statistics.totalCrops}
            subtitle="Unique commodities"
            icon={Wheat}
          />

          <SummaryCard
            title="Farmers"
            value={statistics.totalFarmers}
            subtitle="Registered farmers"
            icon={Users}
          />
        </section>

        {/* =====================================================
            SEARCH
        ====================================================== */}

        <section className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-4 md:p-5 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search crop, market or district..."
                className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-700 rounded-xl px-5 py-3 font-semibold hover:bg-slate-50 transition"
              >
                <X size={17} />
                Clear
              </button>
            )}
          </div>

          <p className="text-sm text-slate-500 mt-3">
            Showing{" "}
            <strong className="text-slate-800">
              {searchedRecords.length}
            </strong>{" "}
            current market records.
          </p>
        </section>

        {/* =====================================================
            DISTRICTS
        ====================================================== */}

        <section className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">
                Telangana
              </p>

              <h2 className="text-2xl md:text-3xl font-bold text-slate-950 mt-1">
                All 33 Districts
              </h2>

              <p className="text-slate-500 mt-1">
                Select a district to view its complete
                market-price information.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <MapPin
                size={17}
                className="text-indigo-600"
              />
              33 Telangana districts
            </div>
          </div>

          {search ? (
            <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-900">
              Search is active. District names below
              remain available, while market records are
              filtered by your search.
            </div>
          ) : null}

          {/* IMPORTANT:
              District cards contain ONLY district names.
              No crops/farmers/markets/options inside them.
          */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TELANGANA_DISTRICTS.map(
              (district, index) => {
                const hasData =
                  districtsWithData.has(
                    normalizeDistrict(district)
                  );

                return (
                  <button
                    key={district}
                    type="button"
                    onClick={() =>
                      setSelectedDistrict(
                        district
                      )
                    }
                    className="group w-full text-left bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-xl px-4 py-4 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 shrink-0 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </span>

                      <span className="flex-1 font-semibold text-slate-900">
                        {district}
                      </span>

                      <ChevronRight
                        size={19}
                        className="text-slate-400 group-hover:text-indigo-600 transition"
                      />
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </section>

        {/* =====================================================
            QUICK ACCESS
        ====================================================== */}

        <section className="grid md:grid-cols-3 gap-4 mb-8">
          <QuickAccessCard
            title="All Crops"
            description="View every crop currently appearing in Telangana mandi data."
            icon={Wheat}
            value={statistics.totalCrops}
            onClick={() => {
              setSelectedCrop("__ALL__");
            }}
          />

          <QuickAccessCard
            title="All Markets"
            description="View unique markets and the districts where they are available."
            icon={Store}
            value={statistics.totalMarkets}
            onClick={() => {
              setSelectedMarket({
                name: "__ALL__",
                district: "",
              });
            }}
          />

          <QuickAccessCard
            title="All Records"
            description="Read the current government mandi records received by the application."
            icon={Database}
            value={statistics.totalRecords}
            onClick={() => {
              setSelectedRecord({
                __all: true,
              });
            }}
          />
        </section>

        {/* =====================================================
            DATA SOURCE INFORMATION
        ====================================================== */}

        <section className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <CircleAlert
                size={20}
                className="text-indigo-700"
              />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Market Price Information
              </h2>

              <p className="text-sm text-slate-600 mt-1 leading-6">
                Prices displayed on this page are
                read-only government mandi records
                fetched from the same market-price
                source used by the Farmer Module. The
                Admin does not manually enter or change
                market prices.
              </p>

              {statistics.latestDate && (
                <p className="text-sm text-indigo-700 font-semibold mt-2">
                  Latest available market date:{" "}
                  {formatDate(
                    statistics.latestDate
                  )}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================
          DISTRICT DETAILS MODAL
      ====================================================== */}

      {selectedDistrict && (
        <Modal
          title={selectedDistrict}
          subtitle="District Market Information"
          onClose={() =>
            setSelectedDistrict(null)
          }
          wide
        >
          <DistrictDetails
            district={selectedDistrict}
            records={districtRecords}
            crops={districtCrops}
            markets={districtMarkets}
            farmers={districtFarmers}
            farmerCrops={districtFarmerCrops}
            onRecordClick={(record) =>
              setSelectedRecord(record)
            }
          />
        </Modal>
      )}

      {/* =====================================================
          CROP MODAL
      ====================================================== */}

      {selectedCrop && (
        <Modal
          title={
            selectedCrop === "__ALL__"
              ? "All Telangana Crops"
              : selectedCrop
          }
          subtitle="Current government mandi information"
          onClose={() =>
            setSelectedCrop(null)
          }
          wide
        >
          <CropDetails
            crop={selectedCrop}
            records={
              selectedCrop === "__ALL__"
                ? records
                : cropRecords
            }
          />
        </Modal>
      )}

      {/* =====================================================
          MARKET MODAL
      ====================================================== */}

      {selectedMarket && (
        <Modal
          title={
            selectedMarket.name === "__ALL__"
              ? "All Telangana Markets"
              : selectedMarket.name
          }
          subtitle="Current mandi market information"
          onClose={() =>
            setSelectedMarket(null)
          }
          wide
        >
          <MarketDetails
            market={selectedMarket}
            records={
              selectedMarket.name === "__ALL__"
                ? records
                : marketRecords
            }
          />
        </Modal>
      )}

      {/* =====================================================
          RECORD MODAL
      ====================================================== */}

      {selectedRecord && (
        <Modal
          title={
            selectedRecord.__all
              ? "All Market Records"
              : getCropName(selectedRecord)
          }
          subtitle={
            selectedRecord.__all
              ? "Current government mandi records"
              : "Market price record"
          }
          onClose={() =>
            setSelectedRecord(null)
          }
          wide
        >
          <RecordDetails
            records={
              selectedRecord.__all
                ? records
                : [selectedRecord]
            }
          />
        </Modal>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Summary Card
|--------------------------------------------------------------------------
*/

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
}) {
  return (
    <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="text-3xl font-bold text-slate-950 mt-1">
            {value}
          </p>

          <p className="text-xs text-slate-500 mt-1">
            {subtitle}
          </p>
        </div>

        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon
            size={21}
            className="text-indigo-700"
          />
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Quick Access Card
|--------------------------------------------------------------------------
*/

function QuickAccessCard({
  title,
  description,
  icon: Icon,
  value,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-5 text-left transition"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon
            size={21}
            className="text-indigo-700"
          />
        </div>

        <span className="text-2xl font-bold text-indigo-800">
          {value}
        </span>
      </div>

      <h3 className="font-bold text-slate-900 mt-4">
        {title}
      </h3>

      <p className="text-sm text-slate-500 mt-1 leading-5">
        {description}
      </p>

      <div className="flex items-center gap-1 text-sm font-semibold text-indigo-700 mt-4">
        Open
        <ChevronRight size={16} />
      </div>
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Modal
|--------------------------------------------------------------------------
*/

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
      <div
        className={`w-full ${
          wide ? "max-w-6xl" : "max-w-2xl"
        } max-h-[92vh] overflow-hidden bg-slate-50 rounded-3xl shadow-2xl`}
      >
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white px-5 md:px-7 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">
                Market Price Information
              </p>

              <h2 className="text-2xl font-bold mt-1">
                {title}
              </h2>

              <p className="text-indigo-200 text-sm mt-1">
                {subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              aria-label="Close"
            >
              <X size={21} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-105px)] p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| District Details
|--------------------------------------------------------------------------
*/

function DistrictDetails({
  district,
  records,
  crops,
  markets,
  farmers,
  farmerCrops,
  onRecordClick,
}) {
  return (
    <div>
      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <DetailStat
          label="Records"
          value={records.length}
          icon={Database}
        />

        <DetailStat
          label="Markets"
          value={markets.length}
          icon={Store}
        />

        <DetailStat
          label="Mandi Crops"
          value={crops.length}
          icon={Wheat}
        />

        <DetailStat
          label="Farmers"
          value={farmers.length}
          icon={Users}
        />

        <DetailStat
          label="Farmer Crops"
          value={farmerCrops.length}
          icon={TrendingUp}
        />
      </div>

      {/* No data */}
      {records.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center mt-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center">
            <Database
              size={28}
              className="text-slate-400"
            />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mt-4">
            No current mandi data for{" "}
            {district}
          </h3>

          <p className="text-slate-500 text-sm mt-2">
            The government market-price API did not
            return a current record for this district.
          </p>
        </div>
      ) : (
        <>
          {/* Markets */}
          <section className="mt-6">
            <SectionTitle
              icon={Store}
              title={`Markets in ${district}`}
              count={markets.length}
            />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {markets.map((market) => (
                <div
                  key={market}
                  className="bg-white border border-slate-200 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Store
                        size={18}
                        className="text-indigo-700"
                      />
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {market}
                      </p>

                      <p className="text-xs text-slate-500 mt-0.5">
                        {district}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Crops */}
          <section className="mt-6">
            <SectionTitle
              icon={Wheat}
              title="Crops with Current Mandi Data"
              count={crops.length}
            />

            <div className="flex flex-wrap gap-2">
              {crops.map((crop) => (
                <span
                  key={crop}
                  className="inline-flex items-center gap-2 bg-green-50 border border-green-100 text-green-800 rounded-full px-3 py-2 text-sm font-semibold"
                >
                  <Wheat size={15} />
                  {crop}
                </span>
              ))}
            </div>
          </section>

          {/* Current prices */}
          <section className="mt-6">
            <SectionTitle
              icon={IndianRupee}
              title="Current Market Prices"
              count={records.length}
            />

            <div className="space-y-3">
              {records.map((record) => (
                <PriceRecordCard
                  key={record._id}
                  record={record}
                  onClick={() =>
                    onRecordClick(record)
                  }
                />
              ))}
            </div>
          </section>

          {/* Farmer information */}
          <section className="mt-6">
            <SectionTitle
              icon={Users}
              title={`Farmer Information in ${district}`}
              count={farmers.length}
            />

            {farmers.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm text-slate-500">
                  No registered farmer records were
                  found for this district.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {farmerCrops.map((item) => (
                  <div
                    key={item.crop}
                    className="bg-white border border-slate-200 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Wheat
                          size={18}
                          className="text-green-700"
                        />

                        <span className="font-semibold text-slate-900">
                          {item.crop}
                        </span>
                      </div>

                      <span className="bg-green-50 text-green-700 rounded-full px-2.5 py-1 text-xs font-bold">
                        {item.count} farmer
                        {item.count === 1
                          ? ""
                          : "s"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Price Record Card
|--------------------------------------------------------------------------
*/

function PriceRecordCard({
  record,
  onClick,
}) {
  const minimum = getMinimumPrice(record);
  const maximum = getMaximumPrice(record);
  const modal = getModalPrice(record);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-4 md:p-5 text-left transition"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Wheat
              size={21}
              className="text-green-700"
            />
          </div>

          <div>
            <h3 className="font-bold text-lg text-slate-950">
              {getCropName(record)}
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              <Store
                size={14}
                className="inline mr-1"
              />
              {getMarketName(record) ||
                "Market not available"}
            </p>

            <p className="text-xs text-slate-500 mt-1">
              {getDistrictName(record) ||
                "District not available"}
              {" · "}
              {getArrivalDate(record)
                ? formatDate(
                    getArrivalDate(record)
                  )
                : "Date not available"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:min-w-[390px]">
          <PriceMiniBox
            label="Minimum"
            value={formatPrice(minimum)}
          />

          <PriceMiniBox
            label="Modal"
            value={formatPrice(modal)}
            highlight
          />

          <PriceMiniBox
            label="Maximum"
            value={formatPrice(maximum)}
          />
        </div>
      </div>
    </button>
  );
}

function PriceMiniBox({
  label,
  value,
  highlight = false,
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlight
          ? "bg-indigo-50 border border-indigo-100"
          : "bg-slate-50 border border-slate-100"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
        {label}
      </p>

      <p
        className={`text-sm font-bold mt-1 ${
          highlight
            ? "text-indigo-800"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Crop Details
|--------------------------------------------------------------------------
*/

function CropDetails({
  crop,
  records,
}) {
  if (records.length === 0) {
    return (
      <EmptyModalState
        title="No crop data available"
        description="The government mandi API did not return current records for this crop."
      />
    );
  }

  const uniqueDistricts = new Set(
    records.map((record) =>
      normalizeDistrict(
        getDistrictName(record)
      )
    )
  );

  const uniqueMarkets = new Set(
    records.map((record) =>
      normalize(
        getMarketName(record)
      )
    )
  );

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailStat
          label="Records"
          value={records.length}
          icon={Database}
        />

        <DetailStat
          label="Districts"
          value={uniqueDistricts.size}
          icon={MapPin}
        />

        <DetailStat
          label="Markets"
          value={uniqueMarkets.size}
          icon={Store}
        />

        <DetailStat
          label="Crop"
          value={crop === "__ALL__" ? "All" : "1"}
          icon={Wheat}
        />
      </div>

      <div className="space-y-3 mt-6">
        {records.map((record, index) => (
          <PriceRecordCard
            key={
              record._id ||
              `${getCropName(record)}-${index}`
            }
            record={record}
            onClick={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Market Details
|--------------------------------------------------------------------------
*/

function MarketDetails({
  market,
  records,
}) {
  if (records.length === 0) {
    return (
      <EmptyModalState
        title="No market data available"
        description="No current market-price records were returned."
      />
    );
  }

  const uniqueCrops = new Set(
    records.map((record) =>
      normalize(
        getCropName(record)
      )
    )
  );

  const districts = [
    ...new Set(
      records
        .map((record) =>
          getDistrictName(record)
        )
        .filter(Boolean)
    ),
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailStat
          label="Records"
          value={records.length}
          icon={Database}
        />

        <DetailStat
          label="Crops"
          value={uniqueCrops.size}
          icon={Wheat}
        />

        <DetailStat
          label="Districts"
          value={districts.length}
          icon={MapPin}
        />

        <DetailStat
          label="Market"
          value={
            market.name === "__ALL__"
              ? "All"
              : "1"
          }
          icon={Store}
        />
      </div>

      {districts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5">
          {districts.map((district) => (
            <span
              key={district}
              className="bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-full px-3 py-1.5 text-sm font-semibold"
            >
              {district}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3 mt-6">
        {records.map((record, index) => (
          <PriceRecordCard
            key={
              record._id ||
              `${getCropName(record)}-${index}`
            }
            record={record}
            onClick={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Record Details
|--------------------------------------------------------------------------
*/

function RecordDetails({
  records,
}) {
  if (records.length === 0) {
    return (
      <EmptyModalState
        title="No records available"
        description="There are currently no market-price records to display."
      />
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record, index) => {
        const minimum =
          getMinimumPrice(record);

        const maximum =
          getMaximumPrice(record);

        const modal =
          getModalPrice(record);

        return (
          <article
            key={
              record._id ||
              `${getCropName(record)}-${index}`
            }
            className="bg-white border border-slate-200 rounded-2xl p-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <Wheat
                    size={20}
                    className="text-green-700"
                  />

                  <h3 className="text-xl font-bold text-slate-950">
                    {getCropName(record) ||
                      "Unknown Crop"}
                  </h3>
                </div>

                <div className="space-y-1 mt-3 text-sm text-slate-600">
                  <p>
                    <Store
                      size={15}
                      className="inline mr-2"
                    />
                    <strong>Market:</strong>{" "}
                    {getMarketName(record) ||
                      "Not available"}
                  </p>

                  <p>
                    <MapPin
                      size={15}
                      className="inline mr-2"
                    />
                    <strong>District:</strong>{" "}
                    {getDistrictName(record) ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>State:</strong>{" "}
                    {getStateName(record)}
                  </p>

                  <p>
                    <CalendarDays
                      size={15}
                      className="inline mr-2"
                    />
                    <strong>Market Date:</strong>{" "}
                    {formatDate(
                      getArrivalDate(record)
                    )}
                  </p>

                  {record?.variety && (
                    <p>
                      <strong>Variety:</strong>{" "}
                      {record.variety}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:min-w-[430px]">
                <LargePriceBox
                  label="Minimum Price"
                  value={formatPrice(minimum)}
                />

                <LargePriceBox
                  label="Modal Price"
                  value={formatPrice(modal)}
                  highlight
                />

                <LargePriceBox
                  label="Maximum Price"
                  value={formatPrice(maximum)}
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>
                Unit:{" "}
                <strong className="text-slate-700">
                  {getUnit(record)}
                </strong>
              </span>

              <span>•</span>

              <span>
                Source: Government mandi data
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Large Price Box
|--------------------------------------------------------------------------
*/

function LargePriceBox({
  label,
  value,
  highlight = false,
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        highlight
          ? "bg-indigo-50 border border-indigo-100"
          : "bg-slate-50 border border-slate-100"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
        {label}
      </p>

      <p
        className={`text-xl font-bold mt-2 ${
          highlight
            ? "text-indigo-800"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <p className="text-xs text-slate-500 mt-1">
        per {getUnit({})}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Detail Stat
|--------------------------------------------------------------------------
*/

function DetailStat({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
          {label}
        </p>

        <Icon
          size={17}
          className="text-indigo-600"
        />
      </div>

      <p className="text-2xl font-bold text-slate-950 mt-1">
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Section Title
|--------------------------------------------------------------------------
*/

function SectionTitle({
  icon: Icon,
  title,
  count,
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <Icon
          size={19}
          className="text-indigo-700"
        />

        <h3 className="font-bold text-slate-900">
          {title}
        </h3>
      </div>

      <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
        {count}
      </span>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Empty State
|--------------------------------------------------------------------------
*/

function EmptyModalState({
  title,
  description,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center">
        <Database
          size={28}
          className="text-slate-400"
        />
      </div>

      <h3 className="text-lg font-bold text-slate-900 mt-4">
        {title}
      </h3>

      <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
        {description}
      </p>
    </div>
  );
}