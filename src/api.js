// Thin client for the banking API. Every mutation replies with the full,
// freshly-read state so the UI always reflects what is actually in the database.

// Always same-origin: the Vite dev proxy (BANKING_API_URL) or the Express server
// hosting the production build decides which machine actually answers.
const baseUrl = "/api";

// The team access code is entered once and kept in localStorage rather than baked
// into the bundle, so it never appears in the published JavaScript.
const ACCESS_CODE_KEY = "qtb-access-code";

let accessCode = "";
try {
  accessCode = localStorage.getItem(ACCESS_CODE_KEY) || "";
} catch {
  accessCode = ""; // private browsing with storage disabled
}

export function setAccessCode(code) {
  accessCode = String(code || "").trim();
  try {
    localStorage.setItem(ACCESS_CODE_KEY, accessCode);
  } catch {
    // keep it in memory for this tab only
  }
}

export function clearAccessCode() {
  accessCode = "";
  try {
    localStorage.removeItem(ACCESS_CODE_KEY);
  } catch {
    // nothing to clean up
  }
}

/** Error carrying `code` so callers can tell "wrong access code" from a real failure. */
class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function request(path, body) {
  const headers = {};
  if (accessCode) headers["x-access-code"] = accessCode;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError("Cannot reach the banking server. Start it with `npm run server`.", "offline");
  }

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) throw new ApiError(payload.error || "Access code required.", "unauthorized");
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export const api = {
  getState: () => request("/state"),
  reset: () => request("/reset", {}),
  createApplication: (form, actor) => request("/applications", { form, actor }),
  decideApplication: (id, decision, comments, reviewer) => request(`/applications/${id}/decision`, { decision, comments, reviewer }),
  postTransaction: (transaction) => request("/transactions", transaction),
  createClosureRequest: (form, actor) => request("/closure-requests", { form, actor }),
  decideClosureRequest: (id, decision, comments, reviewer) => request(`/closure-requests/${id}/decision`, { decision, comments, reviewer })
};
