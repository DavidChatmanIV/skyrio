import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * useAuth()
 *
 * Primary hook for accessing auth state and actions.
 * Use this everywhere instead of importing AuthContext directly.
 *
 * Shape:
 *   user              — null | { _id, id, name, username, email, level, ... }
 *   token             — null | string
 *   isAuthed          — boolean (true = has token + user)
 *   isGuest           — boolean (true = explicitly chose guest mode)
 *   loading           — boolean (true during initial hydration — wait before gating)
 *
 *   setSession()      — call after login/register with { token, user }
 *   logout()          — clears token, user, guest flag
 *   login()           — async POST /api/auth/login
 *   signup()          — async POST /api/auth/register
 *   available()       — async GET  /api/auth/available
 *   continueAsGuest() — sets guest mode, clears any session
 *   setUser()         — update user object (e.g. after profile edit)
 *   setToken()        — update token directly if needed
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used inside <AuthProvider>");
  }
  return ctx;
}

/**
 * useIsGuest()
 * Returns true if the user is in guest mode.
 */
export function useIsGuest() {
  return useAuth().isGuest;
}

/**
 * useIsAuthed()
 * Returns true if fully authenticated.
 */
export function useIsAuthed() {
  return useAuth().isAuthed;
}