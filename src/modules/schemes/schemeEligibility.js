// Eligibility notes are maintained separately from both the scheme directory
// and each farmer's profile. Dates refer to the official source review.
export const SCHEME_RULES = {
  schemeTitlePmkisan: {
    id: "pm-kisan",
    name: "PM-KISAN",
    government: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    status: "active",
    verifiedAt: "2026-10-27",
    informationUrl: "https://pmkisan.gov.in/",
    applicationUrl: "https://pmkisan.gov.in/RegistrationFormupdated.aspx",
    benefit: "₹6,000 per year in three installments for eligible farmer families.",
    requirements: ["Landholding farmer family; State/UT identification and scheme exclusions apply."],
    evaluate(farmer) {
      const land = Number(farmer.landSize || 0);
      if (["tenant", "sharecropper"].includes(farmer.cultivationStatus)) {
        return { status: "not_eligible", satisfied: [], missing: [], reasons: ["The profile indicates leased or share-cultivated land; PM-KISAN is for landholding farmer families."] };
      }
      const satisfied = [];
      const missing = [];
      if (land > 0 && farmer.cultivationStatus === "owner") satisfied.push("Your profile records landholding and owner cultivation.");
      else missing.push("Confirm land ownership and land records.");
      missing.push("Confirm family-level eligibility and exclusions. The official portal excludes institutional landholders and specified constitutional officeholders, government employees (with listed exceptions), pensioners receiving ₹10,000/month or more, income-tax payers, and practicing registered professionals; this profile does not collect those details.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["PM-KISAN covers qualifying landholding farmer families across India."] };
    },
  },
  schemeTitleInsurance: {
    id: "pmfby",
    name: "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
    government: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    status: "active",
    verifiedAt: "2026-10-27",
    informationUrl: "https://pmfby.gov.in/faq",
    applicationUrl: "https://pmfby.gov.in/",
    benefit: "Crop insurance protection for notified crops and areas, subject to current season rules.",
    requirements: ["Insurable interest in a notified crop and area; seasonal enrollment dates and local notifications apply."],
    evaluate(farmer) {
      const satisfied = [];
      const missing = [];
      if (farmer.state && farmer.district) satisfied.push(`Your location is recorded as ${farmer.district}, ${farmer.state}.`);
      else missing.push("Add your state and district.");
      const crops = farmer.selectedCrops || [farmer.mainCrop].filter(Boolean);
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}.`);
      else missing.push("Add the crop you intend to insure.");
      if (Number(farmer.landSize || 0) > 0 && farmer.landUnit) satisfied.push(`Your cultivated area is recorded as ${farmer.landSize} ${farmer.landUnit}.`);
      else missing.push("Add cultivated area and confirm your insurable interest.");
      missing.push("Confirm that your crop and area are notified for the current season and check the local enrollment deadline.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["PMFBY covers farmers with insurable interest in notified crops and areas; current local notifications determine enrollment."] };
    },
  },
  schemeTitleCredit: {
    id: "kcc",
    name: "Kisan Credit Card (KCC)",
    government: "Central",
    department: "Department of Financial Services / participating banks",
    status: "active",
    verifiedAt: "2026-10-27",
    informationUrl: "https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=11325",
    applicationUrl: "https://pmkisan.gov.in/Documents/Kcc.pdf",
    benefit: "Agricultural credit limits are assessed by participating banks based on crop, area, scale of finance, and other applicable factors.",
    requirements: ["Owner cultivators, tenant farmers, oral lessees and sharecroppers may apply; bank assessment and documentation apply."],
    evaluate(farmer) {
      const crops = farmer.selectedCrops || [farmer.mainCrop].filter(Boolean);
      const satisfied = [];
      const missing = [];
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}.`);
      else missing.push("Add the crops or agricultural activity to finance.");
      if (["owner", "tenant", "sharecropper"].includes(farmer.cultivationStatus)) satisfied.push("Your cultivation status is recorded.");
      else missing.push("Confirm your cultivation arrangement and supporting documents.");
      if (Number(farmer.landSize || 0) > 0) satisfied.push("Cultivated land area is recorded.");
      else missing.push("Add the area you cultivate, if applicable.");
      missing.push("The participating bank decides credit limits and approval after reviewing its requirements.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["RBI guidance includes owner cultivators, tenant farmers, oral lessees and sharecroppers; credit remains subject to bank assessment."] };
    },
  },
  schemeTitleSoil: {
    id: "soil-health-card",
    name: "Soil Health Card Scheme",
    government: "Central",
    department: "Department of Agriculture & Farmers Welfare / State Agriculture Departments",
    status: "active",
    verifiedAt: "2026-10-27",
    informationUrl: "https://soilhealth.dac.gov.in/",
    applicationUrl: "https://soilhealth.dac.gov.in/",
    benefit: "Soil testing and nutrient recommendations for a farmer’s holding; cards are intended to be issued periodically.",
    requirements: ["The official FAQ describes the service for farmers’ soil holdings; local sampling and service availability are handled by State/UT departments."],
    evaluate(farmer) {
      if (Number(farmer.landSize || 0) > 0) {
        return { status: "likely_eligible", satisfied: ["Your profile records cultivated land for soil testing."], missing: ["Confirm sample registration and service availability with your local agriculture department."], reasons: ["The Soil Health Card service is intended for farmers’ soil holdings."] };
      }
      return { status: "potentially_eligible", satisfied: [], missing: ["Add cultivated land details and ask the local agriculture department about soil sampling."], reasons: ["The service supports soil testing for farmers’ holdings."] };
    },
  },
  schemeTitleIrrigation: {
    id: "pmksy",
    name: "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY)",
    government: "Central / State implementation",
    department: "Department of Agriculture & Farmers Welfare and implementing departments",
    status: "verification_required",
    verifiedAt: "2026-10-27",
    informationUrl: "https://pmksy.gov.in/",
    applicationUrl: "https://pmksy.gov.in/",
    benefit: "Component-specific irrigation support; benefits and application processes depend on the current component and State notification.",
    requirements: ["Current component, district availability, applicant conditions and dates require confirmation from the implementing department."],
  },
  schemeTitleEnam: {
    id: "enam",
    name: "National Agriculture Market (e-NAM)",
    government: "Central",
    department: "Small Farmers’ Agribusiness Consortium",
    status: "active",
    verifiedAt: "2026-10-27",
    informationUrl: "https://enam.gov.in/web/",
    applicationUrl: "https://www.enam.gov.in/web/Enam_ctrl/enam_registration",
    benefit: "Online access to participating APMC markets and related trading services; local mandi onboarding applies.",
    requirements: ["Farmer registration is associated with a participating mandi/APMC; confirm local registration requirements."],
    evaluate(farmer) {
      if (farmer.state && (farmer.selectedCrops?.length || farmer.mainCrop)) {
        return { status: "potentially_eligible", satisfied: [`Your profile includes farming activity in ${farmer.state}.`], missing: ["Confirm your nearby mandi/APMC participates and complete its registration requirements."], reasons: ["Your profile describes a farmer in a state served by the e-NAM platform; mandi participation is local."] };
      }
      return { status: "potentially_eligible", satisfied: [], missing: ["Add your state and crop, then confirm local mandi participation."], reasons: ["e-NAM participation is available through enrolled APMC markets."] };
    },
  },
  rythuBharosa: {
    id: "telangana-rythu-bharosa",
    name: "Telangana Rythu Bharosa",
    government: "Telangana State",
    department: "Government of Telangana, Agriculture and Co-operation Department",
    status: "active",
    verifiedAt: "2026-10-27",
    informationUrl: "https://mulugu.telangana.gov.in/scheme/rythu-bharosa-agriculture-support/",
    applicationUrl: "https://rythubharosa.telangana.gov.in/Default_Home.aspx",
    benefit: "The Mulugu District Government scheme page lists ₹6,000 per acre each season (₹12,000 annually); confirm current-season details with the State portal.",
    requirements: ["The district government page describes arable-land and State land-record requirements for owners and a valid lease for tenant farmers; beneficiary verification applies."],
    evaluate(farmer) {
      if (String(farmer.state || "").toLowerCase() !== "telangana") {
        return { status: "not_eligible", satisfied: [], missing: [], reasons: ["This is a Telangana state scheme and the profile lists a different state."] };
      }
      const satisfied = ["Your profile lists Telangana."];
      const missing = [];
      if (Number(farmer.landSize || 0) > 0) satisfied.push("Your profile records cultivated land.");
      else missing.push("Add cultivated area and confirm the land is active, arable farmland.");
      if (farmer.cultivationStatus === "owner") missing.push("Confirm land is registered in the State land records or covered by the applicable forest-rights record.");
      else if (farmer.cultivationStatus === "tenant") missing.push("Confirm that you have the valid lease required by the State scheme.");
      else missing.push("Confirm ownership or a qualifying lease with the local agriculture office.");
      missing.push("Confirm current-season beneficiary verification and application details with the State portal.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["The Mulugu District Government page describes Telangana farmer support for active arable land, with land-record or valid-lease conditions."] };
    },
  },
};

const STATUS_LABELS = {
  likely_eligible: "Likely eligible",
  potentially_eligible: "Potentially eligible",
  not_eligible: "Not eligible",
  unverified: "Eligibility unverified",
};

function getRule(scheme) {
  if (scheme.eligibilityRuleId) {
    return Object.values(SCHEME_RULES).find((rule) => rule.id === scheme.eligibilityRuleId);
  }
  return SCHEME_RULES[scheme.titleKey] || Object.values(SCHEME_RULES).find((rule) =>
    `${scheme.title || ""} ${scheme.schemeName || ""}`.toLowerCase().includes(rule.name.toLowerCase())
  );
}

export function assessScheme(scheme, farmer) {
  const rule = getRule(scheme);
  if (!rule || !farmer) {
    return {
      rule: null,
      status: "unverified",
      label: STATUS_LABELS.unverified,
      satisfied: [],
      missing: [farmer ? "No verified, current eligibility rules are available for this scheme." : "Add or load your farmer profile to check relevance."],
      reasons: [],
    };
  }
  const result = rule.evaluate?.(farmer) || {
    status: "unverified", satisfied: [], missing: ["Current detailed eligibility rules require confirmation."], reasons: [],
  };
  return { ...result, rule, label: STATUS_LABELS[result.status] || STATUS_LABELS.unverified };
}

export function getSchemeRule(scheme) {
  return getRule(scheme);
}
