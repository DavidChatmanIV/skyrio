import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

export default function useAdminSession() {
  const [state, setState] = useState({
    loading: true,
    isAdmin: false,
    admin: null,
  });

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/me"), {
          credentials: "include",
        });
        const data = await res.json();
        if (ignore) return;

        setState({
          loading: false,
          isAdmin: !!data?.isAdmin,
          admin: data?.admin || null,
        });
      } catch {
        if (!ignore) setState({ loading: false, isAdmin: false, admin: null });
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
