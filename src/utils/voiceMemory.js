const MAX_MESSAGES = 8;

let conversationMemory = [];

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function isValidRole(role) {
  return role === "farmer" || role === "assistant";
}

export function addVoiceMessage(role, message) {
  const cleanedMessage = cleanText(message);

  if (!isValidRole(role) || !cleanedMessage) {
    return;
  }

  conversationMemory.push({
    role,
    message: cleanedMessage,
    createdAt: Date.now(),
  });

  if (conversationMemory.length > MAX_MESSAGES) {
    conversationMemory = conversationMemory.slice(-MAX_MESSAGES);
  }
}

export function addFarmerMessage(message) {
  addVoiceMessage("farmer", message);
}

export function addAssistantMessage(message) {
  addVoiceMessage("assistant", message);
}

export function getVoiceMemory() {
  return conversationMemory.map((item) => ({
    ...item,
  }));
}

export function getVoiceMemoryForPrompt() {
  if (conversationMemory.length === 0) {
    return "No previous conversation in this session.";
  }

  return conversationMemory
    .map((item) => {
      const speaker =
        item.role === "farmer"
          ? "Farmer"
          : "AgriSaathi";

      return `${speaker}: ${item.message}`;
    })
    .join("\n");
}

export function clearVoiceMemory() {
  conversationMemory = [];
}

export function getVoiceMemorySize() {
  return conversationMemory.length;
}