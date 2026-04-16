import { useAuth0 } from "@auth0/auth0-react";

const BASE = import.meta.env.VITE_BACKEND_URL || "";

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path}`;
}

function parseMaybeJson(res, text) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text || "{}");
    } catch {
      /* fallthrough */
    }
  }
  return text;
}

async function coreRequest(
  path,
  { method = "GET", body, headers = {}, token = "", timeoutMs = 15000 } = {}
) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const finalHeaders = { "Content-Type": "application/json", ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const isJsonBody =
    body &&
    !(body instanceof FormData) &&
    typeof body !== "string" &&
    !(body instanceof Blob);

  const res = await fetch(buildUrl(path), {
    method,
    headers: finalHeaders,
    body: body ? (isJsonBody ? JSON.stringify(body) : body) : undefined,
    signal: controller.signal,
  }).finally(() => clearTimeout(t));

  const text = await res.text();
  const data = parseMaybeJson(res, text);

  if (!res.ok) {
    const err = new Error(
      typeof data === "string" ? data : data?.message || "Request failed"
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function useApi() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  async function request(
    path,
    { method = "GET", body, token = true, timeoutMs = 15000, headers } = {}
  ) {
    let accessToken = "";
    if (token && isAuthenticated) {
      try {
        accessToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: "openid profile email",
          },
        });
      } catch {
        // public route — proceed without token
      }
    }
    return coreRequest(path, {
      method,
      body,
      headers,
      token: accessToken,
      timeoutMs,
    });
  }

  return {
    get: (p, opts) => request(p, { ...opts, method: "GET" }),
    post: (p, body, opts) => request(p, { ...opts, method: "POST", body }),
    put: (p, body, opts) => request(p, { ...opts, method: "PUT", body }),
    del: (p, opts) => request(p, { ...opts, method: "DELETE" }),
  };
}

export async function apiRaw(path, opts = {}) {
  const getToken = opts.getToken || (async () => "");
  const token = opts.token ?? (await getToken());
  return coreRequest(path, { ...opts, token });
}
