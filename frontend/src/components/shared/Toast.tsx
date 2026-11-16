import { useEffect } from "react";
import type { ToastItem } from "../../types";
import "./Toast.css";

export interface ToastProps {
  toast: ToastItem | null;
  onClose: () => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => onClose(), 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const symbol = toast.variant === "success" ? "✓" : toast.variant === "error" ? "!" : "i";

  return (
    <div
      className={`toast toast-${toast.variant}`}
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live="polite">
      <span className="toast-symbol" aria-hidden="true">
        {symbol}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" aria-label="Dismiss message" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
