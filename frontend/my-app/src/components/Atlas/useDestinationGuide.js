import { useState, useCallback, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "";
const getToken = () => localStorage.getItem("token");

export function useDestinationGuide() {
  const [guide, setGuide] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const isLoadingRef = useRef(false);

  const fetchGuide = useCallback(async (destination) => {
    if (!destination?.trim() || isLoadingRef.current) return null;

    setError(null);
    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const token = getToken();

      const res = await fetch(`${API}/api/atlas/destination-guide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ destination: destination.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || data?.message || "Destination guide request failed."
        );
      }

      setGuide(data.guide);
      return data.guide;
    } catch (err) {
      console.error("[useDestinationGuide] fetchGuide error:", err.message);
      setError(err.message || "Atlas is unavailable. Please try again.");
      return null;
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const clearGuide = useCallback(() => {
    setGuide(null);
    setError(null);
  }, []);

  return {
    guide,
    isLoading,
    error,
    fetchGuide,
    clearGuide,
  };
}
