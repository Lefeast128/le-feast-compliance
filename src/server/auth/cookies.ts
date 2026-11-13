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
