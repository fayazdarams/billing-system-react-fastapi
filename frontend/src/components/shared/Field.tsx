import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import "./Field.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-regular-svg-icons";

export interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password" | "email" | "tel" | "number";
  required?: boolean;
  error?: string;
  hint?: string;
  autoComplete?: string;
  showEye?: boolean;
  onToggleEye?: () => void;
  eyeOpen?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "email" | "tel";
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  as?: "input" | "textarea" | "select";
  options?: string[];
  rows?: number;
}

export default function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  error = "",
  hint,
  autoComplete,
  showEye = false,
  onToggleEye,
  eyeOpen = false,
  autoFocus = false,
  maxLength,
  inputMode,
  disabled = false,
  inputRef,
  as = "input",
  options,
  rows,
}: FieldProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const refToUse = inputRef ?? internalRef;
  const resolvedType = type === "password" && showEye && eyeOpen ? "text" : type;

  const hadErrorRef = useRef(false);
  useEffect(() => {
    if (error) hadErrorRef.current = true;
  }, [error]);
  const showValid = !error && hadErrorRef.current && value.trim() !== "";

  const fieldClass = error ? "field field-invalid" : showValid ? "field field-valid" : "field";

  // Custom resize grip for textarea — replaces browser corner grip
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /*
  const onGripMouseDown = (e: React.MouseEvent) => {
    if (!textareaRef.current) return;
    e.preventDefault();

    const startY = e.clientY;
    const startHeight = textareaRef.current.offsetHeight;

    const onMove = (ev: MouseEvent) => {
      if (!textareaRef.current) return;
      const newHeight = startHeight + (ev.clientY - startY);
      // No Math.max, no minHeight here — CSS min-height handles it
      textareaRef.current.style.height = newHeight + "px";
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  */

  return (
    <div className="field-wrap">
      <label className={fieldClass} htmlFor={id}>
        <span className="field-label">
          {label}
          {required ? "*" : ""}
        </span>
        <span className="field-row">
          {as === "textarea" ? (
            <textarea
              ref={textareaRef}
              id={id}
              className="field-input"
              rows={rows ?? 3}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.shiftKey) {
                  event.stopPropagation();
                }
              }}
              autoFocus={autoFocus}
              autoComplete={autoComplete}
              maxLength={maxLength}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={`${id}-error`}
            />
          ) : as === "select" ? (
            <select
              id={id}
              className="field-input field-select"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              autoFocus={autoFocus}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={`${id}-error`}>
              {options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
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
          )}
          {showEye && as === "input" && (
            <button
              className="field-eye"
              type="button"
              aria-label={eyeOpen ? "Hide password" : "Show password"}
              aria-pressed={eyeOpen}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onToggleEye?.();
                setTimeout(() => refToUse.current?.focus(), 0);
              }}>
              <FontAwesomeIcon icon={eyeOpen ? faEye : faEyeSlash} />
            </button>
          )}
        </span>
        {/* Custom resize grip — only for textarea, full-width bottom border 
        {as === "textarea" && <span className="field-resize" onMouseDown={onGripMouseDown} aria-hidden="true" />}
        */}
      </label>
      {/* Hint: between box and error, always in this order */}
      {hint ? <div className="field-hint">{hint}</div> : null}
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
