import { useEffect, useState } from "react";

import {
  getLanguage,
  languages,
  setLanguage,
  subscribeLanguageChange,
  t,
} from "../utils/language";

export default function LanguageSelector({
  compact = false,
  onLanguageChanged,
}) {
  const [currentLanguage, setCurrentLanguage] =
    useState(getLanguage());

  useEffect(() => {
    return subscribeLanguageChange((language) => {
      setCurrentLanguage(language);
    });
  }, []);

  function handleChange(event) {
    const language = setLanguage(event.target.value);

    setCurrentLanguage(language);

    if (typeof onLanguageChanged === "function") {
      onLanguageChanged(language);
    }
  }

  return (
    <label
      className={
        compact
          ? "inline-flex items-center gap-2"
          : "block"
      }
    >
      {!compact && (
        <span className="block text-sm font-semibold text-gray-700 mb-1">
          🌐 {t("selectLanguage")}
        </span>
      )}

      <select
        value={currentLanguage}
        onChange={handleChange}
        className={
          compact
            ? "border border-green-200 bg-white text-green-900 rounded-xl px-3 py-2 text-sm font-semibold"
            : "w-full border border-gray-300 bg-white rounded-xl px-4 py-3"
        }
      >
        {languages.map((language) => (
          <option
            key={language.code}
            value={language.code}
          >
            {language.nativeName} ({language.name})
          </option>
        ))}
      </select>
    </label>
  );
}
