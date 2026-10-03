/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { dateKeyFrom } from "@/lib/date-key";

type AnyRecord = Record<string, any>;

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
    createManualIssue: (body: AnyRecord) => post("/api/compliance/issues", body),
    addIssueAction: (body: AnyRecord) => post(`/api/compliance/issues/${encodeURIComponent(idOf(body.issueId))}/action`, body),
    addRecheck: (body: AnyRecord) => post(`/api/compliance/issues/${encodeURIComponent(idOf(body.issueId))}/recheck`, body),
    addIssueUpdate: (body: AnyRecord) => post(`/api/compliance/issues/${encodeURIComponent(idOf(body.issueId))}/updates`, body),
    completeTrainingRequirement: (body: AnyRecord) => post("/api/training/complete", body),
  },
  reports: {
    compliance: async ({ locationId, start, end }: AnyRecord) => compat(await query(`/api/reports/compliance?locationId=${encodeURIComponent(locationId)}&start=${dateKey(start)}&end=${dateKey(end)}`)),
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
    addTrainingRequirement: (body: AnyRecord) => post("/api/admin/training-requirements", body),
    updateTrainingRequirement: (body: AnyRecord) => patch(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}`, body),
    deleteTrainingRequirement: (body: AnyRecord) => remove(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}`),
    reorderTrainingRequirement: (body: AnyRecord) => post(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}/reorder`, body),
    attachTrainingDocument: (body: AnyRecord) => post(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}/document`, body),
    removeTrainingDocument: (body: AnyRecord) => post(`/api/admin/training-requirements/${encodeURIComponent(idOf(body.requirementId))}/document`, { remove: true }),
    addTeamMemberName: (body: AnyRecord) => post("/api/team-members", body),
    updateTeamMemberName: (body: AnyRecord) => patch(`/api/team-members/${encodeURIComponent(idOf(body.memberId))}`, body),
    deactivateTeamMember: (body: AnyRecord) => remove(`/api/team-members/${encodeURIComponent(idOf(body.memberId))}`),
  },
};

export const documentsApi = {
  upload: async ({ locationId, file, data, filename, contentType, purpose }: AnyRecord) => {
    let encoded = data;
    if (file && typeof file.arrayBuffer === "function") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      encoded = btoa(binary);
      filename = file.name;
      contentType = file.type;
    }
    return post("/api/documents/upload", { locationId, purpose, filename, contentType, data: encoded });
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

export function useRestMutation<TArgs extends AnyRecord, TResult = any>(operation: (args: TArgs) => Promise<TResult>) {
  return useCallback(async (args: TArgs) => {
    const result = await operation(args);
    window.dispatchEvent(new Event("rest:data-changed"));
    return result;
  }, [operation]);
}
