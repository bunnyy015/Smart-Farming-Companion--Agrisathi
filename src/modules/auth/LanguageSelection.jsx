import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLanguage,
  languages,
  setLanguage,
} from "../../utils/language";
import StatusMessage from "../../components/StatusMessage";

const LANGUAGE_DETAILS = {
  en: {
    nativeName: "English",
    voiceText: "Tap here to continue in English",
    locale: "en-IN",
    icon: "🇮🇳",
  },
  te: {
    nativeName: "తెలుగు",
    voiceText: "తెలుగులో కొనసాగడానికి ఇక్కడ నొక్కండి",
    locale: "te-IN",
    icon: "🇮🇳",
  },
  hi: {
    nativeName: "हिन्दी",
    voiceText: "हिन्दी में आगे बढ़ने के लिए यहाँ दबाएँ",
    locale: "hi-IN",
    icon: "🇮🇳",
  },
  ta: {
    nativeName: "தமிழ்",
    voiceText: "தமிழில் தொடர இங்கே அழுத்தவும்",
    locale: "ta-IN",
    icon: "🇮🇳",
  },
  kn: {
    nativeName: "ಕನ್ನಡ",
    voiceText: "ಕನ್ನಡದಲ್ಲಿ ಮುಂದುವರಿಯಲು ಇಲ್ಲಿ ಒತ್ತಿರಿ",
    locale: "kn-IN",
    icon: "🇮🇳",
  },
  ml: {
    nativeName: "മലയാളം",
    voiceText: "മലയാളത്തിൽ തുടരാൻ ഇവിടെ അമർത്തുക",
    locale: "ml-IN",
    icon: "🇮🇳",
  },
  mr: {
    nativeName: "मराठी",
    voiceText: "मराठीत पुढे जाण्यासाठी येथे दाबा",
    locale: "mr-IN",
    icon: "🇮🇳",
  },
  bn: {
    nativeName: "বাংলা",
    voiceText: "বাংলায় চালিয়ে যেতে এখানে চাপুন",
    locale: "bn-IN",
    icon: "🇮🇳",
  },
  gu: {
    nativeName: "ગુજરાતી",
    voiceText: "ગુજરાતીમાં આગળ વધવા અહીં દબાવો",
    locale: "gu-IN",
    icon: "🇮🇳",
  },
  pa: {
    nativeName: "ਪੰਜਾਬੀ",
    voiceText: "ਪੰਜਾਬੀ ਵਿੱਚ ਅੱਗੇ ਵਧਣ ਲਈ ਇੱਥੇ ਦਬਾਓ",
    locale: "pa-IN",
    icon: "🇮🇳",
  },
  ur: {
    nativeName: "اردو",
    voiceText: "اردو میں جاری رکھنے کے لیے یہاں دبائیں",
    locale: "ur-IN",
    icon: "🇮🇳",
  },
  or: {
    nativeName: "ଓଡ଼ିଆ",
    voiceText: "ଓଡ଼ିଆରେ ଆଗକୁ ବଢ଼ିବା ପାଇଁ ଏଠାରେ ଦବାନ୍ତୁ",
    locale: "or-IN",
    icon: "🇮🇳",
  },
};

export default function LanguageSelection() {
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(
    getLanguage()
  );
  const [speakingCode, setSpeakingCode] = useState("");
  const [message, setMessage] = useState(null);

  const filteredLanguages = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return languages;
    }

    return languages.filter((language) => {
      const details =
        LANGUAGE_DETAILS[language.code] || {};

      return [
        language.name,
        details.nativeName,
        language.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [searchText]);

  function showMessage(type, text) {
    setMessage({ type, text });
  }

  function chooseVoice(locale, code) {
    const voices =
      window.speechSynthesis?.getVoices?.() || [];

    return (
      voices.find(
        (voice) =>
          voice.lang.toLowerCase() ===
          locale.toLowerCase()
      ) ||
      voices.find((voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(code.toLowerCase())
      ) ||
      null
    );
  }

  function speakLanguage(language) {
    if (!window.speechSynthesis) {
      showMessage(
        "warning",
        "Voice preview is not supported on this browser."
      );
      return;
    }

    const details =
      LANGUAGE_DETAILS[language.code];

    if (!details) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      details.voiceText
    );

    utterance.lang = details.locale;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = chooseVoice(
      details.locale,
      language.code
    );

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setSpeakingCode(language.code);
    };

    utterance.onend = () => {
      setSpeakingCode("");
    };

    utterance.onerror = () => {
      setSpeakingCode("");

      showMessage(
        "warning",
        "This language voice is not available on the current device."
      );
    };

    window.speechSynthesis.speak(utterance);
  }

  function handleLanguageSelect(code) {
    window.speechSynthesis?.cancel();

    setSelectedLanguage(code);
    setLanguage(code);

    const selectedRole =
      localStorage.getItem("role");

    if (selectedRole === "farmer") {
      navigate("/dashboard", {
        replace: true,
      });
      return;
    }

    if (selectedRole === "dealer") {
      navigate("/dealer", {
        replace: true,
      });
      return;
    }

    if (selectedRole === "kvk") {
      navigate("/kvk", {
        replace: true,
      });
      return;
    }

    if (selectedRole === "admin") {
      navigate("/admin", {
        replace: true,
      });
      return;
    }

    navigate("/role-selection", {
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-green-50 p-4 md:p-6">
      <main className="max-w-4xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-3xl shadow-xl p-6 text-center">
          <div className="text-6xl">🌾</div>

          <h1 className="text-3xl md:text-4xl font-bold mt-4">
            Choose Your Language
          </h1>

          <p className="text-green-100 mt-2">
            Select the language that is easiest for you.
          </p>

          <div className="bg-white/15 rounded-xl p-3 mt-4 text-sm">
            🔊 Tap the speaker button to hear each language.
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <label
            htmlFor="language-search"
            className="font-semibold text-gray-800"
          >
            🔍 Search Language
          </label>

          <input
            id="language-search"
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="English, Telugu, Hindi..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-green-600"
          />
        </section>

        {filteredLanguages.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center mt-5">
            <div className="text-5xl">🌍</div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              No language found
            </h2>

            <p className="text-gray-600 mt-2">
              Try another language name.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-5">
            {filteredLanguages.map((language) => {
              const details =
                LANGUAGE_DETAILS[language.code] || {
                  nativeName: language.name,
                  icon: "🌍",
                };

              const selected =
                selectedLanguage === language.code;

              const speaking =
                speakingCode === language.code;

              return (
                <article
                  key={language.code}
                  className={`rounded-2xl border shadow-sm p-4 transition ${
                    selected
                      ? "bg-green-50 border-green-500 ring-2 ring-green-200"
                      : "bg-white border-green-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleLanguageSelect(
                        language.code
                      )
                    }
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-3xl">
                        {details.icon}
                      </div>

                      {selected && (
                        <span className="bg-green-700 text-white px-2.5 py-1 rounded-full text-xs font-semibold">
                          Selected
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl font-bold text-green-900 mt-3">
                      {details.nativeName}
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      {language.name}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      speakLanguage(language)
                    }
                    className="w-full border border-green-200 bg-green-50 text-green-800 py-2.5 rounded-xl font-semibold mt-4"
                  >
                    {speaking
                      ? "🔊 Speaking..."
                      : "🔊 Hear Language"}
                  </button>
                </article>
              );
            })}
          </section>
        )}

        <section className="bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl p-4 mt-6 text-sm">
          You can change the selected language later from
          Farmer Settings.
        </section>
      </main>
    </div>
  );
}