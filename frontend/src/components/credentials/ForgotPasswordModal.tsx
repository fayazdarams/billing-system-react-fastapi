import { useState } from "react";
import type { FormEvent } from "react";
import Field from "../shared/Field";
import { API_URL, getApiErrorMessage } from "../../lib/api";
import { handleEnterAsTab } from "../../lib/enterAsTab";
import {
  getConfirmPasswordError,
  getLoginUsernameError,
  getPasswordError,
  getVerificationCodeError,
} from "../../lib/validation";
import type { ToastVariant } from "../../types";
import "../shared/Modal.css";
import "./ForgotPasswordModal.css";

async function postJson(path: string, body: unknown) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { detail?: string }).detail || "Request failed");
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onToast: (message: string, variant: ToastVariant) => void;
  initialUsername: string;
}

export default function ForgotPasswordModal({ open, onClose, onToast, initialUsername }: ForgotPasswordModalProps) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState(initialUsername);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [errors, setErrors] = useState({ username: "", code: "", newPassword: "", confirmNewPassword: "" });
  // FIX: like Register `submitted` - error only after Next for that step. No onBlur.
  const [attempted, setAttempted] = useState({ 1: false, 2: false, 3: false });
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!open) return null;

  // FIX: reset on EXIT, not on entry. No useEffect on `open` - that caused flash of old errors.
  // `finished` + timer removed - success/failure is shown in Toast, not in form.
  function resetForm() {
    setStep(1);
    setUsername(initialUsername);
    setCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setErrors({ username: "", code: "", newPassword: "", confirmNewPassword: "" });
    setAttempted({ 1: false, 2: false, 3: false });
    setLoading(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  function handleCancel() {
    resetForm();
    onClose();
  }

  async function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = event.currentTarget; // capture before setTimeout - event goes null after handler
    if (step === 1) {
      setAttempted((p) => ({ ...p, 1: true }));
      const err = getLoginUsernameError(username);
      setErrors((p) => ({ ...p, username: err }));
      if (err) {
        setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
        return;
      }
      setLoading(true);
      try {
        await postJson("/forgot-password", { username: username.trim() });
        onToast("OTP sent to your registered email", "success");
        setStep(2);
      } catch (e) {
        onToast(getApiErrorMessage(e), "error");
        // FIX: API error - focus username so user can retype (like code step).
        setTimeout(() => {
          const el = document.getElementById("forgot-username") as HTMLInputElement | null;
          el?.focus();
          el?.select();
        }, 0);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (step === 2) {
      setAttempted((p) => ({ ...p, 2: true }));
      const err = getVerificationCodeError(code);
      setErrors((p) => ({ ...p, code: err }));
      if (err) {
        setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
        return;
      }
      setLoading(true);
      try {
        await postJson("/verify-code", { username: username.trim(), code });
        setStep(3);
      } catch (e) {
        onToast(getApiErrorMessage(e), "error");
        setTimeout(() => {
          const el = document.getElementById("forgot-code") as HTMLInputElement | null;
          el?.focus();
          el?.select();
        }, 0);
      } finally {
        setLoading(false);
      }
      return;
    }
    // Step 3
    setAttempted((p) => ({ ...p, 3: true }));
    const pwErr = getPasswordError(newPassword);
    const cfErr = getConfirmPasswordError(newPassword, confirmNewPassword);
    setErrors((p) => ({ ...p, newPassword: pwErr, confirmNewPassword: cfErr }));
    if (pwErr || cfErr) {
      setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    setLoading(true);
    try {
      await postJson("/reset-password", {
        username: username.trim(),
        code,
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      // FIX: success in Toast, not in form. No forgot-success, no 1s timer.
      onToast("Password reset successfully", "success");
      resetForm();
      onClose();
    } catch (e) {
      onToast(getApiErrorMessage(e), "error");
      // FIX: stay on Step 3 on failure, focus first invalid / new password.
      setTimeout(() => document.getElementById("forgot-new")?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }

  const shown = (stepNo: 1 | 2 | 3, msg: string) => (attempted[stepNo] ? msg : "");

  function handleUsername(v: string) {
    setUsername(v);
    if (attempted[1]) setErrors((p) => ({ ...p, username: getLoginUsernameError(v) }));
  }
  function handleCode(v: string) {
    setCode(v);
    if (attempted[2]) setErrors((p) => ({ ...p, code: getVerificationCodeError(v) }));
  }
  function handleNewPw(v: string) {
    setNewPassword(v);
    if (attempted[3]) {
      setErrors((p) => ({
        ...p,
        newPassword: getPasswordError(v),
        confirmNewPassword: getConfirmPasswordError(v, confirmNewPassword),
      }));
    }
  }
  function handleConfirmPw(v: string) {
    setConfirmNewPassword(v);
    if (attempted[3]) setErrors((p) => ({ ...p, confirmNewPassword: getConfirmPasswordError(newPassword, v) }));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-dialog forgot-dialog" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
        <h2 className="modal-title" id="forgot-title">
          Forgot Password Form
        </h2>
        <p className="forgot-step">Step {step} of 3</p>
        <form onSubmit={handleNext} onKeyDown={handleEnterAsTab} noValidate>
          {step === 1 && (
            <Field
              id="forgot-username"
              label="User Name"
              value={username}
              onChange={handleUsername}
              error={shown(1, errors.username)}
              required
              autoFocus
              autoComplete="username"
            />
          )}
          {step === 2 && (
            <>
              <Field id="forgot-username-locked" label="User Name" value={username} onChange={() => {}} disabled />
              <Field
                id="forgot-code"
                label="Verification Code"
                value={code}
                onChange={handleCode}
                error={shown(2, errors.code)}
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
              />
            </>
          )}
          {step === 3 && (
            <>
              <Field
                id="forgot-new"
                label="New Password"
                type="password"
                value={newPassword}
                onChange={handleNewPw}
                error={shown(3, errors.newPassword)}
                required
                autoComplete="new-password"
                autoFocus
                showEye
                eyeOpen={showNewPassword}
                onToggleEye={() => setShowNewPassword((c) => !c)}
                maxLength={8}
              />
              <Field
                id="forgot-confirm"
                label="Confirm New Password"
                type="password"
                value={confirmNewPassword}
                onChange={handleConfirmPw}
                error={shown(3, errors.confirmNewPassword)}
                required
                autoComplete="new-password"
                showEye
                eyeOpen={showConfirmPassword}
                onToggleEye={() => setShowConfirmPassword((c) => !c)}
                maxLength={8}
              />
            </>
          )}
          <p className={step === 2 ? "forgot-note forgot-note-visible" : "forgot-note"} aria-hidden={step !== 2}>
            Enter the 6-digit code sent to your registered mobile number.
          </p>

          <div className="modal-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              Next
            </button>
            <button type="button" className="secondary-button" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
