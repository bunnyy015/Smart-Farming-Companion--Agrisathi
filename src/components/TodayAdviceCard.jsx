import useLanguage from "../utils/useLanguage";
import { t } from "../utils/language";

function buildAdvice(weather, language) {
  if (!weather) {
    return {
      icon: "🌦️",
      title: t("adviceNeedWeatherTitle", {}, language),
      text: t("adviceNeedWeatherText", {}, language),
      className:
        "from-blue-50 to-green-50 border-blue-200 text-blue-900",
    };
  }

  const temperature = Number(weather.temperature || 0);
  const humidity = Number(weather.humidity || 0);
  const wind = Number(weather.wind || 0);
  const rain = Number(weather.rain || 0);
  const rainProbability = Number(
    weather.rainProbability || 0
  );

  if (rain > 0 || rainProbability >= 60) {
    return {
      icon: "🌧️",
      title: t("adviceRainTitle", {}, language),
      text: t("adviceRainText", {}, language),
      className:
        "from-blue-50 to-cyan-50 border-blue-200 text-blue-900",
    };
  }

  if (wind >= 18) {
    return {
      icon: "💨",
      title: t("adviceWindTitle", {}, language),
      text: t("adviceWindText", {}, language),
      className:
        "from-yellow-50 to-orange-50 border-yellow-200 text-yellow-900",
    };
  }

  if (temperature >= 35) {
    return {
      icon: "☀️",
      title: t("adviceHeatTitle", {}, language),
      text: t("adviceHeatText", {}, language),
      className:
        "from-orange-50 to-red-50 border-orange-200 text-orange-900",
    };
  }

  if (humidity >= 85) {
    return {
      icon: "💧",
      title: t("adviceHumidityTitle", {}, language),
      text: t("adviceHumidityText", {}, language),
      className:
        "from-purple-50 to-blue-50 border-purple-200 text-purple-900",
    };
  }

  return {
    icon: "✅",
    title: t("adviceGoodTitle", {}, language),
    text: t("adviceGoodText", {}, language),
    className:
      "from-green-50 to-emerald-50 border-green-200 text-green-900",
  };
}

export default function TodayAdviceCard({
  weather,
  onOpenWeather,
  showWeatherAction = true,
}) {
  const language = useLanguage();
  const advice = buildAdvice(weather, language);

  return (
    <section
      className={`bg-gradient-to-r border rounded-2xl p-4 mt-5 ${advice.className}`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{advice.icon}</div>

        <div className="flex-1">
          <p className="text-xs font-semibold opacity-70">
            {t("adviceEyebrow", {}, language)}
          </p>

          <h2 className="font-bold text-lg mt-1">
            {advice.title}
          </h2>

          <p className="text-sm mt-1">{advice.text}</p>

          {showWeatherAction && onOpenWeather && (
            <button
              type="button"
              onClick={onOpenWeather}
              className="text-sm font-bold mt-3 underline"
            >
              {t("viewFullWeather", {}, language)} →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}