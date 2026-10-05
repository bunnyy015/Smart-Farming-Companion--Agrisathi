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
      "बाजार",
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
    action: "product_details",
    route: "/farmer/product/:dealerUid/:productId",
    keywords: [
      "open product",
      "view product",
      "open this product",
      "show product details",
      "product details",
      "ఉత్పత్తి వివరాలు",
      "ఉత్పత్తిని తెరవండి",
      "उत्पाद विवरण",
      "उत्पाद खोलो",
    ],
  },

  {
    action: "dealer_products",
    route: "/farmer/dealer-products",
    keywords: [
      "open dealer products",
      "open marketplace",
      "go to marketplace",
      "marketplace",
      "market place",
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
      "మార్కెట్‌కి",
      "మార్కెట్ కు",
      "మార్కెట్‌ప్లేస్",
      "डीलर उत्पाद",
      "बीज खरीदना",
      "खाद खरीदना",
      "मार्केटप्लेस",
      "बाजार में उत्पाद",
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
      "ఆర్డర్",
      "मेरे ऑर्डर",
      "ऑर्डर स्थिति",
      "என் ஆர்டர்கள்",
      "ஆர்டர்கள்",
      "ನನ್ನ ಆರ್ಡರ್‌ಗಳು",
      "ಆರ್ಡರ್",
      "എന്റെ ഓർഡറുകൾ",
      "ഓർഡർ",
      "माझ्या ऑर्डर",
      "ऑर्डर",
      "আমার অর্ডার",
      "অর্ডার",
      "મારા ઓર્ડર",
      "ਮੇਰੇ ਆਰਡਰ",
      "میرے آرڈر",
      "ମୋ ଅର୍ଡର",
    ],
  },

  {
    action: "order_history",
    route: "/farmer/orders?filter=history",
    keywords: [
      "order history",
      "past orders",
      "previous orders",
      "completed orders",
      "ఆర్డర్ చరిత్ర",
      "పాత ఆర్డర్లు",
      "గత ఆర్డర్లు",
      "ऑर्डर इतिहास",
      "पुराने ऑर्डर",
      "पिछले ऑर्डर",
      "ஆர்டர் வரலாறு",
      "ಹಳೆಯ ಆರ್ಡರ್",
      "ഓർഡർ ചരിത്രം",
      "जुने ऑर्डर",
      "অর্ডারের ইতিহাস",
      "જૂના ઓર્ડર",
      "ਪੁਰਾਣੇ ਆਰਡਰ",
      "پرانے آرڈر",
      "ପୁରୁଣା ଅର୍ଡର",
    ],
  },

  {
    action: "notifications",
    route: "/farmer/notifications",
    keywords: [
      "notifications",
      "notification",
      "alerts",
      "messages",
      "సూచనలు",
      "నోటిఫికేషన్లు",
      "అప్‌డేట్లు",
      "सूचनाएं",
      "नोटिफिकेशन",
      "अपडेट",
      "அறிவிப்புகள்",
      "ಸೂಚನೆಗಳು",
      "അറിയിപ്പുകൾ",
      "सूचना",
      "বিজ্ঞপ্তি",
      "સૂચનાઓ",
      "ਸੂਚਨਾਵਾਂ",
      "اطلاعات",
      "ବିଜ୍ଞପ୍ତି",
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
      "go to profile",
      "take me to my profile",
      "show me my profile",
      "my profile",
      "farmer profile",
      "profile",
      "నా ప్రొఫైల్",
      "ప్రొఫైల్",
      "ప్రొఫైల్‌కి",
      "నా వివరాలు చూపించు",
      "నా వివరాలు",
      "मेरी प्रोफाइल",
      "प्रोफाइल",
      "प्रोफ़ाइल",
      "मेरी जानकारी",
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
    action: "voice_assistant",
    route: "/farmer/voice",
    keywords: [
      "voice assistant",
      "open voice assistant",
      "start voice assistant",
      "వాయిస్ అసిస్టెంట్",
      "వాయిస్ సహాయకుడు",
      "वॉइस असिस्टेंट",
      "आवाज़ सहायक",
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
      "open home",
      "go to home",
      "take me home",
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

export const VOICE_ACTION_ROUTES = Object.freeze(
  Object.fromEntries(
    COMMANDS.map(({ action, route }) => [action, route])
  )
);

export function getVoiceActionRoute(action, searchQuery = "") {
  const route = VOICE_ACTION_ROUTES[action];

  if (!route) {
    return null;
  }

  if (action !== "dealer_products" || !searchQuery.trim()) {
    return route;
  }

  return `${route}?search=${encodeURIComponent(searchQuery.trim())}`;
}

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

  order_history: {
    en: "Opening your order history.",
    te: "మీ ఆర్డర్ చరిత్రను తెరుస్తున్నాను.",
    hi: "आपके ऑर्डर का इतिहास खोल रहा हूँ।",
  },

  notifications: {
    en: "Opening your notifications.",
    te: "మీ సూచనలను తెరుస్తున్నాను.",
    hi: "आपकी सूचनाएँ खोल रहा हूँ।",
  },
};

const GENERIC_OPENING = {
  en: "Opening the requested page.",
  te: "మీరు కోరిన పేజీని తెరుస్తున్నాను.",
  hi: "आपका अनुरोधित पेज खोल रहा हूँ।",
  ta: "நீங்கள் கேட்ட பக்கத்தைத் திறக்கிறேன்.",
  kn: "ನೀವು ಕೇಳಿದ ಪುಟವನ್ನು ತೆರೆಯುತ್ತಿದ್ದೇನೆ.",
  ml: "നിങ്ങൾ ആവശ്യപ്പെട്ട പേജ് തുറക്കുന്നു.",
  mr: "तुम्ही मागितलेले पृष्ठ उघडत आहे.",
  bn: "আপনার অনুরোধ করা পৃষ্ঠাটি খুলছি।",
  gu: "તમે માંગેલું પાનું ખોલી રહ્યો છું.",
  pa: "ਤੁਹਾਡਾ ਮੰਗਿਆ ਪੰਨਾ ਖੋਲ੍ਹ ਰਿਹਾ ਹਾਂ।",
  ur: "آپ کا مطلوبہ صفحہ کھول رہا ہوں۔",
  or: "ଆପଣ ଚାହିଁଥିବା ପୃଷ୍ଠା ଖୋଲୁଛି।",
};

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectResponseLanguage(text, preferredLanguage = "en") {
  const normalizedText = String(text || "");

  if (/[\u0C00-\u0C7F]/.test(normalizedText)) {
    return "te";
  }

  if (/[\u0900-\u097F]/.test(normalizedText)) {
    return ["hi", "mr"].includes(preferredLanguage)
      ? preferredLanguage
      : "hi";
  }

  if (/[\u0B80-\u0BFF]/.test(normalizedText)) return "ta";
  if (/[\u0C80-\u0CFF]/.test(normalizedText)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(normalizedText)) return "ml";
  if (/[\u0980-\u09FF]/.test(normalizedText)) return "bn";
  if (/[\u0A80-\u0AFF]/.test(normalizedText)) return "gu";
  if (/[\u0A00-\u0A7F]/.test(normalizedText)) return "pa";
  if (/[\u0600-\u06FF]/.test(normalizedText)) return "ur";

  if (preferredLanguage === "or" && /[\u0B00-\u0B7F]/.test(normalizedText)) {
    return "or";
  }

  return preferredLanguage;
}

function getResponse(action, languageCode) {
  const responseGroup = RESPONSES[action];

  if (!responseGroup) {
    return GENERIC_OPENING[languageCode] || GENERIC_OPENING.en;
  }

  return (
    responseGroup[languageCode] ||
    (["en", "te", "hi"].includes(languageCode)
      ? responseGroup.en
      : "") ||
    GENERIC_OPENING[languageCode] ||
    GENERIC_OPENING.en
  );
}

function getProductSearchQuery(normalizedTranscript) {
  const searchMatch = normalizedTranscript.match(
    /\b(?:search|find|look for|show(?: me)?|open|view|i need|i want)\s+(?:(?:for|me|the)\s+)?(.+?)(?:\s+(?:in|from)\s+(?:the\s+)?(?:marketplace|shop))?$/u
  );

  if (!searchMatch) return "";

  const query = searchMatch[1]
    .replace(/\b(?:products?|items?|details?|please|now|available)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:for|of)\s+/u, "");

  return ["", "products", "product", "items", "item"].includes(query)
    ? ""
    : query.slice(0, 100);
}

const PRODUCT_SEARCH_TERMS =
  /(?:\b(?:seed|seeds|fertili[sz]er|urea|pesticide|fungicide|insecticide|feed|tool|tools|sprayer)\b|సీడ్స్|విత్తన|ఎరువ|యూరియా|పురుగుమంద|बीज|खाद|उर्वरक|यूरिया|कीटनाशक|விதை|உரம்|கருவி|ಬೀಜ|ಗೊಬ್ಬರ|ಕೀಟನಾಶಕ|വിത്ത്|വളം|കീടനാശിനി|बियाणे|खत|कीटकनाशक|বীজ|সার|কীটনাশক|બીજ|ખાતર|જંતુનાશક|ਬੀਜ|ਖਾਦ|ਕੀਟਨਾਸ਼ਕ|بیج|کھاد|زرعی دوا|ବିହନ|ସାର|କୀଟନାଶକ)/u;

function findIntentMatches(normalizedTranscript) {
  const matches = new Map();

  for (const command of COMMANDS) {
    for (const keyword of command.keywords) {
      const normalizedKeyword = normalizeText(keyword);

      if (
        normalizedKeyword &&
        normalizedTranscript.includes(normalizedKeyword)
      ) {
        const previousLength = matches.get(command.action) || 0;
        matches.set(
          command.action,
          Math.max(previousLength, normalizedKeyword.length)
        );
      }
    }
  }

  if (matches.has("order_history")) {
    matches.delete("farmer_orders");
  }

  if (
    /\b(?:search|find|look for|show me|i need|i want(?: to buy)?)\b/u.test(
      normalizedTranscript
    ) &&
    PRODUCT_SEARCH_TERMS.test(normalizedTranscript)
  ) {
    matches.set("dealer_products", 1);
  }

  return matches;
}

const AMBIGUOUS_REPLY = {
  en: "I heard more than one request. Please say one page, such as profile, orders, or marketplace.",
  te: "ఒకటి కంటే ఎక్కువ అభ్యర్థనలు వినిపించాయి. ప్రొఫైల్, ఆర్డర్లు లేదా మార్కెట్‌ప్లేస్ వంటి ఒక పేజీని చెప్పండి.",
  hi: "एक से ज़्यादा अनुरोध सुनाई दिए। कृपया प्रोफाइल, ऑर्डर या मार्केटप्लेस में से एक पेज बताइए।",
  ta: "ஒன்றுக்கு மேற்பட்ட கோரிக்கைகள் கேட்டன. சுயவிவரம், ஆர்டர்கள் அல்லது சந்தை ஆகியவற்றில் ஒரு பக்கத்தைச் சொல்லுங்கள்.",
  kn: "ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ವಿನಂತಿಗಳು ಕೇಳಿವೆ. ಪ್ರೊಫೈಲ್, ಆರ್ಡರ್‌ಗಳು ಅಥವಾ ಮಾರುಕಟ್ಟೆ ಇವುಗಳಲ್ಲಿ ಒಂದನ್ನು ಹೇಳಿ.",
  ml: "ഒന്നിലധികം അഭ്യർത്ഥനകൾ കേട്ടു. പ്രൊഫൈൽ, ഓർഡറുകൾ, മാർക്കറ്റ് എന്നിവയിൽ ഒരു പേജ് പറയൂ.",
  mr: "एकापेक्षा जास्त विनंत्या ऐकू आल्या. प्रोफाइल, ऑर्डर किंवा मार्केटपैकी एक पृष्ठ सांगा.",
  bn: "একাধিক অনুরোধ শুনেছি। প্রোফাইল, অর্ডার বা বাজারের মধ্যে একটি পৃষ্ঠা বলুন।",
  gu: "એકથી વધુ વિનંતીઓ સંભળાઈ. કૃપા કરીને પ્રોફાઇલ, ઓર્ડર અથવા બજાર માંથી એક પાનું કહો.",
  pa: "ਇੱਕ ਤੋਂ ਵੱਧ ਬੇਨਤੀਆਂ ਸੁਣੀਆਂ। ਕਿਰਪਾ ਕਰਕੇ ਪ੍ਰੋਫਾਈਲ, ਆਰਡਰ ਜਾਂ ਮਾਰਕੀਟ ਵਿੱਚੋਂ ਇੱਕ ਪੰਨਾ ਦੱਸੋ।",
  ur: "ایک سے زیادہ درخواستیں سنائی دیں۔ پروفائل، آرڈر یا مارکیٹ میں سے ایک صفحہ بتائیں۔",
  or: "ଏକାଧିକ ଅନୁରୋଧ ଶୁଣିଲି। ପ୍ରୋଫାଇଲ୍, ଅର୍ଡର କିମ୍ବା ବଜାର ମଧ୍ୟରୁ ଗୋଟିଏ ପୃଷ୍ଠା କୁହନ୍ତୁ।",
};

export function detectLocalVoiceCommand(
  transcript,
  preferredLanguage = "en"
) {
  const normalizedTranscript = normalizeText(transcript);

  if (!normalizedTranscript) {
    return null;
  }

  // Route only clear navigation requests locally. Questions such as
  // "what is my order status?" should reach the conversational assistant.
  const navigationLanguage =
    /\b(?:open|show|take me|bring me|go to|navigate to|where can i find|where can i see|can you show|can you open|i want to see|i would like to see)\b|చూపించు|తెరువు|తీసుకెళ్లు|ఎక్కడ.*(?:చూడ|దొరుకు)|खोलो|दिखाओ|ले चलो|कहाँ.*(?:देख|मिले)|திற|காட்டு|திறக்க|ತೋರಿಸು|ತೆರೆ|തുറക്കൂ|കാണിക്കൂ|दाखवा|उघडा|দেখান|খুলুন|બતાવો|ખોલો|ਦਿਖਾਓ|ਖੋਲ੍ਹੋ|دکھائیں|کھولیں|ଦେଖାନ୍ତୁ|ଖୋଲନ୍ତୁ/u;
  if (!navigationLanguage.test(normalizedTranscript)) {
    return null;
  }

  if (
    /\b(?:don't|do not|not|never|cancel|stop)\b|వద్దు|కాదు|मत|नहीं|இல்லை|ಬೇಡ|വേണ്ട|नको|না|નહીં|ਨਹੀਂ|نہیں|ନା/u.test(
      normalizedTranscript
    )
  ) {
    return null;
  }

  const matches = findIntentMatches(normalizedTranscript);
  const rankedMatches = [...matches.entries()].sort(
    (first, second) => second[1] - first[1]
  );

  if (!rankedMatches.length) return null;

  const languageCode = detectResponseLanguage(
    transcript,
    preferredLanguage
  );
  const distinctIntents = rankedMatches.map(([action]) => action);

  if (distinctIntents.length > 1) {
    return {
      action: "none",
      route: null,
      languageCode,
      reply: AMBIGUOUS_REPLY[languageCode] || AMBIGUOUS_REPLY.en,
      source: "local",
      ambiguous: true,
    };
  }

  const [action] = rankedMatches[0];
  const searchQuery =
    ["dealer_products", "product_details"].includes(action)
      ? getProductSearchQuery(normalizedTranscript)
      : "";

  return {
    action,
    route: getVoiceActionRoute(action, searchQuery),
    searchQuery,
    languageCode,
    reply: getResponse(action, languageCode),
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
