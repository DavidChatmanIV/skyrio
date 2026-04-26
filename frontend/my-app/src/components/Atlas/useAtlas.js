import { useState, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { useAtlasContext } from "./AtlasContext";

// ─── Token helper ─────────────────────────────────────────────
// Matches exactly how LoginPage.jsx stores it
const getToken = () => localStorage.getItem("token");

export function useAtlas() {
  const { atlasContext } = useAtlasContext();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
        const token = getToken();

        // Warn in dev if token is missing — saves debugging time
        if (!token && import.meta.env.DEV) {
          console.warn(
            "[useAtlas] No token found in localStorage. Atlas request will likely 401."
          );
        }

        const payload = updatedHistory.map(({ role, content }) => ({
          role,
          content,
        }));

        const res = await fetch(apiUrl("/api/atlas/chat"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // ✅ Fixed: was missing — caused requireAuth to return 401
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            messages: payload,
            context: atlasContext,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          // Surface the actual backend message instead of generic fallback
          throw new Error(
            data?.message || data?.error || "Atlas request failed."
          );
        }

        const atlasMsg = {
          id: `atlas-${Date.now()}`,
          role: "assistant",
          content: data.reply,
        };

        setMessages((prev) => [...prev, atlasMsg]);
      } catch (err) {
        console.error("[Atlas] sendMessage error:", err.message);
        setError(err.message || "Atlas is unavailable. Please try again.");

        // Rollback optimistic user message
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [atlasContext]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat };
}
