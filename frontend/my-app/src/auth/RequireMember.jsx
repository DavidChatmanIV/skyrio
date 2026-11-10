import React from "react";
import SoftBlock from "../components/SoftBlock";
import { useAuth } from "./useAuth";

export default function RequireMember({ children }) {
  const auth = useAuth();

  const isAuthed = !!auth?.isAuthed;
  const isGuest = !!auth?.isGuest;

  // Not logged in
  if (!isAuthed) {
    return (
      <SoftBlock
        title="Create an account to access your Digital Passport"
        subtitle="Your Passport saves XP, badges, trips, and profile perks across Skyrio."
        primaryLabel="Sign up"
        primaryIntent="signup"
        secondaryLabel="Log in"
        secondaryIntent="login"
      />
    );
  }

  // Guest mode
  if (isGuest) {
    return (
      <SoftBlock
        title="Guest mode can't access Passport"
        subtitle="Create an account to unlock your Digital Passport and keep progress saved."
        primaryLabel="Create account"
        primaryIntent="signup"
        secondaryLabel="Log in"
        secondaryIntent="login"
        badge="Guest Mode"
      />
    );
  }

  return children;
}