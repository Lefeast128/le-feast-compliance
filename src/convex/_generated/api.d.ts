/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
  AnyComponents,
} from "convex/server";
import type * as additional from "../additional.js";
import type * as auth from "../auth.js";
import type * as compliance from "../compliance.js";
import type * as http from "../http.js";
import type * as locations from "../locations.js";
import type * as users from "../users.js";

declare const fullApi: ApiFromModules<{
  additional: typeof additional;
  auth: typeof auth;
  compliance: typeof compliance;
  http: typeof http;
  locations: typeof locations;
  users: typeof users;
}>;

export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
export declare const components: AnyComponents;
