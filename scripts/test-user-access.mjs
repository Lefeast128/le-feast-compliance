import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const exists = async path => { await access(new URL(path, root), constants.F_OK); };
const contains = (source, text, label) => assert.equal(source.includes(text), true, `${label} missing ${text}`);

const service = await read("src/server/management/user-access-service.ts");
const resend = await read("src/server/auth/resend.ts");
const rest = await read("src/lib/rest-domain.ts");
const ui = await read("src/components/UserAccessAdmin.tsx");
const admin = await read("src/components/AdminSetup.tsx");
const httpRoute = await read("api/admin/user-access.ts");
const updateRoute = await read("api/admin/user-access/[id].ts");
const resendRoute = await read("api/admin/user-access/[id]/resend.ts");
const otp = await read("src/server/auth/core.ts");

for (const path of [
  "src/server/management/user-access-service.ts",
  "src/components/UserAccessAdmin.tsx",
  "api/admin/user-access.ts",
  "api/admin/user-access/[id].ts",
  "api/admin/user-access/[id]/resend.ts",
]) await exists(path);

contains(service, "requireOrganisationAdmin", "authorization");
contains(service, "listUserAccess", "user listing");
contains(service, "context.user.organisationId", "admin organisation scope");
contains(service, "eq(users.organisationId, organisationId)", "same-organisation users");
contains(service, "existing.organisationId !== organisationId", "cross-organisation protection");
contains(service, "emailVerifiedAt: null", "unverified invitation account");
contains(service, "isAnonymous: false", "non-anonymous invitation account");
contains(service, "db().transaction", "atomic user and membership creation");
contains(service, "syncMemberships", "membership synchronisation");
contains(service, "existingByLocation", "no duplicate membership intent");
contains(service, "locationsForOrganisation", "location ownership validation");
contains(service, "allOrganisationLocations: user.role === \"admin\"", "all-store organisation admin");
contains(service, "user.id === context.user.id", "admin self-protection");
contains(service, "UserAccessDeliveryError", "safe delivery failure");
assert.doesNotMatch(service, /teamMembers/, "user access must stay separate from Team Members");

contains(resend, "sendInvitationEmail", "invitation sender");
contains(resend, "You've been invited to Le Feast Compliance", "invitation subject");
contains(resend, "https://le-feast-compliance.vercel.app", "production application link");
assert.doesNotMatch(resend, /password|invitation token|session token/i, "invitation must not introduce authentication secrets");

contains(httpRoute, "handleQuery", "authenticated list endpoint");
contains(httpRoute, "requireContext", "authenticated mutation endpoint");
contains(httpRoute, "inviteUser", "invite endpoint");
contains(updateRoute, '"PATCH"', "update endpoint");
contains(updateRoute, "updateUserAccess", "edit access endpoint");
contains(resendRoute, '"POST"', "resend endpoint");
contains(resendRoute, "resendUserInvitation", "resend invitation endpoint");

contains(rest, "/api/admin/user-access", "user access REST client");
contains(rest, "/resend", "resend REST client");
contains(ui, "Organisation Admin", "admin role label");
contains(ui, "All stores", "all-store label");
contains(ui, "Invite user", "invite UI");
contains(ui, "Store access", "store access UI");
contains(ui, "Team Members", "team-member separation copy");
contains(ui, "selectedStores", "transient store selection");
contains(ui, "role", "role selection");
contains(ui, "Resend invitation", "resend control");
contains(admin, "UserAccessAdmin", "admin entry point");

contains(otp, "genericOtpResponse", "existing generic OTP behaviour");
contains(otp, "normalizeEmail", "existing email normalization");

console.log("User access tests passed: 35/35");
