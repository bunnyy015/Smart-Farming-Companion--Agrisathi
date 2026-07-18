import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { detectVoiceIntent, getSpeechLanguage } from "../../utils/voiceIntent";

export default function VoiceAssistantPage() {
  const navigate = useNavigate();

  const [listening, setListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [assistantReply, setAssistantReply] = useState(
    "Press the microphone and speak your farming problem."
  );

  const [language, setLanguage] = useState(
    localStorage.getItem("language") ||
      localStorage.getItem("selectedLanguage") ||
      "english"
  );

  function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLanguage(language);
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function handleLanguageChange(event) {
    const selected = event.target.value;
    setLanguage(selected);
    localStorage.setItem("language", selected);

    const message = "Language changed. Press microphone and speak.";
    setAssistantReply(message);
    speak(message);
  }

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const message =
        "Voice recognition is not supported in this browser. Please use Google Chrome.";
      setAssistantReply(message);
      speak(message);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = getSpeechLanguage(language);
    recognition.continuous = false;
    recognition.interimResults = false;

    setListening(true);
    setSpokenText("");
    setAssistantReply("Listening...");

    recognition.start();

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setSpokenText(text);

      const result = detectVoiceIntent(text);

      setAssistantReply(result.reply);
      speak(result.reply);

      if (result.path) {
        setTimeout(() => {
          navigate(result.path);
        }, 1200);
      }
    };

    recognition.onerror = () => {
      const message =
        "Sorry, I could not hear clearly. Please try again.";
      setAssistantReply(message);
      speak(message);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };
  }

  function speakHelp() {
    const message =
      "You can say weather, crop disease, seeds, fertilizer, market price, animal care, irrigation, SOS, or profile.";
    setAssistantReply(message);
    speak(message);
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-green-700 text-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm mb-3"
          >
            ← Back to Dashboard
          </button>

          <h1 className="text-4xl font-bold">
            🎤 AgriSaathi AI Voice Agent
          </h1>

          <p className="text-green-100 mt-2">
            Speak in your language. The assistant will open the correct farming service.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Speaking Language
          </label>

          <select
            value={language}
            onChange={handleLanguageChange}
            className="w-full border border-gray-300 rounded-lg p-3"
          >
            <option value="english">English</option>
            <option value="telugu">Telugu</option>
            <option value="hindi">Hindi</option>
            <option value="kannada">Kannada</option>
            <option value="tamil">Tamil</option>
            <option value="malayalam">Malayalam</option>
            <option value="marathi">Marathi</option>
            <option value="bengali">Bengali</option>
            <option value="gujarati">Gujarati</option>
            <option value="punjabi">Punjabi</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <button
            onClick={startListening}
            disabled={listening}
            className={`w-40 h-40 rounded-full text-6xl shadow-lg ${
              listening
                ? "bg-red-600 text-white animate-pulse"
                : "bg-green-700 text-white hover:bg-green-800"
            }`}
          >
            🎤
          </button>

          <h2 className="text-2xl font-bold text-green-700 mt-6">
            {listening ? "Listening..." : "Tap and Speak"}
          </h2>

          <p className="text-gray-600 mt-2">
            Say: “weather”, “crop disease”, “I need fertilizer”, “market price”, or “emergency help”.
          </p>

          {spokenText && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6 text-left">
              <h3 className="font-bold text-green-700">
                You Said:
              </h3>

              <p className="text-gray-700 mt-1">
                {spokenText}
              </p>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6 text-left">
            <h3 className="font-bold text-yellow-800">
              Assistant Reply:
            </h3>

            <p className="text-yellow-800 mt-1">
              {assistantReply}
            </p>
          </div>

          <button
            onClick={speakHelp}
            className="mt-6 border border-green-700 text-green-700 px-5 py-3 rounded-lg font-semibold"
          >
            🔊 Speak Help
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
          <h2 className="text-2xl font-bold text-green-700 mb-4">
            Example Voice Commands
          </h2>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="border rounded-xl p-4">
              🌦 Weather / వాతావరణం / मौसम
            </div>

            <div className="border rounded-xl p-4">
              🌾 Crop disease / పంట వ్యాధి / फसल रोग
            </div>

            <div className="border rounded-xl p-4">
              🏪 I need fertilizer / ఎరువు కావాలి / खाद चाहिए
            </div>

            <div className="border rounded-xl p-4">
              📈 Market price / మార్కెట్ ధర / बाजार भाव
            </div>

            <div className="border rounded-xl p-4">
              🐄 My cow is sick / ఆవు అనారోగ్యం / गाय बीमार है
            </div>

            <div className="border rounded-xl p-4">
              🚨 Emergency help / సహాయం / मदद
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}