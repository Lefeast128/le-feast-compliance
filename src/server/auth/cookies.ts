export const SESSION_COOKIE = "lf_session";

const parseCookies = (header: string | string[] | undefined) =>
  Object.fromEntries((Array.isArray(header) ? header[0] : header ?? "").split(";").map(part => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }).filter(([key]) => key));

export const readSessionCookie = (header: string | string[] | undefined) => parseCookies(header)[SESSION_COOKIE] || null;

export const sessionCookie = (token: string, maxAgeSeconds: number) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax${secure}`;
};

export const clearSessionCookie = () => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`;
};

const vercelHostOrigin = (value: string | undefined) => {
  const hostname = value?.trim().toLowerCase();
  if (!hostname || !/^[a-z0-9.-]+\.vercel\.app$/.test(hostname)) return null;
  try {
    const parsed = new URL(`https://${hostname}`);
    return parsed.hostname === hostname && parsed.origin === `https://${hostname}` ? parsed.origin : null;
  } catch {
    return null;
  }
};

// Previews are reachable at both the one-off deployment URL (VERCEL_URL) and the
// branch alias (VERCEL_BRANCH_URL) that GitHub and Vercel comments link to.
const vercelPreviewOrigins = () => {
  if (process.env.VERCEL_ENV !== "preview") return [];
  return [vercelHostOrigin(process.env.VERCEL_URL), vercelHostOrigin(process.env.VERCEL_BRANCH_URL)].filter((origin): origin is string => Boolean(origin));
};

export const allowedOrigins = () => [...new Set([
  ...(process.env.AUTH_ALLOWED_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean),
  ...vercelPreviewOrigins(),
])];

export const requestOrigin = (request: { headers?: Record<string, string | string[] | undefined> }) => {
  const origin = request.headers?.origin;
  return Array.isArray(origin) ? origin[0] ?? null : origin ?? null;
};

export const assertMutationOrigin = (request: { headers?: Record<string, string | string[] | undefined> }) => {
  const origin = requestOrigin(request);
  if (origin !== null && !allowedOrigins().includes(origin)) throw new Error("Invalid request origin");
};
