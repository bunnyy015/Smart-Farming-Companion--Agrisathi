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

function readPartialReply(jsonText) {
  const keyMatch = /"reply"\s*:\s*"/u.exec(jsonText);
  if (!keyMatch) return null;
  const start = keyMatch.index + keyMatch[0].length;
  let escaped = false;
  let raw = "";
  for (let index = start; index < jsonText.length; index += 1) {
    const character = jsonText[index];
    if (!escaped && character === '"') {
      try { return JSON.parse(`"${raw}"`); } catch { return null; }
    }
    raw += character;
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
  }

  // Decode an incomplete JSON string prefix without exposing a dangling escape.
  let safeRaw = raw.replace(/\\$/u, "");
  safeRaw = safeRaw.replace(/\\u[\da-f]{0,3}$/iu, "");
  try { return JSON.parse(`"${safeRaw}"`); } catch { return null; }
}

async function requestStreamingReply({ model, prompt, apiKey, signal, onReplyText }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
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
  if (!response.ok) throw new Error(`Gemini ${model} streaming failed: ${response.status}`);
  if (!response.body) throw new Error("Gemini streaming response has no readable body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let generated = "";
  let lastReply = "";
  const consumeEvent = (eventText) => {
    const data = eventText.split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data);
    const delta = (event?.candidates?.[0]?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("");
    if (!delta) return;
    generated += delta;
    const partialReply = readPartialReply(generated);
    if (partialReply !== null && partialReply.length > lastReply.length) {
      lastReply = partialReply;
      onReplyText?.(lastReply);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/u);
      buffer = events.pop() || "";
      for (const eventText of events) consumeEvent(eventText);
      if (done) break;
    }
    if (buffer.trim()) consumeEvent(buffer);
  } catch (error) {
    error.streamedReply = Boolean(lastReply);
    throw error;
  }

  const parsed = parseModelResponse(generated);
  const reply = String(parsed.reply || "").trim();
  if (!reply) throw new Error("Gemini returned no reply.");
  if (reply !== lastReply) onReplyText?.(reply);
  return parsed;
}

/** Sends one already-built assistant prompt to Gemini and validates its JSON reply. */
export async function requestVoiceAssistantResponse({
  prompt,
  languageCode = "en",
  supportedLanguages = ["en"],
  signal,
  onReplyText,
}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY is missing.");
  }

  let lastError;
  const [streamingModel] = MODELS;
  if (onReplyText) {
    try {
      const parsed = await requestStreamingReply({
        model: streamingModel,
        prompt,
        apiKey,
        signal,
        onReplyText,
      });
      const action = ALLOWED_ACTIONS.has(parsed.action) ? parsed.action : "none";
      return {
        reply: String(parsed.reply || "").trim(),
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
      lastError = error;
      console.warn(`Gemini ${streamingModel} streaming request failed:`, error);
      // Do not retry after partial text has escaped to speech or the UI.
      if (error?.streamedReply) throw error;
    }
  }

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
