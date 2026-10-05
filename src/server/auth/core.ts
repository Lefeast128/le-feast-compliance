import { createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_LOGIN_MAX_ATTEMPTS = 5;

export type AuthUser = {
  id: string;
  organisationId: string | null;
  email: string;
  name: string | null;
  role: "user" | "admin";
  hasPassword: boolean;
  passwordHash?: string | null;
  passwordSalt?: string | null;
};

export type AuthMembership = {
  userId: string;
  locationId: string;
  role: "staff" | "manager";
};

export type AuthContext = {
  user: AuthUser;
  memberships: AuthMembership[];
};

export type OtpChallenge = {
  id: string;
  normalizedEmail: string;
  otpDigest: string;
  expiresAt: number;
  consumedAt: number | null;
  invalidatedAt: number | null;
  failedAttempts: number;
  maxAttempts: number;
  rateLimitKey: string;
  createdAt: number;
};

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  lastUsedAt: number | null;
};

export type AuthRepository = {
  findUserByEmail: (normalizedEmail: string) => Promise<AuthUser | null>;
  findUserById: (userId: string) => Promise<AuthUser | null>;
  listMemberships: (userId: string) => Promise<AuthMembership[]>;
  getLatestChallenge: (normalizedEmail: string) => Promise<OtpChallenge | null>;
  invalidateActiveChallenges: (normalizedEmail: string, at: number) => Promise<void>;
  insertChallenge: (challenge: OtpChallenge) => Promise<void>;
  updateChallenge: (id: string, patch: Partial<OtpChallenge>) => Promise<void>;
  insertSession: (session: AuthSession) => Promise<void>;
  getSessionByHash: (tokenHash: string) => Promise<AuthSession | null>;
  touchSession: (id: string, at: number) => Promise<void>;
  revokeSession: (id: string, at: number) => Promise<void>;
  setPassword: (userId: string, credential: PasswordCredential, at: number) => Promise<void>;
  revokeUserSessions: (userId: string, at: number) => Promise<void>;
};

export type PasswordCredential = {
  hash: string;
  salt: string;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const generateOtp = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

export const isValidOtp = (code: string) => /^\d{6}$/.test(code);

export const hashOtp = (normalizedEmail: string, code: string, pepper = process.env.AUTH_OTP_PEPPER) => {
  if (!pepper) throw new Error("AUTH_OTP_PEPPER is not configured");
  return createHmac("sha256", pepper).update(`${normalizedEmail}:${code}`).digest("hex");
};

export const generateSessionToken = () => randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string, secret = process.env.AUTH_SESSION_SECRET) => {
  if (!secret) throw new Error("AUTH_SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(token).digest("hex");
};

const equalDigest = (left: string, right: string) => {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

const passwordDigest = (password: string, salt: string) =>
  scryptSync(password, salt, 64, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

export const validatePassword = (password: unknown) => {
  if (typeof password !== "string" || password.trim().length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  return password;
};

export const createPasswordCredential = (password: unknown): PasswordCredential => {
  const value = validatePassword(password);
  const salt = randomBytes(16).toString("base64url");
  return { salt, hash: passwordDigest(value, salt).toString("base64url") };
};

export const verifyPassword = (password: unknown, user: AuthUser) => {
  if (typeof password !== "string" || !user.passwordHash || !user.passwordSalt) return false;
  const expected = Buffer.from(user.passwordHash, "base64url");
  const actual = passwordDigest(password, user.passwordSalt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

type LoginAttempt = { startedAt: number; failures: number; blockedUntil: number };
const passwordLoginAttempts = new Map<string, LoginAttempt>();

export class PasswordLoginRateLimitError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "PasswordLoginRateLimitError";
  }
}

const loginKey = (email: string, rateLimitKey?: string) => `${rateLimitKey ?? "unknown"}:${email}`;

function checkLoginRateLimit(key: string, now: number) {
  const current = passwordLoginAttempts.get(key);
  if (!current) return;
  if (current.startedAt + PASSWORD_LOGIN_WINDOW_MS <= now) {
    passwordLoginAttempts.delete(key);
    return;
  }
  if (current.blockedUntil > now) throw new PasswordLoginRateLimitError();
}

function recordLoginFailure(key: string, now: number) {
  const current = passwordLoginAttempts.get(key);
  const next = current && current.startedAt + PASSWORD_LOGIN_WINDOW_MS > now
    ? { ...current, failures: current.failures + 1 }
    : { startedAt: now, failures: 1, blockedUntil: 0 };
  if (next.failures >= PASSWORD_LOGIN_MAX_ATTEMPTS) next.blockedUntil = now + PASSWORD_LOGIN_WINDOW_MS;
  passwordLoginAttempts.set(key, next);
}

const recordLoginSuccess = (key: string) => passwordLoginAttempts.delete(key);

const newSession = (userId: string, now: number, sessionSecret?: string) => {
  const sessionToken = generateSessionToken();
  return {
    sessionToken,
    session: {
      id: randomUUID(),
      userId,
      tokenHash: hashSessionToken(sessionToken, sessionSecret),
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      revokedAt: null,
      lastUsedAt: null,
    } satisfies AuthSession,
  };
};

export const genericOtpResponse = () => ({
  ok: true,
  message: "If an account exists, a verification code has been sent.",
});

export async function requestOtp(
  repository: AuthRepository,
  input: { email: string; now?: number; rateLimitKey?: string; otpPepper?: string; send: (email: string, code: string) => Promise<void> },
) {
  const normalizedEmail = normalizeEmail(input.email);
  const now = input.now ?? Date.now();
  const user = await repository.findUserByEmail(normalizedEmail);

  if (!user) return genericOtpResponse();

  const latest = await repository.getLatestChallenge(normalizedEmail);
  if (
    latest &&
    latest.consumedAt === null &&
    latest.invalidatedAt === null &&
    latest.createdAt + OTP_RESEND_COOLDOWN_MS > now
  ) return genericOtpResponse();

  const code = generateOtp();
  await repository.invalidateActiveChallenges(normalizedEmail, now);
  const challenge: OtpChallenge = {
    id: randomUUID(),
    normalizedEmail,
    otpDigest: hashOtp(normalizedEmail, code, input.otpPepper),
    expiresAt: now + OTP_TTL_MS,
    consumedAt: null,
    invalidatedAt: null,
    failedAttempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    rateLimitKey: input.rateLimitKey ?? normalizedEmail,
    createdAt: now,
  };
  await repository.insertChallenge(challenge);
  try {
    await input.send(user.email, code);
  } catch (error) {
    try {
      await repository.updateChallenge(challenge.id, { invalidatedAt: now });
    } catch {
      // Preserve the delivery error; the database failure is not safe to expose.
    }
    throw error;
  }
  return genericOtpResponse();
}

export async function verifyOtp(
  repository: AuthRepository,
  input: { email: string; code: string; now?: number; otpPepper?: string; sessionSecret?: string },
) {
  const normalizedEmail = normalizeEmail(input.email);
  const now = input.now ?? Date.now();
  const challenge = await repository.getLatestChallenge(normalizedEmail);
  if (
    !challenge ||
    challenge.consumedAt !== null ||
    challenge.invalidatedAt !== null ||
    challenge.expiresAt <= now ||
    challenge.failedAttempts >= challenge.maxAttempts ||
    !isValidOtp(input.code)
  ) {
    return null;
  }

  const digest = hashOtp(normalizedEmail, input.code, input.otpPepper);
  if (!equalDigest(challenge.otpDigest, digest)) {
    const failedAttempts = challenge.failedAttempts + 1;
    await repository.updateChallenge(challenge.id, {
      failedAttempts,
      invalidatedAt: failedAttempts >= OTP_MAX_ATTEMPTS ? now : null,
    });
    return null;
  }

  const user = await repository.findUserByEmail(normalizedEmail);
  if (!user) return null;
  await repository.updateChallenge(challenge.id, { consumedAt: now });
  const created = newSession(user.id, now, input.sessionSecret);
  await repository.insertSession(created.session);
  return { sessionToken: created.sessionToken, user };
}

export async function loginWithPassword(
  repository: AuthRepository,
  input: { email: string; password: string; now?: number; rateLimitKey?: string; sessionSecret?: string },
) {
  const normalizedEmail = normalizeEmail(input.email);
  const now = input.now ?? Date.now();
  const key = loginKey(normalizedEmail, input.rateLimitKey);
  checkLoginRateLimit(key, now);
  const user = await repository.findUserByEmail(normalizedEmail);
  if (!user || !verifyPassword(input.password, user)) {
    recordLoginFailure(key, now);
    return null;
  }
  recordLoginSuccess(key);
  const created = newSession(user.id, now, input.sessionSecret);
  await repository.insertSession(created.session);
  return { sessionToken: created.sessionToken, user };
}

export async function setPassword(
  repository: AuthRepository,
  userId: string,
  password: unknown,
  input: { now?: number; sessionSecret?: string } = {},
) {
  const now = input.now ?? Date.now();
  const credential = createPasswordCredential(password);
  await repository.setPassword(userId, credential, now);
  await repository.revokeUserSessions(userId, now);
  const created = newSession(userId, now, input.sessionSecret);
  await repository.insertSession(created.session);
  const user = await repository.findUserById(userId);
  if (!user) return null;
  return { sessionToken: created.sessionToken, user };
}

export async function authenticateSession(
  repository: AuthRepository,
  token: string,
  input: { now?: number; sessionSecret?: string } = {},
) {
  const now = input.now ?? Date.now();
  const session = await repository.getSessionByHash(hashSessionToken(token, input.sessionSecret));
  if (!session || session.revokedAt !== null || session.expiresAt <= now) return null;
  const user = await repository.findUserById(session.userId);
  if (!user) return null;
  await repository.touchSession(session.id, now);
  return user;
}

export async function logoutSession(
  repository: AuthRepository,
  token: string,
  input: { now?: number; sessionSecret?: string } = {},
) {
  const session = await repository.getSessionByHash(hashSessionToken(token, input.sessionSecret));
  if (session && session.revokedAt === null) await repository.revokeSession(session.id, input.now ?? Date.now());
}

export const getAuthContext = async (repository: AuthRepository, user: AuthUser): Promise<AuthContext> => ({
  user,
  memberships: await repository.listMemberships(user.id),
});

export const requireAuthenticatedUser = (context: AuthContext | null | undefined) => {
  if (!context?.user) throw new Error("Authentication required");
  return context.user;
};

export const requireOrganisationAdmin = (context: AuthContext, organisationId: string) => {
  const user = requireAuthenticatedUser(context);
  if (user.role !== "admin" || user.organisationId !== organisationId) throw new Error("Organisation admin access required");
  return user;
};

export const requireLocationAccess = (context: AuthContext, locationId: string, organisationId: string) => {
  const user = requireAuthenticatedUser(context);
  if (user.role === "admin" && user.organisationId === organisationId) return user;
  if (context.memberships.some(membership => membership.locationId === locationId)) return user;
  throw new Error("Location access required");
};

export const requireLocationManager = (context: AuthContext, locationId: string, organisationId: string) => {
  const user = requireAuthenticatedUser(context);
  if (user.role === "admin" && user.organisationId === organisationId) return user;
  if (context.memberships.some(membership => membership.locationId === locationId && membership.role === "manager")) return user;
  throw new Error("Location manager access required");
};

export const safeUser = (user: AuthUser) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  organisationId: user.organisationId,
  hasPassword: user.hasPassword,
});

export const isAllowedOrigin = (origin: string | null, allowedOrigins: string[]) =>
  origin === null || allowedOrigins.includes(origin);
