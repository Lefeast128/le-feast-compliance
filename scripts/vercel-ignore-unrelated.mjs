// This repository is linked to an older Android test project.
// Never update that independent environment as a side effect of an Operations push.
process.exit(process.env.VERCEL_PROJECT_ID === "prj_VpxtFTYoacGz2oK54aMR49bDrWmv" ? 0 : 1);
