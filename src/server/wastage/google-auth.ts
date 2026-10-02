import {
  ConnectorInstallationRequiredError,
  ConnectError,
  NoValidTokenError,
  UserAuthorizationRequiredError,
  getToken,
} from "@vercel/connect";
import { google } from "googleapis";

export type GoogleSheetsAuth = ReturnType<typeof createOAuthClient>;
type TokenGetter = typeof getToken;
type AuthFactory = typeof createOAuthClient;

export class GoogleSheetsAuthError extends Error {
  public readonly category: "connector_missing" | "connector_not_attached" | "authorization_required" | "token_exchange_failed";

  constructor(
    category: "connector_missing" | "connector_not_attached" | "authorization_required" | "token_exchange_failed",
    message: string,
  ) {
    super(message);
    this.name = "GoogleSheetsAuthError";
    this.category = category;
  }
}

function createOAuthClient() {
  return new google.auth.OAuth2();
}

export async function getGoogleSheetsAuth({
  tokenGetter = getToken,
  authFactory = createOAuthClient,
}: {
  tokenGetter?: TokenGetter;
  authFactory?: AuthFactory;
} = {}) {
  const connectorId = process.env.GOOGLE_SHEETS_CONNECTOR_ID?.trim();
  if (!connectorId) {
    throw new GoogleSheetsAuthError("connector_missing", "Google Sheets connector is not configured");
  }

  try {
    const token = await tokenGetter(connectorId, { subject: { type: "app" } });
    const auth = authFactory();
    auth.setCredentials({ access_token: token });
    return auth;
  } catch (error) {
    if (error instanceof UserAuthorizationRequiredError) {
      throw new GoogleSheetsAuthError("authorization_required", "Google authorization is required");
    }
    if (error instanceof ConnectorInstallationRequiredError) {
      throw new GoogleSheetsAuthError("connector_not_attached", "Google connector is not attached");
    }
    if (error instanceof NoValidTokenError || error instanceof ConnectError) {
      throw new GoogleSheetsAuthError("token_exchange_failed", "Google connector token exchange failed");
    }
    throw new GoogleSheetsAuthError("token_exchange_failed", "Google connector token exchange failed");
  }
}
