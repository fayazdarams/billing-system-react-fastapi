export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// FastAPI can return detail as:
// - string: "Username not found"
// - array: [{ loc, msg: "String should have at most 8 characters", type }]
// - object: { msg: "..." }
// This extracts a readable string from all 3, never "[object Object]"
function extractDetail(data: unknown): string {
  const detail = (data as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") return first.msg;
    return "Invalid request. Please check your input.";
  }
  if (detail && typeof detail === "object") {
    const msg = (detail as { msg?: unknown }).msg;
    if (typeof msg === "string") return msg;
    return "Invalid request. Please check your input.";
  }
  return "Request failed";
}

// Central postJson — use this in LoginCard / Register / Forgot, don't duplicate it
export async function postJson(path: string, body: unknown) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(extractDetail(data));
      (err as any).status = res.status; // ← keep 401, don't dispatch
      throw err;
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getJson(path: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(extractDetail(data));
      (err as any).status = res.status; // ← keep 401, don't dispatch
      throw err;
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getApiErrorStatus(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error) {
    const s = (error as { status: unknown }).status;
    return typeof s === "number" ? s : null;
  }
  return null;
}

export function getApiErrorMessage(error: unknown): string {
  // Case 1: FastAPI 422 passed as raw object (if someone throws data directly)
  if (error && typeof error === "object" && "detail" in (error as Record<string, unknown>)) {
    return extractDetail(error);
  }

  const message = error instanceof Error ? error.message : "Something went wrong";

  // Case 2: Old "[object Object]" Error created before this fix — don't show it
  if (message === "[object Object]" || message.includes("[object Object]")) {
    return "Invalid request. Please check your input.";
  }

  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Cannot connect to backend server";
  }
  // AbortError = our 10s timeout fired
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out. Please try again.";
  }
  // AbortError can also come as Error with name AbortError
  if (error instanceof Error && error.name === "AbortError") {
    return "Request timed out. Please try again.";
  }

  return message;
}
