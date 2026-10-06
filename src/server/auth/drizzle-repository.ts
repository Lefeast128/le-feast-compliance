import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { authOtpChallenges, authSessions, memberships, users } from "../db/schema.js";
import type { AuthMembership, AuthRepository, AuthSession, AuthUser, OtpChallenge } from "./core.js";

const toUser = (row: typeof users.$inferSelect): AuthUser => ({
  id: row.id,
  organisationId: row.organisationId,
  email: row.email,
  name: row.name,
  role: row.role,
  active: row.active,
  hasPassword: Boolean(row.passwordHash),
  passwordHash: row.passwordHash,
  passwordSalt: row.passwordSalt,
});

const toChallenge = (row: typeof authOtpChallenges.$inferSelect): OtpChallenge => ({
  id: row.id,
  normalizedEmail: row.normalizedEmail,
  otpDigest: row.otpDigest,
  expiresAt: row.expiresAt.getTime(),
  consumedAt: row.consumedAt?.getTime() ?? null,
  invalidatedAt: row.invalidatedAt?.getTime() ?? null,
  failedAttempts: row.failedAttempts,
  maxAttempts: row.maxAttempts,
  rateLimitKey: row.rateLimitKey,
  createdAt: row.createdAt.getTime(),
});

const toSession = (row: typeof authSessions.$inferSelect): AuthSession => ({
  id: row.id,
  userId: row.userId,
  tokenHash: row.tokenHash,
  createdAt: row.createdAt.getTime(),
  expiresAt: row.expiresAt.getTime(),
  revokedAt: row.revokedAt?.getTime() ?? null,
  lastUsedAt: row.lastUsedAt?.getTime() ?? null,
});

export const createDrizzleAuthRepository = (): AuthRepository => {
  const db = getDb();

  return {
    async findUserByEmail(normalizedEmail) {
      const rows = await db.select().from(users).where(eq(users.normalizedEmail, normalizedEmail)).limit(1);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findUserById(userId) {
      const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async listMemberships(userId) {
      const rows = await db.select().from(memberships).where(eq(memberships.userId, userId));
      return rows.map(row => ({ userId: row.userId, locationId: row.locationId, role: row.role })) as AuthMembership[];
    },
    async getLatestChallenge(normalizedEmail) {
      const rows = await db.select().from(authOtpChallenges)
        .where(eq(authOtpChallenges.normalizedEmail, normalizedEmail))
        .orderBy(desc(authOtpChallenges.createdAt)).limit(1);
      return rows[0] ? toChallenge(rows[0]) : null;
    },
    async invalidateActiveChallenges(normalizedEmail, at) {
      await db.update(authOtpChallenges).set({ invalidatedAt: new Date(at) }).where(and(
        eq(authOtpChallenges.normalizedEmail, normalizedEmail),
        isNull(authOtpChallenges.consumedAt),
        isNull(authOtpChallenges.invalidatedAt),
      ));
    },
    async insertChallenge(challenge) {
      await db.insert(authOtpChallenges).values({
        id: challenge.id,
        normalizedEmail: challenge.normalizedEmail,
        otpDigest: challenge.otpDigest,
        expiresAt: new Date(challenge.expiresAt),
        consumedAt: null,
        invalidatedAt: null,
        failedAttempts: challenge.failedAttempts,
        maxAttempts: challenge.maxAttempts,
        rateLimitKey: challenge.rateLimitKey,
        createdAt: new Date(challenge.createdAt),
      });
    },
    async updateChallenge(id, patch) {
      await db.update(authOtpChallenges).set({
        consumedAt: patch.consumedAt === undefined ? undefined : patch.consumedAt === null ? null : new Date(patch.consumedAt),
        invalidatedAt: patch.invalidatedAt === undefined ? undefined : patch.invalidatedAt === null ? null : new Date(patch.invalidatedAt),
        failedAttempts: patch.failedAttempts,
      }).where(eq(authOtpChallenges.id, id));
    },
    async insertSession(session) {
      await db.insert(authSessions).values({
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        createdAt: new Date(session.createdAt),
        expiresAt: new Date(session.expiresAt),
        revokedAt: null,
        lastUsedAt: null,
      });
    },
    async getSessionByHash(tokenHash) {
      const rows = await db.select().from(authSessions).where(eq(authSessions.tokenHash, tokenHash)).limit(1);
      return rows[0] ? toSession(rows[0]) : null;
    },
    async touchSession(id, at) {
      await db.update(authSessions).set({ lastUsedAt: new Date(at) }).where(eq(authSessions.id, id));
    },
    async revokeSession(id, at) {
      await db.update(authSessions).set({ revokedAt: new Date(at) }).where(eq(authSessions.id, id));
    },
    async setPassword(userId, credential, at) {
      await db.update(users).set({ passwordHash: credential.hash, passwordSalt: credential.salt, passwordSetAt: new Date(at) }).where(eq(users.id, userId));
    },
    async revokeUserSessions(userId, at) {
      await db.update(authSessions).set({ revokedAt: new Date(at) }).where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
    },
  };
};
