export function cronAuthorized(headers: Record<string, string | string[] | undefined> | undefined) {
  const configured = process.env.CRON_SECRET?.trim();
  const raw = headers?.authorization;
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  return Boolean(configured && authorization === `Bearer ${configured}`);
}
