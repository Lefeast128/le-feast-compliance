import { getVercelOidcToken } from "@vercel/oidc";
import {
  ExternalAccountClient,
  type BaseExternalAccountClient,
  type ExternalAccountClientOptions,
} from "google-auth-library";

const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const STS_TOKEN_URL = "https://sts.googleapis.com/v1/token";
const IAM_CREDENTIALS_URL = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts";

export type GoogleSheetsAuth = BaseExternalAccountClient;
type OidcTokenGetter = typeof getVercelOidcToken;
type AuthFactory = typeof ExternalAccountClient.fromJSON;

export type GoogleWorkloadIdentityConfig = {
  projectId: string;
  projectNumber: string;
  serviceAccountEmail: string;
  poolId: string;
  providerId: string;
};

export class GoogleSheetsAuthError extends Error {
  public readonly category: "configuration" | "oidc_token" | "google_auth";

  constructor(
    category: "configuration" | "oidc_token" | "google_auth",
    message: string,
  ) {
    super(message);
    this.name = "GoogleSheetsAuthError";
    this.category = category;
  }
}

export function readGoogleWorkloadIdentityConfig(): GoogleWorkloadIdentityConfig {
  const values = {
    projectId: process.env.GCP_PROJECT_ID?.trim(),
    projectNumber: process.env.GCP_PROJECT_NUMBER?.trim(),
    serviceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim(),
    poolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim(),
    providerId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim(),
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) {
    throw new GoogleSheetsAuthError(
      "configuration",
      `Google Workload Identity configuration is missing: ${missing.join(", ")}`,
    );
  }
  return values as GoogleWorkloadIdentityConfig;
}

export function buildGoogleWorkloadIdentityAudience(config: GoogleWorkloadIdentityConfig) {
  return `https://iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`;
}

export function buildGoogleExternalAccountOptions(
  config: GoogleWorkloadIdentityConfig,
  tokenGetter: OidcTokenGetter = getVercelOidcToken,
): ExternalAccountClientOptions {
  const audience = buildGoogleWorkloadIdentityAudience(config);
  return {
    type: "external_account",
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: STS_TOKEN_URL,
    service_account_impersonation_url: `${IAM_CREDENTIALS_URL}/${config.serviceAccountEmail}:generateAccessToken`,
    scopes: [GOOGLE_SHEETS_SCOPE],
    subject_token_supplier: {
      getSubjectToken: async () => {
        try {
          return await tokenGetter({ audience });
        } catch {
          throw new GoogleSheetsAuthError("oidc_token", "Vercel OIDC token exchange failed");
        }
      },
    },
  };
}

export async function getGoogleSheetsAuth({
  tokenGetter = getVercelOidcToken,
  authFactory = ExternalAccountClient.fromJSON,
}: {
  tokenGetter?: OidcTokenGetter;
  authFactory?: AuthFactory;
} = {}): Promise<GoogleSheetsAuth> {
  const config = readGoogleWorkloadIdentityConfig();
  try {
    const auth = authFactory(buildGoogleExternalAccountOptions(config, tokenGetter));
    if (!auth) {
      throw new Error("Google external account client could not be created");
    }
    return auth;
  } catch (error) {
    if (error instanceof GoogleSheetsAuthError) {
      throw error;
    }
    throw new GoogleSheetsAuthError(
      "google_auth",
      "Google Workload Identity authentication could not be initialized",
    );
  }
}
