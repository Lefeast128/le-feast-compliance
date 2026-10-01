export type WastageExportRow = { Store: string; Date: string; "Food Type": string; Quantity: number };
type RecordValue = { itemName?: string | null; quantity?: string | null; noWaste: boolean; createdAt: Date };
type LocationValue = { name: string; shortName?: string | null; timezone: string };
const dateKey = (timestamp: Date, timezone: string) => { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(timestamp); const value = (type: string) => parts.find(part => part.type === type)?.value ?? ""; return `${value("year")}-${value("month")}-${value("day")}`; };
export function buildWastageExportRows(records: RecordValue[], location: LocationValue, start?: Date, end?: Date): WastageExportRow[] {
  const aggregated = new Map<string, { dateKey: string; foodType: string; quantity: number }>();
  const store = (location.shortName || location.name).trim();
  for (const record of records) {
    if (record.noWaste || (start && record.createdAt < start) || (end && record.createdAt > end)) continue;
    const foodType = record.itemName?.trim().replace(/^Reduced\s+/i, "").trim(); const quantityText = record.quantity?.trim();
    if (!foodType || foodType.toLowerCase() === "no waste" || !quantityText) continue;
    const quantity = Number(quantityText); if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const day = dateKey(record.createdAt, location.timezone); const key = `${day}\0${foodType}`; const current = aggregated.get(key); if (current) current.quantity += quantity; else aggregated.set(key, { dateKey: day, foodType, quantity });
  }
  return [...aggregated.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.foodType.localeCompare(b.foodType)).map(row => { const [year, month, day] = row.dateKey.split("-"); return { Store: store, Date: `${day}/${month}/${year}`, "Food Type": row.foodType, Quantity: row.quantity }; });
}
const key = (row: Pick<WastageExportRow, "Store" | "Date" | "Food Type">) => `${row.Store}\0${row.Date}\0${row["Food Type"]}`;
export function validateWastageRows(rows: WastageExportRow[]) { const keys = new Set<string>(); for (const [index, row] of rows.entries()) { if (!row || Object.keys(row).length !== 4 || !row.Store?.trim() || !row.Date?.trim() || !row["Food Type"]?.trim() || !Number.isFinite(row.Quantity) || row.Quantity <= 0) throw new Error(`Wastage export row ${index + 1} is invalid`); const rowKey = key(row); if (keys.has(rowKey)) throw new Error(`Duplicate wastage export row: ${rowKey}`); keys.add(rowKey); } }
export function rowKey(row: Pick<WastageExportRow, "Store" | "Date" | "Food Type">) { return key(row); }
