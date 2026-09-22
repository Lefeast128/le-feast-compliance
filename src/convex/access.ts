import { query } from "./_generated/server";

export const temporaryAdminAccessEnabled = query({
  args: {},
  handler: async () => process.env.ENABLE_TEMP_ADMIN_ACCESS === "true",
});
