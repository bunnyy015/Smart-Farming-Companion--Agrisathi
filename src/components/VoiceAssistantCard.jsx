import { useEffect, useState } from "react";
import { Mic } from "lucide-react";

import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from "../utils/language";

export default function VoiceAssistantCard({ onOpen }) {
  const [language, setCurrentLanguage] = useState(
    getLanguage()
  );

  useEffect(() => {
    return subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });
  }, []);

  return (
    <section className="dashboard-voice-card relative isolate flex min-h-[270px] min-w-0 items-center overflow-hidden rounded-2xl border border-[var(--agri-border)] p-4 shadow-sm sm:p-5">
      <div className="relative z-10 flex min-w-0 items-center gap-3 sm:gap-5">
        <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full bg-green-100/70 ring-8 ring-green-50/70 sm:h-24 sm:w-24">
          <button
            type="button"
            onClick={onOpen}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-700 to-green-500 text-white shadow-lg transition hover:from-green-800 hover:to-green-600 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-300 sm:h-20 sm:w-20"
            aria-label={t("openVoiceAssistant", {}, language)}
          >
            <Mic size={34} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <div className="max-w-[68%] min-w-0 sm:max-w-[58%]">
          <h2 className="text-lg font-bold text-[var(--agri-text)] sm:text-xl">
            {t("askAgriSaathi", {}, language)}
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--agri-muted)]">
            {t(
              "speakInYourLanguage",
              {},
              language
            )}
          </p>

          <button
            type="button"
            onClick={onOpen}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-green-600 px-4 text-sm font-bold text-green-800 transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
          >
            <Mic size={16} aria-hidden="true" /> {t("startSpeaking", {}, language)} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
