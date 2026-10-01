import { useEffect, useState } from "react";
import { getLanguage, subscribeLanguageChange } from "./language";

/** Subscribe a page or shared component to the app-wide persisted language. */
export default function useLanguage() {
  const [language, setCurrentLanguage] = useState(getLanguage);

  useEffect(
    () => subscribeLanguageChange(setCurrentLanguage),
    []
  );

  return language;
}
