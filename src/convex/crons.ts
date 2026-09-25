import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const catalogueInternal = internal as any;

const crons = cronJobs();

crons.interval(
  "TouchOffice catalogue sync",
  { hours: 1 },
  catalogueInternal.catalogue.scheduledSync,
  {},
);

export default crons;
