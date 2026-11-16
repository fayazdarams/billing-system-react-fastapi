import { useCallback, useEffect, useState, useRef } from "react";
import LoginCard from "./components/credentials/LoginCard";
import Toast from "./components/shared/Toast";
import type { ToastItem, ToastVariant } from "./types";
import "./index.css";

let toastId = 0;

export default function App() {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const update = () => {
      const offline = !navigator.onLine;
      if (offline) {
        const active = document.activeElement;
        if (active?.tagName === "INPUT") {
          lastFocusedRef.current = active as HTMLElement;
        }
      }
      setIsOffline(offline);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Restore focus when back online
  useEffect(() => {
    if (!isOffline) {
      if (lastFocusedRef.current) {
        lastFocusedRef.current.focus();
      } else {
        const modalForm = document.querySelector(".modal-dialog form");
        const form = modalForm ?? document.querySelector("form");
        form?.querySelector<HTMLElement>("input:not([disabled]), select, textarea")?.focus();
      }
      lastFocusedRef.current = null;
    }
  }, [isOffline]);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    toastId += 1;
    setToast({ id: toastId, message, variant });
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div
      data-safe-area-inset-root
      className="app-shell"
      style={{ boxSizing: "border-box", paddingTop: "var(--safe-area-inset-top)" }}>
      <main className="app-main" inert={isOffline ? true : undefined}>
        {/*}
        <p className="app-eyebrow">Billing System</p>
        <h1 className="app-heading">Welcome back</h1>
        <p className="app-subheading">Sign in to manage billing, stores and accounts.</p>
        */}
        <LoginCard onToast={showToast} />
      </main>

      <Toast toast={toast} onClose={closeToast} />
      {isOffline && (
        <div className="offline-overlay" role="alert">
          <div className="offline-box">
            <h2>No internet Connection!</h2>
            <p>Check your connection and try again. Your login form will stay here.</p>
          </div>
        </div>
      )}
    </div>
  );
}
