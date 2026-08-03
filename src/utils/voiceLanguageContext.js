import { getLanguageProfile } from "./languageProfile";

const MAX_LEARNED_WORDS = 20;
const MAX_RECENT_PHRASES = 8;

function cleanText(value, maximumLength = 120) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function getSafeLearnedWords(learnedWords) {
  if (
    !learnedWords ||
    typeof learnedWords !== "object" ||
    Array.isArray(learnedWords)
  ) {
    return [];
  }

  return Object.entries(learnedWords)
    .slice(-MAX_LEARNED_WORDS)
    .map(([spokenWord, meaning]) => ({
      spokenWord: cleanText(spokenWord, 50),
      meaning: cleanText(meaning, 100),
    }))
    .filter(
      (item) =>
        item.spokenWord.length > 0 &&
        item.meaning.length > 0
    );
}

function getSafeRecentPhrases(commonPhrases) {
  if (!Array.isArray(commonPhrases)) {
    return [];
  }

  return commonPhrases
    .slice(-MAX_RECENT_PHRASES)
    .map((phrase) => cleanText(phrase))
    .filter(Boolean);
}

export function getVoiceLanguageContext() {
  const profile = getLanguageProfile();

  return {
    preferredLanguage:
      cleanText(profile.preferredLanguage, 10) || "en",

    responseStyle:
      cleanText(profile.responseStyle, 30) || "simple",

    learnedWords: getSafeLearnedWords(
      profile.learnedWords
    ),

    recentPhrases: getSafeRecentPhrases(
      profile.commonPhrases
    ),
  };
}

export function createVoiceLanguagePrompt() {
  const context = getVoiceLanguageContext();

  const learnedWordsText =
    context.learnedWords.length > 0
      ? context.learnedWords
          .map(
            ({ spokenWord, meaning }) =>
              `${spokenWord} means ${meaning}`
          )
          .join("; ")
      : "No saved vocabulary yet.";

  const recentPhrasesText =
    context.recentPhrases.length > 0
      ? context.recentPhrases.join(" | ")
      : "No previous phrases available.";

  return `
Farmer language profile:

Preferred language code:
${context.preferredLanguage}

Preferred response style:
${context.responseStyle}

Previously learned local words:
${learnedWordsText}

Recent speaking examples:
${recentPhrasesText}

Instructions:
- Use this profile only as a helpful language clue.
- The farmer may use regional slang or mix Indian languages with English.
- Understand the intended farming meaning.
- Do not mention dialect detection to the farmer.
- Do not repeat private conversation history unnecessarily.
- Reply using simple and respectful language.
`.trim();
}