const CATEGORY_DEFINITIONS = [
  {
    value: "Seeds",
    terms: ["seed", "seeds", "seedling", "seedlings", "విత్తనం", "విత్తనాలు", "बीज", "ಬೀಜ", "விதை"],
  },
  {
    value: "Fertilizer",
    terms: ["fertilizer", "fertilizers", "fertiliser", "fertilisers", "manure", "compost", "ఎరువు", "ఎరువులు", "खाद", "उर्वरक", "ಗೊಬ್ಬರ", "உரம்"],
  },
  {
    value: "Pesticide",
    terms: ["pesticide", "pesticides", "fungicide", "fungicides", "insecticide", "insecticides", "herbicide", "herbicides", "purugumandu", "పురుగుమందు", "कीटनाशक", "ಕೀಟನಾಶಕ", "பூச்சிக்கொல்லி"],
  },
  {
    value: "Tools",
    terms: ["tool", "tools", "equipment", "sprayer", "sprayers", "implement", "implements", "పరికరం", "పరికరాలు", "उपकरण", "ಉಪಕರಣ", "கருவி"],
  },
  {
    value: "Animal Feed",
    terms: ["animal feed", "animal feeds", "cattle feed", "cattle feeds", "livestock feed", "livestock feeds", "feed", "feeds", "fodder", "పశు ఆహారం", "पशु आहार", "ಪಶು ಆಹಾರ", "கால்நடை தீவனம்"],
  },
];

const CATEGORY_FILLERS = [
  "is there any", "are there any", "do you have", "have you got", "can i get", "show me",
  "show", "find", "search for", "search", "look for", "open", "view", "available",
  "availability", "in stock", "stock", "marketplace", "market place",
  "product place", "products", "product", "items", "item", "all", "the", "me", "please",
  "in", "at", "from", "for", "nearby", "near me", "and", "any", "is there", "are there",
  "do you have", "have you got", "can i get", "named", "called", "is", "there",
];

function normalize(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removePhrase(text, phrase) {
  return ` ${text} `.split(` ${phrase} `).join(" ").replace(/\s+/g, " ").trim();
}

export function getMarketplaceCategory(value) {
  let remaining = normalize(value);
  if (!remaining) return "";

  let matchedCategory = "";
  for (const definition of CATEGORY_DEFINITIONS) {
    for (const term of definition.terms) {
      const normalizedTerm = normalize(term);
      if (` ${remaining} `.includes(` ${normalizedTerm} `)) {
        matchedCategory ||= definition.value;
        remaining = removePhrase(remaining, normalizedTerm);
      }
    }
  }

  if (!matchedCategory) return "";

  for (const filler of CATEGORY_FILLERS) {
    remaining = removePhrase(remaining, normalize(filler));
  }

  return remaining ? "" : matchedCategory;
}
