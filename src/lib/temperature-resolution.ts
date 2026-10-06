export type TemperatureResolutionResult = "normal" | "within_limit" | "fail" | "pass" | "complete" | "incomplete" | "open" | "monitoring" | "resolved" | "no" | "no_waste" | "recorded" | string | null | undefined;

export const resultLabel = (value: TemperatureResolutionResult) => {
  switch (value) {
    case "fail": return "Failed";
    case "pass": return "Passed";
    case "within_limit": return "Within limit";
    case "normal": return "Normal";
    case "complete": return "Complete";
    case "incomplete": return "Incomplete";
    case "open": return "Open";
    case "monitoring": return "Monitoring";
    case "resolved": return "Resolved";
    case "no": return "No";
    case "no_waste": return "No Waste";
    case "recorded": return "Recorded";
    default: return value == null || value === "" ? "Recorded" : String(value);
  }
};

export const issueStatusLabel = (value: TemperatureResolutionResult) => {
  switch (value) {
    case "monitoring": return "Monitoring";
    case "resolved": return "Resolved";
    case "open": return "Open";
    default: return resultLabel(value);
  }
};

export const correctiveActionLabel = ({
  issueStatus,
  hasAction,
  latestRecheckResult,
}: {
  issueStatus: TemperatureResolutionResult;
  hasAction: boolean;
  latestRecheckResult?: TemperatureResolutionResult;
}) => {
  if (issueStatus === "resolved") return "Issue resolved";
  if (latestRecheckResult === "fail") return "Recheck failed";
  if (latestRecheckResult === "pass") return "Recheck passed";
  if (hasAction) return "Corrective action recorded";
  return `${issueStatusLabel(issueStatus)} issue`;
};
