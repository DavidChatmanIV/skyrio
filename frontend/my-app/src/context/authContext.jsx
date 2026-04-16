import { createContext } from "react";

/**
 * AuthContext
 *
 * Just the raw context object — nothing else.
 * Provider → src/auth/AuthProvider.jsx
 * Hook    → src/auth/useAuth.js
 */
export const AuthContext = createContext(null);