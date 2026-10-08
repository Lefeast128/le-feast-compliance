import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { documentsApi, restApi, useRestMutation } from "@/lib/rest-domain";
import { buildWastagePayload, type WastagePickerProduct } from "@/lib/wastage-picker";
import type { DashboardData, DashboardIssue, Equipment, IssueProgress, TeamMember } from "@/components/dashboard/dashboard-types";
import { submitTemperatureRound } from "@/components/dashboard/temperature-round";
import { isItemComplete } from "@/lib/unified-checklist";

type WorkflowArgs = {
  dashboard: DashboardData | null | undefined;
  currentLocationId: string | null;
};

export function useDashboardWorkflows({ dashboard, currentLocationId }: WorkflowArgs) {
  const [round, setRound] = useState<"AM" | "PM" | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundCompleterId, setRoundCompleterId] = useState<string | null>(null);
  const [temperatures, setTemperatures] = useState<Record<string, string>>({});
  const [roundIssues, setRoundIssues] = useState<Array<Equipment & { issueId: string; temperature: number }>>([]);
  const [roundSubmitting, setRoundSubmitting] = useState(false);
  const roundSubmittingRef = useRef(false);
  const [issueProgress, setIssueProgress] = useState<Record<string, IssueProgress>>({});
  const issueActionSubmittingRef = useRef(new Set<string>());
  const [roundEquipment, setRoundEquipment] = useState<Equipment[]>([]);
  const [probeOpen, setProbeOpen] = useState(false);
  const [probeProduct, setProbeProduct] = useState("");
  const [probeTemperature, setProbeTemperature] = useState("");
  const [probeFailed, setProbeFailed] = useState(false);
  const [probeIssueId, setProbeIssueId] = useState<string | null>(null);
  const [probeQuantity, setProbeQuantity] = useState("");
  const [wastageOpen, setWastageOpen] = useState(false);
  const [wastageCatalogue, setWastageCatalogue] = useState<WastagePickerProduct[]>([]);
  const [wastageCatalogueLoading, setWastageCatalogueLoading] = useState(false);
  const [wastageCatalogueError, setWastageCatalogueError] = useState<string | null>(null);
  const [cleaningList, setCleaningList] = useState(false);
  const [checklistList, setChecklistList] = useState<"opening" | "closing" | null>(null);
  const [security, setSecurity] = useState<"AM" | "PM" | null>(null);
  const [securityIndex, setSecurityIndex] = useState(0);
  const [securityTeamMemberId, setSecurityTeamMemberId] = useState("");
  const [securityIssue, setSecurityIssue] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueSelected, setIssueSelected] = useState<DashboardIssue | null>(null);

  const completeAdditionalMutation = useRestMutation(restApi.additional.complete);
  const completeTrainingRequirement = useRestMutation(restApi.compliance.completeTrainingRequirement);
  const signOffStructuredTask = useRestMutation(restApi.compliance.signOffStructuredTask);
  const signOffSecurity = useRestMutation(restApi.compliance.signOffSecurity);
  const addIssueUpdate = useRestMutation(restApi.compliance.addIssueUpdate);
  const completeCleaningTask = useRestMutation(restApi.compliance.completeCleaningTask);
  const recordWastage = useRestMutation(restApi.compliance.recordWastage);
  const startRound = useRestMutation(restApi.compliance.startRound);
  const recordTemperature = useRestMutation(restApi.compliance.recordTemperature);
  const completeRound = useRestMutation(restApi.compliance.completeRound);
  const recordFoodCheck = useRestMutation(restApi.compliance.recordFoodCheck);
  const recordProbeRecheck = useRestMutation(restApi.compliance.recordProbeRecheck);
  const saveChecklistResponse = useRestMutation(restApi.compliance.saveChecklistResponse);
  const saveSecurityResponse = useRestMutation(restApi.compliance.saveSecurityResponse);
  const createManualIssue = useRestMutation(restApi.compliance.createManualIssue);
  const addIssueAction = useRestMutation(restApi.compliance.addIssueAction);

  useEffect(() => {
    const catalogueLocationId = dashboard?.location?._id ?? currentLocationId;
    if (!wastageOpen || !catalogueLocationId) return;
    let cancelled = false;
    restApi.catalogue.wastage({ locationId: catalogueLocationId })
      .then((result: { products?: WastagePickerProduct[] }) => {
        if (cancelled) return;
        setWastageCatalogue(result?.products ?? []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setWastageCatalogue([]);
        setWastageCatalogueError(error instanceof Error ? error.message : "Unable to load wastage catalogue");
      })
      .finally(() => {
        if (!cancelled) setWastageCatalogueLoading(false);
      });
    return () => { cancelled = true; };
  }, [wastageOpen, dashboard?.location?._id, currentLocationId]);

  const active = dashboard;
  const equipment = active?.equipment ?? [];
  const openIssues = dashboard?.issues.filter(item => item.status !== "resolved") ?? [];
  const currentSecurity = security && active ? active.security[security] : null;
  const currentSecurityQuestion = currentSecurity?.[securityIndex];
  const memberName = (id: string | undefined) => active?.teamMembers.find((member: TeamMember) => member._id === id)?.name ?? "Team member";
  const amRound = active?.rounds.find(item => item.session === "AM" && item.completedAt);
  const pmRound = active?.rounds.find(item => item.session === "PM" && item.completedAt);
  const amComplete = !!amRound;
  const pmComplete = !!pmRound;
  const structuredComplete = (area: DashboardData["structuredTasks"][number]["area"], legacyResponses: Array<{ questionId: string; questionVersionRootId?: string | null; questionDefinitionKey?: string | null }>, signedOff: boolean, legacyComplete: boolean) => {
    const tasks = active?.structuredTasks.filter(task => task.area === area) ?? [];
    const responses = active?.structuredTaskResponses.filter(response => response.taskArea === area) ?? [];
    if (!tasks.length) return legacyComplete;
    const complete = tasks.every(task => isItemComplete(task, legacyResponses, responses));
    return complete && signedOff;
  };
  const openingComplete = structuredComplete("opening", active?.checklists.opening.responses ?? [], Boolean(active?.checklistSignOffs?.some(signOff => signOff.checklist === "opening")), (active?.checklists.opening.responses.length ?? 0) >= (active?.checklists.opening.questions.length || 1) && !!active?.checklistSignOffs?.some(signOff => signOff.checklist === "opening"));
  const closingComplete = structuredComplete("closing", active?.checklists.closing.responses ?? [], Boolean(active?.checklistSignOffs?.some(signOff => signOff.checklist === "closing")), (active?.checklists.closing.responses.length ?? 0) >= (active?.checklists.closing.questions.length || 1) && !!active?.checklistSignOffs?.some(signOff => signOff.checklist === "closing"));
  const amSecurityComplete = structuredComplete("security_am", active?.securityResponses.AM ?? [], Boolean(active?.securitySignOffs?.some(signOff => signOff.session === "AM")), (active?.securityResponses.AM.length ?? 0) >= (active?.security.AM.length || 1) && !!active?.securitySignOffs?.some(signOff => signOff.session === "AM"));
  const pmSecurityComplete = structuredComplete("security_pm", active?.securityResponses.PM ?? [], Boolean(active?.securitySignOffs?.some(signOff => signOff.session === "PM")), (active?.securityResponses.PM.length ?? 0) >= (active?.security.PM.length || 1) && !!active?.securitySignOffs?.some(signOff => signOff.session === "PM"));
  const requiredComplete = [amComplete, pmComplete, openingComplete, closingComplete, amSecurityComplete, pmSecurityComplete].filter(Boolean).length;

  function beginRound(session: "AM" | "PM") {
    if (!dashboard) return;
    setRoundId(null); setRoundEquipment([...equipment]); setRoundCompleterId(null); setRound(session); setTemperatures({}); setRoundIssues([]); setIssueProgress({});
  }

  async function completeTemperatureRound(teamMemberId: string) {
    if (!dashboard || !round || !teamMemberId || roundSubmittingRef.current || roundEquipment.some(item => !temperatures[item._id])) return;
    roundSubmittingRef.current = true;
    setRoundCompleterId(teamMemberId);
    setRoundSubmitting(true);
    try {
      const result = await submitTemperatureRound({
        roundId,
        locationId: dashboard.location._id,
        session: round,
        teamMemberId,
        equipment: roundEquipment,
        temperatures,
        startRound,
        recordTemperature,
        completeRound,
      });
      setRoundId(result.roundId);
      if (result.issues.length) {
        setRoundIssues(result.issues);
        setIssueProgress(Object.fromEntries(result.issues.map(issue => [issue.issueId, { action: "", note: "", actionMemberId: "", actionsSaved: false }])));
        return;
      }
      toast.success(`${round} temperatures complete`, { description: `${roundEquipment.length} fridges recorded` });
      setRound(null); setRoundId(null); setRoundEquipment([]);
    } finally {
      roundSubmittingRef.current = false;
      setRoundSubmitting(false);
    }
  }

  async function saveTemperatureActions(issueId: string, action: string, note: string, teamMemberId: string) {
    if (!issueId || !action || !teamMemberId || issueActionSubmittingRef.current.has(issueId)) return;
    if (action === "Other" && !note.trim()) return;
    issueActionSubmittingRef.current.add(issueId);
    try {
      const combinedNote = note.trim() ? `${action} — ${note.trim()}` : action;
      await addIssueAction({ issueId, action: combinedNote, teamMemberId });
      const nextProgress: Record<string, IssueProgress> = { ...issueProgress, [issueId]: { ...issueProgress[issueId], action, note, actionMemberId: teamMemberId, actionsSaved: true } };
      setIssueProgress(nextProgress);
      const allActionsSaved = roundIssues.length > 0 && roundIssues.every(issue => nextProgress[issue.issueId]?.actionsSaved);
      if (allActionsSaved && dashboard && roundId && round && roundCompleterId) {
        await completeRound({ roundId, locationId: dashboard.location._id, session: round, teamMemberId: roundCompleterId });
        toast.success(`${round} temperatures complete`, { description: "Corrective action recorded; issue follow-up remains in Issues & Reviews" });
        setRound(null); setRoundId(null); setRoundCompleterId(null); setRoundEquipment([]); setRoundIssues([]); setIssueProgress({});
      } else toast.success("Corrective action recorded");
    } finally {
      issueActionSubmittingRef.current.delete(issueId);
    }
  }

  async function saveProbe(teamMemberId: string) {
    if (!dashboard || !teamMemberId || !probeProduct || !probeTemperature || !probeQuantity.trim()) return;
    const value = Number(probeTemperature);
    if (Number.isNaN(value)) return;
    if (probeFailed) {
      if (!probeIssueId) return;
      const result = await recordProbeRecheck({ issueId: probeIssueId, temperature: value, teamMemberId });
      if (result.result === "fail") { setProbeTemperature(""); toast("Recheck remains below the configured minimum; further action is required"); return; }
      toast.success("Probe recheck passed — issue resolved"); setProbeOpen(false); setProbeFailed(false); setProbeIssueId(null); setProbeTemperature(""); setProbeQuantity(""); return;
    }
    const configuredProduct = active?.probeProducts.find(item => item.name === probeProduct);
    const minimum = configuredProduct?.minimumTemperature ?? 76;
    const holdMinutes = configuredProduct?.holdMinutes ?? 2;
    const result = await recordFoodCheck({ locationId: dashboard.location._id, product: probeProduct, quantity: probeQuantity, temperature: value, teamMemberId, action: value < minimum ? "Continue cooking; recheck before serving" : `Held for at least ${holdMinutes} minutes` });
    if (result.issueId) { setProbeFailed(true); setProbeIssueId(result.issueId); setProbeTemperature(""); toast("Continue cooking, then record the recheck"); }
    else { toast.success("Food probe recorded"); setProbeOpen(false); setProbeFailed(false); setProbeIssueId(null); setProbeTemperature(""); setProbeQuantity(""); }
  }

  async function saveWastage(payload: ReturnType<typeof buildWastagePayload>) {
    if (!dashboard) return;
    await recordWastage({ locationId: dashboard.location._id, ...payload });
    toast.success(payload.noWaste ? "No waste recorded" : "Wastage recorded");
    setWastageOpen(false);
  }

  async function completeChecklistQuestion(questionId: string, teamMemberId: string) {
    if (!dashboard || !checklistList || !teamMemberId) return;
    await saveChecklistResponse({ locationId: dashboard.location._id, checklist: checklistList, questionId, answer: "yes", teamMemberId });
    toast.success("Job completed");
  }

  async function saveChecklistIssue(questionId: string, problem: string, action: string, teamMemberId: string) {
    if (!dashboard || !checklistList || !teamMemberId) return;
    await saveChecklistResponse({ locationId: dashboard.location._id, checklist: checklistList, questionId, answer: "no", problem, action, teamMemberId });
    toast.success("Issue and action recorded");
  }

  async function signOffChecklistTask(teamMemberId: string) {
    if (!dashboard || !checklistList || !teamMemberId) return;
    await signOffStructuredTask({ locationId: dashboard.location._id, area: checklistList, teamMemberId });
    toast.success(`${checklistList === "opening" ? "Opening" : "Closing"} Food Safety complete`);
    setChecklistList(null);
  }

  function beginSecurity(session: "AM" | "PM", index = 0) {
    setSecurity(session); setSecurityIndex(index); setSecurityTeamMemberId(""); setSecurityIssue("");
  }

  async function saveSecurity() {
    if (!dashboard || !security || !currentSecurityQuestion || !securityTeamMemberId) return;
    const last = securityIndex + 1 >= (currentSecurity?.length ?? 0);
    await saveSecurityResponse({ locationId: dashboard.location._id, session: security, questionId: currentSecurityQuestion._id, issue: last ? securityIssue || undefined : undefined, teamMemberId: securityTeamMemberId });
    if (last) { await signOffSecurity({ locationId: dashboard.location._id, session: security, teamMemberId: securityTeamMemberId }); toast.success(`${security} security check complete`); setSecurity(null); setSecurityTeamMemberId(""); }
    else setSecurityIndex(value => value + 1);
  }

  async function saveIssue(description: string, teamMemberId: string) {
    if (!dashboard || !teamMemberId) return;
    await createManualIssue({ locationId: dashboard.location._id, description, teamMemberId });
    setIssueOpen(false); toast.success("Issue reported");
  }

  async function completeCleaning(taskId: string, teamMemberId: string) {
    if (!dashboard) return;
    await completeCleaningTask({ locationId: dashboard.location._id, taskId, teamMemberId });
    toast.success("Cleaning job completed");
  }

  async function reportCleaningIssue(description: string, teamMemberId: string) {
    if (!dashboard || !teamMemberId) return;
    await createManualIssue({ locationId: dashboard.location._id, description, teamMemberId });
    toast.success("Issue reported");
  }

  async function completeTraining(requirementId: string, teamMemberId: string) {
    if (!dashboard) return;
    await completeTrainingRequirement({ locationId: dashboard.location._id, requirementId, teamMemberId });
    toast.success("Training completion recorded");
  }

  async function completeAdditional(data: { requirementId: string; teamMemberId: string; answers: unknown; certificateReference?: string; certificate?: File | null }) {
    if (!dashboard) return;
    let documentId: string | undefined;
    if (data.certificate) {
      const uploaded = await documentsApi.upload({ locationId: dashboard.location._id, file: data.certificate, purpose: "additional_check_certificate" });
      documentId = uploaded.id ?? uploaded._id;
    }
    await completeAdditionalMutation({ locationId: dashboard.location._id, requirementId: data.requirementId, teamMemberId: data.teamMemberId, answers: data.answers, certificateReference: data.certificateReference || undefined, documentId });
    toast.success("Additional check completed");
  }

  function resetForLocation() {
    roundSubmittingRef.current = false;
    setRoundSubmitting(false); setRound(null); setRoundId(null); setRoundCompleterId(null); setTemperatures({}); setRoundEquipment([]); setRoundIssues([]); setIssueProgress({}); setChecklistList(null); setCleaningList(false); setSecurity(null); setSecurityTeamMemberId(""); setProbeOpen(false); setWastageOpen(false); setIssueSelected(null);
  }

  function openWastage() {
    setWastageCatalogueLoading(true); setWastageCatalogueError(null); setWastageOpen(true);
  }

  return {
    active, equipment, openIssues, memberName, amRound, pmRound, amComplete, pmComplete, openingComplete, closingComplete, amSecurityComplete, pmSecurityComplete, requiredComplete,
    round, roundIssues, issueProgress, setIssueProgress, roundEquipment, temperatures, setTemperatures, roundSubmitting,
    probeOpen, setProbeOpen, probeProduct, setProbeProduct, probeTemperature, setProbeTemperature, probeFailed, setProbeFailed, probeIssueId, setProbeIssueId, probeQuantity, setProbeQuantity,
    wastageOpen, openWastage, setWastageOpen, wastageCatalogue, wastageCatalogueLoading, wastageCatalogueError,
    cleaningList, setCleaningList, checklistList, setChecklistList, security, setSecurity, securityIndex, securityTeamMemberId, setSecurityTeamMemberId, securityIssue, setSecurityIssue, currentSecurityQuestion,
    issueOpen, setIssueOpen, issueSelected, setIssueSelected,
    beginRound, completeTemperatureRound, saveTemperatureActions, saveProbe, saveWastage, completeChecklistQuestion, saveChecklistIssue, signOffChecklistTask, beginSecurity, saveSecurity, saveIssue, completeCleaning, reportCleaningIssue, completeTraining, completeAdditional, addIssueUpdate, resetForLocation,
  };
}
