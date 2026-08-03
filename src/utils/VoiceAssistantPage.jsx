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

import {
  getPreferredLanguage,
  setPreferredLanguage,
} from "./languageProfile";

import {
  createVoiceLanguagePrompt,
} from "./voiceLanguageContext";

import {
  addFarmerMessage,
  addAssistantMessage,
  getVoiceMemoryForPrompt,
  clearVoiceMemory,
} from "./voiceMemory";

import {
  detectLocalVoiceCommand,
} from "./voiceLocalCommands";

import {
  createWeatherPromptContext,
} from "./weatherContext";

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
  en: "I could not understand that clearly. Please say it again.",

  te: "స్పష్టంగా అర్థం కాలేదు. దయచేసి మళ్లీ చెప్పండి.",

  hi: "मैं ठीक से समझ नहीं पाया। कृपया फिर से कहें।",

  ta: "எனக்குத் தெளிவாகப் புரியவில்லை. மீண்டும் சொல்லுங்கள்.",

  kn: "ನನಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ.",

  ml: "എനിക്ക് വ്യക്തമായി മനസ്സിലായില്ല. വീണ്ടും പറയൂ.",

  mr: "मला स्पष्ट समजले नाही. पुन्हा सांगा.",

  bn: "আমি স্পষ্টভাবে বুঝতে পারিনি। আবার বলুন।",

  gu: "મને સ્પષ્ટ રીતે સમજાયું નથી. ફરી કહો.",

  pa: "ਮੈਨੂੰ ਸਾਫ਼ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਦੁਬਾਰਾ ਕਹੋ।",

  ur: "مجھے واضح طور پر سمجھ نہیں آیا۔ دوبارہ کہیں۔",

  or: "ମୁଁ ସ୍ପଷ୍ଟ ଭାବେ ବୁଝିପାରିଲି ନାହିଁ। ପୁଣି କୁହନ୍ତୁ।",
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
    privacy:
      "Your speech is processed only to provide farming guidance.",
  },

  te: {
    title: "అగ్రిసాథి వాయిస్ సహాయకుడు",
    ready: "ప్రారంభించడానికి మైక్రోఫోన్ నొక్కండి",
    listening: "వింటున్నాను…",
    thinking: "ఆలోచిస్తున్నాను…",
    speaking: "మాట్లాడుతున్నాను…",
    stopped: "సంభాషణ నిలిపివేయబడింది",
    unsupported:
      "ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు లేదు. Chrome ఉపయోగించండి.",
    stop: "ఆపండి",
    back: "వెనుకకు",
    privacy:
      "వ్యవసాయ సహాయం అందించడానికి మాత్రమే మీ మాటలను ప్రాసెస్ చేస్తాము.",
  },

  hi: {
    title: "एग्रीसाथी आवाज़ सहायक",
    ready: "शुरू करने के लिए माइक्रोफ़ोन दबाएँ",
    listening: "सुन रहा हूँ…",
    thinking: "सोच रहा हूँ…",
    speaking: "बोल रहा हूँ…",
    stopped: "बातचीत रोक दी गई है",
    unsupported:
      "इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। Chrome इस्तेमाल करें।",
    stop: "रोकें",
    back: "वापस",
    privacy:
      "आपकी आवाज़ का उपयोग केवल खेती से जुड़ी सहायता देने के लिए किया जाता है।",
  },
};

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

const allowedActions = new Set([
  "none",
  ...Object.keys(actionRoutes),
]);

const emptyFarmerProfile = {
  name: "",
  village: "",
  district: "",
  state: "",
  mainCrop: "",
  phone: "",
};

function getUi(language) {
  return interfaceText[language] || interfaceText.en;
}

function getValidLanguage(language) {
  return speechLocales[language]
    ? language
    : "en";
}

function getInitialLanguage() {
  const preferredLanguage =
    getPreferredLanguage();

  if (speechLocales[preferredLanguage]) {
    return preferredLanguage;
  }

  return getValidLanguage(getLanguage());
}

function cleanProfileValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function normalizeFarmerProfile(profile) {
  if (
    !profile ||
    typeof profile !== "object"
  ) {
    return emptyFarmerProfile;
  }

  return {
    name: cleanProfileValue(
      profile.name ||
        profile.fullName
    ),

    village: cleanProfileValue(
      profile.village
    ),

    district: cleanProfileValue(
      profile.district
    ),

    state: cleanProfileValue(
      profile.state
    ),

    mainCrop: cleanProfileValue(
      profile.mainCrop ||
        profile.primaryCrop ||
        profile.crop
    ),

    phone: cleanProfileValue(
      profile.phone
    ),
  };
}

function createFarmerProfilePrompt(
  profile,
  preferredLanguage
) {
  const safeProfile =
    normalizeFarmerProfile(profile);

  const availableDetails = [];

  if (safeProfile.name) {
    availableDetails.push(
      `Farmer name: ${safeProfile.name}`
    );
  }

  if (safeProfile.village) {
    availableDetails.push(
      `Village: ${safeProfile.village}`
    );
  }

  if (safeProfile.district) {
    availableDetails.push(
      `District: ${safeProfile.district}`
    );
  }

  if (safeProfile.state) {
    availableDetails.push(
      `State: ${safeProfile.state}`
    );
  }

  if (safeProfile.mainCrop) {
    availableDetails.push(
      `Main crop: ${safeProfile.mainCrop}`
    );
  }

  availableDetails.push(
    `Preferred language code: ${getValidLanguage(
      preferredLanguage
    )}`
  );

  if (availableDetails.length === 1) {
    return "No detailed farmer profile is available.";
  }

  return availableDetails.join("\n");
}

function extractJson(responseText) {
  if (
    typeof responseText !== "string" ||
    !responseText.trim()
  ) {
    throw new Error(
      "The assistant returned an empty response."
    );
  }

  const cleanedText = responseText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace =
    cleanedText.indexOf("{");

  const lastBrace =
    cleanedText.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    throw new Error(
      "The assistant response was not valid JSON."
    );
  }

  const jsonText = cleanedText.slice(
    firstBrace,
    lastBrace + 1
  );

  return JSON.parse(jsonText);
}

function validateGeminiResult(result) {
  if (
    !result ||
    typeof result !== "object"
  ) {
    throw new Error(
      "The assistant returned an invalid result."
    );
  }

  const reply =
    typeof result.reply === "string"
      ? result.reply.trim()
      : "";

  if (!reply) {
    throw new Error(
      "The assistant did not provide a reply."
    );
  }

  const languageCode =
    getValidLanguage(
      result.languageCode
    );

  const action =
    allowedActions.has(result.action)
      ? result.action
      : "none";

  return {
    reply,
    languageCode,
    action,
  };
}

export default function VoiceAssistantPage() {
  const navigate = useNavigate();

  const initialLanguageRef =
    useRef(getInitialLanguage());

  const [
    languageCode,
    setLanguageCode,
  ] = useState(
    initialLanguageRef.current
  );

  const [status, setStatus] =
    useState("ready");

  const [error, setError] =
    useState("");

  const [authorized, setAuthorized] =
    useState(false);

  const recognitionRef =
    useRef(null);

  const activeRef =
    useRef(false);

  const languageRef =
    useRef(initialLanguageRef.current);

  const farmerProfileRef =
    useRef(emptyFarmerProfile);

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

          try {
            const userSnapshot =
              await get(
                ref(
                  database,
                  `users/${user.uid}`
                )
              );

            if (
              !userSnapshot.exists() ||
              userSnapshot.val()?.role !==
                "farmer"
            ) {
              navigate(
                "/role-selection",
                {
                  replace: true,
                }
              );

              return;
            }

            try {
              const farmerSnapshot =
                await get(
                  ref(
                    database,
                    `farmers/${user.uid}`
                  )
                );

              if (
                farmerSnapshot.exists()
              ) {
                farmerProfileRef.current =
                  normalizeFarmerProfile(
                    farmerSnapshot.val()
                  );
              } else {
                farmerProfileRef.current =
                  emptyFarmerProfile;
              }
            } catch (profileError) {
              console.error(
                "Farmer profile loading error:",
                profileError
              );

              farmerProfileRef.current =
                emptyFarmerProfile;
            }

            setAuthorized(true);
          } catch (authorizationError) {
            console.error(
              "Voice assistant authorization error:",
              authorizationError
            );

            navigate("/login", {
              replace: true,
            });
          }
        }
      );

    return () => {
      activeRef.current = false;

      recognitionRef.current?.abort();

      window.speechSynthesis?.cancel();

      clearVoiceMemory();

      unsubscribe();
    };
  }, [navigate]);

  function updateLanguage(code) {
    const validCode =
      getValidLanguage(code);

    languageRef.current =
      validCode;

    setLanguageCode(validCode);

    setLanguage(validCode);

    setPreferredLanguage(validCode);
  }

  function chooseVoice(code) {
    const validCode =
      getValidLanguage(code);

    const locale =
      speechLocales[validCode];

    const voices =
      window.speechSynthesis
        ?.getVoices?.() || [];

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
            validCode.toLowerCase()
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

    const validCode =
      getValidLanguage(code);

    window.speechSynthesis.cancel();

    setStatus("speaking");

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.lang =
      speechLocales[validCode];

    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice =
      chooseVoice(validCode);

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      if (activeRef.current) {
        onFinished?.();
      }
    };

    utterance.onerror = (
      speechError
    ) => {
      console.error(
        "Speech synthesis error:",
        speechError
      );

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
        event.results?.[0]?.[0]
          ?.transcript?.trim();

      if (transcript) {
        respondToFarmer(transcript);
      }
    };

    recognition.onerror = (
      recognitionError
    ) => {
      if (
        !activeRef.current ||
        recognitionError.error ===
          "aborted"
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
      if (
        recognitionRef.current ===
        recognition
      ) {
        recognitionRef.current =
          null;
      }
    };

    try {
      recognition.start();
    } catch (recognitionStartError) {
      console.error(
        "Speech recognition start error:",
        recognitionStartError
      );

      setStatus("ready");
      activeRef.current = false;

      setError(
        getUi(
          languageRef.current
        ).unsupported
      );
    }
  }

  async function askGemini(transcript) {
    const apiKey =
      import.meta.env
        .VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "VITE_GEMINI_API_KEY is missing."
      );
    }

    const languageContext =
      createVoiceLanguagePrompt();

    const conversationHistory =
      getVoiceMemoryForPrompt();

    const farmerProfileContext =
      createFarmerProfilePrompt(
        farmerProfileRef.current,
        languageRef.current
      );

    const weatherContext =
      createWeatherPromptContext();

    const prompt = `
You are AgriSaathi, a patient crop-farming assistant for Indian farmers.

Rules:
- Detect the language of the current farmer message.
- Reply completely in the same language.
- Keep the reply short, clear and easy to understand.
- The farmer may use local village slang or mix Indian languages with English.
- Use the farmer profile only when it is relevant to the question.
- Use village, district and state details for location-aware farming guidance.
- Use the main crop detail when giving crop-related guidance.
- Use the saved weather context only when the farmer asks a weather-related or weather-dependent farming question.
- For spraying, irrigation, sowing, harvesting or field-work questions, consider the available temperature, humidity, rain probability and wind data.
- If live weather is unavailable or expired, do not guess current weather.
- Clearly say that the farmer should open the Weather page and refresh location when current weather is required.
- Treat weather forecasts as guidance, not certainty.
- Do not repeatedly mention the farmer's personal details.
- Never reveal the farmer's phone number.
- Do not claim that profile information is complete or verified.
- Use the saved language context only to improve understanding.
- Do not mention language detection, dialect detection, saved vocabulary, farmer profile context or conversation memory.
- Focus on crop farming, weather, mandi prices, crop disease, seeds, fertilizers, government schemes, farmer orders and community.
- The application does not contain SOS or complete animal-care services.
- For animal health questions, advise the farmer to contact a nearby government veterinary hospital or qualified veterinarian.
- Do not provide animal medicine dosages.
- For crop disease diagnosis, ask the farmer to use the crop photo scanner.
- Never provide pesticide dosage.
- Ask the farmer to follow the product label and agriculture-officer guidance.
- Do not claim that a purchase, call, location share, order or profile update was completed.
- Select an action only when the farmer clearly asks to open a page.
- When no page should be opened, use the action "none".

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

Return only valid JSON in this exact structure:
{
  "reply": "spoken response",
  "languageCode": "en|te|hi|ta|kn|ml|mr|bn|gu|pa|ur|or",
  "action": "none"
}

Farmer profile:
${farmerProfileContext}

Saved weather context:
${weatherContext}

Saved farmer language context:
${languageContext}

Current session conversation:
${conversationHistory}

Current farmer message:
${JSON.stringify(transcript)}
`.trim();

    let lastError = null;

    for (const model of MODELS) {
      try {
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
                  role: "user",

                  parts: [
                    {
                      text: prompt,
                    },
                  ],
                },
              ],

              generationConfig: {
                temperature: 0.3,
                responseMimeType:
                  "application/json",
              },
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          lastError = new Error(
            data?.error?.message ||
              `Gemini request failed with status ${response.status}.`
          );

          continue;
        }

        const responseText =
          data?.candidates?.[0]
            ?.content?.parts?.[0]
            ?.text;

        const parsedResult =
          extractJson(responseText);

        return validateGeminiResult(
          parsedResult
        );
      } catch (modelError) {
        console.error(
          `Gemini model ${model} failed:`,
          modelError
        );

        lastError = modelError;
      }
    }

    throw (
      lastError ||
      new Error(
        "Voice assistant is temporarily unavailable."
      )
    );
  }

  function handleLocalCommand(
    localCommand,
    transcript
  ) {
    const commandLanguage =
      getValidLanguage(
        localCommand.languageCode
      );

    updateLanguage(commandLanguage);

    addFarmerMessage(transcript);

    addAssistantMessage(
      localCommand.reply
    );

    speak(
      localCommand.reply,
      commandLanguage,
      () => {
        activeRef.current = false;

        clearVoiceMemory();

        navigate(localCommand.route);
      }
    );
  }

  async function respondToFarmer(
    transcript
  ) {
    if (!transcript) {
      return;
    }

    recognitionRef.current?.abort();

    setError("");

    const localCommand =
      detectLocalVoiceCommand(
        transcript,
        languageRef.current
      );

    if (localCommand) {
      handleLocalCommand(
        localCommand,
        transcript
      );

      return;
    }

    try {
      setStatus("thinking");

      const result =
        await askGemini(transcript);

      if (!activeRef.current) {
        return;
      }

      const detectedLanguage =
        getValidLanguage(
          result.languageCode
        );

      updateLanguage(
        detectedLanguage
      );

      addFarmerMessage(transcript);

      addAssistantMessage(
        result.reply
      );

      const route =
        actionRoutes[result.action];

      speak(
        result.reply,
        detectedLanguage,
        () => {
          if (route) {
            activeRef.current = false;

            clearVoiceMemory();

            navigate(route);

            return;
          }

          startListening();
        }
      );
    } catch (requestError) {
      console.error(
        "Voice assistant error:",
        requestError
      );

      if (!activeRef.current) {
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
    }
  }

  function beginConversation() {
    if (
      !authorized ||
      activeRef.current
    ) {
      return;
    }

    clearVoiceMemory();

    activeRef.current = true;

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

    recognitionRef.current = null;

    window.speechSynthesis?.cancel();

    clearVoiceMemory();

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
          onClick={() => {
            stopConversation();
            navigate("/dashboard");
          }}
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
          <p
            className="mt-5 bg-red-900/40 border border-red-200/40 rounded-xl p-4"
            role="alert"
          >
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
          {ui.privacy}
        </p>
      </main>
    </div>
  );
}