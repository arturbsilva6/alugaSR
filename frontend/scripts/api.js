// Cliente HTTP do frontend. Sessão em cookie HttpOnly (nunca em localStorage);
// o token CSRF fica apenas em memória e acompanha as mutações.
let csrfToken = null;
export const setCsrfToken = token => { csrfToken = typeof token === "string" ? token : null; };

export async function api(path, { method = "GET", json, body, contentType, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  else if (contentType) headers["Content-Type"] = contentType;
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  let response;
  try {
    response = await fetch("/api/v1" + path, { method, headers, body, credentials: "same-origin", signal, cache: "no-store" });
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: "Não foi possível conectar. Verifique sua conexão e tente novamente." } };
  }
  if (response.status === 204) return { ok: true, status: 204, data: null };
  let payload = null;
  if ((response.headers.get("content-type") ?? "").includes("application/json")) {
    try { payload = await response.json(); } catch { payload = null; }
  }
  if (!response.ok) {
    return { ok: false, status: response.status, error: payload?.error ?? { code: "HTTP_" + response.status, message: "Não foi possível concluir a operação." } };
  }
  return { ok: true, status: response.status, data: payload?.data ?? null, page: payload?.page ?? null };
}

// Detecta se a API está disponível (ex.: `npm start`). Na prévia estática
// (`npm run preview`) ou em file://, o portal usa as fixtures sintéticas.
export async function detectApi(timeoutMs = 2500) {
  if (typeof window !== "undefined" && window.location.protocol === "file:") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await api("/meta", { signal: controller.signal });
    return r.ok ? r.data : null;
  } finally { clearTimeout(timer); }
}

export async function loadSession() {
  const r = await api("/auth/session");
  if (!r.ok) { setCsrfToken(null); return null; }
  setCsrfToken(r.data.csrfToken);
  return r.data;
}
