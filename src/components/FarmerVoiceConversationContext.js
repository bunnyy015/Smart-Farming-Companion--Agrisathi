import { createContext, useContext } from "react";

export const FarmerVoiceContext = createContext(null);

export function useFarmerVoiceConversation() {
  const context = useContext(FarmerVoiceContext);
  if (!context) {
    throw new Error("Voice conversation state requires the Farmer module layout.");
  }
  return context;
}
