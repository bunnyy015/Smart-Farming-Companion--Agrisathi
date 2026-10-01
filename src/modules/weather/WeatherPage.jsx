import { saveWeatherContext } from "../../utils/weatherContext";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";

const WEATHER_CODES = {
  0: { labelKey: "conditionClearSky", icon: "☀️" },
  1: { labelKey: "conditionMostlyClear", icon: "🌤️" },
  2: { labelKey: "conditionPartlyCloudy", icon: "⛅" },
  3: { labelKey: "conditionCloudy", icon: "☁️" },
  45: { labelKey: "conditionFog", icon: "🌫️" },
  48: { labelKey: "conditionFog", icon: "🌫️" },
  51: { labelKey: "conditionLightDrizzle", icon: "🌦️" },
  53: { labelKey: "conditionDrizzle", icon: "🌦️" },
  55: { labelKey: "conditionHeavyDrizzle", icon: "🌧️" },
  61: { labelKey: "conditionLightRain", icon: "🌦️" },
  63: { labelKey: "conditionRain", icon: "🌧️" },
  65: { labelKey: "conditionHeavyRain", icon: "🌧️" },
  80: { labelKey: "conditionRainShowers", icon: "🌦️" },
  81: { labelKey: "conditionRainShowers", icon: "🌧️" },
  82: { labelKey: "conditionHeavyShowers", icon: "⛈️" },
  95: { labelKey: "conditionThunderstorm", icon: "⛈️" },
  96: { labelKey: "conditionThunderstorm", icon: "⛈️" },
  99: { labelKey: "conditionSevereThunderstorm", icon: "⛈️" },
};

const SEASON_CROPS = {
  kharif: [
    "Cotton",
    "Paddy",
    "Maize",
    "Soybean",
    "Red Gram",
    "Groundnut",
  ],
  rabi: [
    "Wheat",
    "Chickpea",
    "Maize",
    "Sunflower",
    "Mustard",
    "Vegetables",
  ],
  summer: [
    "Green Gram",
    "Black Gram",
    "Groundnut",
    "Vegetables",
    "Fodder Crops",
  ],
};

const SOIL_CROPS = {
  "black soil": [
    "Cotton",
    "Soybean",
    "Chickpea",
    "Sunflower",
    "Sorghum",
  ],
  "red soil": [
    "Groundnut",
    "Millets",
    "Red Gram",
    "Maize",
    "Vegetables",
  ],
  "sandy soil": [
    "Groundnut",
    "Watermelon",
    "Millets",
    "Vegetables",
  ],
  "loamy soil": [
    "Paddy",
    "Maize",
    "Wheat",
    "Vegetables",
    "Sugarcane",
  ],
  "clay soil": [
    "Paddy",
    "Wheat",
    "Sugarcane",
    "Gram",
  ],
};

export default function WeatherPage() {
  const navigate = useNavigate();
  const language = useLanguage();

  const [profile, setProfile] = useState(null);
  const [location, setLocation] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [hourlyForecast, setHourlyForecast] = useState([]);
  const [dailyForecast, setDailyForecast] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [detectingLocation, setDetectingLocation] =
    useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    initializeWeatherPage();
  }, []);

  const farmingAdvice = useMemo(() => {
    return createFarmingAdvice({
      currentWeather,
      hourlyForecast,
      dailyForecast,
      profile,
    });
  }, [
    currentWeather,
    hourlyForecast,
    dailyForecast,
    profile,
  ]);

  const cropSuggestions = useMemo(() => {
    return createCropSuggestions(
      profile,
      marketPrices
    );
  }, [profile, marketPrices]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 6000);
  }

  async function initializeWeatherPage() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const [profileSnapshot, pricesSnapshot] =
        await Promise.all([
          get(
            ref(
              database,
              `users/${currentUser.uid}`
            )
          ),
          get(ref(database, "marketPrices")),
        ]);

      if (
        !profileSnapshot.exists() ||
        profileSnapshot.val().role !== "farmer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });
        return;
      }

      setProfile({
        uid: currentUser.uid,
        ...profileSnapshot.val(),
      });

      setMarketPrices(
        parseMarketPrices(pricesSnapshot)
      );

      await detectCurrentLocation();
    } catch (error) {
      console.error(
        "Weather initialization error:",
        error
      );

      showMessage(
        "error",
        t("weatherLoadFailed", {}, language)
      );

      setLoading(false);
    }
  }

  function parseMarketPrices(snapshot) {
    if (!snapshot.exists()) {
      return [];
    }

    const results = [];

    function readNode(node, key = "") {
      if (
        !node ||
        typeof node !== "object"
      ) {
        return;
      }

      const cropName =
        node.cropName ||
        node.crop ||
        node.commodity ||
        node.productName ||
        node.name;

      const price = Number(
        node.price ||
          node.modalPrice ||
          node.marketPrice ||
          node.averagePrice ||
          0
      );

      if (cropName && price > 0) {
        results.push({
          id: key,
          cropName: String(cropName),
          price,
          market:
            node.market ||
            node.marketName ||
            node.mandi ||
            "",
          district: node.district || "",
          unit:
            node.unit ||
            node.priceUnit ||
            "quintal",
          updatedAt:
            node.updatedAt ||
            node.date ||
            "",
        });

        return;
      }

      Object.entries(node).forEach(
        ([childKey, childValue]) => {
          readNode(childValue, childKey);
        }
      );
    }

    readNode(snapshot.val());

    return results;
  }

  async function detectCurrentLocation() {
    if (!navigator.geolocation) {
      showMessage(
        "error",
        t("locationUnsupported", {}, language)
      );

      setLoading(false);
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } =
            position.coords;

          await loadLocationAndWeather(
            latitude,
            longitude
          );
        } catch (error) {
          console.error(
            "Location weather error:",
            error
          );

          showMessage(
            "error",
            t("localWeatherFailed", {}, language)
          );
        } finally {
          setDetectingLocation(false);
          setLoading(false);
        }
      },

      (error) => {
        console.error(
          "Geolocation error:",
          error
        );

        showMessage(
          "warning",
          t("locationAccessNeeded", {}, language)
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

  async function loadLocationAndWeather(
    latitude,
    longitude
  ) {
    const weatherParameters =
      new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),

        current: [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "precipitation",
          "rain",
          "weather_code",
          "wind_speed_10m",
          "wind_gusts_10m",
        ].join(","),

        hourly: [
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation_probability",
          "precipitation",
          "rain",
          "weather_code",
          "wind_speed_10m",
          "wind_gusts_10m",
          "soil_temperature_0cm",
          "soil_moisture_0_to_1cm",
          "et0_fao_evapotranspiration",
        ].join(","),

        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_sum",
          "rain_sum",
          "precipitation_probability_max",
          "wind_speed_10m_max",
          "et0_fao_evapotranspiration",
          "sunrise",
          "sunset",
        ].join(","),

        timezone: "auto",
        forecast_days: "7",
      });

    const placeParameters =
      new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        localityLanguage: "en",
      });

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?${weatherParameters.toString()}`;

    const placeUrl =
      `https://api.bigdatacloud.net/data/reverse-geocode-client?${placeParameters.toString()}`;

    const [weatherResponse, placeResponse] =
      await Promise.all([
        fetch(weatherUrl),
        fetch(placeUrl),
      ]);

    if (!weatherResponse.ok) {
      throw new Error(
        "Weather service failed"
      );
    }

    if (!placeResponse.ok) {
      throw new Error(
        "Location service failed"
      );
    }

    const weatherData =
      await weatherResponse.json();

    const placeData =
      await placeResponse.json();

   const locationDetails =
  buildLocationDetails(
    placeData,
    latitude,
    longitude
  );

const currentWeatherDetails =
  weatherData.current || null;

const hourlyForecastDetails =
  buildHourlyForecast(
    weatherData.hourly
  );

const dailyForecastDetails =
  buildDailyForecast(
    weatherData.daily
  );

setLocation(locationDetails);

setCurrentWeather(
  currentWeatherDetails
);

setHourlyForecast(
  hourlyForecastDetails
);

setDailyForecast(
  dailyForecastDetails
);

saveWeatherContext({
  location: locationDetails,
  currentWeather:
    currentWeatherDetails,
  hourlyForecast:
    hourlyForecastDetails,
  dailyForecast:
    dailyForecastDetails,
});

  }

  function buildLocationDetails(
    placeData,
    latitude,
    longitude
  ) {
    const administrative =
      placeData?.localityInfo?.administrative ||
      [];

    function findAdministrative(keywords) {
      return (
        administrative.find((item) => {
          const searchText = `${item.name || ""} ${
            item.description || ""
          }`.toLowerCase();

          return keywords.some((keyword) =>
            searchText.includes(keyword)
          );
        })?.name || ""
      );
    }

    return {
      latitude,
      longitude,

      village:
        placeData.locality ||
        placeData.city ||
        findAdministrative([
          "village",
          "town",
          "city",
        ]) ||
        profile?.village ||
        t("currentLocation", {}, language),

      mandal:
        findAdministrative([
          "mandal",
          "taluk",
          "tehsil",
          "subdistrict",
          "sub-district",
        ]) ||
        profile?.mandal ||
        "",

      district:
        findAdministrative(["district"]) ||
        placeData.city ||
        profile?.district ||
        "",

      state:
        placeData.principalSubdivision ||
        findAdministrative(["state"]) ||
        profile?.state ||
        "",

      country: placeData.countryName || "",
      postcode: placeData.postcode || "",
    };
  }

  function buildHourlyForecast(hourly) {
    if (!hourly?.time) {
      return [];
    }

    return hourly.time.map(
      (time, index) => ({
        time,

        temperature:
          hourly.temperature_2m?.[index],

        humidity:
          hourly.relative_humidity_2m?.[
            index
          ],

        rainProbability:
          hourly
            .precipitation_probability?.[
            index
          ],

        precipitation:
          hourly.precipitation?.[index],

        rain: hourly.rain?.[index],

        weatherCode:
          hourly.weather_code?.[index],

        windSpeed:
          hourly.wind_speed_10m?.[index],

        windGust:
          hourly.wind_gusts_10m?.[
            index
          ],

        soilTemperature:
          hourly.soil_temperature_0cm?.[
            index
          ],

        soilMoisture:
          hourly
            .soil_moisture_0_to_1cm?.[
            index
          ],

        evapotranspiration:
          hourly
            .et0_fao_evapotranspiration?.[
            index
          ],
      })
    );
  }

  function buildDailyForecast(daily) {
    if (!daily?.time) {
      return [];
    }

    return daily.time.map(
      (date, index) => ({
        date,

        weatherCode:
          daily.weather_code?.[index],

        maximumTemperature:
          daily.temperature_2m_max?.[
            index
          ],

        minimumTemperature:
          daily.temperature_2m_min?.[
            index
          ],

        precipitation:
          daily.precipitation_sum?.[
            index
          ],

        rain:
          daily.rain_sum?.[index],

        rainProbability:
          daily
            .precipitation_probability_max?.[
            index
          ],

        maximumWindSpeed:
          daily.wind_speed_10m_max?.[
            index
          ],

        evapotranspiration:
          daily
            .et0_fao_evapotranspiration?.[
            index
          ],

        sunrise: daily.sunrise?.[index],
        sunset: daily.sunset?.[index],
      })
    );
  }

  function createFarmingAdvice({
    currentWeather: current,
    hourlyForecast: hours,
    dailyForecast: days,
    profile: farmerProfile,
  }) {
    if (!current || hours.length === 0) {
      return {
        spray: {
          status: "unknown",
          title: t("sprayAdviceUnavailable", {}, language),
          text: t("forecastRequiredSpray", {}, language),
          icon: "🧴",
        },

        irrigation: {
          status: "unknown",
          title: t("irrigationAdviceUnavailable", {}, language),
          text: t("forecastRequiredIrrigation", {}, language),
          icon: "💧",
        },

        fieldWork: {
          status: "unknown",
          title: t("fieldWorkAdviceUnavailable", {}, language),
          text: t("refreshWeatherTryAgain", {}, language),
          icon: "🚜",
        },

        warnings: [],
      };
    }

    const now = Date.now();

    const upcomingHours = hours
      .filter(
        (hour) =>
          new Date(hour.time).getTime() >=
          now
      )
      .slice(0, 24);

    const nextSixHours =
      upcomingHours.slice(0, 6);

    const nextTwelveHours =
      upcomingHours.slice(0, 12);

    const highRainSoon =
      nextSixHours.some(
        (hour) =>
          Number(hour.rainProbability || 0) >=
            40 ||
          Number(hour.precipitation || 0) >
            0.2
      );

    const strongWindSoon =
      nextSixHours.some(
        (hour) =>
          Number(hour.windSpeed || 0) > 15 ||
          Number(hour.windGust || 0) > 25
      );

    const extremeTemperatureSoon =
      nextSixHours.some(
        (hour) =>
          Number(hour.temperature || 0) >
            34 ||
          Number(hour.temperature || 0) <
            15
      );

    const sprayWindow =
      upcomingHours.find((hour, index) => {
        const nextHours =
          upcomingHours.slice(
            index,
            index + 4
          );

        return (
          nextHours.length >= 3 &&
          nextHours.every(
            (candidate) =>
              Number(
                candidate.rainProbability || 0
              ) <= 20 &&
              Number(
                candidate.precipitation || 0
              ) <= 0.1 &&
              Number(
                candidate.windSpeed || 0
              ) <= 15 &&
              Number(
                candidate.windGust || 0
              ) <= 25 &&
              Number(
                candidate.temperature || 0
              ) >= 18 &&
              Number(
                candidate.temperature || 0
              ) <= 32
          )
        );
      });

    let spray;

    if (
      highRainSoon ||
      strongWindSoon ||
      extremeTemperatureSoon
    ) {
      spray = {
        status: "avoid",
        title: t("avoidSpraying", {}, language),
        text: highRainSoon
          ? t("rainWashSpray", {}, language)
          : strongWindSoon
          ? t("windSprayDrift", {}, language)
          : t("unsuitableSprayTemperature", {}, language),
        icon: "⛔",
      };
    } else if (sprayWindow) {
      spray = {
        status: "good",
        title: t("possibleSprayWindow", {}, language),
        text: t("sprayWindowAdvice", { time: formatHour(sprayWindow.time) }, language),
        icon: "✅",
      };
    } else {
      spray = {
        status: "caution",
        title: t("waitBeforeSpraying", {}, language),
        text: t("noSprayWindow", {}, language),
        icon: "⚠️",
      };
    }

    const rainNextTwelveHours =
      nextTwelveHours.reduce(
        (sum, hour) =>
          sum +
          Number(hour.precipitation || 0),
        0
      );

    const rainProbabilityNextTwelveHours =
      Math.max(
        0,
        ...nextTwelveHours.map((hour) =>
          Number(
            hour.rainProbability || 0
          )
        )
      );

    const today =
      days[0] || {};

    const soilType = String(
      farmerProfile?.soilType || ""
    ).toLowerCase();

    const fastDrainingSoil =
      soilType.includes("sandy");

    const slowDrainingSoil =
      soilType.includes("clay") ||
      soilType.includes("black");

    let irrigation;

    if (
      rainNextTwelveHours >= 2 ||
      rainProbabilityNextTwelveHours >= 60
    ) {
      irrigation = {
        status: "wait",
        title: t("delayIrrigation", {}, language),
        text: t("rainLikelyCheckField", {}, language),
        icon: "🌧️",
      };
    } else if (
      Number(today.evapotranspiration || 0) >=
        4 ||
      Number(current.temperature_2m || 0) >=
        34
    ) {
      irrigation = {
        status: "irrigate",
        title: t("checkCropMoisture", {}, language),
        text: fastDrainingSoil
          ? t("hotDryIrrigateSandy", {}, language)
          : t("highWaterDemand", {}, language),
        icon: "💧",
      };
    } else if (slowDrainingSoil) {
      irrigation = {
        status: "check",
        title: t("avoidExcessWatering", {}, language),
        text: t("soilMayHoldWater", {}, language),
        icon: "🌱",
      };
    } else {
      irrigation = {
        status: "check",
        title: t("checkSoilBeforeWatering", {}, language),
        text: t("noUrgentIrrigation", {}, language),
        icon: "🌱",
      };
    }

    const maximumWind =
      Math.max(
        0,
        ...nextTwelveHours.map((hour) =>
          Number(hour.windSpeed || 0)
        )
      );

    const fieldWork =
      maximumWind > 25 ||
      rainProbabilityNextTwelveHours >= 70
        ? {
            status: "avoid",
            title: t("postponeFieldWork", {}, language),
            text: t("windRainFieldWork", {}, language),
            icon: "⛔",
          }
        : {
            status: "good",
            title: t("fieldWorkPossible", {}, language),
            text: t("suitableContinueChecking", {}, language),
            icon: "🚜",
          };

    const warnings = [];

    if (
      Number(current.temperature_2m || 0) >=
      38
    ) {
      warnings.push(
        t("veryHighTemperatureWarning", {}, language)
      );
    }

    if (
      Number(current.wind_speed_10m || 0) >=
      25
    ) {
      warnings.push(
        t("strongWindWarning", {}, language)
      );
    }

    if (
      Number(current.rain || 0) > 0 ||
      Number(current.precipitation || 0) >
        0
    ) {
      warnings.push(
        t("rainAtLocationWarning", {}, language)
      );
    }

    if (
      Number(today.rainProbability || 0) >=
      70
    ) {
      warnings.push(
        t("highRainTodayWarning", {}, language)
      );
    }

    return {
      spray,
      irrigation,
      fieldWork,
      warnings,
    };
  }

  function createCropSuggestions(
    farmerProfile,
    prices
  ) {
    const month = new Date().getMonth() + 1;

    let season = "summer";

    if (month >= 6 && month <= 10) {
      season = "kharif";
    } else if (
      month === 11 ||
      month === 12 ||
      month <= 2
    ) {
      season = "rabi";
    }

    const soilType = String(
      farmerProfile?.soilType || ""
    ).toLowerCase();

    const seasonalCrops =
      SEASON_CROPS[season] || [];

    const soilMatchedCrops =
      Object.entries(SOIL_CROPS).find(
        ([soil]) =>
          soilType.includes(soil)
      )?.[1] || [];

    const candidateNames = [
      ...new Set([
        ...seasonalCrops,
        ...soilMatchedCrops,
      ]),
    ];

    const priceMap = new Map();

    prices.forEach((priceEntry) => {
      const cropName =
        priceEntry.cropName
          .trim()
          .toLowerCase();

      const previous =
        priceMap.get(cropName);

      if (
        !previous ||
        priceEntry.price > previous.price
      ) {
        priceMap.set(
          cropName,
          priceEntry
        );
      }
    });

    const ranked = candidateNames
      .map((cropName) => {
        const marketEntry = Array.from(
          priceMap.entries()
        ).find(([marketCrop]) =>
          marketCrop.includes(
            cropName.toLowerCase()
          )
        )?.[1];

        return {
          cropName,
          season,
          soilMatched:
            soilMatchedCrops.includes(
              cropName
            ),
          marketPrice:
            marketEntry?.price || 0,
          market:
            marketEntry?.market || "",
          unit:
            marketEntry?.unit ||
            "quintal",
        };
      })
      .sort((first, second) => {
        if (
          first.soilMatched !==
          second.soilMatched
        ) {
          return first.soilMatched
            ? -1
            : 1;
        }

        return (
          second.marketPrice -
          first.marketPrice
        );
      })
      .slice(0, 5);

    return {
      season,
      suggestions: ranked,
      hasMarketData: prices.length > 0,
    };
  }

  function getWeatherDetails(code) {
    const details = WEATHER_CODES[code] || { labelKey: "conditionWeather", icon: "🌤️" };
    return { ...details, label: t(details.labelKey, {}, language) };
  }

  function formatHour(value) {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleTimeString(
      language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function formatDay(value) {
    if (!value) {
      return "";
    }

    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString(language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function adviceClass(status) {
    if (
      status === "good" ||
      status === "irrigate"
    ) {
      return "bg-green-50 border-green-200 text-green-900";
    }

    if (
      status === "avoid" ||
      status === "wait"
    ) {
      return "bg-red-50 border-red-200 text-red-900";
    }

    return "bg-yellow-50 border-yellow-200 text-yellow-900";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">
            🌦️
          </div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            {detectingLocation
              ? t("detectingLocation", {}, language)
              : t("weatherLoading", {}, language)}
          </h1>
        </div>
      </div>
    );
  }

  const currentDetails =
    getWeatherDetails(
      currentWeather?.weather_code
    );

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-blue-800 to-green-700 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() =>
              navigate("/dashboard")
            }
            className="text-blue-100 font-semibold"
          >
            {t("dashboardLink", {}, language)}
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">
                {t("farmWeather", {}, language)}
              </h1>

              <p className="text-blue-100 mt-1">
                {t("localForecastAdvice", {}, language)}
              </p>
            </div>

            <button
              type="button"
              disabled={detectingLocation}
              onClick={detectCurrentLocation}
              className="bg-white text-blue-800 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-60"
            >
              {detectingLocation
                ? t("detecting", {}, language)
                : t("refreshLocation", {}, language)}
            </button>
          </div>

          <div className="bg-white/15 rounded-xl p-3 mt-4 text-sm">
            📍{" "}
            {location
              ? [
                  location.village,
                  location.mandal,
                  location.district,
                  location.state,
                ]
                  .filter(Boolean)
                  .join(", ")
              : t("locationNotDetected", {}, language)}
          </div>
        </header>

        {!currentWeather ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center mt-5">
            <div className="text-5xl">
              📍
            </div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              {t("locationPermissionNeeded", {}, language)}
            </h2>

            <p className="text-gray-600 mt-2">
              {t("enableLocationWeather", {}, language)}
            </p>

            <button
              type="button"
              onClick={detectCurrentLocation}
              className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold mt-5"
            >
              {t("detectMyLocation", {}, language)}
            </button>
          </section>
        ) : (
          <>
            <section className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mt-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="text-7xl">
                  {currentDetails.icon}
                </div>

                <div className="flex-1">
                  <p className="text-sm text-gray-500">
                    {t("currentTemperature", {}, language)}
                  </p>

                  <h2 className="text-5xl font-bold text-blue-900 mt-1">
                    {Math.round(
                      Number(
                        currentWeather.temperature_2m ||
                          0
                      )
                    )}
                    °C
                  </h2>

                  <p className="font-semibold text-gray-700 mt-2">
                    {currentDetails.label}
                  </p>

                  <p className="text-sm text-gray-500 mt-1">
                    {t("feelsLike", {}, language)}{" "}
                    {Math.round(
                      Number(
                        currentWeather.apparent_temperature ||
                          0
                      )
                    )}
                    °C
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">
                    💧 {t("humidity", {}, language)}
                  </p>

                  <p className="font-bold text-blue-900 mt-1">
                    {currentWeather.relative_humidity_2m ??
                      "--"}
                    %
                  </p>
                </div>

                <div className="bg-cyan-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">
                    {t("rainLabel", {}, language)}
                  </p>

                  <p className="font-bold text-cyan-900 mt-1">
                    {Number(
                      currentWeather.rain || 0
                    ).toFixed(1)}{" "}
                    mm
                  </p>
                </div>

                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">
                    {t("windLabel", {}, language)}
                  </p>

                  <p className="font-bold text-green-900 mt-1">
                    {Math.round(
                      Number(
                        currentWeather.wind_speed_10m ||
                          0
                      )
                    )}{" "}
                    km/h
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">
                    {t("windGustLabel", {}, language)}
                  </p>

                  <p className="font-bold text-yellow-900 mt-1">
                    {Math.round(
                      Number(
                        currentWeather.wind_gusts_10m ||
                          0
                      )
                    )}{" "}
                    km/h
                  </p>
                </div>
              </div>
            </section>

            {farmingAdvice.warnings.length >
              0 && (
              <section className="bg-red-50 border border-red-200 rounded-2xl p-5 mt-5">
                <h2 className="text-lg font-bold text-red-800">
                  {t("weatherWarnings", {}, language)}
                </h2>

                <div className="space-y-2 mt-3">
                  {farmingAdvice.warnings.map(
                    (warning) => (
                      <p
                        key={warning}
                        className="text-sm text-red-800"
                      >
                        • {warning}
                      </p>
                    )
                  )}
                </div>
              </section>
            )}

            <section className="mt-5">
              <h2 className="text-xl font-bold text-green-900 mb-3">
                {t("todaysFarmAdvice", {}, language)}
              </h2>

              <div className="grid md:grid-cols-3 gap-4">
                {[
                  farmingAdvice.spray,
                  farmingAdvice.irrigation,
                  farmingAdvice.fieldWork,
                ].map((advice) => (
                  <article
                    key={advice.title}
                    className={`border rounded-2xl p-5 ${adviceClass(
                      advice.status
                    )}`}
                  >
                    <div className="text-3xl">
                      {advice.icon}
                    </div>

                    <h3 className="font-bold mt-3">
                      {advice.title}
                    </h3>

                    <p className="text-sm mt-2">
                      {advice.text}
                    </p>
                  </article>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-3">
                {t("pesticideLabelInstructions", {}, language)}
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-bold text-green-900 mb-3">
                {t("next12Hours", {}, language)}
              </h2>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {hourlyForecast
                  .filter(
                    (hour) =>
                      new Date(
                        hour.time
                      ).getTime() >= Date.now()
                  )
                  .slice(0, 12)
                  .map((hour) => {
                    const details =
                      getWeatherDetails(
                        hour.weatherCode
                      );

                    return (
                      <article
                        key={hour.time}
                        className="min-w-32 bg-white border border-blue-100 rounded-2xl shadow-sm p-4 text-center"
                      >
                        <p className="text-sm font-semibold">
                          {formatHour(hour.time)}
                        </p>

                        <div className="text-3xl mt-2">
                          {details.icon}
                        </div>

                        <p className="font-bold text-blue-900 mt-2">
                          {Math.round(
                            Number(
                              hour.temperature || 0
                            )
                          )}
                          °C
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          🌧️{" "}
                          {hour.rainProbability ??
                            0}
                          %
                        </p>

                        <p className="text-xs text-gray-500">
                          💨{" "}
                          {Math.round(
                            Number(
                              hour.windSpeed || 0
                            )
                          )}{" "}
                          km/h
                        </p>
                      </article>
                    );
                  })}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="text-xl font-bold text-green-900 mb-3">
                {t("forecast7Day", {}, language)}
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {dailyForecast.map((day) => {
                  const details =
                    getWeatherDetails(
                      day.weatherCode
                    );

                  return (
                    <article
                      key={day.date}
                      className="bg-white border border-blue-100 rounded-2xl shadow-sm p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-800">
                          {formatDay(day.date)}
                        </p>

                        <span className="text-3xl">
                          {details.icon}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        {details.label}
                      </p>

                      <div className="flex gap-3 mt-3">
                        <span className="font-bold text-red-700">
                          {Math.round(
                            Number(
                              day.maximumTemperature ||
                                0
                            )
                          )}
                          °
                        </span>

                        <span className="font-bold text-blue-700">
                          {Math.round(
                            Number(
                              day.minimumTemperature ||
                                0
                            )
                          )}
                          °
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mt-2">
                        {t("rainChance", {}, language)}{" "}
                        {day.rainProbability || 0}%
                      </p>

                      <p className="text-sm text-gray-600">
                        {t("rainValueLabel", {}, language)}{" "}
                        {Number(
                          day.rain || 0
                        ).toFixed(1)}{" "}
                        mm
                      </p>

                      <p className="text-sm text-gray-600">
                        {t("windValueLabel", {}, language)}{" "}
                        {Math.round(
                          Number(
                            day.maximumWindSpeed ||
                              0
                          )
                        )}{" "}
                        km/h
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-5 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-green-900">
                    {t("cropSuggestions", {}, language)}
                  </h2>

                  <p className="text-sm text-gray-600 mt-1">
                    {t("cropSuggestionsBasis", {}, language)}
                  </p>
                </div>

                <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-semibold self-start capitalize">
                  {t(`season${cropSuggestions.season[0].toUpperCase()}${cropSuggestions.season.slice(1)}`, {}, language)} {t("seasonLabel", {}, language)}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {cropSuggestions.suggestions.map(
                  (crop) => (
                    <article
                      key={crop.cropName}
                      className="bg-green-50 rounded-xl p-4"
                    >
                      <h3 className="font-bold text-green-900">
                        🌾 {crop.cropName}
                      </h3>

                      <p className="text-sm text-gray-600 mt-2">
                        {crop.soilMatched
                          ? t("matchesSavedSoil", {}, language)
                          : t("suitableCurrentSeason", {}, language)}
                      </p>

                      {crop.marketPrice > 0 && (
                        <p className="text-sm font-semibold text-green-800 mt-2">
                          {t("marketPriceLabel", {}, language)} ₹
                          {crop.marketPrice.toLocaleString(
                            "en-IN"
                          )}{" "}
                          / {crop.unit}
                        </p>
                      )}
                    </article>
                  )
                )}
              </div>

              {!cropSuggestions.hasMarketData && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-3 mt-4 text-sm">
                  {t("marketPriceUnavailable", {}, language)}
                </div>
              )}

              <p className="text-xs text-gray-500 mt-4">
                {t("cropSelectionFactors", {}, language)}
              </p>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <button
                type="button"
                onClick={() =>
                  navigate("/market-prices")
                }
                className="bg-white border border-green-100 rounded-2xl p-4 text-center shadow-sm"
              >
                <div className="text-2xl">
                  📈
                </div>

                <p className="font-semibold mt-2">
                  {t("marketPrices", {}, language)}
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/crop-disease")
                }
                className="bg-white border border-green-100 rounded-2xl p-4 text-center shadow-sm"
              >
                <div className="text-2xl">
                  🌿
                </div>

                <p className="font-semibold mt-2">
                  {t("cropHelp", {}, language)}
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/profile")
                }
                className="bg-white border border-green-100 rounded-2xl p-4 text-center shadow-sm"
              >
                <div className="text-2xl">
                  👤
                </div>

                <p className="font-semibold mt-2">
                  {t("farmProfile", {}, language)}
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/community")
                }
                className="bg-white border border-green-100 rounded-2xl p-4 text-center shadow-sm"
              >
                <div className="text-2xl">
                  👥
                </div>

                <p className="font-semibold mt-2">
                  Ask Community
                </p>
              </button>
            </section>

            <p className="text-xs text-center text-gray-500 mt-6">
              Weather data: Open-Meteo. Location:
              BigDataCloud.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
