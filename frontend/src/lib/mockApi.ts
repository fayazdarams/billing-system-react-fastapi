import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  StoredUserValue,
  VerifyPinPayload,
} from "../types";

const DEMO_CODE = "123456";
const COLLECTION = "billing_users";

async function delay(ms = 800): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

interface StoredRecord {
  id: string;
  value: StoredUserValue;
}

// --- TRUE MOCK STORAGE: localStorage only, no fetch, no /actions ---

async function listUsers(): Promise<StoredRecord[]> {
  try {
    const raw = localStorage.getItem(COLLECTION);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveUsers(users: StoredRecord[]): Promise<void> {
  localStorage.setItem(COLLECTION, JSON.stringify(users));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const mockApi = {
  async login(payload: LoginPayload): Promise<{ success: boolean }> {
    await delay(800);
    // Hard-coded demo account from the old PHP page.
    if (payload.uname === "admin" && payload.pswd === "Admin123") {
      return { success: true };
    }
    const users = await listUsers();
    const found = users.find((record) => record.value.username === payload.uname.trim());
    if (found && found.value.password === payload.pswd) {
      return { success: true };
    }
    throw new Error("Invalid User Name or Password");
  },

  async register(payload: RegisterPayload): Promise<{ success: boolean }> {
    await delay(800);
    const existing = await listUsers();
    if (existing.some((record) => record.value.username === payload.username.trim())) {
      throw new Error("Username already exists");
    }
    const value: StoredUserValue = {
      username: payload.username.trim(),
      password: payload.password,
      storeName: payload.storeName.trim(),
      mobile: payload.mobile.trim(),
      whatsapp: payload.whatsapp.trim(),
      email: payload.email.trim(),
    };
    // TODO: Replace with FastAPI fetch: POST /api/register
    existing.push({ id: newId(), value });
    await saveUsers(existing);
    return { success: true };
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ success: boolean }> {
    await delay(800);
    if (payload.username.trim() === "admin") return { success: true };
    const users = await listUsers();
    const found = users.some((record) => record.value.username === payload.username.trim());
    if (!found) throw new Error("User not found");
    // TODO: Replace with FastAPI fetch: POST /api/forgot-password
    // Demo: code is always 123456
    return { success: true };
  },

  async verifyPin(payload: VerifyPinPayload): Promise<{ success: boolean }> {
    await delay(800);
    // TODO: Replace with FastAPI fetch: POST /api/verify-pin
    if (payload.code.trim() === DEMO_CODE) return { success: true };
    throw new Error("Invalid verification code");
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ success: boolean }> {
    await delay(800);
    const users = await listUsers();
    const found = users.find((record) => record.value.username === payload.username.trim());
    if (payload.username.trim() === "admin") {
      // TODO: Replace with FastAPI fetch: POST /api/reset-password
      // Demo admin password is not persisted in mock
      return { success: true };
    }
    if (!found) throw new Error("User not found");
    // TODO: Replace with FastAPI fetch: POST /api/reset-password
    const idx = users.findIndex((u) => u.id === found.id);
    if (idx >= 0) {
      users[idx] = { id: found.id, value: { ...found.value, password: payload.newPassword } };
      await saveUsers(users);
    }
    return { success: true };
  },
};
