/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as additional from "../additional.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as catalogue from "../catalogue.js";
import type * as catalogueSync from "../catalogueSync.js";
import type * as compliance from "../compliance.js";
import type * as crons from "../crons.js";
import type * as googleSheets from "../googleSheets.js";
import type * as http from "../http.js";
import type * as locations from "../locations.js";
import type * as migrationBaseline from "../migrationBaseline.js";
import type * as permissions from "../permissions.js";
import type * as recovery from "../recovery.js";
import type * as users from "../users.js";
import type * as wastageSync from "../wastageSync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  additional: typeof additional;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  catalogue: typeof catalogue;
  catalogueSync: typeof catalogueSync;
  compliance: typeof compliance;
  crons: typeof crons;
  googleSheets: typeof googleSheets;
  http: typeof http;
  locations: typeof locations;
  migrationBaseline: typeof migrationBaseline;
  permissions: typeof permissions;
  recovery: typeof recovery;
  users: typeof users;
  wastageSync: typeof wastageSync;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
