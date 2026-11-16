export interface LoginPayload {
  uname: string;
  pswd: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  confirmPassword: string;
  storeName: string;
  mobile: string;
  whatsapp: string;
  email: string;
}

export interface ForgotPasswordPayload {
  username: string;
}

export interface VerifyPinPayload {
  username: string;
  code: string;
}

export interface ResetPasswordPayload {
  username: string;
  newPassword: string;
  confirmNewPassword: string;
}

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface StoredUserValue {
  username: string;
  password: string;
  storeName: string;
  mobile: string;
  whatsapp: string;
  email: string;
}
