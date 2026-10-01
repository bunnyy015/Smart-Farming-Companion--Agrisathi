import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useLanguage from "../../utils/useLanguage";
import { getSpeechLocale, t } from "../../utils/language";

export default function GovtSchemesPage() {
  const navigate = useNavigate();
  const language = useLanguage();

  const [search, setSearch] = useState("");

  const schemes = [
    {
      titleKey: "schemeTitlePmkisan",
      categoryKey: "schemeCategoryFinancial",
      benefitKey: "schemeBenefitPmkisan",
      eligibilityKey: "schemeEligibilityPmkisan",
      documentsKey: "schemeDocumentsPmkisan",
      icon: "💰",
      applyUrl: "https://pmkisan.gov.in/RegistrationFormupdated.aspx",
      applyLabel: "Apply on PM-KISAN",
      applicationNote: "Use the official new farmer registration form.",
    },
    {
      titleKey: "schemeTitleInsurance",
      categoryKey: "schemeCategoryInsurance",
      benefitKey: "schemeBenefitInsurance",
      eligibilityKey: "schemeEligibilityInsurance",
      documentsKey: "schemeDocumentsInsurance",
      icon: "🛡️",
      applyUrl: "https://pmfby.gov.in/selfRegistration",
      applyLabel: "Apply for crop insurance",
      applicationNote: "Check notified crops, area and enrollment dates before applying.",
    },
    {
      titleKey: "schemeTitleCredit",
      categoryKey: "schemeCategoryLoan",
      benefitKey: "schemeBenefitCredit",
      eligibilityKey: "schemeEligibilityCredit",
      documentsKey: "schemeDocumentsCredit",
      icon: "🏦",
      applyUrl: "https://pmkisan.gov.in/Documents/Kcc.pdf",
      applyLabel: "Get KCC application form",
      applicationNote: "Submit the completed form to a participating bank.",
    },
    {
      titleKey: "schemeTitleSoil",
      categoryKey: "schemeCategorySoil",
      benefitKey: "schemeBenefitSoil",
      eligibilityKey: "schemeEligibilityAllFarmers",
      documentsKey: "schemeDocumentsSoil",
      icon: "🌱",
      applyUrl: "https://soilhealth.dac.gov.in/soilhealthcard",
      applyLabel: "Get Soil Health Card",
      applicationNote: "Use the official portal to access Soil Health Card services.",
    },
    {
      titleKey: "schemeTitleIrrigation",
      categoryKey: "schemeCategoryIrrigation",
      benefitKey: "schemeBenefitIrrigation",
      eligibilityKey: "schemeEligibilityIrrigation",
      documentsKey: "schemeDocumentsCredit",
      icon: "💧",
      applyUrl: "https://pmksy.gov.in/Default.aspx",
      applyLabel: "Official scheme information",
      applicationNote: "For assistance or applications, contact your state agriculture or horticulture department.",
    },
    {
      titleKey: "schemeTitleEnam",
      categoryKey: "schemeCategoryMarket",
      benefitKey: "schemeBenefitEnam",
      eligibilityKey: "schemeEligibilityEnam",
      documentsKey: "schemeDocumentsEnam",
      icon: "📈",
      applyUrl: "https://enam.gov.in/registration",
      applyLabel: "Register on e-NAM",
      applicationNote: "Farmer registration is completed through the official e-NAM portal.",
    },
  ];

  const filteredSchemes = schemes.filter((scheme) => {
    const text = `
      ${t(scheme.titleKey, {}, language)}
      ${t(scheme.categoryKey, {}, language)}
      ${t(scheme.benefitKey, {}, language)}
      ${t(scheme.eligibilityKey, {}, language)}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  function speakScheme(scheme) {
    const message = `${t(scheme.titleKey, {}, language)}. ${t("schemeBenefitLabel", {}, language)} ${t(scheme.benefitKey, {}, language)}. ${t("schemeEligibilityLabel", {}, language)} ${t(scheme.eligibilityKey, {}, language)}. ${t("schemeDocumentsLabel", {}, language)} ${t(scheme.documentsKey, {}, language)}`;

    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = getSpeechLocale(language);
    speech.rate = 0.9;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
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

        <div className="grid md:grid-cols-2 gap-5">
          {filteredSchemes.map((scheme) => (
            <div
              key={scheme.titleKey}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="text-5xl mb-3">{scheme.icon}</div>

              <h2 className="text-2xl font-bold text-green-700">
                {t(scheme.titleKey, {}, language)}
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                {t(scheme.categoryKey, {}, language)}
              </p>

              <div className="mt-4 space-y-2 text-gray-700">
                <p>
                  <b>{t("schemeBenefitLabel", {}, language)}</b> {t(scheme.benefitKey, {}, language)}
                </p>

                <p>
                  <b>{t("schemeEligibilityLabel", {}, language)}</b> {t(scheme.eligibilityKey, {}, language)}
                </p>

                <p>
                  <b>{t("schemeDocumentsLabel", {}, language)}</b> {t(scheme.documentsKey, {}, language)}
                </p>
              </div>

              <p className="text-sm text-gray-600 bg-green-50 rounded-lg p-3 mt-4">
                {scheme.applicationNote}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => speakScheme(scheme)}
                  className="bg-blue-600 text-white py-3 rounded-lg font-semibold"
                >
                  {t("speakScheme", {}, language)}
                </button>

                <a
                  href={scheme.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-700 text-white py-3 px-3 rounded-lg font-semibold text-center hover:bg-green-800 transition"
                >
                  {scheme.applyLabel} ↗
                </a>
              </div>
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
