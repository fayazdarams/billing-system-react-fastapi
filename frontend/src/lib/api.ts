export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export function getApiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong";

  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Cannot connect to backend server";
  }
  // AbortError = our 10s timeout fired
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out. Please try again.";
  }

  return message;
}
