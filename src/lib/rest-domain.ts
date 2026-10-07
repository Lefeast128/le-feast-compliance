/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { put as putBlob } from "@vercel/blob/client";
import { apiRequest } from "@/lib/api-client";
import { dateKeyFrom } from "@/lib/date-key";
import { MAX_PDF_BYTES } from "@/lib/pdf-constants.js";

type AnyRecord = Record<string, any>;

export type UserAccessLocation = { id: string; name: string; shortName: string };
export type UserAccessRole = "staff" | "manager";
export type UserAccessMembership = UserAccessLocation & { locationId: string; membershipId: string; role: "staff" | "manager" };
export type UserAccessUser = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  isPendingInvite: boolean;
  isSelf: boolean;
  allOrganisationLocations: boolean;
  memberships: UserAccessMembership[];
};
export type UserAccessResponse = {
  currentUserId: string;
  locations: UserAccessLocation[];
  users: UserAccessUser[];
  accessHistory: Array<{
    occurredAt: string;
    adminName: string;
    userName: string;
    userEmail: string;
    change: string;
  }>;
};

const unwrap = <T>(body: any): T => (body && typeof body === "object" && "data" in body ? body.data : body) as T;

const compat = (value: any): any => {
  if (Array.isArray(value)) return value.map(compat);
  if (!value || typeof value !== "object") return value;
  const result: AnyRecord = {};
  for (const [key, item] of Object.entries(value)) result[key] = compat(item);
  if (typeof result.id === "string" && result._id === undefined) result._id = result.id;
  return result;
};

const idOf = (value: any) => value?._id ?? value?.id ?? value;
const query = (path: string): Promise<any> => apiRequest<any>(path).then((body) => unwrap<any>(body));
const post = (path: string, body: AnyRecord): Promise<any> => apiRequest<any>(path, { method: "POST", body: JSON.stringify(body) }).then((value) => unwrap<any>(value));
const patch = (path: string, body: AnyRecord): Promise<any> => apiRequest<any>(path, { method: "PATCH", body: JSON.stringify(body) }).then((value) => unwrap<any>(value));
const remove = (path: string): Promise<any> => apiRequest<any>(path, { method: "DELETE" }).then((value) => unwrap<any>(value));

const dateKey = (value: any) => {
  return dateKeyFrom(value);
};

export const restApi = {
  locations: { myLocations: async () => compat(await query("/api/locations").then((value: any) => value.locations ?? value)) },
  catalogue: {
    list: async ({ locationId }: AnyRecord) => compat(await query(`/api/catalogue?locationId=${encodeURIComponent(locationId)}`)),
    wastage: async ({ locationId, search }: AnyRecord) => {
      const params = new URLSearchParams({ locationId: String(locationId) });
      if (typeof search === "string" && search.trim()) params.set("search", search.trim());
      return compat(await query(`/api/catalogue/wastage?${params.toString()}`));
    },
    updateWastage: ({ productId, ...body }: AnyRecord) => patch(`/api/catalogue/${encodeURIComponent(idOf(productId))}`, body),
    refresh: (body: AnyRecord) => post("/api/catalogue/refresh", body),
  },
  compliance: {
    dashboard: async ({ locationId }: AnyRecord) => compat(await query(`/api/dashboard?locationId=${encodeURIComponent(locationId)}`)),
    operations: async () => compat(await query("/api/operations")),
    calendar: async ({ locationId, monthStart, monthEnd }: AnyRecord) => {
      const value = await query(`/api/calendar?locationId=${encodeURIComponent(locationId)}&monthStart=${dateKey(monthStart)}&monthEnd=${dateKey(monthEnd)}`);
      return compat(value?.days ?? value);
    },
    archive: async ({ locationId, start, end }: AnyRecord) => compat(await query(`/api/archive?locationId=${encodeURIComponent(locationId)}&start=${dateKey(start)}&end=${dateKey(end)}`)),
    team: async ({ locationId }: AnyRecord) => ({
      members: compat(await query(`/api/team-members?locationId=${encodeURIComponent(locationId)}`)),
    }),
    startRound: async (body: AnyRecord) => {
      const value: any = await post("/api/compliance/temperature-rounds", body);
      return value?.roundId ?? value;
    },
    recordTemperature: (body: AnyRecord) => post("/api/compliance/temperature-readings", body),
    completeRound: (body: AnyRecord) => post(`/api/compliance/temperature-rounds/${encodeURIComponent(idOf(body.roundId))}/complete`, body),
    recordFoodCheck: (body: AnyRecord) => post("/api/compliance/food-checks", body),
    recordProbeRecheck: (body: AnyRecord) => post(`/api/compliance/probe-issues/${encodeURIComponent(idOf(body.issueId))}/recheck`, body),
    saveChecklistResponse: (body: AnyRecord) => post("/api/compliance/checklists/responses", body),
    signOffChecklist: (body: AnyRecord) => post("/api/compliance/checklists/signoff", body),
    saveSecurityResponse: (body: AnyRecord) => post("/api/compliance/security/responses", body),
    signOffSecurity: (body: AnyRecord) => post("/api/compliance/security/signoff", body),
    recordWastage: (body: AnyRecord) => post("/api/compliance/wastage", body),
    completeCleaningTask: (body: AnyRecord) => post("/api/compliance/cleaning/completions", body),
    structuredTasks: async ({ locationId, date }: AnyRecord) => {
      const params = new URLSearchParams({ locationId: String(locationId) });
      if (date) params.set("date", dateKey(date));
      return compat(await query(`/api/structured-tasks?${params.toString()}`));
    },
    saveStructuredTaskResponse: (body: AnyRecord) => post("/api/compliance/structured-tasks/responses", body),
    signOffStructuredTask: (body: AnyRecord) => post("/api/compliance/structured-tasks/signoff", body),
    createManualIssue: (body: AnyRecord) => post("/api/compliance/issues", body),
    addIssueAction: (body: AnyRecord) => post(`/api/compliance/issues/${encodeURIComponent(idOf(body.issueId))}/action`, body),
    addRecheck: (body: AnyRecord) => post(`/api/compliance/issues/${encodeURIComponent(idOf(body.issueId))}/recheck`, body),
    addIssueUpdate: (body: AnyRecord) => post(`/api/compliance/issues/${encodeURIComponent(idOf(body.issueId))}/updates`, body),
    completeTrainingRequirement: (body: AnyRecord) => post("/api/training/complete", body),
  },
  reports: {
    compliance: async ({ locationId, start, end }: AnyRecord) => compat(await query(`/api/reports/compliance?locationId=${encodeURIComponent(locationId)}&start=${dateKey(start)}&end=${dateKey(end)}`)),
  },
  library: {
    list: async ({ locationId }: AnyRecord) => compat(await query(`/api/library?locationId=${encodeURIComponent(locationId)}`)),
  },
  managerReviews: {
    list: async ({ locationId }: AnyRecord) => compat(await query(`/api/manager-reviews?locationId=${encodeURIComponent(locationId)}`)),
    complete: (body: AnyRecord) => post("/api/manager-reviews", body),
  },
  additional: {
    dashboard: async ({ locationId }: AnyRecord) => compat(await query(`/api/additional?locationId=${encodeURIComponent(locationId)}`)),
    history: async ({ locationId, start, end }: AnyRecord) => compat(await query(`/api/additional/history?locationId=${encodeURIComponent(locationId)}&start=${dateKey(start)}&end=${dateKey(end)}`)),
    generateUploadUrl: async ({ locationId, data, filename, contentType, purpose }: AnyRecord) => documentsApi.upload({ locationId, data, filename, contentType, purpose: purpose ?? "additional_check_certificate" }),
    complete: (body: AnyRecord) => post("/api/additional/complete", body),
    list: async ({ locationId }: AnyRecord) => compat(await query(`/api/admin/additional-requirements?locationId=${encodeURIComponent(locationId)}`)),
    add: (body: AnyRecord) => post("/api/admin/additional-requirements", body),
    update: (body: AnyRecord) => patch(`/api/admin/additional-requirements/${encodeURIComponent(idOf(body.requirementId))}`, body),
    remove: (body: AnyRecord) => remove(`/api/admin/additional-requirements/${encodeURIComponent(idOf(body.requirementId))}`),
    reorder: (body: AnyRecord) => post(`/api/admin/additional-requirements/${encodeURIComponent(idOf(body.requirementId))}/reorder`, body),
  },
  admin: {
    addEquipment: (body: AnyRecord) => post("/api/admin/equipment", body),
    updateEquipmentLimits: (body: AnyRecord) => patch(`/api/admin/equipment/${encodeURIComponent(idOf(body.equipmentId))}`, body),
    setFridgeCount: (body: AnyRecord) => post("/api/admin/equipment/count", body),
    addProbeProduct: (body: AnyRecord) => post("/api/admin/probe-products", body),
    updateProbeProduct: (body: AnyRecord) => patch(`/api/admin/probe-products/${encodeURIComponent(idOf(body.productId))}`, body),
    deleteProbeProduct: (body: AnyRecord) => remove(`/api/admin/probe-products/${encodeURIComponent(idOf(body.productId))}`),
    addChecklistQuestion: (body: AnyRecord) => post("/api/admin/checklist-questions", body),
    updateChecklistQuestion: (body: AnyRecord) => patch(`/api/admin/checklist-questions/${encodeURIComponent(idOf(body.questionId))}`, body),
    deleteChecklistQuestion: (body: AnyRecord) => remove(`/api/admin/checklist-questions/${encodeURIComponent(idOf(body.questionId))}`),
    reorderChecklistQuestion: (body: AnyRecord) => post(`/api/admin/checklist-questions/${encodeURIComponent(idOf(body.questionId))}/reorder`, body),
    addCleaningTask: (body: AnyRecord) => post("/api/admin/cleaning-tasks", body),
    updateCleaningTask: (body: AnyRecord) => patch(`/api/admin/cleaning-tasks/${encodeURIComponent(idOf(body.taskId))}`, body),
    deleteCleaningTask: (body: AnyRecord) => remove(`/api/admin/cleaning-tasks/${encodeURIComponent(idOf(body.taskId))}`),
    reorderCleaningTask: (body: AnyRecord) => post(`/api/admin/cleaning-tasks/${encodeURIComponent(idOf(body.taskId))}/reorder`, body),
    addSecurityQuestion: (body: AnyRecord) => post("/api/admin/security-questions", body),
    updateSecurityQuestion: (body: AnyRecord) => patch(`/api/admin/security-questions/${encodeURIComponent(idOf(body.questionId))}`, body),
    deleteSecurityQuestion: (body: AnyRecord) => remove(`/api/admin/security-questions/${encodeURIComponent(idOf(body.questionId))}`),
    addWastageItem: (body: AnyRecord) => post("/api/admin/wastage-items", body),
    updateWastageItem: (body: AnyRecord) => patch(`/api/admin/wastage-items/${encodeURIComponent(idOf(body.itemId))}`, body),
    deleteWastageItem: (body: AnyRecord) => remove(`/api/admin/wastage-items/${encodeURIComponent(idOf(body.itemId))}`),
    reorderWastageItem: (body: AnyRecord) => post(`/api/admin/wastage-items/${encodeURIComponent(idOf(body.itemId))}/reorder`, body),
    updateStructuredTask: (body: AnyRecord) => patch(`/api/admin/structured-tasks/${encodeURIComponent(idOf(body.taskId))}`, body),
    addTrainingRequirement: (body: AnyRecord) => post("/api/admin/training-requirements", body),
    updateTrainingRequirement: (body: AnyRecord) => patch(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}`, body),
    deleteTrainingRequirement: (body: AnyRecord) => remove(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}`),
    reorderTrainingRequirement: (body: AnyRecord) => post(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}/reorder`, body),
    attachTrainingDocument: (body: AnyRecord) => post(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}/document`, body),
    removeTrainingDocument: (body: AnyRecord) => post(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}/document`, { remove: true }),
    addTeamMemberName: (body: AnyRecord) => post("/api/team-members", body),
    updateTeamMemberName: (body: AnyRecord) => patch(`/api/team-members/${encodeURIComponent(idOf(body.memberId))}`, body),
    deactivateTeamMember: (body: AnyRecord) => remove(`/api/team-members/${encodeURIComponent(idOf(body.memberId))}`),
    userAccess: {
      list: async (): Promise<UserAccessResponse> => compat(await query("/api/admin/user-access")),
      invite: (body: AnyRecord) => post("/api/admin/user-access", body),
      update: ({ userId, ...body }: AnyRecord) => patch(`/api/admin/user-access/${encodeURIComponent(idOf(userId))}`, body),
      remove: ({ userId }: AnyRecord) => remove(`/api/admin/user-access/${encodeURIComponent(idOf(userId))}`),
      resend: ({ userId }: AnyRecord) => post(`/api/admin/user-access/${encodeURIComponent(idOf(userId))}/resend`, {}),
    },
    organisation: {
      list: async () => compat(await query("/api/admin/organisation")),
      library: {
        list: async () => compat(await query("/api/admin/organisation/library")),
        publish: (body: AnyRecord) => post("/api/admin/organisation/library", body),
        update: ({ libraryDocumentId, ...body }: AnyRecord) => patch(`/api/admin/organisation/library/${encodeURIComponent(idOf(libraryDocumentId))}`, body),
        replace: ({ libraryDocumentId, ...body }: AnyRecord) => post(`/api/admin/organisation/library/${encodeURIComponent(idOf(libraryDocumentId))}`, body),
      },
      publishTraining: (body: AnyRecord) => post("/api/admin/organisation/training", body),
      updateTraining: ({ publicationId, ...body }: AnyRecord) => patch(`/api/admin/organisation/training/${encodeURIComponent(idOf(publicationId))}`, body),
      publishChecklist: (body: AnyRecord) => post("/api/admin/organisation/checklist", body),
      updateChecklist: ({ centralItemId, ...body }: AnyRecord) => patch(`/api/admin/organisation/checklist/${encodeURIComponent(idOf(centralItemId))}`, body),
      publishOperationalTask: (body: AnyRecord) => post("/api/admin/organisation/operational-tasks", body),
      updateOperationalTask: ({ centralItemId, ...body }: AnyRecord) => patch(`/api/admin/organisation/operational-tasks/${encodeURIComponent(idOf(centralItemId))}`, body),
      retireOperationalTask: ({ centralItemId }: AnyRecord) => patch(`/api/admin/organisation/operational-tasks/${encodeURIComponent(idOf(centralItemId))}`, { retire: true }),
      retireTraining: ({ publicationId }: AnyRecord) => patch(`/api/admin/organisation/training/${encodeURIComponent(idOf(publicationId))}`, { retire: true }),
      retireChecklist: ({ centralItemId }: AnyRecord) => patch(`/api/admin/organisation/checklist/${encodeURIComponent(idOf(centralItemId))}`, { retire: true }),
    },
  },
};

export const documentsApi = {
  upload: async ({ locationId, file, data, filename, contentType, purpose, onUploadProgress }: AnyRecord) => {
    if (!file) return post("/api/documents/upload", { locationId, purpose, filename, contentType, data });
    if (file.type !== "application/pdf") throw new Error("Only PDF files are supported.");
    if (file.size > MAX_PDF_BYTES) throw new Error("This PDF is larger than the 25 MB maximum.");
    const grant = await post("/api/documents/upload-token", {
      locationId,
      purpose,
      filename: file.name,
      contentType: "application/pdf",
      size: file.size,
    });
    const uploadDetails = {
      pathname: grant.pathname,
      locationId,
      purpose,
      filename: grant.filename,
      contentType: "application/pdf",
      size: file.size,
      finalizeToken: grant.finalizeToken,
    };
    try {
      await putBlob(grant.pathname, file, {
        access: "private",
        token: grant.clientToken,
        contentType: "application/pdf",
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress,
      });
      return await post("/api/documents/finalize", uploadDetails);
    } catch (error) {
      try { await post("/api/documents/cleanup", uploadDetails); } catch { /* best effort cleanup */ }
      throw error;
    }
  },
};

export function useRestQuery<T>(key: string | null, loader: () => Promise<T>, enabled = true): T | undefined {
  const [value, setValue] = useState<T>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener("rest:data-changed", refresh);
    return () => window.removeEventListener("rest:data-changed", refresh);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!enabled || !key) { setValue(undefined); return; }
    let cancelled = false;
    loader().then((result) => { if (!cancelled) setValue(result); }).catch(() => { if (!cancelled) setValue(undefined); });
    return () => { cancelled = true; };
    // The key controls the request inputs; callers may create a closure for those inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, revision]);
  return value;
}

export type RestQueryState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  retry: () => void;
};

export function useRestQueryState<T>(key: string | null, loader: () => Promise<T>, enabled = true): RestQueryState<T> {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({
    data: undefined,
    loading: enabled && Boolean(key),
    error: null,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener("rest:data-changed", refresh);
    return () => window.removeEventListener("rest:data-changed", refresh);
  }, []);
  useEffect(() => {
    if (!enabled || !key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: undefined, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: undefined, loading: true, error: null });
    loader().then((data) => {
      if (!cancelled) setState({ data, loading: false, error: null });
    }).catch((error: unknown) => {
      if (!cancelled) setState({ data: undefined, loading: false, error: error instanceof Error ? error : new Error("Request failed") });
    });
    return () => { cancelled = true; };
    // The key controls the request inputs; callers may create a closure for those inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, revision]);
  return { ...state, retry: () => setRevision((current) => current + 1) };
}

export function useRestMutation<TArgs extends AnyRecord, TResult = any>(operation: (args: TArgs) => Promise<TResult>) {
  return useCallback(async (args: TArgs) => {
    const result = await operation(args);
    window.dispatchEvent(new Event("rest:data-changed"));
    return result;
  }, [operation]);
}
