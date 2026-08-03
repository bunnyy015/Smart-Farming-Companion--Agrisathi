import {
  t,
  getLanguage,
  subscribeLanguageChange,
} from "./language";

let currentLanguage = getLanguage();

subscribeLanguageChange((language) => {
  currentLanguage = language;
});

export function appText(key, variables = {}) {
  return t(key, variables, currentLanguage);
}

export function currentAppLanguage() {
  return currentLanguage;
}

export function isTelugu() {
  return currentLanguage === "te";
}

export function isHindi() {
  return currentLanguage === "hi";
}

export function isEnglish() {
  return currentLanguage === "en";
}

export function isTamil() {
  return currentLanguage === "ta";
}

export function isKannada() {
  return currentLanguage === "kn";
}

export function isMalayalam() {
  return currentLanguage === "ml";
}

export function isMarathi() {
  return currentLanguage === "mr";
}

export function isGujarati() {
  return currentLanguage === "gu";
}

export function isPunjabi() {
  return currentLanguage === "pa";
}

export function isBengali() {
  return currentLanguage === "bn";
}

export function isUrdu() {
  return currentLanguage === "ur";
}

export function isOdia() {
  return currentLanguage === "or";
}