import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";

import { auth, database } from "../firebase";
import {
  getLanguage,
  setLanguage,
} from "./language";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

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

const greetings = {
  en: "Namaste. I am your AgriSaathi crop farming assistant. How can I help you today?",

  te: "నమస్కారం రైతు గారు. నేను మీ అగ్రిసాథి పంటల వ్యవసాయ సహాయకుడిని. ఈ రోజు మీకు ఎలా సహాయం చేయగలను?",

  hi: "नमस्ते किसान जी। मैं आपका एग्रीसाथी फसल कृषि सहायक हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?",

  ta: "வணக்கம் விவசாயி. நான் உங்கள் அக்ரிசாதி பயிர் விவசாய உதவியாளர். இன்று எப்படி உதவலாம்?",

  kn: "ನಮಸ್ಕಾರ ರೈತರೇ. ನಾನು ನಿಮ್ಮ ಅಗ್ರಿಸಾಥಿ ಬೆಳೆ ಕೃಷಿ ಸಹಾಯಕ. ಇಂದು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",

  ml: "നമസ്കാരം കർഷകരേ. ഞാൻ നിങ്ങളുടെ അഗ്രിസാഥി വിള കൃഷി സഹായിയാണ്. ഇന്ന് എങ്ങനെ സഹായിക്കാം?",

  mr: "नमस्कार शेतकरी मित्रा. मी तुमचा अॅग्रीसाथी पीक शेती सहाय्यक आहे. आज कशी मदत करू?",

  bn: "নমস্কার কৃষক বন্ধু। আমি আপনার এগ্রিসাথি ফসল কৃষি সহায়ক। আজ কীভাবে সাহায্য করতে পারি?",

  gu: "નમસ્તે ખેડૂત મિત્ર. હું તમારો એગ્રીસાથી પાક કૃષિ સહાયક છું. આજે કેવી રીતે મદદ કરી શકું?",

  pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਜੀ। ਮੈਂ ਤੁਹਾਡਾ ਐਗਰੀਸਾਥੀ ਫਸਲ ਖੇਤੀ ਸਹਾਇਕ ਹਾਂ। ਅੱਜ ਕਿਵੇਂ ਮਦਦ ਕਰਾਂ?",

  ur: "نمستے کسان صاحب۔ میں آپ کا ایگری ساتھی فصل زرعی معاون ہوں۔ آج کیسے مدد کر سکتا ہوں؟",

  or: "ନମସ୍କାର ଚାଷୀ ଭାଇ। ମୁଁ ଆପଣଙ୍କ ଏଗ୍ରିସାଥୀ ଫସଲ କୃଷି ସହାୟକ। ଆଜି କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
};

const retryMessages = {
  en: "I could not hear that clearly. Please say it again.",
  te: "స్పష్టంగా వినిపించలేదు. దయచేసి మళ్లీ చెప్పండి.",
  hi: "मैं ठीक से सुन नहीं पाया। कृपया फिर से कहें।",
  ta: "எனக்குத் தெளிவாகக் கேட்கவில்லை. மீண்டும் சொல்லுங்கள்.",
  kn: "ನನಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ.",
  ml: "എനിക്ക് വ്യക്തമായി കേൾക്കാനായില്ല. വീണ്ടും പറയൂ.",
  mr: "मला स्पष्ट ऐकू आले नाही. पुन्हा सांगा.",
  bn: "আমি স্পষ্ট শুনতে পাইনি। আবার বলুন।",
  gu: "મને સ્પષ્ટ સંભળાયું નથી. ફરી કહો.",
  pa: "ਮੈਨੂੰ ਸਾਫ਼ ਸੁਣਾਈ ਨਹੀਂ ਦਿੱਤਾ। ਦੁਬਾਰਾ ਕਹੋ।",
  ur: "مجھے واضح سنائی نہیں دیا۔ دوبارہ کہیں۔",
  or: "ମୁଁ ସ୍ପଷ୍ଟ ଭାବେ ଶୁଣିପାରିଲି ନାହିଁ। ପୁଣି କୁହନ୍ତୁ।",
};

const interfaceText = {
  en: {
    title: "AgriSaathi Voice Assistant",
    ready: "Tap the microphone to begin",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    stopped: "Conversation paused",
    unsupported:
      "Voice recognition is not supported on this browser. Please use Chrome.",
    stop: "Stop",
    back: "Back",
  },

  te: {
    title: "అగ్రిసాథి వాయిస్ సహాయకుడు",
    ready:
      "ప్రారంభించడానికి మైక్రోఫోన్ నొక్కండి",
    listening: "వింటున్నాను…",
    thinking: "ఆలోచిస్తున్నాను…",
    speaking: "మాట్లాడుతున్నాను…",
    stopped:
      "సంభాషణ నిలిపివేయబడింది",
    unsupported:
      "ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు లేదు. Chrome ఉపయోగించండి.",
    stop: "ఆపండి",
    back: "వెనుకకు",
  },

  hi: {
    title: "एग्रीसाथी आवाज़ सहायक",
    ready:
      "शुरू करने के लिए माइक्रोफ़ोन दबाएँ",
    listening: "सुन रहा हूँ…",
    thinking: "सोच रहा हूँ…",
    speaking: "बोल रहा हूँ…",
    stopped: "बातचीत रोक दी गई है",
    unsupported:
      "इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। Chrome इस्तेमाल करें।",
    stop: "रोकें",
    back: "वापस",
  },
};

const actionRoutes = {
  weather: "/weather",
  crop_disease: "/crop-disease",
  market_prices: "/market-prices",
  government_schemes: "/govt-schemes",
  dealer_products:
    "/farmer/dealer-products",
  farmer_orders: "/farmer/orders",
  community: "/community",
  profile: "/profile",
  dashboard: "/dashboard",
};

function getUi(language) {
  return (
    interfaceText[language] ||
    interfaceText.en
  );
}

export default function VoiceAssistantPage() {
  const navigate = useNavigate();

  const [languageCode, setLanguageCode] =
    useState(getLanguage());

  const [status, setStatus] =
    useState("ready");

  const [error, setError] = useState("");
  const [authorized, setAuthorized] =
    useState(false);

  const recognitionRef = useRef(null);
  const activeRef = useRef(false);
  const historyRef = useRef([]);
  const languageRef = useRef(
    getLanguage()
  );

  const ui = getUi(languageCode);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            navigate("/login", {
              replace: true,
            });

            return;
          }

          const snapshot = await get(
            ref(
              database,
              `users/${user.uid}`
            )
          );

          if (
            !snapshot.exists() ||
            snapshot.val().role !== "farmer"
          ) {
            navigate("/role-selection", {
              replace: true,
            });

            return;
          }

          setAuthorized(true);
        }
      );

    return () => {
      activeRef.current = false;

      recognitionRef.current?.abort();

      window.speechSynthesis?.cancel();

      unsubscribe();
    };
  }, [navigate]);

  function updateLanguage(code) {
    if (!speechLocales[code]) {
      return;
    }

    languageRef.current = code;
    setLanguageCode(code);
    setLanguage(code);
  }

  function chooseVoice(code) {
    const locale =
      speechLocales[code] ||
      speechLocales.en;

    const voices =
      window.speechSynthesis?.getVoices?.() ||
      [];

    return (
      voices.find(
        (voice) =>
          voice.lang.toLowerCase() ===
          locale.toLowerCase()
      ) ||
      voices.find((voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(
            code.toLowerCase()
          )
      ) ||
      null
    );
  }

  function speak(
    text,
    code,
    onFinished
  ) {
    if (
      !activeRef.current ||
      !window.speechSynthesis
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    setStatus("speaking");

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang =
      speechLocales[code] ||
      speechLocales.en;

    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = chooseVoice(code);

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      if (activeRef.current) {
        onFinished?.();
      }
    };

    utterance.onerror = () => {
      if (activeRef.current) {
        onFinished?.();
      }
    };

    window.speechSynthesis.speak(
      utterance
    );
  }

  function startListening() {
    if (!activeRef.current) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        getUi(
          languageRef.current
        ).unsupported
      );

      setStatus("ready");
      activeRef.current = false;

      return;
    }

    recognitionRef.current?.abort();

    const recognition =
      new SpeechRecognition();

    recognitionRef.current =
      recognition;

    recognition.lang =
      speechLocales[
        languageRef.current
      ] || speechLocales.en;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setStatus("listening");
    setError("");

    recognition.onresult = (
      event
    ) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript?.trim();

      if (transcript) {
        respondToFarmer(transcript);
      }
    };

    recognition.onerror = (
      event
    ) => {
      if (
        !activeRef.current ||
        event.error === "aborted"
      ) {
        return;
      }

      const retryMessage =
        retryMessages[
          languageRef.current
        ] || retryMessages.en;

      setError(retryMessage);

      speak(
        retryMessage,
        languageRef.current,
        startListening
      );
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognition.start();
  }

  async function askGemini(
    transcript
  ) {
    const apiKey =
      import.meta.env
        .VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Voice assistant service is not configured."
      );
    }

    const recentHistory =
      historyRef.current.slice(-8);

    const prompt = `
You are AgriSaathi, a patient crop-farming assistant for Indian farmers.

Rules:
- Detect the language of the current farmer message.
- Reply completely in the same language.
- Keep the reply short, clear and easy to understand.
- Focus on crop farming, weather, mandi prices, crop disease, seeds, fertilizers, government schemes, farmer orders and community.
- The application does not contain SOS or full animal-care services.
- For animal health questions, advise the farmer to contact a nearby government veterinary hospital or qualified veterinarian. Do not provide medicine dosage.
- For crop disease diagnosis, ask the farmer to use the crop photo scanner.
- Never give pesticide dosage. Ask the farmer to follow the product label and agriculture-officer guidance.
- Do not claim that a purchase, call, location share or profile update was completed.
- Use an action only when the farmer clearly asks to open a page.

Allowed actions:
none
weather
crop_disease
market_prices
government_schemes
dealer_products
farmer_orders
community
profile
dashboard

Return only valid JSON:
{
  "reply": "spoken response",
  "languageCode": "en|te|hi|ta|kn|ml|mr|bn|gu|pa|ur|or",
  "action": "none"
}

Conversation history:
${JSON.stringify(recentHistory)}

Current farmer message:
${JSON.stringify(transcript)}
`;

    for (const model of MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data =
        await response.json();

      const responseText =
        data?.candidates?.[0]?.content
          ?.parts?.[0]?.text;

      if (responseText) {
        return JSON.parse(
          responseText
            .replace(
              /```json|```/g,
              ""
            )
            .trim()
        );
      }
    }

    throw new Error(
      "Voice assistant is temporarily unavailable."
    );
  }

  async function respondToFarmer(
    transcript
  ) {
    try {
      setStatus("thinking");
      setError("");

      const result =
        await askGemini(transcript);

      const detectedLanguage =
        speechLocales[
          result.languageCode
        ]
          ? result.languageCode
          : languageRef.current;

      updateLanguage(
        detectedLanguage
      );

      historyRef.current = [
        ...historyRef.current,

        {
          role: "farmer",
          message: transcript,
        },

        {
          role: "assistant",
          message: result.reply,
        },
      ].slice(-10);

      const route =
        actionRoutes[result.action];

      speak(
        result.reply,
        detectedLanguage,
        () => {
          if (route) {
            activeRef.current = false;
            navigate(route);
          } else {
            startListening();
          }
        }
      );
    } catch (requestError) {
      console.error(
        "Voice assistant error:",
        requestError
      );

      const retryMessage =
        retryMessages[
          languageRef.current
        ] || retryMessages.en;

      setError(retryMessage);

      speak(
        retryMessage,
        languageRef.current,
        startListening
      );
    }
  }

  function beginConversation() {
    if (
      !authorized ||
      activeRef.current
    ) {
      return;
    }

    activeRef.current = true;
    historyRef.current = [];

    setError("");

    const code =
      languageRef.current;

    speak(
      greetings[code] ||
        greetings.en,
      code,
      startListening
    );
  }

  function stopConversation() {
    activeRef.current = false;

    recognitionRef.current?.abort();

    window.speechSynthesis?.cancel();

    setStatus("stopped");
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
      </div>
    );
  }

  const conversationActive =
    !["ready", "stopped"].includes(
      status
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-800 to-green-600 p-4 flex items-center justify-center">
      <main className="w-full max-w-xl text-center text-white">
        <button
          type="button"
          onClick={() =>
            navigate("/dashboard")
          }
          className="absolute top-5 left-5 bg-white/15 px-4 py-2 rounded-full hover:bg-white/25"
        >
          ← {ui.back}
        </button>

        <div className="mb-10">
          <div className="text-6xl mb-4">
            🌾
          </div>

          <h1 className="text-3xl md:text-4xl font-bold">
            {ui.title}
          </h1>
        </div>

        <button
          type="button"
          onClick={
            conversationActive
              ? stopConversation
              : beginConversation
          }
          aria-label={
            conversationActive
              ? ui.stop
              : ui.ready
          }
          className={`relative w-52 h-52 rounded-full shadow-2xl border-8 border-white/25 transition-all ${
            status === "listening"
              ? "bg-emerald-400 scale-105"
              : status === "thinking"
              ? "bg-amber-400 animate-pulse"
              : status === "speaking"
              ? "bg-blue-400 scale-105"
              : "bg-white text-green-700 hover:scale-105"
          }`}
        >
          {(status === "listening" ||
            status === "speaking") && (
            <span className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-30" />
          )}

          <span className="relative text-7xl">
            {status === "thinking"
              ? "●●●"
              : status === "speaking"
              ? "🔊"
              : "🎤"}
          </span>
        </button>

        <p
          className="text-2xl font-semibold mt-8"
          aria-live="polite"
        >
          {status === "listening"
            ? ui.listening
            : status === "thinking"
            ? ui.thinking
            : status === "speaking"
            ? ui.speaking
            : status === "stopped"
            ? ui.stopped
            : ui.ready}
        </p>

        {error && (
          <p className="mt-5 bg-red-900/40 border border-red-200/40 rounded-xl p-4">
            {error}
          </p>
        )}

        {conversationActive && (
          <button
            type="button"
            onClick={stopConversation}
            className="mt-8 bg-red-600 hover:bg-red-700 px-8 py-3 rounded-full font-bold"
          >
            {ui.stop}
          </button>
        )}

        <p className="mt-10 text-green-100 text-sm">
          Your speech is processed only
          to provide farming guidance.
        </p>
      </main>
    </div>
  );
}