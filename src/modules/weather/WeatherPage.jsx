import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appText } from "../../utils/appText";

export default function WeatherPage() {
  const navigate = useNavigate();

  const [weather, setWeather] = useState(null);
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function pickAdmin(adminList = [], keywords = []) {
    return (
      adminList.find((item) =>
        keywords.some((word) =>
          `${item.name || ""} ${item.description || ""}`
            .toLowerCase()
            .includes(word)
        )
      )?.name || ""
    );
  }

  function buildPlaceInfo(geoData) {
    const admin = geoData?.localityInfo?.administrative || [];

    const village =
      geoData.locality ||
      geoData.city ||
      pickAdmin(admin, ["village", "town", "city"]) ||
      appText("notAvailable");

    const mandal =
      pickAdmin(admin, ["mandal", "taluk", "tehsil", "subdistrict", "sub-district"]) ||
      appText("notAvailable");

    const district =
      pickAdmin(admin, ["district"]) ||
      geoData.city ||
      appText("notAvailable");

    const state =
      geoData.principalSubdivision ||
      pickAdmin(admin, ["state"]) ||
      appText("notAvailable");

    return {
      village,
      mandal,
      district,
      state,
      country: geoData.countryName || appText("notAvailable"),
      postcode: geoData.postcode || appText("notAvailable"),
    };
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(appText("locationUnsupported"));
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const weatherUrl =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${latitude}` +
            `&longitude=${longitude}` +
            `&current=temperature_2m,relative_humidity_2m,rain,wind_speed_10m`;

          const placeUrl =
            `https://api.bigdatacloud.net/data/reverse-geocode-client` +
            `?latitude=${latitude}` +
            `&longitude=${longitude}` +
            `&localityLanguage=en`;

          const [weatherRes, placeRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(placeUrl),
          ]);

          const weatherData = await weatherRes.json();
          const placeData = await placeRes.json();

          setWeather(weatherData.current);
          setPlace(buildPlaceInfo(placeData));
        } catch (err) {
          setError(appText("weatherLoadError"));
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(appText("allowLocation"));
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  return (
    <div className="min-h-screen bg-green-50 p-4">
      <div className="bg-green-700 text-white p-4 rounded-xl shadow">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm mb-2"
        >
          {appText("back")}
        </button>

        <h1 className="text-2xl font-bold">{appText("weatherTitle")} 🌦</h1>
        <p>{appText("weatherSubtitle")}</p>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl shadow p-4 mt-5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mt-5 text-center">
        <div className="text-5xl">☀️</div>

        <h2 className="text-3xl font-bold mt-3">
          {loading ? appText("loading") : `${weather?.temperature_2m ?? "--"}°C`}
        </h2>

        <p className="text-gray-600 mt-1">
          {place?.village || appText("detectingLocation")}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mt-5">
        <h2 className="text-lg font-bold text-green-700 mb-3">
          {appText("currentLocation")}
        </h2>

        <div className="space-y-2 text-sm">
          <p><span className="font-semibold">{appText("villageTown")}:</span> {place?.village || "--"}</p>
          <p><span className="font-semibold">{appText("mandalTaluk")}:</span> {place?.mandal || "--"}</p>
          <p><span className="font-semibold">{appText("district")}:</span> {place?.district || "--"}</p>
          <p><span className="font-semibold">{appText("state")}:</span> {place?.state || "--"}</p>
          <p><span className="font-semibold">{appText("country")}:</span> {place?.country || "--"}</p>
          <p><span className="font-semibold">{appText("pinCode")}:</span> {place?.postcode || "--"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <div className="bg-white rounded-xl shadow p-4">
          💧
          <h3 className="font-semibold">{appText("humidity")}</h3>
          <p>{weather?.relative_humidity_2m ?? "--"}%</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          🌧
          <h3 className="font-semibold">{appText("rain")}</h3>
          <p>{weather?.rain ?? "--"} mm</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          💨
          <h3 className="font-semibold">{appText("wind")}</h3>
          <p>{weather?.wind_speed_10m ?? "--"} km/h</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          🌾
          <h3 className="font-semibold">{appText("cropTip")}</h3>
          <p>{appText("irrigateMorning")}</p>
        </div>
      </div>
    </div>
  );
}
