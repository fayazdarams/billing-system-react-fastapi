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
  if (!isValidEmail(value.trim())) return "Please enter a valid Email. (e.g. account@kop.com)";
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
  if (!isValidPan(v)) return "Please enter a valid PAN (e.g. ABCPD1234E)";
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
  if (!isValidGst(v)) return "Please enter a valid GST (e.g. 27ABCPD1234E1Z5)";
  return "";
}

// ---- Verhoeff (Aadhaar checksum) ----
// Tables from the Verhoeff algorithm. No magic numbers elsewhere —
// these 3 tables ARE the algorithm.
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidAadhar(value: string): boolean {
  // Assumes 12 digits already checked. Returns true only if Verhoeff checksum == 0.
  let c = 0;
  const digits = value.split("").reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(digits[i])]];
  }
  return c === 0;
}

export function getAccountAadharError(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (!/^[0-9]+$/.test(v)) return "Aadhar must be 12 digits";
  if (v.length !== 12) return "Aadhar must be 12 digits";
  // Rule 1 — first digit never 0 or 1 (UIDAI reserves those).
  if (v[0] === "0" || v[0] === "1") return "Aadhar cannot start with 0 or 1";
  // Rule 2 — digit 12 is a Verhoeff checksum over digits 1-12.
  if (!isValidAadhar(v)) return "Please enter a valid Aadhar (checksum failed)";
  return "";
}
