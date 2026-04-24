import { useState, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { useAtlasContext } from "./AtlasContext";

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
        const payload = updatedHistory.map(({ role, content }) => ({
          role,
          content,
        }));

        const res = await fetch(apiUrl("/atlas/chat"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: payload,
            context: atlasContext,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || "Atlas request failed.");
        }

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
    [atlasContext]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat };
}
