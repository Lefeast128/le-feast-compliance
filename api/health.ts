import { checkDatabase } from "../src/server/health.ts";

type Request = { method?: string };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    res.status(200).json(await checkDatabase());
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
}
