export type IssueUpdateType = "further_action" | "resolution";
export type IssueStatus = "open" | "monitoring" | "resolved";

export type IssueUpdateSelection = {
  updateType: IssueUpdateType;
  status: IssueStatus;
};

export function selectIssueUpdateType(selection: IssueUpdateSelection, updateType: IssueUpdateType): IssueUpdateSelection {
  return updateType === "resolution"
    ? { updateType, status: "resolved" }
    : { updateType, status: selection.status === "resolved" ? "monitoring" : selection.status };
}

export function selectIssueStatus(selection: IssueUpdateSelection, status: IssueStatus): IssueUpdateSelection {
  return status === "resolved"
    ? { updateType: "resolution", status }
    : { updateType: selection.updateType === "resolution" ? "further_action" : selection.updateType, status };
}

export function issueUpdateActionLabel(updateType: IssueUpdateType) {
  return updateType === "resolution" ? "Resolve issue" : "Add update";
}
