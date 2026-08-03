const LANGUAGE_STORAGE_KEY = "agrisathi-language";
const LANGUAGE_CHANGE_EVENT = "agrisathi-language-changed";

export const DEFAULT_LANGUAGE = "en";

export const languages = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    locale: "en-IN",
    direction: "ltr",
  },
  {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    locale: "te-IN",
    direction: "ltr",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    locale: "hi-IN",
    direction: "ltr",
  },
  {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    locale: "ta-IN",
    direction: "ltr",
  },
  {
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    locale: "kn-IN",
    direction: "ltr",
  },
  {
    code: "ml",
    name: "Malayalam",
    nativeName: "മലയാളം",
    locale: "ml-IN",
    direction: "ltr",
  },
  {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    locale: "mr-IN",
    direction: "ltr",
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    locale: "bn-IN",
    direction: "ltr",
  },
  {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    locale: "gu-IN",
    direction: "ltr",
  },
  {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    locale: "pa-IN",
    direction: "ltr",
  },
  {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    locale: "ur-IN",
    direction: "rtl",
  },
  {
    code: "or",
    name: "Odia",
    nativeName: "ଓଡ଼ିଆ",
    locale: "or-IN",
    direction: "ltr",
  },
];

export const translations = {
  en: {
    selectLanguage: "Select Language",
    chooseLanguage: "Choose your preferred language",
    smartFarmingCompanion: "Smart Farming Companion",
    welcomeFarmer: "Welcome Farmer",
    chooseService: "Choose a service below",

    login: "Login",
    logout: "Logout",
    createAccount: "Create Account",
    email: "Email",
    password: "Password",
    dashboard: "Dashboard",

    home: "Home",
    orders: "Orders",
    notifications: "Notifications",
    community: "Community",
    profile: "Profile",
    settings: "Settings",

    weather: "Weather",
    cropDisease: "Crop Disease",
    marketPrices: "Market Prices",
    govtSchemes: "Government Schemes",
    farmerProfile: "Farmer Profile",
    dealerProducts: "Dealers",
    myOrders: "My Orders",
    voiceAssistant: "Voice Assistant",

    scanCrop: "Scan Crop",
    localDealers: "Local Dealers",
    buyProducts: "Buy Products",
    checkMandi: "Check Mandi Prices",
    trackPurchase: "Track Purchase",
    farmingServices: "Farming Services",

    back: "Back",
    refresh: "Refresh",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    continue: "Continue",
    retry: "Try Again",

    languageChanged: "Language changed successfully.",
    noInformation: "Information is not available.",
  },

  te: {
    selectLanguage: "భాషను ఎంచుకోండి",
    chooseLanguage: "మీకు ఇష్టమైన భాషను ఎంచుకోండి",
    smartFarmingCompanion: "స్మార్ట్ వ్యవసాయ సహాయకుడు",
    welcomeFarmer: "స్వాగతం రైతు గారు",
    chooseService: "క్రింది సేవను ఎంచుకోండి",

    login: "లాగిన్",
    logout: "లాగౌట్",
    createAccount: "ఖాతా సృష్టించండి",
    email: "ఇమెయిల్",
    password: "పాస్‌వర్డ్",
    dashboard: "డాష్‌బోర్డ్",

    home: "హోమ్",
    orders: "ఆర్డర్లు",
    notifications: "సూచనలు",
    community: "కమ్యూనిటీ",
    profile: "ప్రొఫైల్",
    settings: "సెట్టింగ్స్",

    weather: "వాతావరణం",
    cropDisease: "పంట వ్యాధి",
    marketPrices: "మార్కెట్ ధరలు",
    govtSchemes: "ప్రభుత్వ పథకాలు",
    farmerProfile: "రైతు ప్రొఫైల్",
    dealerProducts: "డీలర్లు",
    myOrders: "నా ఆర్డర్లు",
    voiceAssistant: "వాయిస్ సహాయకుడు",

    scanCrop: "పంటను స్కాన్ చేయండి",
    localDealers: "సమీప డీలర్లు",
    buyProducts: "ఉత్పత్తులు కొనండి",
    checkMandi: "మండి ధరలు చూడండి",
    trackPurchase: "కొనుగోలు స్థితి చూడండి",
    farmingServices: "వ్యవసాయ సేవలు",

    back: "వెనక్కి",
    refresh: "రిఫ్రెష్",
    loading: "లోడ్ అవుతోంది...",
    save: "సేవ్ చేయండి",
    cancel: "రద్దు చేయండి",
    continue: "కొనసాగండి",
    retry: "మళ్లీ ప్రయత్నించండి",

    languageChanged: "భాష విజయవంతంగా మార్చబడింది.",
    noInformation: "సమాచారం అందుబాటులో లేదు.",
  },

  hi: {
    selectLanguage: "भाषा चुनें",
    chooseLanguage: "अपनी पसंदीदा भाषा चुनें",
    smartFarmingCompanion: "स्मार्ट खेती साथी",
    welcomeFarmer: "स्वागत है किसान",
    chooseService: "नीचे एक सेवा चुनें",

    login: "लॉगिन",
    logout: "लॉगआउट",
    createAccount: "खाता बनाएं",
    email: "ईमेल",
    password: "पासवर्ड",
    dashboard: "डैशबोर्ड",

    home: "होम",
    orders: "ऑर्डर",
    notifications: "सूचनाएं",
    community: "समुदाय",
    profile: "प्रोफाइल",
    settings: "सेटिंग्स",

    weather: "मौसम",
    cropDisease: "फसल रोग",
    marketPrices: "बाजार भाव",
    govtSchemes: "सरकारी योजनाएं",
    farmerProfile: "किसान प्रोफाइल",
    dealerProducts: "डीलर",
    myOrders: "मेरे ऑर्डर",
    voiceAssistant: "आवाज़ सहायक",

    scanCrop: "फसल स्कैन करें",
    localDealers: "स्थानीय डीलर",
    buyProducts: "सामान खरीदें",
    checkMandi: "मंडी भाव देखें",
    trackPurchase: "खरीद की स्थिति देखें",
    farmingServices: "कृषि सेवाएं",

    back: "वापस",
    refresh: "रीफ्रेश",
    loading: "लोड हो रहा है...",
    save: "सेव करें",
    cancel: "रद्द करें",
    continue: "जारी रखें",
    retry: "फिर प्रयास करें",

    languageChanged: "भाषा सफलतापूर्वक बदल दी गई है।",
    noInformation: "जानकारी उपलब्ध नहीं है।",
  },

  ta: {
    selectLanguage: "மொழியைத் தேர்ந்தெடுக்கவும்",
    chooseLanguage: "உங்களுக்கு விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்",
    smartFarmingCompanion: "ஸ்மார்ட் விவசாய துணை",
    welcomeFarmer: "விவசாயிக்கு வரவேற்பு",
    chooseService: "கீழே ஒரு சேவையைத் தேர்ந்தெடுக்கவும்",

    login: "உள்நுழை",
    logout: "வெளியேறு",
    createAccount: "கணக்கு உருவாக்கு",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    dashboard: "முகப்புப் பலகை",

    home: "முகப்பு",
    orders: "ஆர்டர்கள்",
    notifications: "அறிவிப்புகள்",
    community: "சமூகம்",
    profile: "சுயவிவரம்",
    settings: "அமைப்புகள்",

    weather: "வானிலை",
    cropDisease: "பயிர் நோய்",
    marketPrices: "சந்தை விலை",
    govtSchemes: "அரசு திட்டங்கள்",
    farmerProfile: "விவசாயி சுயவிவரம்",
    dealerProducts: "விற்பனையாளர்கள்",
    myOrders: "என் ஆர்டர்கள்",
    voiceAssistant: "குரல் உதவியாளர்",

    scanCrop: "பயிரை ஸ்கேன் செய்க",
    localDealers: "உள்ளூர் விற்பனையாளர்கள்",
    buyProducts: "பொருட்கள் வாங்குக",
    checkMandi: "சந்தை விலையைப் பார்க்கவும்",
    trackPurchase: "வாங்கியதை கண்காணிக்கவும்",
    farmingServices: "விவசாய சேவைகள்",

    back: "பின்செல்",
    refresh: "புதுப்பிக்கவும்",
    loading: "ஏற்றுகிறது...",
    save: "சேமிக்கவும்",
    cancel: "ரத்து செய்க",
    continue: "தொடரவும்",
    retry: "மீண்டும் முயற்சிக்கவும்",

    languageChanged: "மொழி வெற்றிகரமாக மாற்றப்பட்டது.",
    noInformation: "தகவல் கிடைக்கவில்லை.",
  },

  kn: {
    selectLanguage: "ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ",
    chooseLanguage: "ನಿಮ್ಮ ಇಷ್ಟದ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    smartFarmingCompanion: "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಂಗಾತಿ",
    welcomeFarmer: "ಸ್ವಾಗತ ರೈತರೇ",
    chooseService: "ಕೆಳಗಿನ ಸೇವೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",

    login: "ಲಾಗಿನ್",
    logout: "ಲಾಗೌಟ್",
    createAccount: "ಖಾತೆ ರಚಿಸಿ",
    email: "ಇಮೇಲ್",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",

    home: "ಮುಖಪುಟ",
    orders: "ಆರ್ಡರ್‌ಗಳು",
    notifications: "ಸೂಚನೆಗಳು",
    community: "ಸಮುದಾಯ",
    profile: "ಪ್ರೊಫೈಲ್",
    settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",

    weather: "ಹವಾಮಾನ",
    cropDisease: "ಬೆಳೆ ರೋಗ",
    marketPrices: "ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು",
    govtSchemes: "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು",
    farmerProfile: "ರೈತ ಪ್ರೊಫೈಲ್",
    dealerProducts: "ಡೀಲರ್‌ಗಳು",
    myOrders: "ನನ್ನ ಆರ್ಡರ್‌ಗಳು",
    voiceAssistant: "ಧ್ವನಿ ಸಹಾಯಕ",

    scanCrop: "ಬೆಳೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
    localDealers: "ಸ್ಥಳೀಯ ಡೀಲರ್‌ಗಳು",
    buyProducts: "ಉತ್ಪನ್ನ ಖರೀದಿಸಿ",
    checkMandi: "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ನೋಡಿ",
    trackPurchase: "ಖರೀದಿ ಸ್ಥಿತಿ ನೋಡಿ",
    farmingServices: "ಕೃಷಿ ಸೇವೆಗಳು",

    back: "ಹಿಂದೆ",
    refresh: "ರಿಫ್ರೆಶ್",
    loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    save: "ಉಳಿಸಿ",
    cancel: "ರದ್ದುಮಾಡಿ",
    continue: "ಮುಂದುವರಿಸಿ",
    retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",

    languageChanged: "ಭಾಷೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಬದಲಾಯಿಸಲಾಗಿದೆ.",
    noInformation: "ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.",
  },

  ml: {
    selectLanguage: "ഭാഷ തിരഞ്ഞെടുക്കുക",
    chooseLanguage: "നിങ്ങളുടെ ഇഷ്ടഭാഷ തിരഞ്ഞെടുക്കുക",
    smartFarmingCompanion: "സ്മാർട്ട് കൃഷി കൂട്ടായി",
    welcomeFarmer: "കർഷകനു സ്വാഗതം",
    chooseService: "താഴെ ഒരു സേവനം തിരഞ്ഞെടുക്കുക",

    login: "ലോഗിൻ",
    logout: "ലോഗൗട്ട്",
    createAccount: "അക്കൗണ്ട് സൃഷ്ടിക്കുക",
    email: "ഇമെയിൽ",
    password: "പാസ്‌വേഡ്",
    dashboard: "ഡാഷ്ബോർഡ്",

    home: "ഹോം",
    orders: "ഓർഡറുകൾ",
    notifications: "അറിയിപ്പുകൾ",
    community: "സമൂഹം",
    profile: "പ്രൊഫൈൽ",
    settings: "ക്രമീകരണങ്ങൾ",

    weather: "കാലാവസ്ഥ",
    cropDisease: "വിള രോഗം",
    marketPrices: "മാർക്കറ്റ് വിലകൾ",
    govtSchemes: "സർക്കാർ പദ്ധതികൾ",
    farmerProfile: "കർഷക പ്രൊഫൈൽ",
    dealerProducts: "ഡീലർമാർ",
    myOrders: "എന്റെ ഓർഡറുകൾ",
    voiceAssistant: "വോയ്സ് അസിസ്റ്റന്റ്",

    scanCrop: "വിള സ്കാൻ ചെയ്യുക",
    localDealers: "പ്രാദേശിക ഡീലർമാർ",
    buyProducts: "ഉൽപ്പന്നങ്ങൾ വാങ്ങുക",
    checkMandi: "മാർക്കറ്റ് വില പരിശോധിക്കുക",
    trackPurchase: "വാങ്ങൽ നില പരിശോധിക്കുക",
    farmingServices: "കൃഷി സേവനങ്ങൾ",

    back: "പിന്നോട്ട്",
    refresh: "പുതുക്കുക",
    loading: "ലോഡ് ചെയ്യുന്നു...",
    save: "സേവ് ചെയ്യുക",
    cancel: "റദ്ദാക്കുക",
    continue: "തുടരുക",
    retry: "വീണ്ടും ശ്രമിക്കുക",

    languageChanged: "ഭാഷ വിജയകരമായി മാറ്റി.",
    noInformation: "വിവരം ലഭ്യമല്ല.",
  },

  mr: {
    selectLanguage: "भाषा निवडा",
    chooseLanguage: "आपली पसंतीची भाषा निवडा",
    smartFarmingCompanion: "स्मार्ट शेती साथी",
    welcomeFarmer: "शेतकरी मित्रा, स्वागत आहे",
    chooseService: "खालील सेवा निवडा",

    login: "लॉगिन",
    logout: "लॉगआउट",
    createAccount: "खाते तयार करा",
    email: "ईमेल",
    password: "पासवर्ड",
    dashboard: "डॅशबोर्ड",

    home: "मुख्यपृष्ठ",
    orders: "ऑर्डर",
    notifications: "सूचना",
    community: "समुदाय",
    profile: "प्रोफाइल",
    settings: "सेटिंग्ज",

    weather: "हवामान",
    cropDisease: "पीक रोग",
    marketPrices: "बाजार भाव",
    govtSchemes: "सरकारी योजना",
    farmerProfile: "शेतकरी प्रोफाइल",
    dealerProducts: "विक्रेते",
    myOrders: "माझे ऑर्डर",
    voiceAssistant: "आवाज सहाय्यक",

    scanCrop: "पीक स्कॅन करा",
    localDealers: "स्थानिक विक्रेते",
    buyProducts: "उत्पादने खरेदी करा",
    checkMandi: "बाजार भाव पहा",
    trackPurchase: "खरेदीची स्थिती पहा",
    farmingServices: "शेती सेवा",

    back: "मागे",
    refresh: "रीफ्रेश",
    loading: "लोड होत आहे...",
    save: "सेव्ह करा",
    cancel: "रद्द करा",
    continue: "पुढे जा",
    retry: "पुन्हा प्रयत्न करा",

    languageChanged: "भाषा यशस्वीपणे बदलली.",
    noInformation: "माहिती उपलब्ध नाही.",
  },

  bn: {
    selectLanguage: "ভাষা নির্বাচন করুন",
    chooseLanguage: "আপনার পছন্দের ভাষা নির্বাচন করুন",
    smartFarmingCompanion: "স্মার্ট কৃষি সহায়ক",
    welcomeFarmer: "কৃষককে স্বাগতম",
    chooseService: "নিচের একটি পরিষেবা নির্বাচন করুন",

    login: "লগইন",
    logout: "লগআউট",
    createAccount: "অ্যাকাউন্ট তৈরি করুন",
    email: "ইমেল",
    password: "পাসওয়ার্ড",
    dashboard: "ড্যাশবোর্ড",

    home: "হোম",
    orders: "অর্ডার",
    notifications: "বিজ্ঞপ্তি",
    community: "সম্প্রদায়",
    profile: "প্রোফাইল",
    settings: "সেটিংস",

    weather: "আবহাওয়া",
    cropDisease: "ফসলের রোগ",
    marketPrices: "বাজার দর",
    govtSchemes: "সরকারি প্রকল্প",
    farmerProfile: "কৃষক প্রোফাইল",
    dealerProducts: "ডিলার",
    myOrders: "আমার অর্ডার",
    voiceAssistant: "ভয়েস সহায়ক",

    scanCrop: "ফসল স্ক্যান করুন",
    localDealers: "স্থানীয় ডিলার",
    buyProducts: "পণ্য কিনুন",
    checkMandi: "বাজার দর দেখুন",
    trackPurchase: "ক্রয় অনুসরণ করুন",
    farmingServices: "কৃষি পরিষেবা",

    back: "পিছনে",
    refresh: "রিফ্রেশ",
    loading: "লোড হচ্ছে...",
    save: "সংরক্ষণ করুন",
    cancel: "বাতিল করুন",
    continue: "চালিয়ে যান",
    retry: "আবার চেষ্টা করুন",

    languageChanged: "ভাষা সফলভাবে পরিবর্তিত হয়েছে।",
    noInformation: "তথ্য পাওয়া যায়নি।",
  },

  gu: {
    selectLanguage: "ભાષા પસંદ કરો",
    chooseLanguage: "તમારી પસંદગીની ભાષા પસંદ કરો",
    smartFarmingCompanion: "સ્માર્ટ ખેતી સાથી",
    welcomeFarmer: "ખેડૂતનું સ્વાગત છે",
    chooseService: "નીચેની સેવા પસંદ કરો",

    login: "લોગિન",
    logout: "લોગઆઉટ",
    createAccount: "ખાતું બનાવો",
    email: "ઇમેઇલ",
    password: "પાસવર્ડ",
    dashboard: "ડેશબોર્ડ",

    home: "હોમ",
    orders: "ઓર્ડર",
    notifications: "સૂચનાઓ",
    community: "સમુદાય",
    profile: "પ્રોફાઇલ",
    settings: "સેટિંગ્સ",

    weather: "હવામાન",
    cropDisease: "પાક રોગ",
    marketPrices: "બજાર ભાવ",
    govtSchemes: "સરકારી યોજનાઓ",
    farmerProfile: "ખેડૂત પ્રોફાઇલ",
    dealerProducts: "ડીલર",
    myOrders: "મારા ઓર્ડર",
    voiceAssistant: "વોઇસ સહાયક",

    scanCrop: "પાક સ્કેન કરો",
    localDealers: "સ્થાનિક ડીલર",
    buyProducts: "ઉત્પાદનો ખરીદો",
    checkMandi: "બજાર ભાવ જુઓ",
    trackPurchase: "ખરીદી તપાસો",
    farmingServices: "ખેતી સેવાઓ",

    back: "પાછળ",
    refresh: "રિફ્રેશ",
    loading: "લોડ થઈ રહ્યું છે...",
    save: "સાચવો",
    cancel: "રદ કરો",
    continue: "ચાલુ રાખો",
    retry: "ફરી પ્રયાસ કરો",

    languageChanged: "ભાષા સફળતાપૂર્વક બદલાઈ.",
    noInformation: "માહિતી ઉપલબ્ધ નથી.",
  },

  pa: {
    selectLanguage: "ਭਾਸ਼ਾ ਚੁਣੋ",
    chooseLanguage: "ਆਪਣੀ ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ ਚੁਣੋ",
    smartFarmingCompanion: "ਸਮਾਰਟ ਖੇਤੀ ਸਾਥੀ",
    welcomeFarmer: "ਕਿਸਾਨ ਜੀ ਦਾ ਸੁਆਗਤ ਹੈ",
    chooseService: "ਹੇਠਾਂ ਇੱਕ ਸੇਵਾ ਚੁਣੋ",

    login: "ਲਾਗਇਨ",
    logout: "ਲਾਗਆਉਟ",
    createAccount: "ਖਾਤਾ ਬਣਾਓ",
    email: "ਈਮੇਲ",
    password: "ਪਾਸਵਰਡ",
    dashboard: "ਡੈਸ਼ਬੋਰਡ",

    home: "ਮੁੱਖ ਪੰਨਾ",
    orders: "ਆਰਡਰ",
    notifications: "ਸੂਚਨਾਵਾਂ",
    community: "ਭਾਈਚਾਰਾ",
    profile: "ਪ੍ਰੋਫਾਈਲ",
    settings: "ਸੈਟਿੰਗਜ਼",

    weather: "ਮੌਸਮ",
    cropDisease: "ਫਸਲ ਰੋਗ",
    marketPrices: "ਮਾਰਕੀਟ ਭਾਅ",
    govtSchemes: "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ",
    farmerProfile: "ਕਿਸਾਨ ਪ੍ਰੋਫਾਈਲ",
    dealerProducts: "ਡੀਲਰ",
    myOrders: "ਮੇਰੇ ਆਰਡਰ",
    voiceAssistant: "ਆਵਾਜ਼ ਸਹਾਇਕ",

    scanCrop: "ਫਸਲ ਸਕੈਨ ਕਰੋ",
    localDealers: "ਸਥਾਨਕ ਡੀਲਰ",
    buyProducts: "ਸਮਾਨ ਖਰੀਦੋ",
    checkMandi: "ਮੰਡੀ ਭਾਅ ਵੇਖੋ",
    trackPurchase: "ਖਰੀਦ ਦੀ ਸਥਿਤੀ ਵੇਖੋ",
    farmingServices: "ਖੇਤੀ ਸੇਵਾਵਾਂ",

    back: "ਪਿੱਛੇ",
    refresh: "ਰਿਫਰੈਸ਼",
    loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...",
    save: "ਸੇਵ ਕਰੋ",
    cancel: "ਰੱਦ ਕਰੋ",
    continue: "ਜਾਰੀ ਰੱਖੋ",
    retry: "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ",

    languageChanged: "ਭਾਸ਼ਾ ਸਫਲਤਾਪੂਰਵਕ ਬਦਲੀ ਗਈ।",
    noInformation: "ਜਾਣਕਾਰੀ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।",
  },

  ur: {
    selectLanguage: "زبان منتخب کریں",
    chooseLanguage: "اپنی پسندیدہ زبان منتخب کریں",
    smartFarmingCompanion: "اسمارٹ فارمنگ ساتھی",
    welcomeFarmer: "کسان صاحب خوش آمدید",
    chooseService: "نیچے سے ایک خدمت منتخب کریں",

    login: "لاگ اِن",
    logout: "لاگ آؤٹ",
    createAccount: "اکاؤنٹ بنائیں",
    email: "ای میل",
    password: "پاس ورڈ",
    dashboard: "ڈیش بورڈ",

    home: "ہوم",
    orders: "آرڈرز",
    notifications: "اطلاعات",
    community: "برادری",
    profile: "پروفائل",
    settings: "سیٹنگز",

    weather: "موسم",
    cropDisease: "فصل کی بیماری",
    marketPrices: "بازار قیمتیں",
    govtSchemes: "سرکاری اسکیمیں",
    farmerProfile: "کسان پروفائل",
    dealerProducts: "ڈیلر",
    myOrders: "میرے آرڈرز",
    voiceAssistant: "آواز معاون",

    scanCrop: "فصل اسکین کریں",
    localDealers: "قریبی ڈیلر",
    buyProducts: "سامان خریدیں",
    checkMandi: "منڈی قیمت دیکھیں",
    trackPurchase: "خریداری کی حالت دیکھیں",
    farmingServices: "زرعی خدمات",

    back: "واپس",
    refresh: "تازہ کریں",
    loading: "لوڈ ہو رہا ہے...",
    save: "محفوظ کریں",
    cancel: "منسوخ کریں",
    continue: "جاری رکھیں",
    retry: "دوبارہ کوشش کریں",

    languageChanged: "زبان کامیابی سے تبدیل ہوگئی۔",
    noInformation: "معلومات دستیاب نہیں ہیں۔",
  },

  or: {
    selectLanguage: "ଭାଷା ବାଛନ୍ତୁ",
    chooseLanguage: "ଆପଣଙ୍କ ପସନ୍ଦର ଭାଷା ବାଛନ୍ତୁ",
    smartFarmingCompanion: "ସ୍ମାର୍ଟ କୃଷି ସାଥୀ",
    welcomeFarmer: "କୃଷକଙ୍କୁ ସ୍ୱାଗତ",
    chooseService: "ନିମ୍ନରୁ ଏକ ସେବା ବାଛନ୍ତୁ",

    login: "ଲଗଇନ",
    logout: "ଲଗଆଉଟ",
    createAccount: "ଖାତା ସୃଷ୍ଟି କରନ୍ତୁ",
    email: "ଇମେଲ",
    password: "ପାସୱାର୍ଡ",
    dashboard: "ଡ୍ୟାଶବୋର୍ଡ",

    home: "ହୋମ",
    orders: "ଅର୍ଡର",
    notifications: "ସୂଚନା",
    community: "ସମୁଦାୟ",
    profile: "ପ୍ରୋଫାଇଲ",
    settings: "ସେଟିଂସ",

    weather: "ଆବହାଓଆ",
    cropDisease: "ଫସଲ ରୋଗ",
    marketPrices: "ବଜାର ଦର",
    govtSchemes: "ସରକାରୀ ଯୋଜନା",
    farmerProfile: "କୃଷକ ପ୍ରୋଫାଇଲ",
    dealerProducts: "ଡିଲର",
    myOrders: "ମୋ ଅର୍ଡର",
    voiceAssistant: "ଭଏସ୍ ସହାୟକ",

    scanCrop: "ଫସଲ ସ୍କାନ କରନ୍ତୁ",
    localDealers: "ସ୍ଥାନୀୟ ଡିଲର",
    buyProducts: "ସାମଗ୍ରୀ କିଣନ୍ତୁ",
    checkMandi: "ବଜାର ଦର ଦେଖନ୍ତୁ",
    trackPurchase: "କ୍ରୟ ସ୍ଥିତି ଦେଖନ୍ତୁ",
    farmingServices: "କୃଷି ସେବା",

    back: "ପଛକୁ",
    refresh: "ରିଫ୍ରେଶ",
    loading: "ଲୋଡ୍ ହେଉଛି...",
    save: "ସେଭ୍ କରନ୍ତୁ",
    cancel: "ବାତିଲ କରନ୍ତୁ",
    continue: "ଆଗକୁ ବଢ଼ନ୍ତୁ",
    retry: "ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ",

    languageChanged: "ଭାଷା ସଫଳତାର ସହିତ ବଦଳିଗଲା।",
    noInformation: "ସୂଚନା ଉପଲବ୍ଧ ନାହିଁ।",
  },
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function isSupportedLanguage(code) {
  return languages.some((language) => language.code === code);
}

export function normalizeLanguage(code) {
  const normalized = String(code || "")
    .trim()
    .toLowerCase()
    .split("-")[0];

  return isSupportedLanguage(normalized)
    ? normalized
    : DEFAULT_LANGUAGE;
}

export function getLanguage() {
  if (!isBrowser()) {
    return DEFAULT_LANGUAGE;
  }

  return normalizeLanguage(
    window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  );
}

export function getLanguageDetails(code = getLanguage()) {
  const normalizedCode = normalizeLanguage(code);

  return (
    languages.find(
      (language) => language.code === normalizedCode
    ) || languages[0]
  );
}

export function getLanguageName(code = getLanguage()) {
  return getLanguageDetails(code).nativeName;
}

export function getSpeechLocale(code = getLanguage()) {
  return getLanguageDetails(code).locale;
}

export function getLanguageDirection(code = getLanguage()) {
  return getLanguageDetails(code).direction;
}

export function applyLanguageToDocument(code = getLanguage()) {
  if (!isBrowser() || !document?.documentElement) {
    return;
  }

  const details = getLanguageDetails(code);

  document.documentElement.lang = details.locale;
  document.documentElement.dir = details.direction;
}

export function setLanguage(code) {
  const normalizedCode = normalizeLanguage(code);

  if (!isBrowser()) {
    return normalizedCode;
  }

  window.localStorage.setItem(
    LANGUAGE_STORAGE_KEY,
    normalizedCode
  );

  applyLanguageToDocument(normalizedCode);

  window.dispatchEvent(
    new CustomEvent(LANGUAGE_CHANGE_EVENT, {
      detail: {
        language: normalizedCode,
      },
    })
  );

  return normalizedCode;
}

export function subscribeLanguageChange(callback) {
  if (!isBrowser() || typeof callback !== "function") {
    return () => {};
  }

  function handleLanguageChange(event) {
    callback(
      normalizeLanguage(
        event?.detail?.language || getLanguage()
      )
    );
  }

  window.addEventListener(
    LANGUAGE_CHANGE_EVENT,
    handleLanguageChange
  );

  return () => {
    window.removeEventListener(
      LANGUAGE_CHANGE_EVENT,
      handleLanguageChange
    );
  };
}

function replaceVariables(text, variables = {}) {
  return Object.entries(variables).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{{${key}}}`, String(value)),
    String(text)
  );
}

export function t(
  key,
  variables = {},
  languageCode = getLanguage()
) {
  const language = normalizeLanguage(languageCode);

  const translatedValue =
    translations[language]?.[key] ??
    translations[DEFAULT_LANGUAGE]?.[key];

  if (translatedValue === undefined) {
    return key;
  }

  if (typeof translatedValue !== "string") {
    return translatedValue;
  }

  return replaceVariables(translatedValue, variables);
}

export function createTranslator(languageCode) {
  const language = normalizeLanguage(languageCode);

  return (key, variables = {}) =>
    t(key, variables, language);
}

export function initializeLanguage() {
  const language = getLanguage();

  applyLanguageToDocument(language);

  return language;
}