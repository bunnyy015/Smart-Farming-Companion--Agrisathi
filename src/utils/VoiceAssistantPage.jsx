import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
} from "firebase/database";

import { auth, database } from "../firebase";

import {
  getLanguage,
  isSupportedLanguage,
  setLanguage as persistLanguage,
  t,
} from "./language";
import {
  getPreferredLanguage,
  setPreferredLanguage,
  setSpeechLocale,
} from "./languageProfile";

import { createVoiceLanguagePrompt } from "./voiceLanguageContext";

import {
  addFarmerMessage,
  addAssistantMessage,
  getVoiceMemoryForPrompt,
  clearVoiceMemory,
} from "./voiceMemory";

import {
  detectLocalVoiceCommand,
  getVoiceActionRoute,
  VOICE_ACTION_ROUTES,
} from "./voiceLocalCommands";

import { createWeatherPromptContext } from "./weatherContext";
import { requestVoiceAssistantResponse } from "./voiceAssistantService";
import { getVoiceSmallTalkReply } from "./voiceSmallTalk";
import { cancelSpeech, speakLocalizedText } from "./speechOutput";

/* =========================================================
   GEMINI
========================================================= */

/* =========================================================
   SPEECH LOCALES
========================================================= */

const speechLocales = {
  en: "en-IN",
  te: "te-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  ur: "ur-IN",
  or: "or-IN",
};

/* =========================================================
   LANGUAGE NAMES
========================================================= */

const languageNames = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  gu: "Gujarati",
  pa: "Punjabi",
  ur: "Urdu",
  or: "Odia",
};

/* =========================================================
   GREETINGS
========================================================= */

/* =========================================================
   INTERFACE TEXT
========================================================= */

const interfaceText = {
  en: {
    title: "AgriSaathi Voice Assistant",
    subtitle:
      "Ask about weather, crops, market prices, schemes and your orders.",
    start: "Start listening",
    stop: "Stop Conversation",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
    idle: "Ready",
    speechNotSupported:
      "Speech recognition is not supported in this browser.",
    tapToSpeak:
      "Tap the microphone and speak.",
    permission:
      "Microphone permission is blocked. Please allow microphone access in your browser and then tap the microphone again.",
    voiceUnavailable:
      "No voice for the selected language is available in this browser or device. Install that language's speech voice in your system settings, then retry.",
    speechUnsupported: "Speech output is not supported in this browser.",
  },

  te: {
    title: "అగ్రిసాథి వాయిస్ అసిస్టెంట్",
    subtitle:
      "వాతావరణం, పంటలు, మార్కెట్ ధరలు, పథకాలు మరియు ఆర్డర్ల గురించి అడగండి.",
    start: "వినడం ప్రారంభించండి",
    stop: "సంభాషణ ఆపండి",
    listening: "వింటున్నాను...",
    thinking: "ఆలోచిస్తున్నాను...",
    speaking: "మాట్లాడుతున్నాను...",
    idle: "సిద్ధంగా ఉంది",
    speechNotSupported:
      "ఈ బ్రౌజర్‌లో స్పీచ్ రికగ్నిషన్‌కు మద్దతు లేదు.",
    tapToSpeak:
      "మైక్రోఫోన్‌ను నొక్కి మాట్లాడండి.",
    permission:
      "మైక్రోఫోన్ అనుమతి నిలిపివేయబడింది. బ్రౌజర్‌లో మైక్రోఫోన్ అనుమతిని ఇవ్వండి. తరువాత మైక్రోఫోన్‌ను మళ్లీ నొక్కండి.",
    voiceUnavailable:
      "ఈ బ్రౌజర్ లేదా పరికరంలో ఎంచుకున్న భాషకు వాయిస్ అందుబాటులో లేదు. పరికర సెట్టింగుల్లో ఆ భాష స్పీచ్ వాయిస్‌ను ఇన్‌స్టాల్ చేసి మళ్లీ ప్రయత్నించండి.",
    speechUnsupported: "ఈ బ్రౌజర్‌లో స్పీచ్ అవుట్‌పుట్‌కు మద్దతు లేదు.",
  },

  hi: {
    title: "एग्रीसाथी वॉइस असिस्टेंट",
    subtitle:
      "मौसम, फसल, बाजार भाव, योजनाओं और ऑर्डर के बारे में पूछें।",
    start: "सुनना शुरू करें",
    stop: "बातचीत रोकें",
    listening: "सुन रहा हूँ...",
    thinking: "सोच रहा हूँ...",
    speaking: "बोल रहा हूँ...",
    idle: "तैयार",
    speechNotSupported:
      "इस ब्राउज़र में स्पीच रिकग्निशन समर्थित नहीं है।",
    tapToSpeak:
      "माइक्रोफ़ोन दबाकर बोलें।",
    permission:
      "माइक्रोफ़ोन की अनुमति बंद है। ब्राउज़र में माइक्रोफ़ोन की अनुमति दें और फिर माइक्रोफ़ोन दबाएँ।",
    voiceUnavailable:
      "इस ब्राउज़र या डिवाइस में चुनी गई भाषा की आवाज़ उपलब्ध नहीं है। डिवाइस सेटिंग में उस भाषा की स्पीच आवाज़ इंस्टॉल करके फिर कोशिश करें।",
    speechUnsupported: "इस ब्राउज़र में स्पीच आउटपुट समर्थित नहीं है।",
  },
  ta: { title: "அக்ரிசாத்தி குரல் உதவியாளர்", subtitle: "பயிர்கள், வானிலை, சந்தை விலைகள், திட்டங்கள் மற்றும் ஆர்டர்கள் பற்றி கேளுங்கள்.", start: "கேட்கத் தொடங்கு", stop: "உரையாடலை நிறுத்து", listening: "கேட்கிறது...", thinking: "சிந்திக்கிறது...", speaking: "பேசுகிறது...", idle: "தயார்", speechNotSupported: "இந்த உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை.", tapToSpeak: "மைக்ரோஃபோனைத் தட்டி பேசுங்கள்.", permission: "மைக்ரோஃபோன் அனுமதி தடுக்கப்பட்டுள்ளது. உலாவி அமைப்புகளில் அனுமதித்து மீண்டும் முயற்சிக்கவும்." },
  kn: { title: "ಅಗ್ರಿಸಾಥಿ ಧ್ವನಿ ಸಹಾಯಕ", subtitle: "ಬೆಳೆ, ಹವಾಮಾನ, ಮಾರುಕಟ್ಟೆ ಬೆಲೆ, ಯೋಜನೆಗಳು ಮತ್ತು ಆರ್ಡರ್‌ಗಳ ಬಗ್ಗೆ ಕೇಳಿ.", start: "ಕೇಳಲು ಪ್ರಾರಂಭಿಸಿ", stop: "ಸಂಭಾಷಣೆ ನಿಲ್ಲಿಸಿ", listening: "ಕೇಳುತ್ತಿದೆ...", thinking: "ಯೋಚಿಸುತ್ತಿದೆ...", speaking: "ಮಾತನಾಡುತ್ತಿದೆ...", idle: "ಸಿದ್ಧ", speechNotSupported: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ.", tapToSpeak: "ಮೈಕ್ರೊಫೋನ್ ಒತ್ತಿ ಮಾತನಾಡಿ.", permission: "ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಅನುಮತಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", voiceUnavailable: "ಈ ಭಾಷೆಯ ಧ್ವನಿ ಈ ಸಾಧನದಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ. ಸಾಧನದ ಭಾಷಣ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಧ್ವನಿಯನ್ನು ಸ್ಥಾಪಿಸಿ.", speechUnsupported: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಮಾತಿನ ಔಟ್‌ಪುಟ್ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ." },
  ml: { title: "അഗ്രിസാത്തി വോയ്സ് അസിസ്റ്റന്റ്", subtitle: "വിളകൾ, കാലാവസ്ഥ, വിപണി വിലകൾ, പദ്ധതികൾ, ഓർഡറുകൾ എന്നിവയെക്കുറിച്ച് ചോദിക്കൂ.", start: "കേൾക്കാൻ തുടങ്ങുക", stop: "സംഭാഷണം നിർത്തുക", listening: "കേൾക്കുന്നു...", thinking: "ചിന്തിക്കുന്നു...", speaking: "സംസാരിക്കുന്നു...", idle: "തയ്യാർ", speechNotSupported: "ഈ ബ്രൗസറിൽ ശബ്ദ തിരിച്ചറിയൽ പിന്തുണയ്ക്കുന്നില്ല.", tapToSpeak: "മൈക്രോഫോൺ അമർത്തി സംസാരിക്കൂ.", permission: "മൈക്രോഫോൺ അനുമതി തടഞ്ഞിരിക്കുന്നു. ബ്രൗസറിൽ അനുമതി നൽകി വീണ്ടും ശ്രമിക്കൂ." },
  mr: { title: "अ‍ॅग्रीसाथी व्हॉइस असिस्टंट", subtitle: "पिके, हवामान, बाजारभाव, योजना आणि ऑर्डरबद्दल विचारा.", start: "ऐकणे सुरू करा", stop: "संभाषण थांबवा", listening: "ऐकत आहे...", thinking: "विचार करत आहे...", speaking: "बोलत आहे...", idle: "तयार", speechNotSupported: "या ब्राउझरमध्ये आवाज ओळख समर्थित नाही.", tapToSpeak: "मायक्रोफोन दाबून बोला.", permission: "मायक्रोफोनची परवानगी बंद आहे. ब्राउझरमध्ये परवानगी देऊन पुन्हा प्रयत्न करा." },
  bn: { title: "অ্যাগ্রিসাথি ভয়েস অ্যাসিস্ট্যান্ট", subtitle: "ফসল, আবহাওয়া, বাজারদর, প্রকল্প এবং অর্ডার সম্পর্কে জিজ্ঞাসা করুন।", start: "শোনা শুরু করুন", stop: "কথোপকথন থামান", listening: "শুনছি...", thinking: "ভাবছি...", speaking: "বলছি...", idle: "প্রস্তুত", speechNotSupported: "এই ব্রাউজারে স্পিচ রিকগনিশন সমর্থিত নয়।", tapToSpeak: "মাইক্রোফোনে চাপ দিয়ে কথা বলুন।", permission: "মাইক্রোফোনের অনুমতি বন্ধ। ব্রাউজারে অনুমতি দিয়ে আবার চেষ্টা করুন।" },
  gu: { title: "એગ્રીસાથી વૉઇસ સહાયક", subtitle: "પાક, હવામાન, બજારભાવ, યોજનાઓ અને ઓર્ડર વિશે પૂછો.", start: "સાંભળવાનું શરૂ કરો", stop: "વાતચીત બંધ કરો", listening: "સાંભળી રહ્યો છું...", thinking: "વિચારી રહ્યો છું...", speaking: "બોલી રહ્યો છું...", idle: "તૈયાર", speechNotSupported: "આ બ્રાઉઝરમાં વાણી ઓળખ ઉપલબ્ધ નથી.", tapToSpeak: "માઇક્રોફોન દબાવીને બોલો.", permission: "માઇક્રોફોનની પરવાનગી બંધ છે. બ્રાઉઝરમાં પરવાનગી આપીને ફરી પ્રયાસ કરો." },
  pa: { title: "ਐਗਰੀਸਾਥੀ ਵੌਇਸ ਸਹਾਇਕ", subtitle: "ਫਸਲਾਂ, ਮੌਸਮ, ਮੰਡੀ ਭਾਅ, ਯੋਜਨਾਵਾਂ ਅਤੇ ਆਰਡਰਾਂ ਬਾਰੇ ਪੁੱਛੋ।", start: "ਸੁਣਨਾ ਸ਼ੁਰੂ ਕਰੋ", stop: "ਗੱਲਬਾਤ ਰੋਕੋ", listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ...", thinking: "ਸੋਚ ਰਿਹਾ ਹਾਂ...", speaking: "ਬੋਲ ਰਿਹਾ ਹਾਂ...", idle: "ਤਿਆਰ", speechNotSupported: "ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਬੋਲੀ ਪਛਾਣ ਸਮਰਥਿਤ ਨਹੀਂ ਹੈ।", tapToSpeak: "ਮਾਈਕ੍ਰੋਫੋਨ ਦਬਾ ਕੇ ਬੋਲੋ।", permission: "ਮਾਈਕ੍ਰੋਫੋਨ ਦੀ ਇਜਾਜ਼ਤ ਬੰਦ ਹੈ। ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਇਜਾਜ਼ਤ ਦੇ ਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।" },
  ur: { title: "ایگری ساتھی وائس اسسٹنٹ", subtitle: "فصلوں، موسم، منڈی کے نرخ، اسکیموں اور آرڈرز کے بارے میں پوچھیں۔", start: "سننا شروع کریں", stop: "گفتگو روکیں", listening: "سن رہا ہوں...", thinking: "سوچ رہا ہوں...", speaking: "بول رہا ہوں...", idle: "تیار", speechNotSupported: "اس براؤزر میں آواز کی شناخت دستیاب نہیں۔", tapToSpeak: "مائیکروفون دبائیں اور بولیں۔", permission: "مائیکروفون کی اجازت بند ہے۔ براؤزر میں اجازت دے کر دوبارہ کوشش کریں۔" },
  or: { title: "ଅଗ୍ରିସାଥୀ ଭଏସ୍ ଆସିଷ୍ଟାଣ୍ଟ", subtitle: "ଫସଲ, ପାଣିପାଗ, ବଜାର ଦର, ଯୋଜନା ଏବଂ ଅର୍ଡର ବିଷୟରେ ପଚାରନ୍ତୁ।", start: "ଶୁଣିବା ଆରମ୍ଭ କରନ୍ତୁ", stop: "କଥାବାର୍ତ୍ତା ବନ୍ଦ କରନ୍ତୁ", listening: "ଶୁଣୁଛି...", thinking: "ଭାବୁଛି...", speaking: "କହୁଛି...", idle: "ପ୍ରସ୍ତୁତ", speechNotSupported: "ଏହି ବ୍ରାଉଜରରେ କଥା ଚିହ୍ନଟ ସମର୍ଥିତ ନୁହେଁ।", tapToSpeak: "ମାଇକ୍ରୋଫୋନ୍ ଦବାଇ କଥା କହନ୍ତୁ।", permission: "ମାଇକ୍ରୋଫୋନ୍ ଅନୁମତି ବନ୍ଦ ଅଛି। ବ୍ରାଉଜରରେ ଅନୁମତି ଦେଇ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।" },
};

/* =========================================================
   RETRY MESSAGES
========================================================= */

const serviceErrorMessages = {
  en: "I’m having trouble reaching the assistant right now. Please try again in a moment.",
  te: "ప్రస్తుతం సహాయకుడిని సంప్రదించడంలో సమస్య ఉంది. దయచేసి కాసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.",
  hi: "अभी सहायक से जुड़ने में समस्या हो रही है। कृपया थोड़ी देर बाद फिर कोशिश करें।",
};

function getServiceErrorMessage(error, languageCode) {
  const detail = String(error?.message || "");
  if (detail.includes("VITE_GEMINI_API_KEY is missing")) {
    return {
      en: "The Gemini API key is not configured. Ask the app administrator to add it, then restart the app.",
      te: "Gemini API కీ కాన్ఫిగర్ చేయలేదు. నిర్వాహకుడిని కీని జోడించి యాప్‌ను మళ్లీ ప్రారంభించమని అడగండి.",
      hi: "Gemini API key सेट नहीं है। ऐप व्यवस्थापक से इसे जोड़कर ऐप फिर शुरू करने को कहें।",
    }[languageCode] || "The Gemini API key is not configured. Ask the app administrator to add it, then restart the app.";
  }

  const statusCode = detail.match(/failed:\s*(\d{3})/i)?.[1];
  if (statusCode === "401" || statusCode === "403") {
    return "The AI service rejected its API key or access. Ask the app administrator to check the Gemini key and API access.";
  }
  if (statusCode === "429") {
    return "The AI service is temporarily rate-limited. Please wait a little and try again.";
  }
  if (/failed to fetch|networkerror|network request failed/i.test(detail)) {
    return "I can’t reach the AI service. Check your internet connection and try again.";
  }
  return serviceErrorMessages[languageCode] || serviceErrorMessages.en;
}

/* =========================================================
   ACTION ROUTES
========================================================= */

const actionRoutes = VOICE_ACTION_ROUTES;

/* =========================================================
   NORMALIZE
========================================================= */

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/* =========================================================
   COMPONENT
========================================================= */

export default function VoiceAssistantPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [language, setLanguageState] = useState(
    () => {
      const preferredLanguage = getPreferredLanguage();
      const appLanguage = getLanguage();

      return speechLocales[preferredLanguage] &&
        preferredLanguage !== "en"
        ? preferredLanguage
        : appLanguage || "en";
    }
  );

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [farmer, setFarmer] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const recognitionRef = useRef(null);
  const processedRecognitionRef = useRef(null);

  const activeRef = useRef(false);

  const languageRef = useRef(language);

  const statusRef = useRef(status);

  const speakingRef = useRef(false);

  const responseInProgressRef = useRef(false);
  const requestControllerRef = useRef(null);

  /*
   * Prevents browser recognition errors from creating
   * automatic retry loops.
   */
  const microphoneBlockedRef = useRef(false);

  const weatherContext = createWeatherPromptContext();

  /* =======================================================
     LANGUAGE
  ======================================================= */

  function setLanguage(nextLanguage) {
    if (!speechLocales[nextLanguage]) {
      return;
    }

    languageRef.current = nextLanguage;

    setLanguageState(nextLanguage);

    try {
      setPreferredLanguage(nextLanguage);
      setSpeechLocale(speechLocales[nextLanguage]);

      if (isSupportedLanguage(nextLanguage)) {
        persistLanguage(nextLanguage);
      }
    } catch (error) {
      console.warn(
        "Unable to save language:",
        error
      );
    }
  }

  /* =======================================================
     REFS
  ======================================================= */

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          setAuthLoading(false);

          navigate("/login", {
            replace: true,
          });

          return;
        }

        try {
          const userSnapshot = await get(
            ref(
              database,
              `users/${currentUser.uid}`
            )
          );

          if (userSnapshot.exists()) {
            const userData =
              userSnapshot.val();

            const role =
              normalize(userData.role);

            if (role !== "farmer") {
              navigate(
                "/role-selection",
                {
                  replace: true,
                }
              );

              return;
            }
          }

          const farmerSnapshot =
            await get(
              ref(
                database,
                `farmers/${currentUser.uid}`
              )
            );

          if (farmerSnapshot.exists()) {
            setFarmer(
              { uid: currentUser.uid, ...farmerSnapshot.val() }
            );
          } else {
            setFarmer({ uid: currentUser.uid });
          }
        } catch (error) {
          console.warn(
            "Unable to load farmer profile:",
            error
          );
        } finally {
          setAuthLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [navigate]);

  /* =======================================================
     CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      activeRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      recognitionRef.current = null;
      requestControllerRef.current?.abort();

      try {
        cancelSpeech();
      } catch {
        // ignore
      }
    };
  }, []);

  /* =======================================================
     SPEECH VOICE
  ======================================================= */

  /* =======================================================
     SPEAK
  ======================================================= */

  function speak(
    text,
    code = languageRef.current,
    onFinished
  ) {
    if (!text) {
      onFinished?.();
      return;
    }

    stopRecognition();

    speakingRef.current = true;
    setStatus("speaking");
    const currentInterface =
      interfaceText[code] || interfaceText.en;

    const finish = () => {
      speakingRef.current = false;
      onFinished?.();
    };

    speakLocalizedText(text, code, {
      rate: 0.94,
      pitch: 1,
      volume: 1,
      onStart: () => setStatus("speaking"),
    }).then((result) => {
      if (result.status === "cancelled") return;

      if (
        result.status === "voice-unavailable" ||
        result.status === "unsupported" ||
        result.status === "cloud-error" ||
        result.status === "error"
      ) {
        setError(
          result.status === "cloud-error"
            ? t("speechGenerationFailed", {}, code)
            : result.status === "unsupported"
              ? currentInterface.speechUnsupported
              : currentInterface.voiceUnavailable
        );
      }

      finish();
    }).catch((error) => {
      console.error("Speech output failed:", error);
      setError(currentInterface.voiceUnavailable);
      finish();
    });
  }

  /* =======================================================
     STOP RECOGNITION
  ======================================================= */

  function stopRecognition() {
    const recognition =
      recognitionRef.current;

    if (!recognition) {
      return;
    }

    recognitionRef.current = null;

    try {
      recognition.abort();
    } catch {
      // ignore
    }
  }

  /* =======================================================
     START LISTENING
  ======================================================= */

  function startListening() {
    if (!activeRef.current) {
      return;
    }

    if (speakingRef.current) {
      return;
    }

    if (
      responseInProgressRef.current
    ) {
      return;
    }

    if (
      microphoneBlockedRef.current
    ) {
      return;
    }

    if (recognitionRef.current) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const message =
        interfaceText[
          languageRef.current
        ]?.speechNotSupported ||
        interfaceText.en
          .speechNotSupported;

      setError(message);
      setStatus("idle");

      return;
    }

    setError("");

    const recognition =
      new SpeechRecognition();

    recognitionRef.current =
      recognition;

    recognition.lang =
      speechLocales[
        languageRef.current
      ] ||
      speechLocales.en;

    console.info(
      "[VoiceAssistant] Selected language:",
      languageRef.current,
      recognition.lang
    );

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!activeRef.current) {
        try {
          recognition.abort();
        } catch {
          // ignore
        }

        return;
      }

      setError("");
      setStatus("listening");
    };

    recognition.onresult = async (
      event
    ) => {
      if (!activeRef.current) {
        return;
      }

      if (processedRecognitionRef.current === recognition) {
        return;
      }

      const result =
        event.results?.[0]?.[0];

      const spokenText =
        result?.transcript?.trim() ||
        "";

      if (!spokenText) {
        console.info(
          "[VoiceAssistant] Empty recognition result; no command executed."
        );
        setStatus("idle");
        setError(
          "I didn't hear anything. Tap the microphone and speak again."
        );
        return;
      }

      processedRecognitionRef.current = recognition;

      console.info(
        "[VoiceAssistant] Recognized text:",
        spokenText
      );

      try {
        recognition.stop();
      } catch {
        // ignore
      }

      if (
        recognitionRef.current ===
        recognition
      ) {
        recognitionRef.current =
          null;
      }

      await respondToFarmer(
        spokenText
      );
    };

    recognition.onerror = (
      event
    ) => {
      console.warn(
        "Speech recognition error:",
        event.error
      );

      if (
        recognitionRef.current ===
        recognition
      ) {
        recognitionRef.current =
          null;
      }

      /*
       * VERY IMPORTANT:
       *
       * Do NOT automatically restart after
       * permission or microphone errors.
       */
      if (
        event.error ===
          "not-allowed" ||
        event.error ===
          "service-not-allowed"
      ) {
        microphoneBlockedRef.current =
          true;

        activeRef.current = false;

        setActive(false);

        setStatus("idle");

        const message =
          interfaceText[
            languageRef.current
          ]?.permission ||
          interfaceText.en.permission;

        setError(message);

        return;
      }

      if (
        event.error ===
        "audio-capture"
      ) {
        setStatus("idle");

        setError(
          "I couldn't access your microphone. Check that your microphone is connected and allowed in the browser."
        );

        /*
         * Do not automatically retry.
         */
        return;
      }

      if (
        event.error ===
        "network"
      ) {
        setStatus("idle");

        setError(
          "Speech recognition needs an internet connection. Please try again."
        );

        /*
         * Do not automatically retry.
         */
        return;
      }

      if (
        event.error ===
        "language-not-supported"
      ) {
        setStatus("idle");

        setError(
          `Your browser's speech service does not support ${languageNames[languageRef.current] || "this language"}. Supported voice choices are English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, and Odia; availability depends on the browser and its speech provider.`
        );

        return;
      }

      if (
        event.error ===
        "no-speech"
      ) {
        setStatus("idle");

        setError(
          "I didn't hear anything. Tap the microphone and speak again."
        );

        /*
         * No automatic retry.
         *
         * Farmer can press the microphone.
         */
        return;
      }

      if (
        event.error ===
        "aborted"
      ) {
        setStatus("idle");
        return;
      }

      setStatus("idle");

      setError(
        "I couldn't hear you properly. Tap the microphone and try again."
      );
    };

    recognition.onend = () => {
      if (
        recognitionRef.current ===
        recognition
      ) {
        recognitionRef.current =
          null;
      }

      /*
       * NEVER automatically restart here.
       *
       * Listening is started only by:
       *
       * 1. Conversation greeting completion
       * 2. Assistant response completion
       * 3. Explicit microphone click
       */
      if (
        activeRef.current &&
        statusRef.current ===
          "listening"
      ) {
        setStatus("idle");
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn(
        "Unable to start recognition:",
        error
      );

      if (
        recognitionRef.current ===
        recognition
      ) {
        recognitionRef.current =
          null;
      }

      setStatus("idle");

      setError(
        "Unable to start the microphone. Please tap the microphone again."
      );
    }
  }

  /* =======================================================
     MEMORY
  ======================================================= */

  function addMemory(role, text) {
    const cleaned =
      String(text || "").trim();

    if (!cleaned) {
      return;
    }

    try {
      if (role === "farmer") {
        addFarmerMessage(
          cleaned
        );
      }

      if (role === "assistant") {
        addAssistantMessage(
          cleaned
        );
      }
    } catch (error) {
      console.warn(
        "Unable to save voice memory:",
        error
      );
    }

  }

  function addConversationMessage(role, text) {
    const cleaned = String(text || "").trim();
    if (!cleaned) return;
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random()}`, role, text: cleaned },
    ].slice(-40));
  }

  /* =======================================================
     GEMINI
  ======================================================= */

  async function askGemini(
    userText
  ) {
    const currentLanguage =
      languageRef.current || "en";

    const languageName =
      languageNames[
        currentLanguage
      ] || "English";

    const farmerContext = farmer
      ? `
Farmer profile:
Name: ${farmer.name || "Unknown"}
Village: ${farmer.village || "Unknown"}
District: ${farmer.district || "Unknown"}
State: ${farmer.state || "Unknown"}
Main crop: ${farmer.mainCrop || "Unknown"}
Phone: ${farmer.phone || "Unknown"}
`
      : "Farmer profile is not available.";

    const weatherInformation =
      JSON.stringify(
        weatherContext || {}
      );

    const conversation =
      getVoiceMemoryForPrompt();
    let orderContext = "Farmer order details are unavailable.";
    // Loading orders for every turn adds a Firebase round trip to questions
    // that cannot use the data (for example crop, weather, and greetings).
    const asksAboutOrders =
      /\b(?:order|orders|purchase|purchases|delivery|deliveries|shipment|tracking|track|status)\b|ఆర్డర్|ఆర్డర్లు|ఆర్డర్ స్థితి|ऑर्डर|आर्डर|डिलीवरी|ऑर्डर की स्थिति|ஆர்டர்|ವಿತರಣೆ|ഓർഡർ|ऑर्डरची|অর্ডার|ઓર્ડર|ਆਰਡਰ|آرڈر|ଅର୍ଡର/u.test(
        String(userText || "").normalize("NFC").toLocaleLowerCase()
      );
    if (farmer?.uid && asksAboutOrders) {
      try {
        const ordersSnapshot = await get(
          query(
            ref(database, "dealerOrders"),
            orderByChild("farmerUid"),
            equalTo(farmer.uid)
          )
        );
        if (ordersSnapshot.exists()) {
          const recentOrders = Object.entries(ordersSnapshot.val())
            .map(([id, order]) => ({ id, ...order }))
            .sort(
              (a, b) =>
                new Date(b.updatedAt || b.createdAt || 0) -
                new Date(a.updatedAt || a.createdAt || 0)
            )
            .slice(0, 6);
          orderContext = recentOrders.length
            ? recentOrders
                .map(
                  (order) =>
                    `Order ${order.id}: ${order.productName || "product"}, quantity ${order.quantity ?? "unknown"}, status ${order.status || order.orderStatus || "unknown"}, created ${order.createdAt || "unknown"}, updated ${order.updatedAt || "unknown"}.`
                )
                .join("\n")
            : "The farmer has no orders.";
        } else {
          orderContext = "The farmer has no orders.";
        }
      } catch (orderError) {
        console.warn("Unable to load farmer order context:", orderError);
      }
    }

    const languageProfilePrompt =
      createVoiceLanguagePrompt();

    const prompt = `
You are AgriSaathi, an agriculture-focused voice assistant for Indian farmers.

${languageProfilePrompt}

The farmer is communicating through voice.

Current response language:
${languageName}

Current language code:
${currentLanguage}

Current farmer page:
${location.pathname}

IMPORTANT:
Reply in the same language requested by the current language code.

Keep responses concise because they will be spoken aloud.

You can help with:
- weather and weather-related field work
- crop selection, crop growth, seeds, soil, irrigation, fertilizer, pests, and disease
- market prices and selling guidance
- government schemes
- dealer products and marketplace product searches
- active orders, order history, and notifications
- community, farmer profile, and dashboard

The only valid navigation actions and their existing React routes are:

${Object.entries(actionRoutes)
  .map(([action, route]) => `${action}: ${route}`)
  .join("\n")}

Return ONLY valid JSON.

Required format:

{
  "reply": "short spoken response",
  "languageCode": "${currentLanguage}",
  "action": "none",
  "searchQuery": ""
}

Understand natural phrasing, code-switching, and Indian-language requests. Do not require an exact sentence or translate by matching a few English keywords.
If the farmer clearly asks to open or find a page, set action to exactly one registered action above.
For a product search, use action "dealer_products" and put only the requested product/category in searchQuery.
To open a particular existing product, use action "product_details" and put the product name in searchQuery.
If the request could refer to more than one page, ask a short clarification question and set action to "none".
If speech is unclear, unrelated, or has no safe matching route, do not navigate; ask one natural, concise clarification question. Do not list navigation commands unless the farmer explicitly asks what you can do.
For agriculture questions, answer in the selected language. Do not invent local weather, market prices, diagnoses, or scheme eligibility. Keep the answer to 1-2 short sentences.

Do not put markdown around the JSON.

${farmerContext}

Weather context:
${weatherInformation}

Previous conversation:
${conversation || "No previous conversation."}

Recent farmer orders:
${orderContext}

Farmer's new request:
${userText}
`;

    requestControllerRef.current = new AbortController();
    const result = await requestVoiceAssistantResponse({
      prompt,
      languageCode: currentLanguage,
      supportedLanguages: Object.keys(speechLocales),
      signal: requestControllerRef.current.signal,
    });

    console.info(
      "[VoiceAssistant] Detected Gemini intent:",
      result.action
    );
    console.info(
      "[VoiceAssistant] Target route:",
      getVoiceActionRoute(result.action, result.searchQuery)
    );

    return result;
  }

  async function navigateForVoiceAction(action, searchQuery = "") {
    if (action === "product_details") {
      const marketplaceRoute = getVoiceActionRoute(
        "dealer_products",
        searchQuery
      );
      const normalizedQuery = String(searchQuery || "")
        .normalize("NFC")
        .toLocaleLowerCase()
        .trim();

      if (normalizedQuery) {
        try {
          const productsSnapshot = await get(
            ref(database, "dealerProducts")
          );
          const matches = [];

          if (productsSnapshot.exists()) {
            Object.entries(productsSnapshot.val()).forEach(
              ([dealerUid, dealerProducts]) => {
                Object.entries(dealerProducts || {}).forEach(
                  ([productId, product]) => {
                    if (
                      !product ||
                      typeof product !== "object" ||
                      product.status === "inactive" ||
                      Number(product.quantity || 0) <= 0
                    ) {
                      return;
                    }

                    const productName = String(
                      product.productName || product.name || ""
                    )
                      .normalize("NFC")
                      .toLocaleLowerCase()
                      .trim();
                    const searchableText = [
                      productName,
                      product.brand,
                      product.category,
                      product.description,
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .normalize("NFC")
                      .toLocaleLowerCase();

                    if (searchableText.includes(normalizedQuery)) {
                      matches.push({
                        dealerUid,
                        productId,
                        productName,
                      });
                    }
                  }
                );
              }
            );
          }

          const exactMatches = matches.filter(
            (product) => product.productName === normalizedQuery
          );
          const candidates = exactMatches.length
            ? exactMatches
            : matches;

          console.info(
            "[VoiceAssistant] Product matches:",
            candidates.length
          );

          if (candidates.length === 1) {
            const product = candidates[0];
            const productRoute =
              `/farmer/product/${encodeURIComponent(product.dealerUid)}` +
              `/${encodeURIComponent(product.productId)}`;

            if (
              `${location.pathname}${location.search}` ===
              productRoute
            ) {
              console.info(
                "[VoiceAssistant] Navigation result: already on target product."
              );
              setStatus("idle");
              return true;
            }

            navigate(productRoute);
            console.info(
              "[VoiceAssistant] Navigation result: opened product.",
              productRoute
            );
            return true;
          }
        } catch (error) {
          console.warn(
            "[VoiceAssistant] Product lookup failed; opening marketplace search.",
            error
          );
        }
      }

      if (!marketplaceRoute) {
        return false;
      }

      navigate(marketplaceRoute);
      console.info(
        "[VoiceAssistant] Navigation result: showing marketplace matches.",
        marketplaceRoute
      );
      return true;
    }

    const targetRoute = getVoiceActionRoute(action, searchQuery);

    console.info(
      "[VoiceAssistant] Target route:",
      targetRoute
    );

    if (!targetRoute) {
      console.warn(
        "[VoiceAssistant] No registered Farmer route for intent:",
        action
      );
      return false;
    }

    const currentRoute = `${location.pathname}${location.search}`;

    if (currentRoute === targetRoute) {
      console.info(
        "[VoiceAssistant] Navigation result: already on target page."
      );
      setStatus("idle");
      return true;
    }

    navigate(targetRoute);
    console.info(
      "[VoiceAssistant] Navigation result: navigated.",
      targetRoute
    );
    return true;
  }

  /* =======================================================
     LOCAL COMMAND
  ======================================================= */

  async function handleLocalCommand(
    text
  ) {
    try {
      const normalizedCommand = String(text || "")
        .normalize("NFC")
        .toLocaleLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      console.info(
        "[VoiceAssistant] Normalized command:",
        normalizedCommand
      );

      const result = detectLocalVoiceCommand(
        text,
        languageRef.current
      );

      if (!result) {
        console.info(
          "[VoiceAssistant] Detected intent: no local route match; checking agricultural assistant."
        );
        return false;
      }

      console.info(
        "[VoiceAssistant] Detected intent:",
        result.ambiguous ? "ambiguous" : result.action
      );
      console.info(
        "[VoiceAssistant] Target route:",
        result.route
      );

      const reply =
        result.reply ||
        result.response ||
        "";

      const newLanguage =
        result.languageCode ||
        result.language ||
        null;

      const action =
        result.action || "none";

      if (
        newLanguage &&
        speechLocales[newLanguage]
      ) {
        setLanguage(
          newLanguage
        );
      }

      if (reply) {
        addMemory(
          "assistant",
          reply
        );
        addConversationMessage("assistant", reply);
      }

      speak(
        reply,
        newLanguage ||
          languageRef.current,
        () => {
          if (!activeRef.current) {
            return;
          }

          if (
            action !== "none" &&
            actionRoutes[action]
          ) {
            navigateForVoiceAction(
              action,
              result.searchQuery
            );
            return;
          }

          setStatus("idle");
        }
      );

      return true;
    } catch (error) {
      console.warn(
        "Local voice command error:",
        error
      );

      return false;
    }
  }

  /* =======================================================
     RESPOND
  ======================================================= */

  async function respondToFarmer(
    spokenText
  ) {
    if (!spokenText) {
      return;
    }

    if (!activeRef.current) {
      return;
    }

    if (
      responseInProgressRef.current
    ) {
      return;
    }

    responseInProgressRef.current =
      true;

    stopRecognition();

    setError("");

    setStatus("thinking");

    addMemory(
      "farmer",
      spokenText
    );
    addConversationMessage("farmer", spokenText);

    try {
      /*
       * LOCAL COMMAND FIRST
       */
      const handled =
        await handleLocalCommand(
          spokenText
        );

      if (handled) {
        return;
      }

      const smallTalkReply = getVoiceSmallTalkReply(
        spokenText,
        languageRef.current
      );
      if (smallTalkReply) {
        addMemory("assistant", smallTalkReply);
        addConversationMessage("assistant", smallTalkReply);
        speak(smallTalkReply, languageRef.current, () => {
          if (activeRef.current) setStatus("idle");
        });
        return;
      }

      /*
       * GEMINI
       */
      const result =
        await askGemini(
          spokenText
        );

      if (!activeRef.current) {
        return;
      }

      const reply =
        result.reply;

      const responseLanguage =
        result.languageCode ||
        languageRef.current;

      if (
        responseLanguage &&
        speechLocales[
          responseLanguage
        ]
      ) {
        setLanguage(
          responseLanguage
        );
      }

      addMemory(
        "assistant",
        reply
      );
      addConversationMessage("assistant", reply);

      speak(
        reply,
        responseLanguage,
        () => {
          if (!activeRef.current) {
            return;
          }

          if (
            result.action !==
              "none" &&
            actionRoutes[
              result.action
            ]
          ) {
            navigateForVoiceAction(
              result.action,
              result.searchQuery
            );
            return;
          }

          setStatus("idle");
        }
      );
    } catch (error) {
      if (!activeRef.current || error?.name === "AbortError") {
        return;
      }
      console.error(
        "Voice assistant error:",
        error
      );

      const currentLanguage =
        languageRef.current ||
        "en";

      // Greetings and common pleasantries should keep working even if
      // the remote model is unavailable or a transcript bypasses the
      // normal local small-talk branch.
      const offlineReply = getVoiceSmallTalkReply(
        spokenText,
        currentLanguage
      );

      if (offlineReply) {
        addMemory("assistant", offlineReply);
        addConversationMessage("assistant", offlineReply);
        speak(offlineReply, currentLanguage, () => {
          if (activeRef.current) setStatus("idle");
        });
        return;
      }

      const retryMessage = getServiceErrorMessage(error, currentLanguage);

      setError(
        retryMessage
      );
      addConversationMessage("assistant", retryMessage);
      speak(
        retryMessage,
        currentLanguage,
        () => {
          setStatus("idle");
        }
      );
    } finally {
      responseInProgressRef.current =
        false;
    }
  }

  /* =======================================================
     BEGIN CONVERSATION
  ======================================================= */

  async function beginConversation() {
    if (authLoading) {
      return;
    }

    /*
     * Reset permission-block state only when
     * user explicitly presses the microphone.
     */
    microphoneBlockedRef.current =
      false;

    stopRecognition();

    try {
        cancelSpeech();
    } catch {
      // ignore
    }

    setError("");

    responseInProgressRef.current =
      false;

    speakingRef.current = false;

    activeRef.current = true;

    setActive(true);

    setStatus("idle");
    startListening();
  }

  /* =======================================================
     STOP CONVERSATION
  ======================================================= */

  function stopConversation() {
    activeRef.current = false;

    setActive(false);

    responseInProgressRef.current =
      false;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;

    speakingRef.current = false;

    stopRecognition();

    try {
      cancelSpeech();
    } catch {
      // ignore
    }

    setStatus("idle");

    setError("");
  }

  /* =======================================================
     LANGUAGE CHANGE
  ======================================================= */

  function handleLanguageChange(
    event
  ) {
    const nextLanguage =
      event.target.value;

    if (!speechLocales[nextLanguage]) {
      return;
    }

    setLanguage(
      nextLanguage
    );

    if (statusRef.current === "listening") {
      stopRecognition();
      setStatus("idle");
      setError(
        "Language changed. Tap the microphone to continue."
      );
    }
    if (statusRef.current === "speaking") {
      cancelSpeech();
      speakingRef.current = false;
      setStatus("idle");
    }
  }

  function clearConversation() {
    setMessages([]);
    clearVoiceMemory();
    setError("");
  }

  /* =======================================================
     STATUS
  ======================================================= */

  function getStatusText() {
    const current =
      interfaceText[
        languageRef.current
      ] ||
      interfaceText.en;

    if (status === "listening") {
      return current.listening;
    }

    if (status === "thinking") {
      return current.thinking;
    }

    if (status === "speaking") {
      return current.speaking;
    }

    return current.idle;
  }

  /* =======================================================
     AUTH LOADING
  ======================================================= */

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-cyan-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center text-3xl shadow-lg">
            🎙️
          </div>

          <h2 className="text-xl font-bold text-slate-900 mt-5">
            Loading Voice Assistant
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Preparing your AgriSaathi assistant...
          </p>
        </div>
      </div>
    );
  }

  const currentInterface =
    interfaceText[
      languageRef.current
    ] ||
    interfaceText.en;

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-cyan-50 p-4 md:p-6">

      <div className="w-full">

        {/* HEADER */}

        <header className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white rounded-3xl shadow-xl p-6 md:p-8">

          <div className="absolute -top-20 -right-16 w-52 h-52 bg-white/10 rounded-full" />

          <div className="absolute -bottom-24 -left-16 w-56 h-56 bg-white/10 rounded-full" />

          <div className="relative">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

              <div>

                <div className="flex items-center gap-3">

                  <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-3xl">
                    🎙️
                  </div>

                  <div>

                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">
                      AgriSaathi
                    </p>

                    <h1 className="text-2xl md:text-3xl font-bold">
                      {currentInterface.title}
                    </h1>

                  </div>

                </div>

                <p className="text-blue-100 mt-4 max-w-2xl">
                  {currentInterface.subtitle}
                </p>

              </div>

              <div className="bg-white/10 border border-white/20 rounded-2xl p-3">

                <label className="block text-xs text-blue-100 font-semibold mb-1">
                  Language
                </label>

                <select
                  value={
                    languageRef.current
                  }
                  onChange={
                    handleLanguageChange
                  }
                  className="bg-white text-slate-800 rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                >
                  {Object.entries(
                    languageNames
                  ).map(
                    ([code, name]) => (
                      <option
                        key={code}
                        value={code}
                      >
                        {name}
                      </option>
                    )
                  )}
                </select>

              </div>

            </div>

          </div>

        </header>

        {/* MAIN */}

        <main className="bg-white border border-blue-100 rounded-3xl shadow-xl mt-6 overflow-hidden">

          <div className="p-6 md:p-10">

            {/* STATUS */}

            <div className="flex justify-center">

              <div
                className={`
                  inline-flex items-center gap-2
                  px-4 py-2 rounded-full
                  text-sm font-semibold border
                  ${
                    status === "listening"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : status === "thinking"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : status === "speaking"
                      ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }
                `}
              >

                <span
                  className={`
                    w-2.5 h-2.5 rounded-full
                    ${
                      status === "listening"
                        ? "bg-blue-500"
                        : status === "thinking"
                        ? "bg-amber-500"
                        : status === "speaking"
                        ? "bg-cyan-500"
                        : "bg-slate-400"
                    }
                  `}
                />

                {getStatusText()}

              </div>

            </div>

            {/* MICROPHONE */}

            <div className="flex justify-center mt-10">

              <button
                type="button"
                onClick={() => {
                  /*
                   * FIRST CLICK:
                   * Start complete conversation.
                   */
                  if (!active) {
                    beginConversation();
                    return;
                  }

                  /*
                   * If listening:
                   * stop only listening.
                   */
                  if (
                    status ===
                    "listening"
                  ) {
                    stopRecognition();

                    setStatus(
                      "idle"
                    );

                    return;
                  }

                  /*
                   * If idle:
                   * explicitly start listening.
                   */
                  if (
                    status ===
                    "idle"
                  ) {
                    microphoneBlockedRef.current =
                      false;

                    setError("");

                    startListening();

                    return;
                  }

                  /*
                   * If thinking/speaking:
                   * do nothing.
                   */
                }}
                aria-label={
                  active
                    ? currentInterface.stop
                    : currentInterface.start
                }
                className={`
                  relative
                  w-40 h-40
                  md:w-48 md:h-48
                  rounded-full
                  flex items-center justify-center
                  shadow-2xl
                  transition-all duration-200
                  focus:outline-none
                  focus:ring-4
                  focus:ring-blue-200

                  ${
                    status === "listening"
                      ? "bg-blue-600 scale-105 shadow-blue-200"
                      : status === "thinking"
                      ? "bg-amber-500"
                      : status === "speaking"
                      ? "bg-cyan-500 scale-105 shadow-cyan-200"
                      : "bg-gradient-to-br from-blue-600 to-cyan-500 hover:scale-105"
                  }
                `}
              >

                {status ===
                  "listening" && (
                  <span className="absolute inset-[-8px] rounded-full border-4 border-blue-300/50" />
                )}

                <span className="text-6xl md:text-7xl text-white">
                  {status ===
                  "thinking"
                    ? "⏳"
                    : status ===
                      "speaking"
                    ? "🔊"
                    : "🎙️"}
                </span>

              </button>

            </div>

            {/* MESSAGE */}

            <div className="text-center mt-8">

              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                {active
                  ? getStatusText()
                  : currentInterface.start}
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                {active
                  ? status ===
                    "listening"
                    ? "Speak clearly. Your request will be processed automatically."
                    : status ===
                      "thinking"
                    ? "AgriSaathi is preparing your answer."
                    : status ===
                      "speaking"
                    ? "AgriSaathi is responding."
                    : currentInterface.tapToSpeak
                  : currentInterface.tapToSpeak}
              </p>

            </div>

            {/* ERROR */}

            {error && (
              <div className="max-w-2xl mx-auto mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">

                <div className="flex items-start gap-3">

                  <div className="text-xl">
                    ⚠️
                  </div>

                  <div>

                    <p className="font-semibold text-amber-900">
                      Voice Assistant
                    </p>

                    <p className="text-sm text-amber-800 mt-1">
                      {error}
                    </p>

                  </div>

                </div>

              </div>
            )}

            <section className="max-w-3xl mx-auto mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-6" aria-live="polite">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">Conversation</h2>
                {messages.length > 0 && (
                  <button type="button" onClick={clearConversation} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900">
                    Clear
                  </button>
                )}
              </div>
              {messages.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Tap the microphone when you’re ready. Your assistant will listen without speaking first.
                </p>
              ) : (
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === "farmer" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${message.role === "farmer" ? "bg-blue-600 text-white" : "border border-cyan-100 bg-white text-slate-800"}`}>
                        <p className={`mb-1 text-xs font-bold ${message.role === "farmer" ? "text-blue-100" : "text-cyan-700"}`}>
                          {message.role === "farmer" ? "You" : "AgriSaathi"}
                        </p>
                        <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* STOP */}

            {active && (
              <div className="flex justify-center mt-8">

                <button
                  type="button"
                  onClick={
                    stopConversation
                  }
                  className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition border border-slate-200"
                >
                  Stop Conversation
                </button>

              </div>
            )}

          </div>

          {/* FARMER CONTEXT */}

          {farmer && (
            <div className="border-t border-slate-100 bg-slate-50 p-6 md:p-8">

              <div className="max-w-4xl mx-auto">

                <div className="flex items-center gap-3">

                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-xl">
                    👨‍🌾
                  </div>

                  <div>

                    <h2 className="font-bold text-slate-900">
                      Farmer Context
                    </h2>

                    <p className="text-sm text-slate-500">
                      Used to provide more relevant answers.
                    </p>

                  </div>

                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">

                  <div className="bg-white border border-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-400">
                      Name
                    </p>

                    <p className="font-semibold text-slate-800 mt-1">
                      {farmer.name ||
                        "Not available"}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-400">
                      Village
                    </p>

                    <p className="font-semibold text-slate-800 mt-1">
                      {farmer.village ||
                        "Not available"}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-400">
                      District
                    </p>

                    <p className="font-semibold text-slate-800 mt-1">
                      {farmer.district ||
                        "Not available"}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-4">
                    <p className="text-xs text-slate-400">
                      Main Crop
                    </p>

                    <p className="font-semibold text-slate-800 mt-1">
                      {farmer.mainCrop ||
                        "Not available"}
                    </p>
                  </div>

                </div>

              </div>

            </div>
          )}

        </main>

        {/* HELP */}

        <section className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-2xl shadow-lg mt-6 p-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>

              <h2 className="text-xl font-bold">
                What can you ask?
              </h2>

              <p className="text-blue-100 text-sm mt-2">
                Try questions about weather,
                crop disease, market prices,
                government schemes or your orders.
              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              {[
                "Weather",
                "Crop Disease",
                "Market Prices",
                "Government Schemes",
                "My Orders",
              ].map(
                (item) => (
                  <span
                    key={item}
                    className="bg-white/15 border border-white/20 px-3 py-1.5 rounded-full text-xs font-semibold"
                  >
                    {item}
                  </span>
                )
              )}

            </div>

          </div>

        </section>

        {/* FOOTER */}

        <footer className="text-center py-8 text-sm text-slate-400">
          AgriSaathi · Voice Assistant
        </footer>

      </div>
    </div>
  );
}
