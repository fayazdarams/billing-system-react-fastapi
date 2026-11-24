/* App.tsx does not show login screen if back-end or database is down
   This covers our scenerio 
   1. User logged in Browser TAB-1
   2. shutdown back-end/database
   3. open site in Browser TAB-2
   4. App.tsx earlier was presenting login screen
   5. Start back-end/database
   6. Login again. Login successful. New httpOnly session key issued. TAB-1 silently uses new httpOnly
   7. It is logical to show login screen only if the user is not logged in. 
*/

import { useCallback, useEffect, useState, useRef } from "react";
import LoginCard, { type LoggedInUser } from "./components/credentials/LoginCard";
import MainApp from "./components/MainApp";
import Toast from "./components/shared/Toast";
import { getJson, postJson, getApiErrorStatus } from "./lib/api";
import type { ToastItem, ToastVariant } from "./types";
import "./index.css";

let toastId = 0;

export default function App() {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  // --- Login / Auto-login (added, rest untouched) ---
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [bkdbDown, setbkdbDown] = useState(false); //bkdbDown - Backend or database is down

  // Auto-login: on app load, ask backend if HttpOnly cookie is still valid
  useEffect(() => {
    getJson("/me")
      .then((data) => setUser(data as LoggedInUser))
      .catch((error) => {
        setUser(null);
        if (getApiErrorStatus(error) === 401) setbkdbDown(false);
        else {
          showToast("BackEnd / Database is unavailable. Please try again.", "error");
          setbkdbDown(true);
        }
      })
      .finally(() => setChecking(false));
  }, []);

  async function handleLogout() {
    await postJson("/logout", {}).catch(() => {});
    // Even if backend is down / postJson throws, we still logout locally
    // That's why we .catch(() => {}) — logout must clear UI even if DB is down
    setUser(null);
  }

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

        {checking ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              height: "100%",
              minHeight: "60vh",
            }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "4px solid #ddd",
                borderTopColor: "#333",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p>Loading...</p>
          </div>
        ) : bkdbDown ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: "60vh",
            }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "16px 48px",
                fontSize: "18px",
                fontWeight: 600,
                borderRadius: "10px",
                cursor: "pointer",
              }}>
              Retry
            </button>
          </div>
        ) : user ? (
          <MainApp
            storenumber={user.storenumber}
            storeName={user.storeName}
            username={user.username}
            onLogout={handleLogout}
            onToast={showToast}
            onSessionExpired={() => {
              setUser(null);
            }}
          />
        ) : (
          <LoginCard onToast={showToast} onLoginSuccess={setUser} />
        )}
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
