const GREETINGS = {
  en: "Hello! I’m your AgriSaathi farming assistant. How can I help you today?",
  te: "నమస్కారం! నేను మీ అగ్రిసాథి వ్యవసాయ సహాయకుడిని. ఈరోజు మీకు ఎలా సహాయం చేయగలను?",
  hi: "नमस्ते! मैं आपका एग्रीसाथी कृषि सहायक हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?",
};

const PLEASANTRIES = {
  en: "I’m doing well and ready to help. What would you like to know about your farm today?",
  te: "నేను బాగున్నాను, మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను. ఈరోజు మీ పొలం గురించి ఏమి తెలుసుకోవాలనుకుంటున్నారు?",
  hi: "मैं अच्छा हूँ और आपकी मदद के लिए तैयार हूँ। आज आप अपनी खेती के बारे में क्या जानना चाहते हैं?",
};

const THANKS = {
  en: "You’re welcome! Let me know if you need help with your crops, weather, or orders.",
  te: "మీకు స్వాగతం! పంటలు, వాతావరణం లేదా ఆర్డర్ల గురించి సహాయం కావాలంటే చెప్పండి.",
  hi: "आपका स्वागत है! फसल, मौसम या ऑर्डर में मदद चाहिए तो बताइए।",
};

function normalize(text) {
  return String(text || "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getVoiceSmallTalkReply(text, languageCode = "en") {
  const normalized = normalize(text);
  const language = ["en", "te", "hi"].includes(languageCode)
    ? languageCode
    : "en";

  if (/^(hello|hi|hey|good morning|good afternoon|good evening|namaskaram|namaste|నమస్కారం|నమస్తే|नमस्कार|नमस्ते)$/.test(normalized)) {
    const greetingLanguage = /[\u0C00-\u0C7F]/.test(normalized)
      ? "te"
      : /[\u0900-\u097F]/.test(normalized)
        ? "hi"
        : language;
    return GREETINGS[greetingLanguage];
  }

  if (/^(how are you|how are you doing|are you there|what is your name|who are you)$/.test(normalized)) {
    return PLEASANTRIES[language];
  }

  if (/^(thanks|thank you|thank you so much|ధన్యవాదాలు|ధన్యవాదం|धन्यवाद|शुक्रिया)$/.test(normalized)) {
    const thanksLanguage = /[\u0C00-\u0C7F]/.test(normalized)
      ? "te"
      : /[\u0900-\u097F]/.test(normalized)
        ? "hi"
        : language;
    return THANKS[thanksLanguage];
  }

  return "";
}
