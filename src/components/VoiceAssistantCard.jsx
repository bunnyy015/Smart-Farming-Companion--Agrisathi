export default function VoiceAssistantCard({ onOpen }) {
  return (
    <section className="bg-white border border-green-100 rounded-3xl shadow-sm p-5 mt-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpen}
          className="w-24 h-24 shrink-0 rounded-full bg-gradient-to-br from-green-700 to-green-500 text-white text-4xl shadow-lg flex items-center justify-center active:scale-95 transition"
          aria-label="Open AgriSaathi voice assistant"
        >
          🎤
        </button>

        <div className="min-w-0">
          <h2 className="text-xl font-bold text-green-900">
            Ask AgriSaathi
          </h2>

          <p className="text-sm text-gray-600 mt-1">
            Tap the microphone and speak in your language.
          </p>

          <button
            type="button"
            onClick={onOpen}
            className="text-sm font-bold text-green-700 mt-3"
          >
            Start Speaking →
          </button>
        </div>
      </div>
    </section>
  );
}