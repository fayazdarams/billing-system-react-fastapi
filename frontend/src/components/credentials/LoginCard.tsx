import { useState } from "react";
import type { FormEvent } from "react";
import Field from "../shared/Field";
import RegisterModal from "./RegisterModal";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { getJson, postJson, getApiErrorMessage } from "../../lib/api";
import { handleEnterAsTab } from "../../lib/enterAsTab";
import { getLoginPasswordError, getLoginUsernameError } from "../../lib/validation";
import type { ToastVariant } from "../../types";
import "./LoginCard.css";

export interface LoggedInUser {
  username: string;
  storenumber: number;
  storeName: string;
}

export interface LoginCardProps {
  onToast: (message: string, variant: ToastVariant) => void;
  onLoginSuccess: (user: LoggedInUser) => void;
}

interface LoginErrors {
  uname: string;
  pswd: string;
}

export default function LoginCard({ onToast, onLoginSuccess }: LoginCardProps) {
  const [uname, setUname] = useState("");
  const [pswd, setPswd] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({ uname: "", pswd: "" });
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = event.currentTarget;
    const nextErrors: LoginErrors = { uname: getLoginUsernameError(uname), pswd: getLoginPasswordError(pswd) };
    setErrors(nextErrors);
    if (nextErrors.uname || nextErrors.pswd) {
      setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    setLoading(true);
    try {
      await postJson("/login", { username: uname.trim(), password: pswd });
      const me = (await getJson("/me")) as LoggedInUser;
      onToast("Login successful - redirecting...", "success");
      onLoginSuccess(me);
    } catch (error) {
      onToast(getApiErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="login-card">
        <form className="login-form" onSubmit={handleSubmit} onKeyDown={handleEnterAsTab} noValidate>
          <Field
            id="login-username"
            label="User Name"
            value={uname}
            onChange={(value) => {
              setUname(value);
              if (errors.uname) setErrors((prev) => ({ ...prev, uname: "" }));
            }}
            error={errors.uname}
            required
            autoFocus
            autoComplete="username"
          />
          <Field
            id="login-password"
            label="Password"
            type="password"
            value={pswd}
            onChange={(value) => {
              setPswd(value);
              if (errors.pswd) setErrors((prev) => ({ ...prev, pswd: "" }));
            }}
            error={errors.pswd}
            required
            autoComplete="current-password"
            showEye
            eyeOpen={showPassword}
            onToggleEye={() => setShowPassword((current) => !current)}
          />
          <button type="submit" className="primary-button login-only-button" disabled={loading}>
            Login
          </button>
        </form>
        <div className="login-card-actions">
          <button type="button" className="login-secondary-button" onClick={() => setShowRegister(true)}>
            Register
          </button>
          <button type="button" className="login-secondary-button" onClick={() => setShowForgot(true)}>
            Forgot password
          </button>
        </div>
        <ProgressBar active={loading} />
      </section>
      <RegisterModal open={showRegister} onClose={() => setShowRegister(false)} onToast={onToast} />
      <ForgotPasswordModal
        key={uname}
        open={showForgot}
        onClose={() => setShowForgot(false)}
        onToast={onToast}
        initialUsername={uname}
      />
    </>
  );
}

function ProgressBar({ active }: { active: boolean }) {
  return (
    <div
      className={active ? "progress-wrap" : "progress-wrap progress-hidden"}
      role={active ? "progressbar" : undefined}
      aria-hidden={!active}>
      <div className="progress-bar" />
    </div>
  );
}
