const STORAGE_KEY = "agrisathi-language-profile";

const DEFAULT_PROFILE = {
  preferredLanguage: "en",

  speechLocale: "en-IN",

  responseStyle: "simple",

  learnedWords: {},

  commonPhrases: [],

  lastLanguage: "en",

  updatedAt: null,
};

export function getLanguageProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return { ...DEFAULT_PROFILE };
    }

    return {
      ...DEFAULT_PROFILE,
      ...JSON.parse(saved),
    };
  } catch (error) {
    console.error("Language Profile Error:", error);

    return { ...DEFAULT_PROFILE };
  }
}

export function saveLanguageProfile(profile) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...profile,
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    console.error(error);
  }
}

export function setPreferredLanguage(language) {
  const profile = getLanguageProfile();

  profile.preferredLanguage = language;
  profile.lastLanguage = language;

  saveLanguageProfile(profile);
}

export function getPreferredLanguage() {
  return getLanguageProfile().preferredLanguage;
}

export function setSpeechLocale(locale) {
  const profile = getLanguageProfile();

  profile.speechLocale = locale;

  saveLanguageProfile(profile);
}

export function getSpeechLocale() {
  return getLanguageProfile().speechLocale;
}

export function rememberWord(spokenWord, meaning) {
  if (!spokenWord || !meaning) return;

  const profile = getLanguageProfile();

  profile.learnedWords[spokenWord.toLowerCase()] = meaning;

  saveLanguageProfile(profile);
}

export function getRememberedWord(word) {
  if (!word) return null;

  const profile = getLanguageProfile();

  return (
    profile.learnedWords[word.toLowerCase()] || null
  );
}

export function rememberPhrase(sentence) {
  if (!sentence) return;

  const profile = getLanguageProfile();

  if (!profile.commonPhrases.includes(sentence)) {
    profile.commonPhrases.push(sentence);

    if (profile.commonPhrases.length > 50) {
      profile.commonPhrases.shift();
    }

    saveLanguageProfile(profile);
  }
}

export function getCommonPhrases() {
  return getLanguageProfile().commonPhrases;
}

export function clearLanguageProfile() {
  localStorage.removeItem(STORAGE_KEY);
}