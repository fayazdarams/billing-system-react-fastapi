import { useRef } from "react";
import type { RefObject } from "react";
import "./Field.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
//import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { faEye, faEyeSlash } from "@fortawesome/free-regular-svg-icons";

export interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password" | "email" | "tel" | "number";
  required?: boolean;
  error?: string;
  autoComplete?: string;
  showEye?: boolean;
  onToggleEye?: () => void;
  eyeOpen?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "email" | "tel";
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export default function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  error = "",
  autoComplete,
  showEye = false,
  onToggleEye,
  eyeOpen = false,
  autoFocus = false,
  maxLength,
  inputMode,
  disabled = false,
  inputRef,
}: FieldProps) {
  // FIX: parent may not pass inputRef (Register password fields don't).
  // Use own ref as fallback so eye focus always works.
  const internalRef = useRef<HTMLInputElement>(null);
  const refToUse = inputRef ?? internalRef;
  const resolvedType = type === "password" && showEye && eyeOpen ? "text" : type;
  return (
    <div className="field-wrap">
      <label className={error ? "field field-invalid" : "field"} htmlFor={id}>
        <span className="field-label">
          {label}
          {required ? "*" : ""}
        </span>
        <span className="field-row">
          <input
            id={id}
            ref={refToUse}
            className={showEye ? "field-input field-input-with-eye" : "field-input"}
            type={resolvedType}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required={required}
            autoFocus={autoFocus}
            autoComplete={autoComplete}
            maxLength={maxLength}
            inputMode={inputMode}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-error`}
          />
          {showEye && (
            <button
              className="field-eye"
              type="button"
              aria-label={eyeOpen ? "Hide password" : "Show password"}
              aria-pressed={eyeOpen}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onToggleEye?.();
                // After type toggle re-render, focus back to this field.
                setTimeout(() => refToUse.current?.focus(), 0);
              }}>
              <FontAwesomeIcon icon={eyeOpen ? faEye : faEyeSlash} />
            </button>
          )}
        </span>
      </label>
      <div
        className={error ? "field-error field-error-visible" : "field-error"}
        id={`${id}-error`}
        role="alert"
        aria-hidden={!error}>
        {error || " "}
      </div>
    </div>
  );
}
