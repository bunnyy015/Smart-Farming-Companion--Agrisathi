const STORAGE_PREFIX = "agrisathiVoiceConversation_";
const MAX_CONVERSATION_MESSAGES = 40;

function storageKey(farmerUid) {
  return `${STORAGE_PREFIX}${farmerUid}`;
}

function normalizeMessages(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message) => (
      message &&
      (message.role === "farmer" || message.role === "assistant") &&
      typeof message.text === "string" &&
      message.text.trim()
    ))
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((message, index) => ({
      id: typeof message.id === "string" && message.id
        ? message.id
        : `restored-${index}-${Number(message.createdAt) || Date.now()}`,
      role: message.role,
      text: message.text,
      createdAt: Number.isFinite(Number(message.createdAt))
        ? Number(message.createdAt)
        : Date.now(),
    }));
}

export function loadFarmerVoiceConversation(farmerUid) {
  if (!farmerUid || typeof window === "undefined") {
    return { messages: [], language: "" };
  }

  try {
    const saved = window.sessionStorage.getItem(storageKey(farmerUid));
    if (!saved) return { messages: [], language: "" };
    const parsed = JSON.parse(saved);
    return {
      messages: normalizeMessages(parsed?.messages),
      language: typeof parsed?.language === "string" ? parsed.language : "",
    };
  } catch (error) {
    console.warn("Unable to restore the farmer voice conversation:", error);
    return { messages: [], language: "" };
  }
}

export function saveFarmerVoiceConversation(farmerUid, messages, language) {
  if (!farmerUid || typeof window === "undefined") return;

  try {
    const normalizedMessages = normalizeMessages(messages);
    if (normalizedMessages.length === 0) {
      window.sessionStorage.removeItem(storageKey(farmerUid));
      return;
    }

    window.sessionStorage.setItem(storageKey(farmerUid), JSON.stringify({
      messages: normalizedMessages,
      language: typeof language === "string" ? language : "",
      updatedAt: Date.now(),
    }));
  } catch (error) {
    console.warn("Unable to save the farmer voice conversation:", error);
  }
}

export function clearFarmerVoiceConversation(farmerUid) {
  if (!farmerUid || typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(storageKey(farmerUid));
  } catch (error) {
    console.warn("Unable to clear the farmer voice conversation:", error);
  }
}
