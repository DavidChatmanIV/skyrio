/**
 * ─────────────────────────────────────────────────────────────
 * Custom hook for all Atlas AI interactions.
 * Wraps /api/atlas/chat using Skyrio's useApi() hook.
 * Never import atlasService.js here — frontend talks to backend only.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef } from "react";
import { useApi } from "@/lib/api";

export function useAtlas() {
  const api = useApi();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // FIX: use a ref to guard against rapid sends instead of putting
  // isLoading in the useCallback dependency array — that was causing
  // sendMessage to recreate on every loading state change, leading
  // to race conditions when users sent messages quickly.
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

        const data = await api.post("/api/atlas/chat", { messages: payload });

        const atlasMsg = {
          id: `atlas-${Date.now()}`,
          role: "assistant",
          content: data.reply,
        };

        setMessages((prev) => [...prev, atlasMsg]);
      } catch (err) {
        setError(err.message || "Atlas is unavailable. Please try again.");
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [api] // ← isLoading removed — ref handles the guard now
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat };
}