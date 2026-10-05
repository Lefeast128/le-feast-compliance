export type AuthUser = {
  id: string;
  organisationId: string | null;
  email: string;
  name: string | null;
  role: "user" | "admin";
  hasPassword: boolean;
};

export type AuthMembership = {
  userId: string;
  locationId: string;
  role: "staff" | "manager";
};

export type AuthSessionResponse =
  | { authenticated: false }
  | { authenticated: true; user: AuthUser; memberships: AuthMembership[] };

export type OtpResponse = {
  ok: true;
  message: string;
};

export type VerifyOtpResponse = {
  ok: true;
  user: AuthUser;
  memberships: AuthMembership[];
};

export type PasswordAuthResponse = {
  ok: true;
  user: AuthUser;
  memberships: AuthMembership[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const parseBody = (text: string): unknown => {
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
  const text = await response.text();
  const body = parseBody(text);

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Request failed";
    throw new ApiError(response.status, message, body);
  }

  return body as T;
}

export const authApi = {
  getSession: () =>
    apiRequest<AuthSessionResponse>("/api/auth/session", { method: "GET" }),

  requestOtp: (email: string) =>
    apiRequest<OtpResponse>("/api/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, code: string) =>
    apiRequest<VerifyOtpResponse>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code, purpose: "setup" }),
    }),
  verifyOtpFor: (email: string, code: string, purpose: "setup" | "reset") =>
    apiRequest<VerifyOtpResponse>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code, purpose }),
    }),
  login: (email: string, password: string) =>
    apiRequest<PasswordAuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  setPassword: (password: string) =>
    apiRequest<PasswordAuthResponse>("/api/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  logout: () =>
    apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};
