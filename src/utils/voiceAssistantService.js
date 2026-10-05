import { VOICE_ACTION_ROUTES } from "./voiceLocalCommands";

// Older 2.5 endpoints may return 404 for newly created API users.
// Keep a current stable endpoint first and an alias as an availability fallback.
const MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-3.8-flash",
];
const ALLOWED_ACTIONS = new Set([
  "none",
  ...Object.keys(VOICE_ACTION_ROUTES),
]);

function parseModelResponse(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

/** Sends one already-built assistant prompt to Gemini and validates its JSON reply. */
export async function requestVoiceAssistantResponse({
  prompt,
  languageCode = "en",
  supportedLanguages = ["en"],
  signal,
}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY is missing.");
  }

  let lastError;
  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 220,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini ${model} failed: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText?.trim()) {
        throw new Error("Gemini returned an empty response.");
      }

      const parsed = parseModelResponse(generatedText);
      const reply = String(parsed.reply || "").trim();
      if (!reply) throw new Error("Gemini returned no reply.");

      const action = ALLOWED_ACTIONS.has(parsed.action) ? parsed.action : "none";
      return {
        reply,
        languageCode: supportedLanguages.includes(parsed.languageCode)
          ? parsed.languageCode
          : languageCode,
        action,
        searchQuery: ["dealer_products", "product_details"].includes(action)
          ? String(parsed.searchQuery || "").trim().slice(0, 100)
          : "",
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      console.warn(`Gemini ${model} request failed:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to get a response from Gemini.");
}
