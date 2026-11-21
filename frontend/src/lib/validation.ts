export function isStrongPassword(value: string): boolean {
  return /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8}$/.test(value);
}

export function isTenDigits(value: string): boolean {
  return /^[0-9]{10}$/.test(value);
}

export function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getUsernameError(value: string): string {
  const v = value.trim();
  if (!v) return "Please enter User Name";
  if (v.length !== 5) return "Username must be 5 characters long";
  if (!/^[a-z]{5}$/.test(v)) return "Username must be 5 lowercase letters (a-z)";
  return "";
}

export function getLoginUsernameError(value: string): string {
  if (!value.trim()) return "Please enter User Name";
  return "";
}

export function getLoginPasswordError(value: string): string {
  if (!value) return "Please enter Password";
  return "";
}

export function getPasswordError(value: string): string {
  if (!value) return "Please enter Password";
  if (!isStrongPassword(value)) return "Mix of smallcase,uppercase letters and digits (8 characters long)";
  return "";
}

export function getConfirmPasswordError(password: string, confirm: string): string {
  if (!confirm) return "Please confirm Password";
  if (password !== confirm) return "Password does not match";
  return "";
}

export function getStoreNameError(value: string): string {
  if (!value.trim()) return "Please enter Store Name";
  return "";
}

export function getMobileError(value: string, label: string): string {
  if (!value.trim()) return `Please enter ${label}`;
  if (!isTenDigits(value.trim())) return `${label} must be 10 digits`;
  return "";
}

export function getEmailError(value: string): string {
  if (!value.trim()) return "";
  if (!isValidEmail(value.trim())) return "Please enter a valid Email";
  return "";
}

export function getVerificationCodeError(value: string): string {
  if (!value.trim()) return "Please enter Verification Code";
  return "";
}

// ---- AccountForm ----

export function getAccountNameError(value: string): string {
  if (!value.trim()) return "Please enter Name";
  return "";
}

export function getAccountAddressError(value: string): string {
  if (!value.trim()) return "Please enter Address";
  return "";
}

export function getAccountOpeningBalanceError(value: string): string {
  const v = value.trim();
  if (!v) return "Please enter Opening Balance";
  const n = Number(v);
  if (!Number.isFinite(n)) return "Opening Balance must be a number";
  if (n < 0) return "Opening Balance must be 0 or more";
  return "";
}

export function getAccountTypeError(value: string): string {
  const v = value.trim();
  if (!v) return "Please enter Type";
  if (v !== "Cr" && v !== "Dr") return "Type must be Cr or Dr";
  return "";
}

export function isValidPan(value: string): boolean {
  // 1-3: A-Z, 4: P/C/H/F/A/T/B/L/J/G, 5: A-Z, 6-9: 0001-9999, 10: A-Z
  return /^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$/.test(value);
}

export function getAccountPanError(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v) return "";
  if (v.length !== 10) return "PAN must be 10 characters long";
  if (!isValidPan(v)) return "Please enter a valid PAN (e.g. ABCDE1234F)";
  return "";
}

export function isValidGst(value: string): boolean {
  // 1-2: state code 01-38, 3-12: PAN, 13: 1-9/A-Z, 14: Z, 15: 0-9/A-Z
  if (!/^[0-9]{2}[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)) return false;
  const stateCode = Number(value.slice(0, 2));
  if (stateCode < 1 || stateCode > 38) return false;
  return true;
}

export function getAccountGstError(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v) return "";
  if (v.length !== 15) return "GST must be 15 characters long";
  if (!isValidGst(v)) return "Please enter a valid GST (e.g. 27ABCDE1234F1Z5)";
  return "";
}

export function getAccountAadharError(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (!/^[0-9]{12}$/.test(v)) return "Aadhar must be 12 digits";
  return "";
}

// AccountForm uses the same helpers as RegisterModal for these three:
// Mobile / WhatsApp -> getMobileError(value, "Mobile" / "WhatsApp")
// Email -> getEmailError(value)
