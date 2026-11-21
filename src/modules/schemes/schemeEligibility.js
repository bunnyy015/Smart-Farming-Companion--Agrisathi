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
      const crops = getFarmerCrops(farmer);
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}.`);
      else missing.push("Add the crop you intend to insure.");
      const cropAreas = getCropAreaSummary(farmer);
      if (cropAreas.length) satisfied.push(`Your crop-wise area is recorded as ${cropAreas.join("; ")}.`);
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
      const crops = getFarmerCrops(farmer);
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
        const satisfied = [`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of cultivated land for soil testing.`];
        if (farmer.soilType) satisfied.push(`Your saved soil type is ${farmer.soilType}; the soil test can provide measured nutrient recommendations for your plot.`);
        else satisfied.push("A soil type is not saved; the soil sample and lab result, rather than a profile estimate, establish nutrient status.");
        return { status: "likely_eligible", satisfied, missing: ["Confirm sample registration and service availability with your local agriculture department."], reasons: ["The Soil Health Card service is intended for farmers’ soil holdings."] };
      }
      return { status: "potentially_eligible", satisfied: farmer.soilType ? [`Your profile records ${farmer.soilType}; add the field area for a soil-sample match.`] : [], missing: ["Add cultivated land details and ask the local agriculture department about soil sampling."], reasons: ["The service supports soil testing for farmers’ holdings."] };
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
    requirements: ["The Per Drop More Crop component focuses on farm-level water-use efficiency through precision and micro-irrigation; approved state plans, crop and area rules apply."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const areas = getCropAreaSummary(farmer);
      const satisfied = [];
      const missing = [];
      if (farmer.state && farmer.district) satisfied.push(`Your farm is recorded in ${farmer.district}, ${farmer.state}.`);
      else missing.push("Add your state and district to check the local micro-irrigation plan.");
      if (crops.length) satisfied.push(`Your crops are ${crops.join(", ")}; crop spacing affects the suitable drip or sprinkler system.`);
      else missing.push("Add the crop or crops you grow to check irrigation-system relevance.");
      if (areas.length) satisfied.push(`Crop-wise area: ${areas.join("; ")}.`);
      else if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your total cultivated area is ${farmer.landSize} ${farmer.landUnit || "acres"}.`);
      else missing.push("Add the field area you want to irrigate.");
      if (farmer.irrigationType) satisfied.push(`Your current water setup is ${farmer.irrigationType}.`);
      else missing.push("Add your irrigation or water-source details.");
      if (farmer.soilType) satisfied.push(`${farmer.soilType} is noted for agronomy context; it does not decide subsidy eligibility by itself.`);
      missing.push("Confirm the approved component, system, application window and target with your State Agriculture Department before purchase.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Crop, field area, irrigation and soil details help identify relevance; the State plan and field verification decide support."] };
    },
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
      if (farmer.state && getFarmerCrops(farmer).length) {
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
      const state = String(farmer.state || "").trim().toLowerCase();
      if (!state) {
        return { status: "potentially_eligible", satisfied: [], missing: ["Add your state to check this Telangana-specific scheme."], reasons: ["Rythu Bharosa is a Telangana State agriculture support programme."] };
      }
      if (state !== "telangana") {
        return { status: "not_eligible", satisfied: [], missing: [], reasons: ["This is a Telangana state scheme and the profile lists a different state."] };
      }
      const satisfied = ["Your profile lists Telangana."];
      const missing = [];
      if (Number(farmer.landSize || 0) > 0) satisfied.push("Your profile records cultivated land.");
      else missing.push("Add cultivated area and confirm the land is active, arable farmland.");
      const crops = getFarmerCrops(farmer);
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")} as crops grown.`);
      if (farmer.soilType) satisfied.push(`${farmer.soilType} is saved for farm context; it is not an independent eligibility condition.`);
      if (farmer.cultivationStatus === "owner") missing.push("Confirm land is registered in the State land records or covered by the applicable forest-rights record.");
      else if (farmer.cultivationStatus === "tenant") missing.push("Confirm that you have the valid lease required by the State scheme.");
      else missing.push("Confirm ownership or a qualifying lease with the local agriculture office.");
      missing.push("Confirm current-season beneficiary verification and application details with the State portal.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["The Mulugu District Government page describes Telangana farmer support for active arable land, with land-record or valid-lease conditions."] };
    },
  },
  schemeTitleRythuBima: {
    id: "telangana-rythu-bima",
    name: "Telangana Rythu Bima",
    government: "Telangana State",
    department: "Government of Telangana, Agriculture Department",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://www.rythubharosa.telangana.gov.in/Default_Home.aspx",
    applicationUrl: "https://www.rythubharosa.telangana.gov.in/Default_Home.aspx",
    benefit: "The official Telangana portal lists ₹5 lakh life cover for the nominated beneficiary, subject to policy and claim verification.",
    requirements: ["Official scheme information describes enrollment for farmers aged 18–59 in Telangana; the State verifies farmer records, enrollment and nominee details."],
    evaluate(farmer) {
      const state = String(farmer.state || "").trim().toLowerCase();
      const age = farmer.age === "" || farmer.age == null ? NaN : Number(farmer.age);
      const land = Number(farmer.landSize || 0);
      const satisfied = [];
      const missing = [];
      if (!state) {
        return { status: "potentially_eligible", satisfied, missing: ["Add your state to check whether the Telangana scheme applies to your profile."], reasons: ["Rythu Bima is a Telangana State scheme; your location is needed for a profile check."] };
      }
      if (state !== "telangana") {
        return { status: "not_eligible", satisfied, missing: [], reasons: ["Rythu Bima is a Telangana State scheme, but your profile lists a different state."] };
      }
      satisfied.push("Your profile lists Telangana.");
      if (Number.isFinite(age) && age >= 18 && age <= 59) satisfied.push(`Your profile age (${age}) is within the published 18–59 enrollment range.`);
      else if (Number.isFinite(age)) return { status: "not_eligible", satisfied, missing: [], reasons: [`Your profile age (${age}) is outside the published 18–59 enrollment range.`] };
      else missing.push("Add your age to compare with the published 18–59 enrollment range.");
      if (land > 0 && farmer.cultivationStatus === "owner") satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of owner-cultivated land.`);
      else if (land > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of cultivated land.`);
      else missing.push("Add your cultivated land and confirm the farmer record accepted for enrollment.");
      if (!farmer.cultivationStatus) missing.push("Add your cultivation arrangement if available so the local office can verify your farmer records.");
      missing.push("Confirm active enrollment, official farmer records and nominee details with the State Agriculture Department; crop choice is not an age or life-cover qualification.");
      return {
        status: "potentially_eligible",
        satisfied,
        missing,
        reasons: ["Your saved profile is compared with the State and published age range. Only the State and insurer can confirm enrollment and claim eligibility."],
      };
    },
  },
  schemeTitlePmkmy: {
    id: "pm-kisan-maandhan",
    name: "Pradhan Mantri Kisan Maandhan Yojana (PM-KMY)",
    government: "Central",
    department: "Department of Agriculture & Farmers Welfare",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://www.myscheme.gov.in/schemes/pmkmdy",
    applicationUrl: "https://www.myscheme.gov.in/schemes/pmkmdy",
    benefit: "Voluntary contributory pension scheme with an assured pension of ₹3,000 per month from age 60 for enrolled eligible subscribers.",
    requirements: ["Published entry age is 18–40; small and marginal farmer landholding is up to 2 hectares; scheme exclusions and contribution terms apply."],
    evaluate(farmer) {
      const age = farmer.age === "" || farmer.age == null ? NaN : Number(farmer.age);
      const land = Number(farmer.landSize || 0);
      const hectares = String(farmer.landUnit).toLowerCase().startsWith("hect") ? land : land * 0.404686;
      const crops = getFarmerCrops(farmer);
      const satisfied = [];
      const missing = [];
      if (Number.isFinite(age) && age >= 18 && age <= 40) satisfied.push(`Your profile age (${age}) is within the 18–40 entry range.`);
      else if (Number.isFinite(age)) return { status: "not_eligible", satisfied, missing: [], reasons: ["Your age is outside PM-KMY's published entry-age range of 18–40."] };
      else missing.push("Add your age to check the 18–40 entry range.");
      if (land > 0 && hectares <= 2) satisfied.push(`Your recorded land (${farmer.landSize} ${farmer.landUnit || "acres"}) is within the published 2-hectare ceiling.`);
      else if (hectares > 2) return { status: "not_eligible", satisfied, missing: [], reasons: ["The recorded land exceeds PM-KMY's published ceiling of 2 hectares; confirm the official landholding calculation if records differ."] };
      else missing.push("Add your land area and unit to check the 2-hectare limit.");
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}.`);
      missing.push("Confirm small/marginal farmer land records, scheme exclusions, contribution amount and enrollment with an authorized CSC.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Age, land area and crops are profile-based screening signals; the enrollment authority verifies all scheme conditions."] };
    },
  },
  schemeTitleKusum: {
    id: "pm-kusum",
    name: "PM-KUSUM",
    government: "Central",
    department: "Ministry of New and Renewable Energy / State Implementing Agencies",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://pmkusum.mnre.gov.in/landing-faq.html",
    applicationUrl: "https://pmkusum.mnre.gov.in/landing-faq.html",
    benefit: "Support depends on the active component, state window, pump and project requirements.",
    requirements: ["Applicant and project conditions vary by PM-KUSUM component and State Implementing Agency."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const hasLand = Number(farmer.landSize || 0) > 0;
      const satisfied = [];
      const missing = [];
      if (farmer.state) satisfied.push(`Your profile lists ${farmer.state}.`); else missing.push("Add your state to find the implementing agency.");
      if (hasLand) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of farmland.`); else missing.push("Add farmland details if you are applying for a land-based component.");
      if (farmer.irrigationType) satisfied.push(`Your irrigation type is recorded as ${farmer.irrigationType}.`); else missing.push("Add your irrigation or pump details if applicable.");
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}.`);
      missing.push("Confirm the component, open state application window, land/pump conditions and current subsidy with the State Implementing Agency.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["The profile suggests possible relevance to solar irrigation support; it cannot determine project or subsidy eligibility."] };
    },
  },
  schemeTitleSmam: {
    id: "smam",
    name: "Sub-Mission on Agricultural Mechanization (SMAM)",
    government: "Central / State implementation",
    department: "Department of Agriculture & Farmers Welfare / State Agriculture Departments",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://agrimachinery.nic.in/Index/Index",
    applicationUrl: "https://agrimachinery.nic.in/Index/Index",
    benefit: "State-window and equipment-specific assistance may be available under current guidelines.",
    requirements: ["Current equipment lists, targets and eligible applicant categories are defined by the State and application window."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const satisfied = [];
      const missing = [];
      if (farmer.state) satisfied.push(`Your profile lists ${farmer.state}.`); else missing.push("Add your state to check its agriculture department's open targets.");
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}.`); else missing.push("Add the crops you grow to assess machinery relevance.");
      if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of farmland.`); else missing.push("Add your cultivated land area, if available.");
      missing.push("Confirm eligible equipment, applicant category, open target and subsidy with your State Agriculture Department before purchase.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Your farm profile can help identify relevant machinery, but the State decides eligibility and availability."] };
    },
  },
  schemeTitleNmnf: {
    id: "national-mission-natural-farming",
    name: "National Mission on Natural Farming (NMNF)",
    government: "Central / State implementation",
    department: "Department of Agriculture & Farmers Welfare / State Agriculture Departments",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://naturalfarming.dac.gov.in/",
    applicationUrl: "https://naturalfarming.dac.gov.in/",
    benefit: "Training, demonstrations and bio-input support may be available through State and local natural-farming clusters; any incentive depends on current enrollment guidelines.",
    requirements: ["Participation and support depend on local cluster availability and State/UT enrollment."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const satisfied = [];
      const missing = [];
      if (farmer.state) satisfied.push(`Your profile lists ${farmer.state}.`); else missing.push("Add your state to locate the relevant Agriculture Department or cluster.");
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}.`); else missing.push("Add your crops to assess natural-farming relevance.");
      if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of cultivated land.`); else missing.push("Add cultivated area if available.");
      missing.push("Confirm cluster availability, natural-farming participation conditions and current incentive rules with your State or local coordinator.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Crop and land details indicate possible relevance only; local enrollment and farming-practice conditions must be verified."] };
    },
  },
  schemeTitleAif: {
    id: "agriculture-infrastructure-fund",
    name: "Agriculture Infrastructure Fund (AIF)",
    government: "Central",
    department: "Department of Agriculture & Farmers Welfare / Participating Lending Institutions",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://agriinfra.dac.gov.in/",
    applicationUrl: "https://agriinfra.dac.gov.in/",
    benefit: "Eligible infrastructure loans may receive interest-subvention and credit-guarantee support under current guidelines and lender approval.",
    requirements: ["Applicant type, eligible infrastructure project and lending institution appraisal must meet current AIF guidelines."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const satisfied = [];
      const missing = [];
      if (crops.length) satisfied.push(`Your profile lists ${crops.join(", ")}, which can inform a post-harvest project proposal.`); else missing.push("Add crops or agricultural activity to relate a project to your farm.");
      if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of farmland.`); else missing.push("Add land or asset details if these are relevant to a proposed project.");
      missing.push("AIF is project finance rather than a direct cash benefit. Confirm an eligible infrastructure project, applicant category, project proposal and lender approval.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Your farm details may inform an eligible infrastructure project, but profile details alone do not establish access to AIF finance."] };
    },
  },
  midh: {
    id: "midh",
    name: "Mission for Integrated Development of Horticulture (MIDH)",
    government: "Central / State implementation",
    department: "Department of Agriculture & Farmers Welfare / State Horticulture Missions",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://midh.gov.in/RightToInformation",
    applicationUrl: "https://midh.gov.in/",
    benefit: "State-implemented horticulture development support across covered fruit, vegetable, spice, flower and other horticulture sectors; open activities and assistance vary by State.",
    requirements: ["MIDH covers horticulture sectors; the State Horticulture Mission determines current component, target, application and project conditions."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const horticultureTerms = /fruit|banana|mango|citrus|orange|lemon|lime|guava|papaya|grape|pomegranate|apple|sapota|jackfruit|coconut|cashew|vegetable|tomato|brinjal|eggplant|okra|bhindi|chilli|pepper|onion|garlic|cabbage|cauliflower|potato|sweet potato|tapioca|turmeric|ginger|coriander|spice|mushroom|flower|floriculture|aromatic|bamboo|horticulture/;
      const matchedCrops = crops.filter((crop) => horticultureTerms.test(crop.toLowerCase()));
      const satisfied = [];
      const missing = [];
      if (farmer.state) satisfied.push(`Your farm is recorded in ${farmer.state}.`); else missing.push("Add your state to identify the State Horticulture Mission.");
      if (matchedCrops.length) satisfied.push(`Your profile crops (${matchedCrops.join(", ")}) are in horticulture categories covered by MIDH.`);
      else if (crops.length) missing.push(`Your saved crops are ${crops.join(", ")}; confirm with your State Horticulture Mission whether a current MIDH component covers them.`);
      else missing.push("Add your crops to check whether MIDH horticulture components are relevant.");
      const areas = getCropAreaSummary(farmer);
      if (areas.length) satisfied.push(`Recorded crop areas: ${areas.join("; ")}.`);
      else if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of farmland.`);
      else missing.push("Add cultivated area if you are seeking a land-based horticulture activity.");
      if (farmer.soilType) satisfied.push(`${farmer.soilType} is included as farm context; local crop suitability is assessed by the horticulture department.`);
      missing.push("Confirm the open component, district target, eligible activity and current application process with your State Horticulture Mission.");
      return { status: "potentially_eligible", satisfied, missing, reasons: [matchedCrops.length ? "Your crop list makes horticulture support relevant to check." : "MIDH relevance depends on crop and the current State component; this profile match is only a guide."] };
    },
  },
  "pmksy-per-drop-more-crop": {
    id: "pmksy-per-drop-more-crop",
    name: "PMKSY – Per Drop More Crop",
    government: "Central / State implementation",
    department: "Department of Agriculture & Farmers Welfare / State Agriculture Departments",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://pmksy.gov.in/pdfLinks/FAQ.pdf",
    applicationUrl: "https://pmksy.gov.in/",
    benefit: "Farm-level water-use efficiency support through precision and micro-irrigation under activities approved in the State plan.",
    requirements: ["Crop, spacing, area, approved district plan, State targets and current application rules determine assistance."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const areas = getCropAreaSummary(farmer);
      const satisfied = [];
      const missing = [];
      if (farmer.state && farmer.district) satisfied.push(`Your farm is recorded in ${farmer.district}, ${farmer.state}.`);
      else missing.push("Add your state and district to check the approved local plan.");
      if (crops.length) satisfied.push(`Your crop profile (${crops.join(", ")}) can be used to assess drip or sprinkler suitability.`);
      else missing.push("Add the crop or crops you grow.");
      if (areas.length) satisfied.push(`Crop-wise area: ${areas.join("; ")}.`);
      else if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your total cultivated area is ${farmer.landSize} ${farmer.landUnit || "acres"}.`);
      else missing.push("Add the field area you want to irrigate.");
      if (farmer.irrigationType) satisfied.push(`Your recorded irrigation type is ${farmer.irrigationType}.`);
      else missing.push("Add your irrigation type or water source.");
      if (farmer.soilType) satisfied.push(`${farmer.soilType} is noted for crop and water planning, not as a standalone eligibility test.`);
      missing.push("Ask your district agriculture or horticulture office whether the component and application window are open.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Your crop, area, soil and irrigation profile can identify possible micro-irrigation relevance; State approval is required."] };
    },
  },
  "telangana-micro-irrigation-project": {
    id: "telangana-micro-irrigation-project",
    name: "Telangana Micro Irrigation Project (TGMIP)",
    government: "Telangana State",
    department: "Department of Horticulture, Government of Telangana",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://horticulturedept.telangana.gov.in/horticulturetelangana/MIP_About.aspx",
    applicationUrl: "https://horticulturedept.telangana.gov.in/horticulturetelangana/MIP_OnlineRegform.aspx",
    benefit: "State assistance may support approved drip and sprinkler systems; the current subsidy pattern and land limits are published by Telangana Horticulture Department.",
    requirements: ["Telangana location and eligible land records are required; State registration, available funds, crop, farmer category and current guidelines apply."],
    evaluate(farmer) {
      const state = String(farmer.state || "").trim().toLowerCase();
      if (!state) return { status: "potentially_eligible", satisfied: [], missing: ["Add your state to check the Telangana-only programme."], reasons: ["TGMIP is operated by Telangana's Horticulture Department."] };
      if (!state.includes("telangana")) return { status: "not_eligible", satisfied: [], missing: [], reasons: ["This micro-irrigation programme is specific to Telangana; your saved profile lists another state."] };
      const crops = getFarmerCrops(farmer);
      const areas = getCropAreaSummary(farmer);
      const satisfied = ["Your profile lists Telangana."];
      const missing = [];
      if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of farmland.`);
      else missing.push("Add land area and confirm title/land records with the State portal.");
      if (crops.length) satisfied.push(`Your saved crops are ${crops.join(", ")}.`);
      else missing.push("Add crops so the agriculture team can check the suitable irrigation system.");
      if (areas.length) satisfied.push(`Crop-wise area: ${areas.join("; ")}.`);
      if (farmer.irrigationType) satisfied.push(`Your existing irrigation type is ${farmer.irrigationType}.`);
      else missing.push("Add your current irrigation or water source.");
      if (farmer.soilType) satisfied.push(`${farmer.soilType} is available as agronomy context; the State verifies scheme eligibility from official records.`);
      missing.push("Confirm current TGMIP limits, subsidy category, funds and registration requirements on the State portal.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Your Telangana farm profile makes micro-irrigation support relevant to check; it is not an approval decision."] };
    },
  },
  "pm-dhan-dhaanya-krishi-yojana": {
    id: "pm-dhan-dhaanya-krishi-yojana",
    name: "Prime Minister Dhan-Dhaanya Krishi Yojana (PMDDKY)",
    government: "Central / State implementation",
    department: "Department of Agriculture & Farmers Welfare",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2321731&lang=2&reg=48",
    applicationUrl: "https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2321731&lang=2&reg=48",
    benefit: "District-level convergence for agriculture development in 100 selected districts; no uniform direct cash payment is established by the profile.",
    requirements: ["The farmer's district must be selected and the relevant activity must appear in the local district plan."],
    evaluate(farmer) {
      const state = String(farmer.state || "").trim();
      const district = String(farmer.district || "").trim();
      const satisfied = [];
      const missing = [];
      if (state && district) satisfied.push(`Your profile records ${district}, ${state}.`);
      else missing.push("Add your state and district to check whether your area is included.");
      if (getFarmerCrops(farmer).length) satisfied.push(`Your crop profile (${getFarmerCrops(farmer).join(", ")}) can help identify locally relevant activities.`);
      else missing.push("Add crops to your Farmer Profile to assess relevance to local activities.");
      if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"} of land.`);
      missing.push("Confirm your district is on the official selected-district list and ask which activities are currently funded locally.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["This is a district-focused programme; a profile match is not a benefit approval or proof that your district is selected."] };
    },
  },
  "mission-aatmanirbharta-pulses": {
    id: "mission-aatmanirbharta-pulses",
    name: "Mission for Aatmanirbharta in Pulses",
    government: "Central / State implementation",
    department: "Department of Agriculture & Farmers Welfare",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://www.pib.gov.in/FactsheetDetails.aspx?ModuleId=16&NoteId=151113&id=151113&lang=1&reg=6",
    applicationUrl: "https://www.pib.gov.in/FactsheetDetails.aspx?ModuleId=16&NoteId=151113&id=151113&lang=1&reg=6",
    benefit: "State-planned pulse seed and production activities, and eligible procurement for notified pulses under current registration and procurement rules.",
    requirements: ["Crop, State or district allocation, season, farmer registration and procurement conditions apply."],
    evaluate(farmer) {
      const crops = getFarmerCrops(farmer);
      const pulseCropPattern = /\b(tur|arhar|red gram|pigeon pea|urad|black gram|masoor|lentil)\b/i;
      const matchingCrops = crops.filter((crop) => pulseCropPattern.test(crop));
      if (crops.length && matchingCrops.length === 0) {
        return { status: "not_eligible", satisfied: [], missing: [], reasons: ["The saved crop list does not include tur/arhar, urad, masoor or another pulse covered by the activities described here."] };
      }
      const satisfied = [];
      const missing = [];
      if (matchingCrops.length) satisfied.push(`Your profile lists pulse crop(s): ${matchingCrops.join(", ")}.`);
      else missing.push("Add the pulse crop you grow to your Farmer Profile.");
      if (farmer.state && farmer.district) satisfied.push(`Your location is recorded as ${farmer.district}, ${farmer.state}.`);
      else missing.push("Add your state and district to check local seed-kit or procurement availability.");
      const areas = getCropAreaSummary(farmer);
      if (areas.length) satisfied.push(`Crop-wise area: ${areas.join("; ")}.`);
      missing.push("Confirm whether your district has a current seed-kit activity or MSP procurement window; both are State- and season-dependent.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Crop and location indicate relevance only; State allocation, registration and procurement authorities determine eligibility."] };
    },
  },
  "telangana-indiramma-atmeeya-bharosa": {
    id: "telangana-indiramma-atmeeya-bharosa",
    name: "Telangana Indiramma Atmeeya Bharosa",
    government: "Telangana State",
    department: "Panchayat Raj & Rural Development Department, Government of Telangana",
    status: "active",
    verifiedAt: "2026-11-12",
    informationUrl: "https://www.telangana.gov.in/wp-content/uploads/2026/05/Budget-in-Brief.pdf",
    applicationUrl: "https://tslsa.telangana.gov.in/pdf/poverty-alleviation-govt-schemes.pdf",
    benefit: "State assistance for qualifying landless agricultural labour households; verify current amount and enrollment conditions locally.",
    requirements: ["Telangana residence and current landless agricultural labour household conditions; current MGNREGS-related rules and local verification may apply."],
    evaluate(farmer) {
      const state = String(farmer.state || "").trim().toLowerCase();
      if (!state) return { status: "potentially_eligible", satisfied: [], missing: ["Add your state to check this Telangana-only programme.", "Confirm landless-labour and current-year MGNREGS conditions with the local authority."], reasons: ["The saved profile does not contain the household or work details used by the State for verification."] };
      if (!state.includes("telangana")) return { status: "not_eligible", satisfied: [], missing: [], reasons: ["This programme is specific to Telangana; your profile lists another state."] };
      const satisfied = ["Your profile lists Telangana."];
      const missing = ["Confirm that your household meets the current landless agricultural labour criteria.", "Confirm current-year MGNREGS/job-card conditions and local enrollment status with your Gram Panchayat or Rural Development office."];
      if (Number(farmer.landSize || 0) > 0) satisfied.push(`Your profile records ${farmer.landSize} ${farmer.landUnit || "acres"}; the scheme targets landless agricultural labour households, so verify whether your records meet that definition.`);
      else satisfied.push("Your profile does not record cultivated land; the State must verify landless-household status.");
      return { status: "potentially_eligible", satisfied, missing, reasons: ["Profile details are not enough to establish household eligibility; the Gram Sabha or authorized State officer verifies applications."] };
    },
  },
};

function getFarmerCrops(farmer) {
  const selected = Array.isArray(farmer.selectedCrops) ? farmer.selectedCrops : [];
  const other = String(farmer.otherCrops || "").split(",");
  const cropAreas = farmer.cropAreas && typeof farmer.cropAreas === "object" ? Object.keys(farmer.cropAreas) : [];
  return [...new Set([...selected, farmer.mainCrop, ...other, ...cropAreas]
    .map((crop) => String(crop || "").trim())
    .filter(Boolean))];
}

function getCropAreaSummary(farmer) {
  if (!farmer.cropAreas || typeof farmer.cropAreas !== "object") return [];
  return Object.entries(farmer.cropAreas)
    .filter(([, area]) => Number(area) > 0)
    .map(([crop, area]) => `${crop}: ${area} ${farmer.landUnit || "acres"}`);
}

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
  const rawTitleKey = [scheme.titleKey, scheme.title, scheme.schemeName].find((value) => /^schemeTitle[A-Za-z]+$/.test(String(value || "")));
  return SCHEME_RULES[rawTitleKey] || SCHEME_RULES[scheme.titleKey] || Object.values(SCHEME_RULES).find((rule) =>
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
