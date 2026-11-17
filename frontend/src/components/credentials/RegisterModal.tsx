import { useState } from "react";
import type { FormEvent } from "react";
import Field from "../shared/Field";
import { handleEnterAsTab } from "../../lib/enterAsTab";
import { postJson, getApiErrorMessage } from "../../lib/api";
import {
  getConfirmPasswordError,
  getEmailError,
  getMobileError,
  getPasswordError,
  getStoreNameError,
  getUsernameError,
} from "../../lib/validation";
import type { ToastVariant } from "../../types";
import "../shared/Modal.css";
import "./RegisterModal.css";

export interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onToast: (message: string, variant: ToastVariant) => void;
}

interface RegisterErrors {
  username: string;
  password: string;
  confirmPassword: string;
  storeName: string;
  mobile: string;
  whatsapp: string;
  email: string;
}

const emptyErrors: RegisterErrors = {
  username: "",
  password: "",
  confirmPassword: "",
  storeName: "",
  mobile: "",
  whatsapp: "",
  email: "",
};

export default function RegisterModal({ open, onClose, onToast }: RegisterModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>(emptyErrors);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!open) return null;

  function resetForm() {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setStoreName("");
    setMobile("");
    setWhatsapp("");
    setEmail("");
    setErrors(emptyErrors);
    setSubmitted(false);
    setLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function validateAll(): RegisterErrors {
    return {
      username: getUsernameError(username),
      password: getPasswordError(password),
      confirmPassword: getConfirmPasswordError(password, confirmPassword),
      storeName: getStoreNameError(storeName),
      mobile: getMobileError(mobile, "Mobile"),
      whatsapp: getMobileError(whatsapp, "WhatsApp"),
      email: getEmailError(email),
    };
  }

  function handleChange(name: string, value: string) {
    if (name === "username") setUsername(value);
    if (name === "password") setPassword(value);
    if (name === "confirmPassword") setConfirmPassword(value);
    if (name === "storeName") setStoreName(value);
    if (name === "mobile") {
      setMobile(value);
      setWhatsapp(value);
    }
    if (name === "whatsapp") setWhatsapp(value);
    if (name === "email") setEmail(value);
    // After submit, re-validate all fields from new value. Single setErrors.
    // FIX: removed duplicate first setErrors for password/mobile above.
    if (submitted) {
      const next = {
        username: name === "username" ? value : username,
        password: name === "password" ? value : password,
        confirmPassword: name === "confirmPassword" ? value : confirmPassword,
        storeName: name === "storeName" ? value : storeName,
        mobile: name === "mobile" ? value : mobile,
        whatsapp: name === "whatsapp" ? value : name === "mobile" ? value : whatsapp,
        email: name === "email" ? value : email,
      };
      setErrors({
        username: getUsernameError(next.username),
        password: getPasswordError(next.password),
        confirmPassword: getConfirmPasswordError(next.password, next.confirmPassword),
        storeName: getStoreNameError(next.storeName),
        mobile: getMobileError(next.mobile, "Mobile"),
        whatsapp: getMobileError(next.whatsapp, "WhatsApp"),
        email: getEmailError(next.email),
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = event.currentTarget;
    const nextErrors = validateAll();
    setErrors(nextErrors);
    setSubmitted(true);
    if (Object.values(nextErrors).some(Boolean)) {
      setTimeout(() => {
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }, 0);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s
    try {
      const data = await postJson("/register", {
        username,
        password,
        confirmPassword,
        storeName,
        mobile,
        whatsapp,
        email,
      });

      onToast(data.message, "success");
      resetForm();
      onClose();
    } catch (error) {
      onToast(getApiErrorMessage(error), "error");
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  function handleCancel() {
    resetForm();
    onClose();
  }

  const shown = (msg: string) => (submitted ? msg : "");

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-dialog register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-title">
        <h2 className="modal-title" id="register-title">
          New User Registration Form
        </h2>
        <form onSubmit={handleSubmit} onKeyDown={handleEnterAsTab} noValidate>
          <div className="register-grid">
            <div className="register-column">
              <Field
                id="register-username"
                label="UserName"
                value={username}
                onChange={(value) => handleChange("username", value)}
                error={shown(errors.username)}
                required
                autoComplete="username"
                maxLength={5}
                autoFocus
              />
              <Field
                id="register-password"
                label="Password"
                type="password"
                value={password}
                onChange={(value) => handleChange("password", value)}
                error={shown(errors.password)}
                required
                autoComplete="new-password"
                showEye
                eyeOpen={showPassword}
                onToggleEye={() => setShowPassword((c) => !c)}
                maxLength={8}
              />
              <Field
                id="register-confirm"
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(value) => handleChange("confirmPassword", value)}
                error={shown(errors.confirmPassword)}
                required
                autoComplete="new-password"
                showEye
                eyeOpen={showConfirmPassword}
                onToggleEye={() => setShowConfirmPassword((c) => !c)}
                maxLength={8}
              />
            </div>
            <div className="register-column">
              <Field
                id="register-store"
                label="StoreName"
                value={storeName}
                onChange={(value) => handleChange("storeName", value)}
                error={shown(errors.storeName)}
                required
                autoComplete="organization"
              />
              <Field
                id="register-mobile"
                label="Mobile"
                value={mobile}
                onChange={(value) => handleChange("mobile", value)}
                error={shown(errors.mobile)}
                required
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
              />
              <Field
                id="register-whatsapp"
                label="WhatsApp"
                value={whatsapp}
                onChange={(value) => handleChange("whatsapp", value)}
                error={shown(errors.whatsapp)}
                required
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
              />
              <Field
                id="register-email"
                label="Email"
                type="email"
                value={email}
                onChange={(value) => handleChange("email", value)}
                error={shown(errors.email)}
                autoComplete="email"
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              Submit
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
