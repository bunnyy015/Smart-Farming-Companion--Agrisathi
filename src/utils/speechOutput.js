const LANGUAGE_LOCALES = {
  en: "en-IN",
  te: "te-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  ur: "ur-IN",
  or: "or-IN",
};

const VOICE_WAIT_TIMEOUT_MS = 3500;
let speechRequestId = 0;
let activeAudio = null;
let activeAudioUrl = null;
let activeTtsController = null;
let activeAudioStop = null;

function stopActiveAudio(status = "cancelled") {
  activeAudioStop?.(status);
}

function getLanguageCode(languageCode) {
  const normalized = String(languageCode || "en")
    .trim()
    .toLowerCase();
  const code = normalized.split(/[-_]/u)[0];
  return LANGUAGE_LOCALES[code] ? code : "en";
}

function normalizeLocale(locale) {
  return String(locale || "").trim().toLowerCase().replaceAll("_", "-");
}

function findCompatibleVoice(voices, locale) {
  const requested = normalizeLocale(locale);
  const languageCode = requested.split("-")[0];
  const compatible = voices.filter((voice) => {
    const voiceLocale = normalizeLocale(voice?.lang);
    return voiceLocale === languageCode || voiceLocale.startsWith(`${languageCode}-`);
  });

  return (
    compatible.find((voice) => normalizeLocale(voice.lang) === requested) ||
    compatible.find((voice) => voice.default) ||
    compatible[0] ||
    null
  );
}

function waitForCompatibleVoice(synthesis, locale) {
  const initialVoice = findCompatibleVoice(synthesis.getVoices(), locale);
  if (initialVoice) return Promise.resolve(initialVoice);

  return new Promise((resolve) => {
    let settled = false;
    let intervalId;
    let timeoutId;

    const cleanup = () => {
      synthesis.removeEventListener?.("voiceschanged", check);
      if (intervalId) window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };

    const finish = (voice) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(voice);
    };

    const check = () => {
      try {
        const voice = findCompatibleVoice(synthesis.getVoices(), locale);
        if (voice) finish(voice);
      } catch {
        finish(null);
      }
    };

    synthesis.addEventListener?.("voiceschanged", check);
    // A few browser engines expose voices asynchronously without firing the
    // event consistently, so poll briefly as well.
    intervalId = window.setInterval(check, 150);
    timeoutId = window.setTimeout(
      () => finish(null),
      VOICE_WAIT_TIMEOUT_MS
    );
    check();
  });
}

export function cancelSpeech() {
  speechRequestId += 1;
  activeTtsController?.abort();
  activeTtsController = null;
  stopActiveAudio();
  try {
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
  } catch {
    // Ignore browser speech cancellation errors.
  }
}

function extractAudioData(responseData) {
  if (typeof responseData?.output_audio?.data === "string") {
    return responseData.output_audio.data;
  }

  for (const step of responseData?.steps || []) {
    for (const item of step?.content || []) {
      if (item?.type === "audio" && typeof item.data === "string") {
        return item.data;
      }
    }
  }

  return "";
}

async function speakWithGeminiTts(text, requestId, { rate, volume, onStart }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return { status: "cloud-error", reason: "missing-key" };

  const controller = new AbortController();
  activeTtsController = controller;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash-lite-tts",
          store: false,
          input: [{
            type: "user_input",
            content: [{ type: "text", text: String(text) }],
          }],
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice: "Kore" }] },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini speech request failed (${response.status}).`);
    }

    const responseData = await response.json();
    const encodedAudio = extractAudioData(responseData);
    if (!encodedAudio) throw new Error("Gemini returned no audio data.");
    if (requestId !== speechRequestId) return { status: "cancelled" };

    const binary = atob(encodedAudio);
    const audioBytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      audioBytes[index] = binary.charCodeAt(index);
    }

    activeAudioUrl = URL.createObjectURL(
      new Blob([audioBytes], { type: "audio/wav" })
    );
    const audio = new Audio(activeAudioUrl);
    activeAudio = audio;
    audio.volume = volume;
    audio.playbackRate = rate;

    return await new Promise((resolve) => {
      let settled = false;
      const finish = (status) => {
        if (settled) return;
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        audio.onplay = null;
        if (status !== "spoken") {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        }
        if (activeAudio === audio) activeAudio = null;
        activeAudioStop = null;
        if (activeAudioUrl) {
          URL.revokeObjectURL(activeAudioUrl);
          activeAudioUrl = null;
        }
        resolve({ status });
      };

      activeAudioStop = finish;
      audio.onended = () => finish("spoken");
      audio.onerror = () => finish("cloud-error");
      audio.onplay = () => onStart?.();
      audio.play().catch(() => finish("cloud-error"));
    });
  } catch (error) {
    if (error?.name === "AbortError") return { status: "cancelled" };
    console.error("Gemini speech synthesis failed:", error);
    return { status: "cloud-error" };
  } finally {
    if (activeTtsController === controller) activeTtsController = null;
  }
}

/** Speak only with a voice whose advertised language matches the selection. */
export async function speakLocalizedText(
  text,
  selectedLanguage = "en",
  { rate = 1, pitch = 1, volume = 1, onStart } = {}
) {
  if (!text) return { status: "empty" };
  if (typeof window === "undefined") {
    return { status: "unsupported" };
  }

  const requestId = ++speechRequestId;
  const languageCode = getLanguageCode(selectedLanguage);
  const locale = LANGUAGE_LOCALES[languageCode];
  const synthesis = window.speechSynthesis;

  activeTtsController?.abort();
  activeTtsController = null;
  stopActiveAudio();
  try {
    synthesis?.cancel();
  } catch {
    // Ignore stale utterance cancellation errors.
  }

  let voice;
  if (synthesis) {
    try {
      voice = await waitForCompatibleVoice(synthesis, locale);
    } catch {
      voice = null;
    }
  }

  if (requestId !== speechRequestId) {
    return { status: "cancelled" };
  }

  if (
    !synthesis ||
    !voice ||
    !findCompatibleVoice([voice], locale)
  ) {
    const remoteResult = await speakWithGeminiTts(text, requestId, {
      rate,
      volume,
      onStart,
    });
    return { ...remoteResult, languageCode, locale };
  }

  let utterance;
  try {
    utterance = new SpeechSynthesisUtterance(String(text));
  } catch {
    return { status: "unsupported", languageCode, locale };
  }

  utterance.lang = locale;
  utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      resolve({ status, languageCode, locale, voice: voice.name });
    };

    utterance.onstart = () => onStart?.();
    utterance.onend = () => finish("spoken");
    utterance.onerror = (event) => {
      finish(event?.error === "canceled" ? "cancelled" : "error");
    };

    try {
      synthesis.speak(utterance);
    } catch {
      finish("error");
    }
  });
}
