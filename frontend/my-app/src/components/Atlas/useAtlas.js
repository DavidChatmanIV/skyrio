/**
 * ─────────────────────────────────────────────────────────────
 * Custom hook for all Atlas AI interactions.
 * Sends real booking context (flights, budget, destination)
 * alongside every message so Atlas gives specific advice.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef } from "react";
import { useApi } from "@/lib/api";
import { useAtlasContext } from "./AtlasContext";

export function useAtlas() {
  const api = useApi();
  const { atlasContext } = useAtlasContext();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ref guard — prevents rapid-fire double sends without
  // putting isLoading in the useCallback dependency array
  const isLoadingRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const sendMessage = useCallback(
    async (text) => {
      if (!text?.trim() || isLoadingRef.current) return;

      setError(null);

      const userMsg = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };

      const updatedHistory = [...messagesRef.current, userMsg];
      setMessages(updatedHistory);

      isLoadingRef.current = true;
      setIsLoading(true);

      try {
        const payload = updatedHistory.map(({ role, content }) => ({
          role,
          content,
        }));

        // Send real booking context alongside conversation history.
        // The backend builds a dynamic system prompt from this data
        // so Atlas can say "I found 3 flights under $800" etc.
        const data = await api.post("/api/atlas/chat", {
          messages: payload,
          context: atlasContext,
        });

        const atlasMsg = {
          id: `atlas-${Date.now()}`,
          role: "assistant",
          content: data.reply,
        };

        setMessages((prev) => [...prev, atlasMsg]);
      } catch (err) {
        setError(err.message || "Atlas is unavailable. Please try again.");
        // Roll back optimistic user message on failure
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [api, atlasContext] // atlasContext in deps so latest data is always used
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat };
}