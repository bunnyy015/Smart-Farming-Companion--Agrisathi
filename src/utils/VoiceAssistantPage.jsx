import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";

import { auth, database } from "../firebase";

import {
  getLanguage,
  setLanguage as persistLanguage,
} from "./language";

import { createVoiceLanguagePrompt } from "./voiceLanguageContext";

import {
  addFarmerMessage,
  addAssistantMessage,
  getVoiceMemory,
  getVoiceMemoryForPrompt,
  clearVoiceMemory,
} from "./voiceMemory";

import { detectLocalVoiceCommand } from "./voiceLocalCommands";

import { createWeatherPromptContext } from "./weatherContext";

/* =========================================================
   GEMINI
========================================================= */

const MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

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

const greetings = {
  en: "Hello! I am your AgriSaathi voice assistant. How can I help you today?",

  te: "నమస్కారం! నేను మీ అగ్రిసాథి వాయిస్ అసిస్టెంట్‌ను. ఈరోజు మీకు ఎలా సహాయం చేయగలను?",

  hi: "नमस्ते! मैं आपका एग्रीसाथी वॉइस असिस्टेंट हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?",

  ta: "வணக்கம்! நான் உங்கள் அக்ரிசாத்தி குரல் உதவியாளர். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?",

  kn: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಅಗ್ರಿಸಾಥಿ ಧ್ವನಿ ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",

  ml: "നമസ്കാരം! ഞാൻ നിങ്ങളുടെ അഗ്രിസാത്തി വോയ്സ് അസിസ്റ്റന്റാണ്. ഇന്ന് എങ്ങനെ സഹായിക്കാം?",

  mr: "नमस्कार! मी तुमचा अ‍ॅग्रीसाथी व्हॉइस असिस्टंट आहे. आज मी तुमची कशी मदत करू शकतो?",

  bn: "নমস্কার! আমি আপনার অ্যাগ্রিসাথি ভয়েস অ্যাসিস্ট্যান্ট। আজ আমি কীভাবে আপনাকে সাহায্য করতে পারি?",

  gu: "નમસ્તે! હું તમારો એગ્રીસાથી વૉઇસ આસિસ્ટન્ટ છું. આજે હું તમારી કેવી રીતે મદદ કરી શકું?",

  pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ ਐਗਰੀਸਾਥੀ ਵੌਇਸ ਅਸਿਸਟੈਂਟ ਹਾਂ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",

  ur: "السلام علیکم! میں آپ کا ایگری ساتھی وائس اسسٹنٹ ہوں۔ آج میں آپ کی کیسے مدد کر سکتا ہوں؟",

  or: "ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କର ଅଗ୍ରିସାଥୀ ଭଏସ୍ ଆସିଷ୍ଟାଣ୍ଟ। ଆଜି ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
};

/* =========================================================
   INTERFACE TEXT
========================================================= */

const interfaceText = {
  en: {
    title: "AgriSaathi Voice Assistant",
    subtitle:
      "Ask about weather, crops, market prices, schemes and your orders.",
    start: "Start Conversation",
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
  },

  te: {
    title: "అగ్రిసాథి వాయిస్ అసిస్టెంట్",
    subtitle:
      "వాతావరణం, పంటలు, మార్కెట్ ధరలు, పథకాలు మరియు ఆర్డర్ల గురించి అడగండి.",
    start: "సంభాషణ ప్రారంభించండి",
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
  },

  hi: {
    title: "एग्रीसाथी वॉइस असिस्टेंट",
    subtitle:
      "मौसम, फसल, बाजार भाव, योजनाओं और ऑर्डर के बारे में पूछें।",
    start: "बातचीत शुरू करें",
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
  },
};

/* =========================================================
   RETRY MESSAGES
========================================================= */

const retryMessages = {
  en: "I couldn't process that request. Please try again.",

  te: "నేను ఆ అభ్యర్థనను ప్రాసెస్ చేయలేకపోయాను. దయచేసి మళ్లీ ప్రయత్నించండి.",

  hi: "मैं उस अनुरोध को पूरा नहीं कर पाया। कृपया फिर से प्रयास करें।",
};

/* =========================================================
   ACTION ROUTES
========================================================= */

const actionRoutes = {
  weather: "/weather",
  crop_disease: "/crop-disease",
  market_prices: "/market-prices",
  government_schemes: "/govt-schemes",
  dealer_products: "/farmer/dealer-products",
  farmer_orders: "/farmer/orders",
  community: "/community",
  profile: "/profile",
  dashboard: "/dashboard",
};

const allowedActions = [
  "none",
  ...Object.keys(actionRoutes),
];

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

  const [language, setLanguageState] = useState(
    () => getLanguage() || "en"
  );

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [farmer, setFarmer] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [history, setHistory] = useState([]);

  const recognitionRef = useRef(null);

  const activeRef = useRef(false);

  const languageRef = useRef(language);

  const statusRef = useRef(status);

  const speakingRef = useRef(false);

  const responseInProgressRef = useRef(false);

  /*
   * Prevents browser recognition errors from creating
   * automatic retry loops.
   */
  const microphoneBlockedRef = useRef(false);

  /*
   * Used to prevent multiple delayed startListening()
   * calls from being created.
   */
  const listenTimerRef = useRef(null);

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
      persistLanguage(nextLanguage);
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
     LOAD MEMORY
  ======================================================= */

  useEffect(() => {
    try {
      const memory = getVoiceMemory();

      if (Array.isArray(memory)) {
        setHistory(
          memory.map((item) => ({
            role: item.role,
            text: item.message,
            timestamp: item.createdAt,
          }))
        );
      }
    } catch (error) {
      console.warn(
        "Unable to load voice memory:",
        error
      );
    }
  }, []);

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
              farmerSnapshot.val()
            );
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

      if (listenTimerRef.current) {
        clearTimeout(
          listenTimerRef.current
        );

        listenTimerRef.current = null;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      recognitionRef.current = null;

      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  /* =======================================================
     SPEECH VOICE
  ======================================================= */

  function chooseVoice(code) {
    if (
      typeof window === "undefined" ||
      !window.speechSynthesis
    ) {
      return null;
    }

    const voices =
      window.speechSynthesis.getVoices();

    if (!voices.length) {
      return null;
    }

    const locale =
      speechLocales[code] ||
      speechLocales.en;

    const exact = voices.find(
      (voice) =>
        normalize(voice.lang) ===
        normalize(locale)
    );

    if (exact) {
      return exact;
    }

    const prefix =
      normalize(locale).split("-")[0];

    return (
      voices.find((voice) =>
        normalize(voice.lang).startsWith(
          prefix
        )
      ) || null
    );
  }

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

    if (
      typeof window === "undefined" ||
      !window.speechSynthesis
    ) {
      onFinished?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    const utterance =
      new SpeechSynthesisUtterance(
        String(text)
      );

    const locale =
      speechLocales[code] ||
      speechLocales.en;

    utterance.lang = locale;
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice =
      chooseVoice(code);

    if (voice) {
      utterance.voice = voice;
    }

    speakingRef.current = true;

    setStatus("speaking");

    let finished = false;

    const finish = () => {
      if (finished) return;

      finished = true;

      speakingRef.current = false;

      onFinished?.();
    };

    utterance.onend = finish;

    utterance.onerror = finish;

    window.speechSynthesis.speak(
      utterance
    );
  }

  /* =======================================================
     CLEAR LISTEN TIMER
  ======================================================= */

  function clearListenTimer() {
    if (listenTimerRef.current) {
      clearTimeout(
        listenTimerRef.current
      );

      listenTimerRef.current = null;
    }
  }

  /* =======================================================
     STOP RECOGNITION
  ======================================================= */

  function stopRecognition() {
    clearListenTimer();

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
     SCHEDULE NEXT LISTEN
  ======================================================= */

  function scheduleListening(delay = 400) {
    clearListenTimer();

    if (!activeRef.current) {
      return;
    }

    if (microphoneBlockedRef.current) {
      return;
    }

    listenTimerRef.current =
      setTimeout(() => {
        listenTimerRef.current =
          null;

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

        startListening();
      }, delay);
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

      const result =
        event.results?.[0]?.[0];

      const spokenText =
        result?.transcript?.trim() ||
        "";

      if (!spokenText) {
        return;
      }

      setTranscript(
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
          "Speech recognition is not available for the selected language."
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

    setHistory(
      (previous) =>
        [
          ...previous,
          {
            role,
            text: cleaned,
            timestamp: Date.now(),
          },
        ].slice(-8)
    );
  }

  /* =======================================================
     GEMINI
  ======================================================= */

  async function askGemini(
    userText
  ) {
    const apiKey =
      import.meta.env
        .VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "VITE_GEMINI_API_KEY is missing."
      );
    }

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

IMPORTANT:
Reply in the same language requested by the current language code.

Keep responses concise because they will be spoken aloud.

You can help with:
- weather
- agriculture
- crops
- crop disease guidance
- market prices
- government schemes
- dealer products
- farmer orders
- community
- farmer profile
- dashboard

You may request navigation using only these actions:

${allowedActions.join(", ")}

Return ONLY valid JSON.

Required format:

{
  "reply": "short spoken response",
  "languageCode": "${currentLanguage}",
  "action": "none"
}

If navigation is useful, set action to one of the allowed action names.

Do not put markdown around the JSON.

${farmerContext}

Weather context:
${weatherInformation}

Previous conversation:
${conversation || "No previous conversation."}

Farmer's new request:
${userText}
`;

    let lastError = null;

    for (const model of MODELS) {
      try {
        const response =
          await fetch(
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
                    role: "user",
                    parts: [
                      {
                        text: prompt,
                      },
                    ],
                  },
                ],

                generationConfig: {
                  temperature: 0.25,
                  maxOutputTokens: 500,
                  responseMimeType:
                    "application/json",
                },
              }),
            }
          );

        if (!response.ok) {
          const errorText =
            await response.text();

          throw new Error(
            `Gemini ${model} failed: ${response.status} ${errorText}`
          );
        }

        const data =
          await response.json();

        const generatedText =
          data?.candidates?.[0]
            ?.content?.parts?.[0]
            ?.text
            ?.trim();

        if (!generatedText) {
          throw new Error(
            "Gemini returned an empty response."
          );
        }

        let parsed;

        try {
          parsed =
            JSON.parse(
              generatedText
            );
        } catch {
          const cleaned =
            generatedText
              .replace(
                /^```json/i,
                ""
              )
              .replace(
                /^```/i,
                ""
              )
              .replace(
                /```$/i,
                ""
              )
              .trim();

          parsed =
            JSON.parse(cleaned);
        }

        const reply =
          String(
            parsed.reply || ""
          ).trim();

        const languageCode =
          speechLocales[
            parsed.languageCode
          ]
            ? parsed.languageCode
            : currentLanguage;

        const action =
          allowedActions.includes(
            parsed.action
          )
            ? parsed.action
            : "none";

        if (!reply) {
          throw new Error(
            "Gemini returned no reply."
          );
        }

        return {
          reply,
          languageCode,
          action,
        };
      } catch (error) {
        console.warn(
          `Gemini ${model} error:`,
          error
        );

        lastError = error;
      }
    }

    throw (
      lastError ||
      new Error(
        "Unable to get a response from Gemini."
      )
    );
  }

  /* =======================================================
     LOCAL COMMAND
  ======================================================= */

  async function handleLocalCommand(
    text
  ) {
    try {
      const result =
        await detectLocalVoiceCommand(
          text,
          languageRef.current
        );

      if (!result) {
        return false;
      }

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

        setLastResponse(
          reply
        );
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
            navigate(
              actionRoutes[action]
            );

            return;
          }

          setStatus("idle");

          scheduleListening(
            500
          );
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

      /*
       * GEMINI
       */
      const result =
        await askGemini(
          spokenText
        );

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

      setLastResponse(
        reply
      );

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
            navigate(
              actionRoutes[
                result.action
              ]
            );

            return;
          }

          setStatus("idle");

          scheduleListening(
            500
          );
        }
      );
    } catch (error) {
      console.error(
        "Voice assistant error:",
        error
      );

      const currentLanguage =
        languageRef.current ||
        "en";

      const retryMessage =
        retryMessages[
          currentLanguage
        ] ||
        retryMessages.en;

      setError(
        retryMessage
      );

      setStatus("idle");

      /*
       * Speak the error ONCE.
       * After it finishes, automatically
       * return to listening.
       */
      speak(
        retryMessage,
        currentLanguage,
        () => {
          if (
            activeRef.current &&
            !microphoneBlockedRef.current
          ) {
            scheduleListening(
              500
            );
          }
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

    clearListenTimer();

    stopRecognition();

    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }

    try {
      clearVoiceMemory();
    } catch (error) {
      console.warn(
        "Unable to clear voice memory:",
        error
      );
    }

    setHistory([]);

    setTranscript("");

    setLastResponse("");

    setError("");

    responseInProgressRef.current =
      false;

    speakingRef.current = false;

    activeRef.current = true;

    setActive(true);

    const currentLanguage =
      languageRef.current || "en";

    const greeting =
      greetings[
        currentLanguage
      ] || greetings.en;

    speak(
      greeting,
      currentLanguage,
      () => {
        if (!activeRef.current) {
          return;
        }

        setStatus("idle");

        scheduleListening(
          500
        );
      }
    );
  }

  /* =======================================================
     STOP CONVERSATION
  ======================================================= */

  function stopConversation() {
    activeRef.current = false;

    setActive(false);

    responseInProgressRef.current =
      false;

    speakingRef.current = false;

    clearListenTimer();

    stopRecognition();

    try {
      window.speechSynthesis?.cancel();
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

    if (
      statusRef.current ===
      "listening"
    ) {
      stopRecognition();

      setStatus("idle");

      setError(
        "Language changed. Tap the microphone to continue."
      );
    }
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

      <div className="max-w-5xl mx-auto">

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

            {/* TRANSCRIPT */}

            {transcript && (
              <div className="max-w-2xl mx-auto mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-5">

                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                  You said
                </p>

                <p className="text-slate-800 font-medium mt-2">
                  {transcript}
                </p>

              </div>
            )}

            {/* RESPONSE */}

            {lastResponse && (
              <div className="max-w-2xl mx-auto mt-4 bg-cyan-50 border border-cyan-100 rounded-2xl p-5">

                <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                  AgriSaathi
                </p>

                <p className="text-slate-800 mt-2 leading-6">
                  {lastResponse}
                </p>

              </div>
            )}

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