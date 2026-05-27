/**
 * useAtlas.js
 * ─────────────────────────────────────────────────────────────
 * Custom hook for the Atlas AI chat widget.
 *
 * Features:
 *   - Multi-turn chat with context injection
 *   - Memory awareness (preference count, new user detection)
 *   - Action tracking (shows when Atlas cancelled, refunded, etc)
 *   - Preference CRUD for settings page
 *
 * Drop into:  src/components/Atlas/useAtlas.js
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { useAtlasContext } from "./AtlasContext";

const getToken = () => localStorage.getItem("token");

export function useAtlas() {
  const { atlasContext } = useAtlasContext();

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Memory state ──
  const [memory, setMemory] = useState({
    preferenceCount: 0,
    isNewUser: true,
  });

  // ── Last actions Atlas performed (for UI indicators) ──
  // e.g. [{ tool: "cancel_booking", success: true }]
  const [lastActions, setLastActions] = useState(null);

  const isLoadingRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // ── Send a message ──────────────────────────────────────────
  const sendMessage = useCallback(
    async (text) => {
      if (!text?.trim() || isLoadingRef.current) return;

      setError(null);
      setLastActions(null);

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

        if (!token && import.meta.env.DEV) {
          console.warn(
            "[useAtlas] No token found. Atlas request will likely 401."
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
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            messages: payload,
            context: atlasContext,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.message || data?.error || "Atlas request failed."
          );
        }

        const atlasMsg = {
          id: `atlas-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          // Attach actions metadata to the message for rendering
          actions: data.actions || null,
        };

        setMessages((prev) => [...prev, atlasMsg]);

        // ── Update memory + actions state ──
        if (data.memory) setMemory(data.memory);
        if (data.actions) setLastActions(data.actions);
      } catch (err) {
        console.error("[Atlas] sendMessage error:", err.message);
        setError(err.message || "Atlas is unavailable. Please try again.");
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [atlasContext]
  );

  // ── Fetch stored preferences (settings page) ───────────────
  const fetchPreferences = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(apiUrl("/api/atlas/preferences"), {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error("[Atlas] fetchPreferences error:", err.message);
      return null;
    }
  }, []);

  // ── Delete one preference ──────────────────────────────────
  const removePreference = useCallback(async (preferenceId) => {
    try {
      const token = getToken();
      const res = await fetch(
        apiUrl(`/api/atlas/preferences/${preferenceId}`),
        {
          method: "DELETE",
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMemory((prev) => ({
        ...prev,
        preferenceCount: Math.max(0, prev.preferenceCount - 1),
      }));
      return true;
    } catch (err) {
      console.error("[Atlas] removePreference error:", err.message);
      return false;
    }
  }, []);

  // ── Clear all preferences ──────────────────────────────────
  const clearPreferences = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(apiUrl("/api/atlas/preferences"), {
        method: "DELETE",
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMemory({ preferenceCount: 0, isNewUser: false });
      return true;
    } catch (err) {
      console.error("[Atlas] clearPreferences error:", err.message);
      return false;
    }
  }, []);

  // ── Clear chat ─────────────────────────────────────────────
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setLastActions(null);
  }, []);

  return {
    // Chat
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,

    // Memory
    memory,
    fetchPreferences,
    removePreference,
    clearPreferences,

    // Actions (what Atlas did this turn)
    lastActions,
  };
}
