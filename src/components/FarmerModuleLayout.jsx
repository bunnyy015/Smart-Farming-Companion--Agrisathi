import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { Mic } from "lucide-react";

import { auth, database } from "../firebase";
import useLanguage from "../utils/useLanguage";
import { t } from "../utils/language";
import { clearVoiceMemory } from "../utils/voiceMemory";
import { FarmerVoiceContext } from "./FarmerVoiceConversationContext";
import {
  clearFarmerVoiceConversation,
  loadFarmerVoiceConversation,
  saveFarmerVoiceConversation,
} from "../utils/voiceConversationStore";
import "./FarmerModuleLayout.css";

export default function FarmerModuleLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const language = useLanguage();
  const activeUidRef = useRef("");
  const [farmerUid, setFarmerUid] = useState("");
  const [isFarmer, setIsFarmer] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationLanguage, setConversationLanguage] = useState("");

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        const previousUid = activeUidRef.current;
        if (previousUid) clearFarmerVoiceConversation(previousUid);
        activeUidRef.current = "";
        clearVoiceMemory();
        setFarmerUid("");
        setIsFarmer(false);
        setMessages([]);
        setConversationLanguage("");
        return;
      }

      const currentUid = currentUser.uid;
      try {
        const userSnapshot = await get(ref(database, `users/${currentUid}`));
        if (!mounted || auth.currentUser?.uid !== currentUid) return;

        const role = String(userSnapshot.val()?.role || "").trim().toLowerCase();
        if (!userSnapshot.exists() || role !== "farmer") {
          const previousUid = activeUidRef.current;
          if (previousUid && previousUid !== currentUid) {
            clearFarmerVoiceConversation(previousUid);
            clearVoiceMemory();
            setMessages([]);
            setConversationLanguage("");
          }
          activeUidRef.current = "";
          setFarmerUid("");
          setIsFarmer(false);
          return;
        }

        if (activeUidRef.current !== currentUid) {
          const previousUid = activeUidRef.current;
          if (previousUid) clearFarmerVoiceConversation(previousUid);
          clearVoiceMemory();
          const savedConversation = loadFarmerVoiceConversation(currentUid);
          setMessages(savedConversation.messages);
          setConversationLanguage(savedConversation.language);
          activeUidRef.current = currentUid;
        }

        setFarmerUid(currentUid);
        setIsFarmer(true);
      } catch (error) {
        if (!mounted || auth.currentUser?.uid !== currentUid) return;
        console.warn("Unable to verify Farmer access for the voice button:", error);
        setIsFarmer(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isFarmer || !farmerUid || activeUidRef.current !== farmerUid) return;
    saveFarmerVoiceConversation(farmerUid, messages, conversationLanguage);
  }, [conversationLanguage, farmerUid, isFarmer, messages]);

  const clearConversation = useCallback(() => {
    if (farmerUid) clearFarmerVoiceConversation(farmerUid);
    setMessages([]);
    clearVoiceMemory();
  }, [farmerUid]);

  const conversation = useMemo(() => ({
    farmerUid,
    messages,
    setMessages,
    conversationLanguage,
    setConversationLanguage,
    clearConversation,
  }), [clearConversation, conversationLanguage, farmerUid, messages]);

  const openAssistant = () => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    navigate("/farmer/voice", { state: { returnTo } });
  };

  const showFloatingAssistant = isFarmer && location.pathname !== "/farmer/voice";

  return (
    <FarmerVoiceContext.Provider value={conversation}>
      <Outlet />
      {showFloatingAssistant && (
        <button
          type="button"
          className="farmer-voice-fab"
          style={{
            right: "calc(env(safe-area-inset-right, 0px) + 1.25rem)",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
          }}
          onClick={openAssistant}
          title={t("askAgriSaathi", {}, language)}
          aria-label={t("askAgriSaathi", {}, language)}
        >
          <span className="farmer-voice-fab__pulse" aria-hidden="true" />
          <Mic size={27} strokeWidth={2.3} aria-hidden="true" />
          <span className="farmer-voice-fab__tooltip" aria-hidden="true">
            {t("askAgriSaathi", {}, language)}
          </span>
        </button>
      )}
    </FarmerVoiceContext.Provider>
  );
}
