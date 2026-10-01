import { assertMutationOrigin, readSessionCookie } from "../auth/cookies.js";
import { authenticateSession, getAuthContext, type AuthContext } from "../auth/core.js";
import { createDrizzleAuthRepository } from "../auth/drizzle-repository.js";
import { ApiError } from "./errors.js";
export { ApiError } from "./errors.js";

export type ApiRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export async function requireContext(req: ApiRequest): Promise<AuthContext> {
  const cookie = req.headers?.cookie;
  const token = readSessionCookie(cookie);
  if (!token) throw new ApiError(401, "Authentication required");
  const repository = createDrizzleAuthRepository();
  const user = await authenticateSession(repository, token);
  if (!user) throw new ApiError(401, "Authentication required");
  return getAuthContext(repository, user);
}

export function requireMutationRequest(req: ApiRequest) {
  try {
    assertMutationOrigin(req);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      throw new ApiError(403, error.message);
    }
    throw error;
  }
}

export function parseBody(req: ApiRequest) {
  let body: unknown;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Invalid JSON body");
  return body as Record<string, unknown>;
}

export function respondError(res: ApiResponse, error: unknown) {
  if (error instanceof ApiError) {
    res.status(error.status).json({ ok: false, error: error.message });
    return;
  }
  if (error instanceof Error && [
    "Location access required",
    "Location manager access required",
    "Organisation admin access required",
  ].includes(error.message)) {
    res.status(403).json({ ok: false, error: "Access denied" });
    return;
  }
  console.error("Compliance API request failed", error instanceof Error ? error.message : "unknown error");
  res.status(500).json({ ok: false, error: "Unable to complete request" });
}

export async function handleMutation(req: ApiRequest, res: ApiResponse, operation: (context: AuthContext, body: Record<string, unknown>) => Promise<unknown>) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    requireMutationRequest(req);
    const context = await requireContext(req);
    const body = parseBody(req);
    res.status(200).json({ ok: true, data: await operation(context, body) });
  } catch (error) {
    respondError(res, error);
  }
}

export const getRouteParam = (req: ApiRequest, name: string) => {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] : value;
};

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
