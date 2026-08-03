const WEATHER_CONTEXT_KEY = "agrisathi_weather_context";

export function saveWeatherContext({
  location,
  currentWeather,
  hourlyForecast = [],
  dailyForecast = [],
}) {
  if (!currentWeather) {
    return;
  }

  const now = Date.now();

  const upcomingHours = hourlyForecast
    .filter((hour) => {
      return new Date(hour.time).getTime() >= now;
    })
    .slice(0, 12);

  const nextRainProbability = Math.max(
    0,
    ...upcomingHours.map((hour) =>
      Number(hour.rainProbability || 0)
    )
  );

  const expectedRain = upcomingHours.reduce(
    (total, hour) =>
      total + Number(hour.precipitation || 0),
    0
  );

  const maximumWind = Math.max(
    Number(currentWeather.wind_speed_10m || 0),
    ...upcomingHours.map((hour) =>
      Number(hour.windSpeed || 0)
    )
  );

  const todayForecast = dailyForecast[0] || null;

  const weatherContext = {
    savedAt: Date.now(),

    location: {
      village: location?.village || "",
      mandal: location?.mandal || "",
      district: location?.district || "",
      state: location?.state || "",
    },

    current: {
      temperature: Number(
        currentWeather.temperature_2m || 0
      ),

      apparentTemperature: Number(
        currentWeather.apparent_temperature || 0
      ),

      humidity: Number(
        currentWeather.relative_humidity_2m || 0
      ),

      precipitation: Number(
        currentWeather.precipitation || 0
      ),

      rain: Number(currentWeather.rain || 0),

      windSpeed: Number(
        currentWeather.wind_speed_10m || 0
      ),

      windGust: Number(
        currentWeather.wind_gusts_10m || 0
      ),

      weatherCode: Number(
        currentWeather.weather_code || 0
      ),
    },

    forecast: {
      nextTwelveHoursRainProbability:
        nextRainProbability,

      nextTwelveHoursExpectedRain:
        Number(expectedRain.toFixed(1)),

      maximumWindSpeed:
        Number(maximumWind.toFixed(1)),

      todayMaximumTemperature: Number(
        todayForecast?.maximumTemperature || 0
      ),

      todayMinimumTemperature: Number(
        todayForecast?.minimumTemperature || 0
      ),

      todayRainProbability: Number(
        todayForecast?.rainProbability || 0
      ),

      todayExpectedRain: Number(
        todayForecast?.rain || 0
      ),
    },
  };

  localStorage.setItem(
    WEATHER_CONTEXT_KEY,
    JSON.stringify(weatherContext)
  );
}

export function getWeatherContext() {
  try {
    const savedValue = localStorage.getItem(
      WEATHER_CONTEXT_KEY
    );

    if (!savedValue) {
      return null;
    }

    const weatherContext =
      JSON.parse(savedValue);

    if (
      !weatherContext ||
      typeof weatherContext !== "object"
    ) {
      return null;
    }

    const savedAt = Number(
      weatherContext.savedAt || 0
    );

    const maximumAge =
      3 * 60 * 60 * 1000;

    if (
      !savedAt ||
      Date.now() - savedAt > maximumAge
    ) {
      localStorage.removeItem(
        WEATHER_CONTEXT_KEY
      );

      return null;
    }

    return weatherContext;
  } catch (error) {
    console.error(
      "Weather context reading error:",
      error
    );

    return null;
  }
}

export function createWeatherPromptContext() {
  const weather = getWeatherContext();

  if (!weather) {
    return `
Current live weather data is unavailable.

Do not assume the weather.
Ask the farmer to open the Weather page and refresh their location when live weather is required.
`.trim();
  }

  const locationParts = [
    weather.location?.village,
    weather.location?.mandal,
    weather.location?.district,
    weather.location?.state,
  ].filter(Boolean);

  const locationText =
    locationParts.join(", ") ||
    "Detected farmer location";

  return `
Weather location: ${locationText}

Current conditions:
- Temperature: ${weather.current.temperature}°C
- Feels like: ${weather.current.apparentTemperature}°C
- Humidity: ${weather.current.humidity}%
- Current rain: ${weather.current.rain} mm
- Current precipitation: ${weather.current.precipitation} mm
- Wind speed: ${weather.current.windSpeed} km/h
- Wind gust: ${weather.current.windGust} km/h
- Weather code: ${weather.current.weatherCode}

Forecast:
- Maximum rain probability during the next 12 hours: ${weather.forecast.nextTwelveHoursRainProbability}%
- Expected precipitation during the next 12 hours: ${weather.forecast.nextTwelveHoursExpectedRain} mm
- Maximum wind speed during the next 12 hours: ${weather.forecast.maximumWindSpeed} km/h
- Today's maximum temperature: ${weather.forecast.todayMaximumTemperature}°C
- Today's minimum temperature: ${weather.forecast.todayMinimumTemperature}°C
- Today's rain probability: ${weather.forecast.todayRainProbability}%
- Today's expected rain: ${weather.forecast.todayExpectedRain} mm

Use this data only when answering weather-related farming questions.
Do not claim weather certainty.
Advise the farmer to check the local sky and field conditions before spraying, irrigation, sowing or harvesting.
`.trim();
}

export function clearWeatherContext() {
  localStorage.removeItem(
    WEATHER_CONTEXT_KEY
  );
}