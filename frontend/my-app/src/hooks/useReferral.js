import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useReferral
 *
 * Drop this into PublicPassportPage (/u/:username).
 * Reads the ?ref= param from the URL and stores it in
 * sessionStorage so RegisterPage can pick it up later.
 *
 * Usage:
 *   import useReferral from "@/hooks/useReferral";
 *   // inside PublicPassportPage component:
 *   useReferral();
 */
export default function useReferral() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && typeof ref === "string" && ref.trim().length > 0) {
      try {
        sessionStorage.setItem("skyrio_ref", ref.trim().toLowerCase());
      } catch {}
    }
  }, [searchParams]);
}
