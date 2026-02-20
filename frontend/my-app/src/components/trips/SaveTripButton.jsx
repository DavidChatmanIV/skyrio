import React from "react";
import { requireAuthOrOpenModal } from "../../auth/requireAuth";
import { useAuth } from "../../auth/useAuth";
import { useAuthModal } from "../../auth/useAuthModal";

export default function SaveTripButton() {
  const auth = useAuth();
  const { openAuthModal } = useAuthModal();

  function onSave() {
    const ok = requireAuthOrOpenModal({
      auth,
      openAuth: openAuthModal,
      intent: "save",
      redirectTo: "/booking",
    });

    if (!ok) return;

    // ✅ perform save
  }

  return <button onClick={onSave}>Save Trip</button>;
}
