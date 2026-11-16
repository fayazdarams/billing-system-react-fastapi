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
