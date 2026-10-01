const COMMANDS = [
  {
    action: "weather",
    route: "/weather",
    keywords: [
      "open weather",
      "show weather",
      "weather page",
      "today weather",
      "weather",
      "వాతావరణం",
      "వాతావరణం చూపించు",
      "వాతావరణం తెరువు",
      "मौसम",
      "मौसम दिखाओ",
      "வானிலை",
      "ಹವಾಮಾನ",
      "കാലാവസ്ഥ",
      "हवामान",
      "আবহাওয়া",
      "હવામાન",
      "ਮੌਸਮ",
      "موسم",
      "ପାଣିପାଗ",
    ],
  },

  {
    action: "market_prices",
    route: "/market-prices",
    keywords: [
      "open market prices",
      "show market prices",
      "market price",
      "market prices",
      "mandi price",
      "mandi prices",
      "crop prices",
      "పంట ధరలు",
      "మార్కెట్ ధరలు",
      "మండి ధరలు",
      "बाजार भाव",
      "मंडी भाव",
      "फसल के दाम",
      "சந்தை விலை",
      "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ",
      "വിപണി വില",
      "बाजार भाव",
      "বাজার দর",
      "બજાર ભાવ",
      "ਮੰਡੀ ਭਾਅ",
      "منڈی ریٹ",
      "ବଜାର ଦର",
    ],
  },

  {
    action: "crop_disease",
    route: "/crop-disease",
    keywords: [
      "open crop disease",
      "crop disease",
      "disease scanner",
      "scan crop",
      "scan plant",
      "crop scanner",
      "పంట వ్యాధి",
      "పంట స్కానర్",
      "రోగం గుర్తించు",
      "फसल रोग",
      "रोग पहचान",
      "பயிர் நோய்",
      "ಬೆಳೆ ರೋಗ",
      "വിള രോഗം",
      "पीक रोग",
      "ফসলের রোগ",
      "પાક રોગ",
      "ਫਸਲ ਰੋਗ",
      "فصل کی بیماری",
      "ଫସଲ ରୋଗ",
    ],
  },

  {
    action: "government_schemes",
    route: "/govt-schemes",
    keywords: [
      "open government schemes",
      "government schemes",
      "farmer schemes",
      "schemes",
      "subsidies",
      "subsidy",
      "ప్రభుత్వ పథకాలు",
      "రైతు పథకాలు",
      "సబ్సిడీ",
      "सरकारी योजनाएं",
      "किसान योजना",
      "सब्सिडी",
      "அரசு திட்டங்கள்",
      "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು",
      "സർക്കാർ പദ്ധതികൾ",
      "शासकीय योजना",
      "সরকারি প্রকল্প",
      "સરકારી યોજનાઓ",
      "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ",
      "سرکاری اسکیمیں",
      "ସରକାରୀ ଯୋଜନା",
    ],
  },

  {
    action: "dealer_products",
    route: "/farmer/dealer-products",
    keywords: [
      "open dealer products",
      "dealer products",
      "show products",
      "buy seeds",
      "buy fertilizer",
      "local dealers",
      "dealer shop",
      "డీలర్ ఉత్పత్తులు",
      "విత్తనాలు కొనాలి",
      "ఎరువులు కొనాలి",
      "స్థానిక డీలర్లు",
      "डीलर उत्पाद",
      "बीज खरीदना",
      "खाद खरीदना",
      "டீலர் பொருட்கள்",
      "ಡೀಲರ್ ಉತ್ಪನ್ನಗಳು",
      "ഡീലർ ഉൽപ്പന്നങ്ങൾ",
      "डीलर उत्पादने",
      "ডিলার পণ্য",
      "ડીલર ઉત્પાદનો",
      "ਡੀਲਰ ਉਤਪਾਦ",
      "ڈیلر مصنوعات",
      "ଡିଲର ଉତ୍ପାଦ",
    ],
  },

  {
    action: "farmer_orders",
    route: "/farmer/orders",
    keywords: [
      "open my orders",
      "show my orders",
      "my orders",
      "order status",
      "orders",
      "నా ఆర్డర్లు",
      "ఆర్డర్ స్థితి",
      "मेरे ऑर्डर",
      "ऑर्डर स्थिति",
      "என் ஆர்டர்கள்",
      "ನನ್ನ ಆರ್ಡರ್‌ಗಳು",
      "എന്റെ ഓർഡറുകൾ",
      "माझ्या ऑर्डर",
      "আমার অর্ডার",
      "મારા ઓર્ડર",
      "ਮੇਰੇ ਆਰਡਰ",
      "میرے آرڈر",
      "ମୋ ଅର୍ଡର",
    ],
  },

  {
    action: "crop_calendar",
    route: "/farmer/crop-calendar",
    keywords: [
      "crop calendar",
      "farm reminders",
      "my reminders",
      "irrigation reminder",
      "పంట క్యాలెండర్",
      "రిమైండర్లు",
      "फसल कैलेंडर",
      "मेरे रिमाइंडर",
      "பயிர் நாள்காட்டி",
      "ಬೆಳೆ ಕ್ಯಾಲೆಂಡರ್",
    ],
  },

  {
    action: "order_history",
    route: "/farmer/history",
    keywords: [
      "order history",
      "past orders",
      "completed orders",
      "నా పాత ఆర్డర్లు",
      "ऑर्डर इतिहास",
      "पिछले ऑर्डर",
    ],
  },

  {
    action: "community",
    route: "/community",
    keywords: [
      "open community",
      "farmer community",
      "community",
      "posts",
      "రైతు సంఘం",
      "కమ్యూనిటీ",
      "पोस्ट",
      "किसान समुदाय",
      "சமூகம்",
      "ರೈತ ಸಮುದಾಯ",
      "കർഷക സമൂഹം",
      "शेतकरी समुदाय",
      "কৃষক সম্প্রদায়",
      "ખેડૂત સમુદાય",
      "ਕਿਸਾਨ ਭਾਈਚਾਰਾ",
      "کسان کمیونٹی",
      "ଚାଷୀ ସମୁଦାୟ",
    ],
  },

  {
    action: "profile",
    route: "/profile",
    keywords: [
      "open profile",
      "show profile",
      "my profile",
      "farmer profile",
      "నా ప్రొఫైల్",
      "నా వివరాలు",
      "मेरी प्रोफाइल",
      "என் சுயவிவரம்",
      "ನನ್ನ ಪ್ರೊಫೈಲ್",
      "എന്റെ പ്രൊഫൈൽ",
      "माझे प्रोफाइल",
      "আমার প্রোফাইল",
      "મારી પ્રોફાઇલ",
      "ਮੇਰੀ ਪ੍ਰੋਫਾਈਲ",
      "میری پروفائل",
      "ମୋ ପ୍ରୋଫାଇଲ",
    ],
  },

  {
    action: "dashboard",
    route: "/dashboard",
    keywords: [
      "open dashboard",
      "go home",
      "home page",
      "dashboard",
      "హోమ్",
      "డాష్‌బోర్డ్",
      "होम",
      "डैशबोर्ड",
      "முகப்பு",
      "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
      "ഹോം",
      "मुख्यपृष्ठ",
      "হোম",
      "હોમ",
      "ਹੋਮ",
      "ہوم",
      "ହୋମ",
    ],
  },
];

const RESPONSES = {
  weather: {
    en: "Opening weather.",
    te: "వాతావరణం తెరుస్తున్నాను.",
    hi: "मौसम खोल रहा हूँ।",
  },

  market_prices: {
    en: "Opening market prices.",
    te: "మార్కెట్ ధరలు తెరుస్తున్నాను.",
    hi: "बाजार भाव खोल रहा हूँ।",
  },

  crop_disease: {
    en: "Opening the crop disease scanner.",
    te: "పంట వ్యాధి స్కానర్ తెరుస్తున్నాను.",
    hi: "फसल रोग स्कैनर खोल रहा हूँ।",
  },

  government_schemes: {
    en: "Opening government schemes.",
    te: "ప్రభుత్వ పథకాలు తెరుస్తున్నాను.",
    hi: "सरकारी योजनाएं खोल रहा हूँ।",
  },

  dealer_products: {
    en: "Opening local dealer products.",
    te: "స్థానిక డీలర్ ఉత్పత్తులు తెరుస్తున్నాను.",
    hi: "स्थानीय डीलर उत्पाद खोल रहा हूँ।",
  },

  farmer_orders: {
    en: "Opening your orders.",
    te: "మీ ఆర్డర్లు తెరుస్తున్నాను.",
    hi: "आपके ऑर्डर खोल रहा हूँ।",
  },

  community: {
    en: "Opening the farmer community.",
    te: "రైతు కమ్యూనిటీ తెరుస్తున్నాను.",
    hi: "किसान समुदाय खोल रहा हूँ।",
  },

  profile: {
    en: "Opening your profile.",
    te: "మీ ప్రొఫైల్ తెరుస్తున్నాను.",
    hi: "आपकी प्रोफाइल खोल रहा हूँ।",
  },

  dashboard: {
    en: "Opening the dashboard.",
    te: "డాష్‌బోర్డ్ తెరుస్తున్నాను.",
    hi: "डैशबोर्ड खोल रहा हूँ।",
  },
};

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectResponseLanguage(text, preferredLanguage = "en") {
  const normalizedText = String(text || "");

  if (/[\u0C00-\u0C7F]/.test(normalizedText)) {
    return "te";
  }

  if (/[\u0900-\u097F]/.test(normalizedText)) {
    return "hi";
  }

  return preferredLanguage;
}

function getResponse(action, languageCode) {
  const responseGroup = RESPONSES[action];

  if (!responseGroup) {
    return "";
  }

  return (
    responseGroup[languageCode] ||
    responseGroup.en ||
    ""
  );
}

export function detectLocalVoiceCommand(
  transcript,
  preferredLanguage = "en"
) {
  const normalizedTranscript = normalizeText(transcript);

  if (!normalizedTranscript) {
    return null;
  }

  let bestMatch = null;

  for (const command of COMMANDS) {
    for (const keyword of command.keywords) {
      const normalizedKeyword = normalizeText(keyword);

      if (!normalizedKeyword) {
        continue;
      }

      if (normalizedTranscript.includes(normalizedKeyword)) {
        if (
          !bestMatch ||
          normalizedKeyword.length > bestMatch.matchLength
        ) {
          bestMatch = {
            action: command.action,
            route: command.route,
            matchLength: normalizedKeyword.length,
          };
        }
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  const languageCode = detectResponseLanguage(
    transcript,
    preferredLanguage
  );

  return {
    action: bestMatch.action,
    route: bestMatch.route,
    languageCode,
    reply: getResponse(bestMatch.action, languageCode),
    source: "local",
  };
}

export function isLocalVoiceCommand(transcript) {
  return Boolean(detectLocalVoiceCommand(transcript));
}

export function getSupportedLocalCommands() {
  return COMMANDS.map((command) => ({
    action: command.action,
    route: command.route,
  }));
}