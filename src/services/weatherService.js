const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "rain",
  "weather_code",
  "is_day",
  "wind_speed_10m",
  "wind_gusts_10m",
];

const HOURLY_FIELDS = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "rain",
  "weather_code",
  "is_day",
  "wind_speed_10m",
];

export async function fetchWeatherForecast({ latitude, longitude, signal } = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 || lat > 90 ||
    lon < -180 || lon > 180
  ) {
    const error = new Error("Valid device coordinates are required for weather.");
    error.code = "INVALID_COORDINATES";
    throw error;
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: CURRENT_FIELDS.join(","),
    hourly: HOURLY_FIELDS.join(","),
    timezone: "auto",
    forecast_days: "2",
  });

  const response = await fetch(`${FORECAST_URL}?${params}`, signal ? { signal } : undefined);
  if (!response.ok) {
    const error = new Error(`Weather request failed (${response.status}).`);
    error.code = "WEATHER_REQUEST_FAILED";
    throw error;
  }

  const forecast = await response.json();
  if (forecast?.error) {
    const error = new Error(forecast.reason || "The weather provider rejected the request.");
    error.code = "WEATHER_PROVIDER_ERROR";
    throw error;
  }
  return forecast;
}

export function selectNextTwelveHours(forecast) {
  const hourly = forecast?.hourly;
  if (!Array.isArray(hourly?.time)) return [];

  const currentTime = String(forecast?.current?.time || "");
  let startIndex = hourly.time.findIndex((time) => time >= currentTime);
  if (startIndex < 0) startIndex = 0;

  return hourly.time.slice(startIndex, startIndex + 12).map((time, offset) => {
    const index = startIndex + offset;
    return {
      time,
      temperature: hourly.temperature_2m?.[index],
      precipitationProbability: hourly.precipitation_probability?.[index],
      precipitation: hourly.precipitation?.[index],
      rain: hourly.rain?.[index],
      weatherCode: hourly.weather_code?.[index],
      isDay: hourly.is_day?.[index],
      windSpeed: hourly.wind_speed_10m?.[index],
    };
  });
}
