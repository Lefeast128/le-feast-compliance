export type WastageExportRow = {
  Store: string;
  Date: string;
  "Food Type": string;
  Quantity: number;
};

type WastageRecord = {
  itemName?: string;
  quantity?: string;
  noWaste: boolean;
  createdAt: number;
};

type WastageLocation = {
  name: string;
  shortName?: string;
  timezone: string;
};

const SHEET_COLUMNS = ["Store", "Date", "Food Type", "Quantity"] as const;

function localDateKey(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  const value = (type: string) =>
    parts.find(part => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function buildWastageExportRows(
  records: WastageRecord[],
  location: WastageLocation,
  start?: number,
  end?: number,
): WastageExportRow[] {
  const aggregated = new Map<string, { dateKey: string; foodType: string; quantity: number }>();
  const store = (location.shortName || location.name).trim();

  for (const record of records) {
    if (
      record.noWaste ||
      (start !== undefined && record.createdAt < start) ||
      (end !== undefined && record.createdAt > end)
    ) {
      continue;
    }

    const foodType = record.itemName?.trim().replace(/^Reduced\s+/i, "").trim();
    const quantityText = record.quantity?.trim();
    if (!foodType || foodType.toLowerCase() === "no waste" || !quantityText) continue;

    const quantity = Number(quantityText);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const dateKey = localDateKey(record.createdAt, location.timezone);
    const key = `${dateKey}\u0000${foodType}`;
    const existing = aggregated.get(key);
    if (existing) existing.quantity += quantity;
    else aggregated.set(key, { dateKey, foodType, quantity });
  }

  return [...aggregated.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.foodType.localeCompare(b.foodType))
    .map(row => {
      const [year, month, day] = row.dateKey.split("-");
      return {
        Store: store,
        Date: `${day}/${month}/${year}`,
        "Food Type": row.foodType,
        Quantity: row.quantity,
      };
    });
}

function rowKey(row: Pick<WastageExportRow, "Store" | "Date" | "Food Type">) {
  return `${row.Store}\u0000${row.Date}\u0000${row["Food Type"]}`;
}

export function validateWastageRows(rows: WastageExportRow[]) {
  const keys = new Set<string>();

  for (const [index, row] of rows.entries()) {
    if (
      !row ||
      Object.keys(row).length !== SHEET_COLUMNS.length ||
      SHEET_COLUMNS.some(column => !(column in row))
    ) {
      throw new Error(`Wastage export row ${index + 1} has invalid columns`);
    }
    if (
      !row.Store.trim() ||
      !row.Date.trim() ||
      !row["Food Type"].trim() ||
      !Number.isFinite(row.Quantity) ||
      row.Quantity <= 0
    ) {
      throw new Error(`Wastage export row ${index + 1} is invalid`);
    }

    const key = rowKey(row);
    if (keys.has(key)) throw new Error(`Duplicate wastage export row: ${key}`);
    keys.add(key);
  }
}

type SheetValuesApi = {
  get: (request: { spreadsheetId: string; range: string }) => Promise<{ data?: { values?: unknown[][] } }>;
  batchUpdate: (request: { spreadsheetId: string; requestBody: { valueInputOption: string; data: Array<{ range: string; values: unknown[][] }> } }) => Promise<unknown>;
};

function quoteSheetName(tabName: string) {
  return `'${tabName.replace(/'/g, "''")}'`;
}

function readExistingRows(values: unknown[][] | undefined) {
  if (!values?.length) return { hasHeader: false, rows: [] as Array<{ rowNumber: number; row: WastageExportRow }> };

  const header = values[0] ?? [];
  if (SHEET_COLUMNS.some((column, index) => header[index] !== column) || header.length !== SHEET_COLUMNS.length) {
    throw new Error("Google Sheet has unexpected wastage headers");
  }

  const rows: Array<{ rowNumber: number; row: WastageExportRow }> = [];
  for (let index = 1; index < values.length; index++) {
    const value = values[index] ?? [];
    if (!value.length || value.every(item => String(item ?? "").trim() === "")) continue;
    const row = {
      Store: String(value[0] ?? ""),
      Date: String(value[1] ?? ""),
      "Food Type": String(value[2] ?? ""),
      Quantity: Number(value[3]),
    };
    if (!row.Store.trim() || !row.Date.trim() || !row["Food Type"].trim() || !Number.isFinite(row.Quantity)) {
      throw new Error(`Google Sheet row ${index + 1} is invalid`);
    }
    rows.push({ rowNumber: index + 1, row });
  }
  return { hasHeader: true, rows };
}

export async function syncWastageRows(
  sheets: { spreadsheets: { values: SheetValuesApi } },
  spreadsheetId: string,
  tabName: string,
  rows: WastageExportRow[],
) {
  validateWastageRows(rows);
  const range = `${quoteSheetName(tabName)}!A:D`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const existing = readExistingRows(response.data?.values);
  const existingByKey = new Map<string, { rowNumber: number; row: WastageExportRow }>();

  for (const item of existing.rows) {
    const key = rowKey(item.row);
    if (existingByKey.has(key)) throw new Error(`Google Sheet contains duplicate wastage row: ${key}`);
    existingByKey.set(key, item);
  }

  const data: Array<{ range: string; values: unknown[][] }> = [];
  if (!existing.hasHeader) data.push({ range: `${quoteSheetName(tabName)}!A1:D1`, values: [SHEET_COLUMNS as unknown as string[]] });

  const appended: WastageExportRow[] = [];
  for (const row of rows) {
    const current = existingByKey.get(rowKey(row));
    if (current) {
      if (current.row.Quantity !== row.Quantity) {
        data.push({ range: `${quoteSheetName(tabName)}!D${current.rowNumber}`, values: [[row.Quantity]] });
      }
    } else {
      appended.push(row);
    }
  }

  if (appended.length) {
    const startRow = (response.data?.values?.length ?? 1) + 1;
    data.push({
      range: `${quoteSheetName(tabName)}!A${startRow}:D${startRow + appended.length - 1}`,
      values: appended.map(row => [row.Store, row.Date, row["Food Type"], row.Quantity]),
    });
  }

  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  }

  return {
    updated: data.filter(item => item.range.includes("!D")).length,
    appended: appended.length,
    unchanged: rows.length - appended.length - data.filter(item => item.range.includes("!D")).length,
  };
}
