import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { database, getAuthUser } from "../../firebase";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";
import { cancelSpeech, speakLocalizedText } from "../../utils/speechOutput";
import { resolveGovernmentSchemesPath, subscribeToGovernmentSchemes } from "../../services/governmentSchemesService";
import { DEFAULT_SCHEMES } from "./defaultGovernmentSchemes";
import { assessScheme, getSchemeRule } from "./schemeEligibility";
import "./GovtSchemesPage.css";

function localizeKnownSchemeTitle(title, language) {
  const normalized = String(title || "").toLowerCase();
  const titleKey = String(title || "").match(/^schemeTitle[A-Za-z]+$/)?.[0];
  const knownTitleKeys = new Set(["schemeTitleAif", "schemeTitleNmnf", "schemeTitlePmkmy", "schemeTitleKusum", "schemeTitleSmam", "schemeTitleRythuBharosa", "schemeTitleRythuBima"]);
  if (titleKey) {
    const localizedTitle = knownTitleKeys.has(titleKey) ? t(titleKey, {}, language) : titleKey;
    return localizedTitle === titleKey ? titleKey.slice("schemeTitle".length) : localizedTitle;
  }
  const knownTitles = [
    ["pm kisan", "schemeTitlePmkisan"],
    ["pm-kisan", "schemeTitlePmkisan"],
    ["fasal bima", "schemeTitleInsurance"],
    ["kisan credit card", "schemeTitleCredit"],
    ["soil health card", "schemeTitleSoil"],
    ["krishi sinchayee", "schemeTitleIrrigation"],
    ["enam", "schemeTitleEnam"],
    ["rythu bharosa", "schemeTitleRythuBharosa"],
    ["rythu bima", "schemeTitleRythuBima"],
    ["agriculture infrastructure fund", "schemeTitleAif"],
    ["national mission on natural farming", "schemeTitleNmnf"],
    ["kisan maandhan", "schemeTitlePmkmy"],
    ["pm-kusum", "schemeTitleKusum"],
    ["sub-mission on agricultural mechanization", "schemeTitleSmam"],
  ];
  const match = knownTitles.find(([phrase]) => normalized.includes(phrase));
  return match ? t(match[1], {}, language) : title;
}

function localizeGovernmentLabel(value, language) {
  return String(value || "").toLowerCase() === "central"
    ? t("centralGovernment", {}, language)
    : value;
}

export default function GovtSchemesPage() {
  const navigate = useNavigate();
  const language = useLanguage();
  const [search, setSearch] = useState("");

  const [schemes, setSchemes] = useState(DEFAULT_SCHEMES);
  const [schemesLoading, setSchemesLoading] = useState(true);
  const [speechMessage, setSpeechMessage] = useState("");
  const [farmer, setFarmer] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [view, setView] = useState("personalized");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSchemeKey, setSelectedSchemeKey] = useState("");

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
              setSchemes(records.length ? records : DEFAULT_SCHEMES);
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

  useEffect(() => {
    let active = true;
    let stopUser;
    let stopFarmer;
    async function loadFarmerProfile() {
      try {
        const user = await getAuthUser();
        if (!user) {
          if (active) setProfileLoading(false);
          return;
        }
        if (!active) return;
        let userData = {};
        let farmerData = {};
        let loadedUser = false;
        let loadedFarmer = false;
        const refresh = () => {
          if (!active) return;
          const profile = { ...userData, ...farmerData };
          setFarmer(profile.role === "farmer" ? profile : null);
          if (loadedUser && loadedFarmer) setProfileLoading(false);
        };
        stopUser = onValue(ref(database, `users/${user.uid}`), (snapshot) => {
          userData = snapshot.exists() ? snapshot.val() : {};
          loadedUser = true;
          refresh();
        }, (error) => { console.warn("Unable to read farmer account:", error); loadedUser = true; refresh(); });
        stopFarmer = onValue(ref(database, `farmers/${user.uid}`), (snapshot) => {
          farmerData = snapshot.exists() ? snapshot.val() : {};
          loadedFarmer = true;
          refresh();
        }, (error) => { console.warn("Unable to read farmer profile:", error); loadedFarmer = true; refresh(); });
      } catch (error) {
        console.warn("Unable to load farmer scheme profile:", error);
        if (active) setProfileLoading(false);
      }
    }
    loadFarmerProfile();
    return () => { active = false; stopUser?.(); stopFarmer?.(); };
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
      title: localizeKnownSchemeTitle(legacyText(scheme.titleKey, scheme.title || scheme.schemeName, scheme.defaultValues?.title), language),
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

  const schemeDirectory = useMemo(() => {
    const missingLocalSchemes = ["telangana-rythu-bharosa", "telangana-rythu-bima", "midh", "pmksy-per-drop-more-crop", "telangana-micro-irrigation-project"]
      .map((id) => DEFAULT_SCHEMES.find((scheme) => scheme.id === id))
      .filter((knownScheme) => knownScheme && !schemes.some((scheme) => {
        const identity = `${scheme.id || ""} ${scheme.titleKey || ""} ${scheme.title || ""} ${scheme.schemeName || ""}`.toLowerCase();
        const normalizedTitle = String(knownScheme.title || "").toLowerCase();
        const shortTitle = normalizedTitle.replace(/^telangana\s+/, "");
        return identity.includes(knownScheme.id) || (knownScheme.titleKey && identity.includes(knownScheme.titleKey.toLowerCase())) ||
          (normalizedTitle && (identity.includes(normalizedTitle) || identity.includes(shortTitle)));
      }));
    return missingLocalSchemes.length ? [...schemes, ...missingLocalSchemes] : schemes;
  }, [schemes]);

  const assessedSchemes = schemeDirectory.map((scheme) => ({
    scheme,
    assessment: assessScheme(scheme, farmer),
    rule: getSchemeRule(scheme),
  }));
  const isProfileEligible = (assessment) => assessment.status === "likely_eligible";

  const filteredSchemes = assessedSchemes.filter(({ scheme, assessment }) => {
    const details = getSchemeDetails(scheme);
    const matchesSearch = [details.title, scheme.title, scheme.schemeName, details.category, details.benefits, details.eligibility,
      scheme.department, scheme.state, details.documents, assessment.label].join(" ").toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (view === "all" || isProfileEligible(assessment)) &&
      (statusFilter === "all" || assessment.status === statusFilter);
  });

  const getSchemeKey = (scheme) => String(scheme.id || scheme.titleKey || scheme.title || scheme.schemeName);
  const selectedScheme = assessedSchemes.find(({ scheme }) => getSchemeKey(scheme) === selectedSchemeKey);
  const profileCrops = farmer
    ? [...new Set([...(Array.isArray(farmer.selectedCrops) ? farmer.selectedCrops : []), farmer.mainCrop, ...String(farmer.otherCrops || "").split(",")].map((crop) => String(crop || "").trim()).filter(Boolean))]
    : [];
  const profileFacts = farmer ? [
    farmer.state && farmer.district ? `📍 ${farmer.district}, ${farmer.state}` : farmer.state && `📍 ${farmer.state}`,
    profileCrops.length ? `🌾 ${profileCrops.join(", ")}` : null,
    Number(farmer.landSize) > 0 ? `📐 ${farmer.landSize} ${farmer.landUnit || "acres"}` : null,
    farmer.soilType && `🟤 ${farmer.soilType}`,
    farmer.irrigationType && `💧 ${farmer.irrigationType}`,
    Number(farmer.age) > 0 && `🎂 ${farmer.age} years`,
  ].filter(Boolean) : [];
  const profileMatchCount = assessedSchemes.filter(({ assessment }) => isProfileEligible(assessment)).length;

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
    <div className="govt-schemes-page min-h-screen p-6">
      <div className="govt-schemes-shell w-full">
        <div className="govt-schemes-hero mb-6 rounded-2xl p-6 text-white shadow-lg">
          <button
            onClick={() => navigate("/dashboard")}
            className="govt-schemes-back mb-3 text-sm"
          >
            {t("dashboardLink", {}, language)}
          </button>

          <h1 className="govt-schemes-title text-4xl font-bold">
            {t("governmentSchemesTitle", {}, language)}
          </h1>

          <p className="govt-schemes-intro mt-2 text-green-100">
            {t("governmentSchemesIntro", {}, language)}
          </p>
        </div>

        {speechMessage && (
          <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {speechMessage}
          </p>
        )}

        {(schemesLoading || profileLoading) && <p className="mb-4 text-sm text-green-800">{t("loading", {}, language)}</p>}

        {farmer && view !== "all" && (
          <section className="schemes-farm-profile mb-5 rounded-2xl p-5" aria-label="Farm profile used for scheme matching">
            <div className="schemes-farm-profile-heading">
              <div>
                <p className="schemes-eyebrow">PERSONALIZED MATCHING</p>
                <h2>Based on your farm profile</h2>
                <p>Crop, soil, land, water and location details help find relevant schemes.</p>
              </div>
              <span className="schemes-match-count">{profileMatchCount} possible matches</span>
            </div>
            <div className="schemes-profile-facts">
              {profileFacts.length ? profileFacts.map((fact) => <span key={fact} className="schemes-profile-fact">{fact}</span>) : <span className="schemes-profile-empty">Add crop, land, soil and irrigation details in Farmer Profile to improve these matches.</span>}
            </div>
            <p className="schemes-profile-note">These are suggestions from saved profile details, not official eligibility decisions.</p>
          </section>
        )}

        {selectedScheme ? (() => {
          const { scheme, assessment, rule } = selectedScheme;
          const details = getSchemeDetails(scheme);
          const applicationStart = scheme.applicationStartDate || scheme.openingDate || scheme.startDate;
          const applicationEnd = scheme.applicationEndDate || scheme.closingDate || scheme.deadline;
          const schemeStatus = scheme.schemeStatus || (rule?.status === "active" ? "Information available; local availability may vary" : rule?.status) || "Verification required";
          const officialUrl = details.applicationLink || rule?.applicationUrl;
          return (
            <article className="scheme-detail-panel mx-auto max-w-4xl rounded-2xl border border-green-100 bg-white p-5 shadow-lg sm:p-8">
              <button type="button" onClick={() => setSelectedSchemeKey("")} className="schemes-action-button mb-5 rounded-lg border border-green-200 px-4 py-2 font-semibold text-green-900">← Back to schemes</button>
              <header className="border-b border-gray-100 pb-5">
                <div className="flex items-start gap-4"><span aria-hidden="true" className="text-5xl">{details.icon}</span><div><p className="text-sm font-semibold text-green-800">{localizeGovernmentLabel(rule?.government || scheme.government || scheme.level || t("governmentScheme", {}, language), language)}</p><h2 className="mt-1 text-2xl font-bold text-green-950 sm:text-3xl">{details.title}</h2><p className="mt-2 text-sm text-gray-600">{[rule?.department || scheme.department, scheme.state || scheme.applicableState || scheme.geography].filter(Boolean).map((value) => localizeGovernmentLabel(value, language)).join(" · ")}</p></div></div>
              </header>

              <section className={`scheme-assessment-panel mt-5 rounded-xl border p-4 ${assessment.status === "likely_eligible" ? "is-likely" : assessment.status === "not_eligible" ? "is-ineligible" : "is-potential"}`} aria-live="polite">
                <p className="text-lg font-bold text-gray-950">Your result: {assessment.label}</p>
                <p className="mt-1 text-sm text-gray-700">This is an AgriSaathi assessment from your saved profile, not an official decision or guarantee of approval.</p>
                {assessment.reasons.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-800">{assessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
                {assessment.satisfied.length > 0 && <div className="mt-3"><h3 className="font-semibold text-green-950">Profile details that match</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-800">{assessment.satisfied.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                {assessment.missing.length > 0 && <div className="mt-3"><h3 className="font-semibold text-amber-950">Still to confirm</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-800">{assessment.missing.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              </section>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <section><h3 className="font-bold text-green-950">About this scheme</h3><p className="mt-2 text-sm leading-6 text-gray-700">{scheme.description || rule?.benefit || "A detailed description has not been verified. See the official information source."}</p></section>
                <section><h3 className="font-bold text-green-950">Benefits</h3><p className="mt-2 text-sm leading-6 text-gray-700">{rule?.benefit || details.benefits || "Benefits are not verified in this directory entry."}</p></section>
                <section><h3 className="font-bold text-green-950">Eligibility conditions</h3><p className="mt-2 text-sm leading-6 text-gray-700">{details.eligibility || "A complete eligibility summary is not verified. Check the official guidelines."}</p>{rule?.requirements?.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">{rule.requirements.map((item) => <li key={item}>{item}</li>)}</ul>}</section>
                <section><h3 className="font-bold text-green-950">Application and scheme status</h3><p className="mt-2 text-sm text-gray-700">Scheme information: {schemeStatus}.</p><p className="mt-1 text-sm text-gray-700">Application dates: {applicationStart || applicationEnd ? `${applicationStart || "Not listed"} to ${applicationEnd || "Not listed"}` : "No current opening or closing date is verified. Check the official portal."}</p>{details.applicationNote && <p className="mt-2 text-sm text-gray-700">{details.applicationNote}</p>}</section>
              </div>

              <section className="mt-6 rounded-xl border border-gray-200 p-4"><h3 className="font-bold text-green-950">Documents to prepare</h3><p className="mt-2 text-sm leading-6 text-gray-700">{details.documents || "A verified document list is not available in this directory entry. Confirm required documents with the official scheme office or portal."}</p><p className="mt-1 text-xs text-gray-500">Document lists may change. Confirm the current requirements with the scheme authority.</p></section>

              {details.steps.length > 0 && <section className="mt-6"><h3 className="font-bold text-green-950">How to apply</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-700">{details.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></section>}

              <section className="mt-6 rounded-xl bg-gray-50 p-4"><h3 className="font-bold text-green-950">Official source and verification</h3><p className="mt-2 text-sm text-gray-700">Last source review: {rule?.verifiedAt || scheme.lastVerified || "Not recorded"}. Source status: {rule ? (rule.status === "active" ? "Scheme information reviewed; local eligibility or application dates may still vary." : "Needs further verification.") : "No verified source is attached to this scheme entry."}</p>{rule?.informationUrl && <a href={rule.informationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-green-800 underline">Official scheme information ↗</a>}{scheme.sourceUrl && <a href={scheme.sourceUrl} target="_blank" rel="noreferrer" className="ml-4 mt-2 inline-block text-sm font-semibold text-green-800 underline">Additional source ↗</a>}</section>

              <div className="mt-6 flex flex-wrap gap-3">{officialUrl && <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="schemes-action-button schemes-primary-action rounded-lg px-5 py-3 font-semibold text-white">{details.applyLabel} ↗</a>}<button type="button" onClick={() => speakScheme(scheme)} className="schemes-action-button schemes-secondary-action rounded-lg px-5 py-3 font-semibold text-white">{t("speakScheme", {}, language)}</button></div>
            </article>
          );
        })() : (
          <>
            <section className="schemes-filter-panel mb-6 rounded-2xl p-5 shadow-lg">
              <p className="schemes-filter-intro mb-3 text-sm">{view === "personalized" ? "Recommendations use your saved crop, soil, land, irrigation and location details. Open a card to see why it matched and what must be confirmed." : t("browseSchemesIntro", {}, language)}</p>
              <div className="schemes-view-tabs mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setView("personalized"); setStatusFilter("all"); setSearch(""); }} aria-pressed={view === "personalized"} className={`schemes-tab rounded-lg px-4 py-2 font-semibold ${view === "personalized" ? "is-active" : ""}`}>{t("forYourProfile", {}, language)}</button>
                <button type="button" onClick={() => { setView("all"); setStatusFilter("all"); }} aria-pressed={view === "all"} className={`schemes-tab rounded-lg px-4 py-2 font-semibold ${view === "all" ? "is-active" : ""}`}>{t("allSchemes", {}, language)}</button>
              </div>
              {view === "all" && <div className="schemes-status-filters mb-4 flex flex-wrap gap-2" aria-label={t("filterSchemesEligibility", {}, language)}>{[["all", "allStatuses"], ["likely_eligible", "likelyEligible"], ["potentially_eligible", "potentialMatch"], ["not_eligible", "notEligible"], ["unverified", "unverified"]].map(([value, key]) => <button key={value} type="button" onClick={() => setStatusFilter(value)} aria-pressed={statusFilter === value} className="schemes-status-filter rounded-full border px-3 py-1.5 text-sm">{t(key, {}, language)}</button>)}</div>}
              {!profileLoading && !farmer && view === "personalized" && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sign in and complete your farmer profile to see eligible scheme matches.</p>}
              {farmer && view === "personalized" && <p className="schemes-updated-note mb-3 text-xs">Matches are recalculated from your saved profile{farmer.updatedAt ? ` · updated ${new Date(farmer.updatedAt).toLocaleDateString()}` : ""}.</p>}
              <label htmlFor="scheme-search" className="sr-only">Search schemes</label><input id="scheme-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchSchemesPlaceholder", {}, language)} className="schemes-search-input w-full rounded-lg border p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700" />
            </section>

            <div className="schemes-card-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSchemes.map(({ scheme, assessment, rule }) => {
                const details = getSchemeDetails(scheme);
                const statusStyle = assessment.status === "likely_eligible" ? "is-likely" : assessment.status === "not_eligible" ? "is-ineligible" : "is-potential";
                return <button key={getSchemeKey(scheme)} type="button" onClick={() => setSelectedSchemeKey(getSchemeKey(scheme))} className="schemes-card rounded-xl border p-4 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
                  <div className="flex items-start gap-3"><span aria-hidden="true" className="text-3xl">{details.icon}</span><div className="min-w-0"><h2 className="font-bold text-green-950">{details.title}</h2><p className="mt-1 text-xs text-gray-500">{localizeGovernmentLabel(rule?.government || scheme.government || scheme.state || t("governmentScheme", {}, language), language)}</p></div></div>
                  <span className={`schemes-match-badge mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusStyle}`}>{t(({ likely_eligible: "likelyEligible", potentially_eligible: "potentialMatch", not_eligible: "notEligible", unverified: "unverified" })[assessment.status] || "unverified", {}, language)}</span>
                  <span title={assessment.satisfied[0] || assessment.missing[0] || assessment.reasons[0] || "Open to review scheme details."} className="mt-2 block min-h-5 truncate text-xs text-gray-600">{assessment.satisfied[0] || assessment.missing[0] || assessment.reasons[0] || "Open to review scheme details."}</span>
                  <span className="mt-3 block text-sm font-semibold text-green-800">{t("viewCompleteScheme", {}, language)} →</span>
                </button>;
              })}
            </div>

            {filteredSchemes.length === 0 && !schemesLoading && !profileLoading && <div className="schemes-filter-panel rounded-2xl p-8 text-center shadow-lg"><h2 className="text-xl font-bold text-green-900">{view === "personalized" ? "No profile-based matches yet" : t("noSchemesFound", {}, language)}</h2><p className="mt-2 text-gray-600">{view === "personalized" ? "Add your location, crops, cultivated area, soil and irrigation details in Farmer Profile to get more relevant suggestions." : t("searchSchemesHint", {}, language)}</p>{view === "personalized" && <button type="button" onClick={() => { setView("all"); setStatusFilter("all"); }} className="schemes-tab is-active mt-4 rounded-lg px-4 py-2 font-semibold">{t("browseAllSchemes", {}, language)}</button>}</div>}
          </>
        )}
      </div>
    </div>
  );
}
