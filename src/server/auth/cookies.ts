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

export const allowedOrigins = () => (process.env.AUTH_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

export const requestOrigin = (request: { headers?: Record<string, string | string[] | undefined> }) => {
  const origin = request.headers?.origin;
  return Array.isArray(origin) ? origin[0] ?? null : origin ?? null;
};

export const assertMutationOrigin = (request: { headers?: Record<string, string | string[] | undefined> }) => {
  const origin = requestOrigin(request);
  if (origin !== null && !allowedOrigins().includes(origin)) throw new Error("Invalid request origin");
};

// Session cookie for sign-ins from Le Feast Hub, where this app runs inside the
// hub's page. SameSite=Lax cookies are refused there, so this one is
// SameSite=None and Partitioned: the browser keeps it only for use inside the hub.
export const hubSessionCookie = (token: string, maxAgeSeconds: number) =>
  `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`;

export const clearHubSessionCookie = () =>
  `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`;
