"use node";

import { google } from "googleapis";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { syncWastageRows, type WastageExportRow } from "./wastageSync";

// The generated internal API includes this module itself, so keep the cross-module
// lookup dynamic to avoid a circular type reference during Convex typechecking.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const complianceInternal = internal as any;

function googleSheetsConfig() {
  const required = {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim(),
    tabName: process.env.GOOGLE_SHEETS_TAB_NAME?.trim(),
    clientEmail: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL?.trim(),
    privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Google Sheets configuration is missing: ${missing.join(", ")}`);
  }

  return required as {
    spreadsheetId: string;
    tabName: string;
    clientEmail: string;
    privateKey: string;
  };
}

async function syncWastageSheet(ctx: ActionCtx): Promise<{
  ok: true;
  rowCount: number;
  updated: number;
  appended: number;
  unchanged: number;
}> {
  const config = googleSheetsConfig();
  const rows: WastageExportRow[] = await ctx.runQuery(complianceInternal.compliance.wastageExportAll, {});
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const result = await syncWastageRows(
    sheets as unknown as Parameters<typeof syncWastageRows>[0],
    config.spreadsheetId,
    config.tabName,
    rows,
  );
  return { ok: true, rowCount: rows.length, ...result };
}

export const scheduledSync = internalAction({
  args: {},
  handler: async ctx => syncWastageSheet(ctx),
});
