import { useEffect, useMemo, useState } from "react";

type Member = { _id: string; name: string };

/** Keeps the active operational signer scoped to one store and validates it against live staff. */
export function useActiveTeamMember(locationId: string | null | undefined, members: Member[]) {
  const key = locationId ? `lefeast.activeTeamMember.${locationId}` : null;
  const [value, setValue] = useState("");
  const memberIds = useMemo(() => new Set(members.map((member) => member._id)), [members]);

  const storedValue = useMemo(() => {
    if (!key || typeof window === "undefined") return "";
    try { return window.localStorage.getItem(key) ?? ""; } catch { return ""; }
  }, [key]);
  const effectiveValue = memberIds.has(value) ? value : memberIds.has(storedValue) ? storedValue : "";

  useEffect(() => {
    if (!effectiveValue) {
      if (key) try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ }
      return;
    }
    if (key) try { window.localStorage.setItem(key, effectiveValue); } catch { /* storage unavailable */ }
  }, [key, effectiveValue]);

  return [effectiveValue, setValue] as const;
}
