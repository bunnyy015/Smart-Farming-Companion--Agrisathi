import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";
import { cancelSpeech, speakLocalizedText } from "../../utils/speechOutput";
import { resolveGovernmentSchemesPath, subscribeToGovernmentSchemes } from "../../services/governmentSchemesService";
import { DEFAULT_SCHEMES } from "./defaultGovernmentSchemes";

export default function GovtSchemesPage() {
  const navigate = useNavigate();
  const language = useLanguage();
  const [search, setSearch] = useState("");

  const [schemes, setSchemes] = useState(DEFAULT_SCHEMES);
  const [schemesLoading, setSchemesLoading] = useState(true);
  const [speechMessage, setSpeechMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;

    resolveGovernmentSchemesPath()
      .then((path) => {
        if (cancelled) return;
        unsubscribe = subscribeToGovernmentSchemes(
          path,
          (records, initialized) => {
            if (records.length || initialized) {
              setSchemes(records);
            }
            setSchemesLoading(false);
          },
          (error) => {
            console.warn("Unable to load government schemes:", error);
            setSchemesLoading(false);
          }
        );
      })
      .catch((error) => {
        console.warn("Unable to connect to government schemes:", error);
        if (!cancelled) setSchemesLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  function getSchemeDetails(scheme) {
    const list = (value) => Array.isArray(value)
      ? value
      : String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

    const legacyText = (field, value, original) => scheme.migratedFromFarmerDefaults
      && field && original === value
      ? t(field, {}, language)
      : value || t(field, {}, language);

    return {
      title: legacyText(scheme.titleKey, scheme.title || scheme.schemeName, scheme.defaultValues?.title),
      category: legacyText(scheme.categoryKey, scheme.category || scheme.department, scheme.defaultValues?.category),
      benefits: legacyText(scheme.benefitKey, scheme.benefits || scheme.benefit, scheme.defaultValues?.benefits),
      eligibility: legacyText(scheme.eligibilityKey, scheme.eligibility, scheme.defaultValues?.eligibility),
      documents: legacyText(scheme.documentsKey, scheme.requiredDocuments || scheme.documents, scheme.defaultValues?.requiredDocuments),
      steps: list(scheme.applicationProcess || scheme.registrationSteps),
      applicationNote: scheme.applicationNote || "",
      applicationLink: scheme.applicationLink || scheme.applyUrl || "",
      applyLabel: scheme.applyLabel || "Apply",
      icon: scheme.icon || "🌾",
    };
  }

  const filteredSchemes = schemes.filter((scheme) => {
    const details = getSchemeDetails(scheme);
    return [details.title, details.category, details.benefits, details.eligibility,
      scheme.department, scheme.state, details.documents].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  async function speakScheme(scheme) {
    const details = getSchemeDetails(scheme);
    const message = `${details.title}. ${t("schemeBenefitLabel", {}, language)} ${details.benefits}. ${t("schemeEligibilityLabel", {}, language)} ${details.eligibility}. ${t("schemeDocumentsLabel", {}, language)} ${details.documents}`;

    cancelSpeech();
    setSpeechMessage("");
    const result = await speakLocalizedText(message, language, { rate: 0.9 });

    if (["voice-unavailable", "unsupported", "error", "cloud-error"].includes(result.status)) {
      setSpeechMessage(
        result.status === "cloud-error"
          ? t("speechGenerationFailed", {}, language)
          : result.status === "unsupported"
            ? t("speechOutputUnsupported", {}, language)
            : t("speechVoiceUnavailable", {}, language)
      );
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="w-full">
        <div className="bg-green-700 text-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm mb-3"
          >
            {t("dashboardLink", {}, language)}
          </button>

          <h1 className="text-4xl font-bold">
            {t("governmentSchemesTitle", {}, language)}
          </h1>

          <p className="text-green-100 mt-2">
            {t("governmentSchemesIntro", {}, language)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchSchemesPlaceholder", {}, language)}
            className="w-full border border-gray-300 rounded-lg p-3"
          />
        </div>

        {speechMessage && (
          <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {speechMessage}
          </p>
        )}

        {schemesLoading && <p className="mb-4 text-sm text-green-800">{t("loading", {}, language)}</p>}

        <div className="grid md:grid-cols-2 gap-5">
          {filteredSchemes.map((scheme) => (
            <div
              key={scheme.id || scheme.titleKey || scheme.title}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              {(() => { const details = getSchemeDetails(scheme); return <>
              <div className="text-5xl mb-3">{details.icon}</div>

              <h2 className="text-2xl font-bold text-green-700">
                {details.title}
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                {[scheme.department, details.category, scheme.state].filter(Boolean).join(" · ")}
              </p>

              {scheme.description && <p className="mt-3 text-gray-700">{scheme.description}</p>}

              <div className="mt-4 space-y-2 text-gray-700">
                <p>
                  <b>{t("schemeBenefitLabel", {}, language)}</b> {details.benefits}
                </p>

                <p>
                  <b>{t("schemeEligibilityLabel", {}, language)}</b> {details.eligibility}
                </p>

                <p>
                  <b>{t("schemeDocumentsLabel", {}, language)}</b> {details.documents}
                </p>
              </div>

              {details.steps.length > 0 && <section className="mt-5 rounded-xl border border-green-100 bg-green-50 p-4">
                <h3 className="font-bold text-green-900">
                  How to register
                </h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
                  {details.steps.map((step, index) => (
                    <li key={`${index}-${step}`}>{step}</li>
                  ))}
                </ol>
              </section>}

              {details.applicationNote && <p className="text-sm text-gray-600 bg-green-50 rounded-lg p-3 mt-4">{details.applicationNote}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => speakScheme(scheme)}
                  className="bg-blue-600 text-white py-3 rounded-lg font-semibold"
                >
                  {t("speakScheme", {}, language)}
                </button>

                {details.applicationLink && <a
                  href={details.applicationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-700 text-white py-3 px-3 rounded-lg font-semibold text-center hover:bg-green-800 transition"
                >
                  {details.applyLabel} ↗
                </a>}
              </div>
              </>; })()}
            </div>
          ))}
        </div>

        {filteredSchemes.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-green-700">
              {t("noSchemesFound", {}, language)}
            </h2>

            <p className="text-gray-600 mt-2">
              {t("searchSchemesHint", {}, language)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
