import { createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_LOGIN_MAX_ATTEMPTS = 5;
export const OTP_IP_WINDOW_MS = 15 * 60 * 1000;
export const OTP_IP_MAX_REQUESTS = 10;

export type AuthUser = {
  id: string;
  organisationId: string | null;
  email: string;
  name: string | null;
  role: "user" | "admin";
  hasPassword: boolean;
  active: boolean;
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
  // Durable rate limiting. Optional so lightweight test repositories can omit them;
  // the in-memory fallback is only suitable for a single long-lived process.
  getLoginAttempt?: (key: string) => Promise<LoginAttempt | null>;
  saveLoginAttempt?: (key: string, attempt: LoginAttempt) => Promise<void>;
  clearLoginAttempt?: (key: string) => Promise<void>;
  countRecentChallengesByRateLimitKey?: (rateLimitKey: string, since: number) => Promise<number>;
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

export type LoginAttempt = { startedAt: number; failures: number; blockedUntil: number };
const memoryLoginAttempts = new Map<string, LoginAttempt>();

export class PasswordLoginRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds = Math.ceil(PASSWORD_LOGIN_WINDOW_MS / 1000)) {
    super("Too many sign-in attempts");
    this.name = "PasswordLoginRateLimitError";
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

// Lockouts apply to any email (known or not), so this message does not reveal accounts.
export const passwordLockoutMessage = (retryAfterSeconds: number) => {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many sign-in attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again, or use "Forgot password?".`;
};

// Keyed by account, not IP, so rotating addresses cannot reset the counter.
const loginKey = (email: string) => `password:${email}`;

const loginAttemptStore = (repository: AuthRepository) => ({
  get: (key: string) => repository.getLoginAttempt ? repository.getLoginAttempt(key) : Promise.resolve(memoryLoginAttempts.get(key) ?? null),
  save: (key: string, attempt: LoginAttempt) => repository.saveLoginAttempt ? repository.saveLoginAttempt(key, attempt) : Promise.resolve(void memoryLoginAttempts.set(key, attempt)),
  clear: (key: string) => repository.clearLoginAttempt ? repository.clearLoginAttempt(key) : Promise.resolve(void memoryLoginAttempts.delete(key)),
});

async function checkLoginRateLimit(repository: AuthRepository, key: string, now: number) {
  const current = await loginAttemptStore(repository).get(key);
  if (current && current.startedAt + PASSWORD_LOGIN_WINDOW_MS > now && current.blockedUntil > now) throw new PasswordLoginRateLimitError((current.blockedUntil - now) / 1000);
  return current;
}

async function recordLoginFailure(repository: AuthRepository, key: string, current: LoginAttempt | null, now: number) {
  const next = current && current.startedAt + PASSWORD_LOGIN_WINDOW_MS > now
    ? { ...current, failures: current.failures + 1 }
    : { startedAt: now, failures: 1, blockedUntil: 0 };
  if (next.failures >= PASSWORD_LOGIN_MAX_ATTEMPTS) next.blockedUntil = now + PASSWORD_LOGIN_WINDOW_MS;
  await loginAttemptStore(repository).save(key, next);
}

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
  if (input.rateLimitKey && repository.countRecentChallengesByRateLimitKey) {
    const recent = await repository.countRecentChallengesByRateLimitKey(input.rateLimitKey, now - OTP_IP_WINDOW_MS);
    if (recent >= OTP_IP_MAX_REQUESTS) return genericOtpResponse();
  }
  const user = await repository.findUserByEmail(normalizedEmail);

  if (!user || user.active === false) return genericOtpResponse();

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
  if (!user || user.active === false) return null;
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
  const key = loginKey(normalizedEmail);
  const attempt = await checkLoginRateLimit(repository, key, now);
  const user = await repository.findUserByEmail(normalizedEmail);
  if (!user || user.active === false || !verifyPassword(input.password, user)) {
    await recordLoginFailure(repository, key, attempt, now);
    return null;
  }
  if (attempt) await loginAttemptStore(repository).clear(key);
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
  const user = await repository.findUserById(userId);
  if (!user || user.active === false) return null;
  const created = newSession(userId, now, input.sessionSecret);
  await repository.insertSession(created.session);
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
  if (!user || user.active === false) {
    await repository.revokeSession(session.id, now);
    return null;
  }
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
