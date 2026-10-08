import UserAccessAdmin from "@/components/UserAccessAdmin";
import OrganisationLibraryAdmin from "@/components/OrganisationLibraryAdmin";
import OrganisationFeatureCards, {
  type OrganisationFeatureKey,
} from "@/components/admin/OrganisationFeatureCards";
import AdditionalScheduleFields from "@/components/AdditionalScheduleFields";
import CleaningScheduleFields from "@/components/CleaningScheduleFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  documentsApi,
  restApi,
  useRestMutation,
  useRestQuery,
} from "@/lib/rest-domain";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

type Store = { id: string; name: string; shortName: string };
type FieldDefinition = {
  key: string;
  label: string;
  type: string;
  minimum?: number;
  maximum?: number;
  options?: string[];
};
type TaskStep = {
  id: string;
  label: string;
  description?: string | null;
  responseType: "confirm" | "yes_no" | "number" | "short_text";
  required?: boolean;
};
type OperationalTask = {
  id: string;
  kind: string;
  checklist?: "opening" | "closing" | null;
  session?: "AM" | "PM" | null;
  name?: string | null;
  question?: string | null;
  title?: string | null;
  description?: string | null;
  frequency?: string | null;
  interval?: number | null;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  nextDueAt?: string | null;
  fields?: FieldDefinition[] | null;
  taskType?: "simple" | "with_steps";
  completionMode?: "question" | "task";
  steps?: TaskStep[];
  locationIds: string[];
  stores: string[];
  allocationMode: "all" | "selected";
};
type TrainingItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  audience?: string | null;
  trainingFormat?: "briefing" | "document";
  locationIds: string[];
  stores: string[];
  requirementIds: string[];
  requirements: Array<{ id: string; locationId: string }>;
  attachmentStatus?: Array<{
    locationId: string;
    store: string;
    status: "attached" | "missing";
  }>;
  version: number;
  allocationMode: "all" | "selected";
};
type OrganisationControls = {
  locations: Store[];
  training: TrainingItem[];
  checklists: Array<{
    id: string;
    question: string;
    checklist: "opening" | "closing";
    locationIds: string[];
    stores: string[];
    allocationMode: "all" | "selected";
    description?: string | null;
    taskType?: "simple" | "with_steps";
    completionMode?: "question" | "task";
    steps?: TaskStep[];
  }>;
  operationalTasks: OperationalTask[];
  recentChanges: Array<{ at: string | Date; actor: string; change: string }>;
};
type Props = { onBack: () => void };

const selectedIds = (allStores: boolean, stores: Record<string, boolean>) =>
  allStores ? [] : Object.keys(stores).filter((id) => stores[id]);
const emptyFields = (): FieldDefinition[] => [
  { key: "check", label: "Check", type: "completed" },
];

function StorePicker({
  locations,
  allStores,
  setAllStores,
  stores,
  setStores,
}: {
  locations: Store[];
  allStores: boolean;
  setAllStores: (value: boolean) => void;
  stores: Record<string, boolean>;
  setStores: (value: Record<string, boolean>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allStores}
          onChange={(event) => setAllStores(event.target.checked)}
        />{" "}
        All stores
      </label>
      {!allStores && (
        <div className="grid gap-2 sm:grid-cols-2">
          {locations.map((store) => (
            <label
              key={store.id}
              className="flex items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={Boolean(stores[store.id])}
                onChange={() =>
                  setStores({ ...stores, [store.id]: !stores[store.id] })
                }
              />
              {store.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrganisationAdmin({ onBack }: Props) {
  const data = useRestQuery<OrganisationControls>(
    "organisation-admin",
    restApi.admin.organisation.list,
    true,
  );
  const publishTraining = useRestMutation(
    restApi.admin.organisation.publishTraining,
  );
  const updateTraining = useRestMutation(
    restApi.admin.organisation.updateTraining,
  );
  const retireTraining = useRestMutation(
    restApi.admin.organisation.retireTraining,
  );
  const publishChecklist = useRestMutation(
    restApi.admin.organisation.publishChecklist,
  );
  const updateChecklist = useRestMutation(
    restApi.admin.organisation.updateChecklist,
  );
  const retireChecklist = useRestMutation(
    restApi.admin.organisation.retireChecklist,
  );
  const publishOperational = useRestMutation(
    restApi.admin.organisation.publishOperationalTask,
  );
  const updateOperational = useRestMutation(
    restApi.admin.organisation.updateOperationalTask,
  );
  const retireOperational = useRestMutation(
    restApi.admin.organisation.retireOperationalTask,
  );
  const attachDocument = useRestMutation(restApi.admin.attachTrainingDocument);
  const removeTrainingDocument = useRestMutation(
    restApi.admin.removeTrainingDocument,
  );
  const [trainingEdit, setTrainingEdit] = useState<string | null>(null);
  const [trainingTitle, setTrainingTitle] = useState("");
  const [trainingDescription, setTrainingDescription] = useState("");
  const [trainingCategory, setTrainingCategory] = useState("other");
  const [trainingAudience, setTrainingAudience] = useState("all_team");
  const [trainingFormat, setTrainingFormat] = useState<"briefing" | "document">(
    "briefing",
  );
  const [trainingAllStores, setTrainingAllStores] = useState(true);
  const [trainingStores, setTrainingStores] = useState<Record<string, boolean>>(
    {},
  );
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [trainingReacknowledge, setTrainingReacknowledge] = useState(false);
  const [taskEdit, setTaskEdit] = useState<string | null>(null);
  const [taskType, setTaskType] = useState("opening");
  const [taskQuestion, setTaskQuestion] = useState("");
  const [taskName, setTaskName] = useState("");
  const [taskFrequency, setTaskFrequency] = useState("daily");
  const [taskWeekdays, setTaskWeekdays] = useState<number[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskInterval, setTaskInterval] = useState("");
  const [taskDayOfMonth, setTaskDayOfMonth] = useState("1");
  const [taskNextDue, setTaskNextDue] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [taskFields, setTaskFields] = useState<FieldDefinition[]>(emptyFields);
  const [taskTaskType, setTaskTaskType] = useState<"simple" | "with_steps">(
    "simple",
  );
  const [taskCompletionMode, setTaskCompletionMode] = useState<"question" | "task">("question");
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [taskAllStores, setTaskAllStores] = useState(true);
  const [taskStores, setTaskStores] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<"home" | OrganisationFeatureKey>(
    "home",
  );

  function resetTraining() {
    setTrainingEdit(null);
    setTrainingTitle("");
    setTrainingDescription("");
    setTrainingCategory("other");
    setTrainingAudience("all_team");
    setTrainingFormat("briefing");
    setTrainingAllStores(true);
    setTrainingStores({});
    setTrainingFile(null);
    setTrainingReacknowledge(false);
  }
  function resetTask() {
    setTaskEdit(null);
    setTaskType("opening");
    setTaskQuestion("");
    setTaskName("");
    setTaskFrequency("daily");
    setTaskWeekdays([]);
    setTaskTitle("");
    setTaskDescription("");
    setTaskInterval("");
    setTaskDayOfMonth("1");
    setTaskNextDue(new Date().toISOString().slice(0, 10));
    setTaskFields(emptyFields());
    setTaskTaskType("simple");
    setTaskCompletionMode("question");
    setTaskSteps([]);
    setTaskAllStores(true);
    setTaskStores({});
  }
  function startTrainingEdit(item: TrainingItem) {
    setTrainingEdit(item.id);
    setTrainingTitle(item.title);
    setTrainingDescription(item.description ?? "");
    setTrainingCategory(item.category ?? "other");
    setTrainingAudience(item.audience ?? "all_team");
    setTrainingFormat(item.trainingFormat ?? "briefing");
    setTrainingAllStores(item.allocationMode === "all");
    setTrainingStores(
      Object.fromEntries(item.locationIds.map((id) => [id, true])),
    );
    setTrainingFile(null);
    setTrainingReacknowledge(false);
  }
  function startTaskEdit(item: OperationalTask) {
    setTaskEdit(item.id);
    setTaskType(item.kind);
    setTaskQuestion(item.question ?? "");
    setTaskName(item.name ?? "");
    setTaskFrequency(item.frequency ?? "daily");
    setTaskWeekdays(
      item.weekdays?.length
        ? item.weekdays
        : item.kind === "cleaning" && item.frequency === "weekly"
          ? [1]
          : item.kind === "additional" && item.nextDueAt
          ? [new Date(item.nextDueAt).getUTCDay() || 7]
          : [],
    );
    setTaskTitle(item.title ?? "");
    setTaskDescription(item.description ?? "");
    setTaskInterval(item.interval ? String(item.interval) : "");
    setTaskDayOfMonth(
      item.dayOfMonth
        ? String(item.dayOfMonth)
        : item.nextDueAt
          ? String(new Date(item.nextDueAt).getUTCDate())
          : "1",
    );
    setTaskNextDue(
      item.nextDueAt
        ? new Date(item.nextDueAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setTaskFields(item.fields ?? emptyFields());
    setTaskTaskType(item.taskType ?? "simple");
    setTaskCompletionMode(item.completionMode ?? (item.kind === "cleaning" ? "task" : "question"));
    setTaskSteps(item.steps ?? []);
    setTaskAllStores(item.allocationMode === "all");
    setTaskStores(Object.fromEntries(item.locationIds.map((id) => [id, true])));
  }

  async function saveTraining() {
    if (!trainingTitle.trim()) return;
    const locationIds = selectedIds(trainingAllStores, trainingStores);
    if (!trainingAllStores && !locationIds.length) {
      toast.error("Select at least one store");
      return;
    }
    const editingItem = trainingEdit
      ? data?.training.find((item) => item.id === trainingEdit)
      : undefined;
    const missingDocument =
      editingItem?.attachmentStatus?.some(
        (item) => item.status === "missing",
      ) ?? false;
    if (
      trainingFormat === "document" &&
      (!trainingEdit || missingDocument) &&
      !trainingFile
    ) {
      toast.error("Select a PDF before publishing document training");
      return;
    }
    if (trainingFile && trainingFile.type !== "application/pdf") {
      toast.error("Only PDF files are supported");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: trainingTitle.trim(),
        description: trainingDescription,
        category: trainingCategory,
        audience: trainingAudience,
        trainingFormat,
        allStores: trainingAllStores,
        locationIds,
        requireReacknowledgement: trainingReacknowledge,
        documentSelected: Boolean(trainingFile),
      };
      const result = trainingEdit
        ? await updateTraining({ publicationId: trainingEdit, ...body })
        : await publishTraining(body);
      const failures: string[] = [];
      if (trainingFile && result?.requirements?.length) {
        for (const requirement of result.requirements) {
          try {
            const document = await documentsApi.upload({
              locationId: requirement.locationId,
              file: trainingFile,
              purpose: "training_document",
            });
            await attachDocument({
              requirementId: requirement.id ?? requirement._id,
              documentId: document.id ?? document._id,
              requireReacknowledgement: trainingReacknowledge || !trainingEdit,
            });
          } catch {
            failures.push(
              stores.find((store) => store.id === requirement.locationId)
                ?.name ?? "Selected store",
            );
          }
        }
      }
      if (failures.length) {
        toast.error(
          `PDF attachment incomplete. Repair: ${failures.join(", ")}`,
        );
        return;
      }
      toast.success(
        trainingEdit
          ? "Central training updated"
          : "Training published to the selected stores",
      );
      resetTraining();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save training",
      );
    } finally {
      setSaving(false);
    }
  }

  async function replaceTrainingDocument(item: TrainingItem, file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported");
      return;
    }
    const requireReacknowledgement = window.confirm(
      "Require staff to acknowledge this document version again?",
    );
    setSaving(true);
    const missing = new Set(
      (item.attachmentStatus ?? [])
        .filter((status) => status.status === "missing")
        .map((status) => status.locationId),
    );
    const targets =
      missing.size && missing.size < item.requirements.length
        ? item.requirements.filter((requirement) =>
            missing.has(requirement.locationId),
          )
        : item.requirements;
    const failures: string[] = [];
    try {
      for (const requirement of targets) {
        try {
          const document = await documentsApi.upload({
            locationId: requirement.locationId,
            file,
            purpose: "training_document",
          });
          await attachDocument({
            requirementId: requirement.id,
            documentId: document.id ?? document._id,
            requireReacknowledgement,
          });
        } catch {
          failures.push(
            stores.find((store) => store.id === requirement.locationId)?.name ??
              "Selected store",
          );
        }
      }
      if (failures.length)
        toast.error(
          `PDF attachment incomplete. Repair: ${failures.join(", ")}`,
        );
      else
        toast.success(
          missing.size
            ? "Missing PDFs attached"
            : "Central training document updated",
        );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update training document",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeCentralTrainingDocument(item: TrainingItem) {
    const requirementId = item.requirementIds[0];
    if (!requirementId) return;
    if (
      !window.confirm(
        "Remove the current PDF from this training requirement?\n\nThe training requirement and historical records will be preserved.",
      )
    )
      return;
    setSaving(true);
    try {
      await removeTrainingDocument({ requirementId });
      if (trainingEdit === item.id) {
        setTrainingFormat("briefing");
        setTrainingFile(null);
      }
      toast.success("PDF removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove PDF",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTask() {
    const locationIds = selectedIds(taskAllStores, taskStores);
    if (!taskAllStores && !locationIds.length) {
      toast.error("Select at least one store");
      return;
    }
    const body: Record<string, unknown> = {
      kind: taskType,
      allStores: taskAllStores,
      locationIds,
    };
    if (
      taskType === "opening" ||
      taskType === "closing" ||
      taskType.startsWith("security_")
    ) {
      body.question = taskQuestion.trim();
      body.description = taskDescription;
      body.taskType = taskTaskType;
      body.completionMode = taskTaskType === "simple" ? taskCompletionMode : undefined;
      body.steps = taskTaskType === "with_steps" ? taskSteps : [];
    }
    if (taskType === "cleaning") {
      body.name = taskName.trim();
      body.description = taskDescription;
      body.taskType = taskTaskType;
      body.completionMode = taskTaskType === "simple" ? taskCompletionMode : undefined;
      body.steps = taskTaskType === "with_steps" ? taskSteps : [];
      body.frequency = taskFrequency;
      body.weekdays = taskWeekdays;
    }
    if (taskType === "additional") {
      body.title = taskTitle.trim();
      body.description = taskDescription;
      body.frequency = taskFrequency;
      body.interval = taskInterval ? Number(taskInterval) : undefined;
      body.weekdays = taskWeekdays;
      body.dayOfMonth = ["monthly", "every_x_months"].includes(taskFrequency)
        ? Number(taskDayOfMonth)
        : undefined;
      body.nextDueAt = new Date(taskNextDue + "T12:00:00").getTime();
      body.fields = taskFields;
    }
    if (
      (taskType === "cleaning" && !taskName.trim()) ||
      ((taskType === "opening" ||
        taskType === "closing" ||
        taskType.startsWith("security_")) &&
        !taskQuestion.trim()) ||
      (taskType === "additional" && !taskTitle.trim())
    )
      return;
    setSaving(true);
    try {
      if (taskEdit) {
        if (taskType === "opening" || taskType === "closing")
          await updateChecklist({
            centralItemId: taskEdit,
            checklist: taskType,
            question: taskQuestion.trim(),
            description: taskDescription,
            taskType: taskTaskType,
            completionMode: taskTaskType === "simple" ? taskCompletionMode : undefined,
            steps: taskTaskType === "with_steps" ? taskSteps : [],
            allStores: taskAllStores,
            locationIds,
          });
        else await updateOperational({ centralItemId: taskEdit, ...body });
      } else if (taskType === "opening" || taskType === "closing")
        await publishChecklist({ ...body, checklist: taskType });
      else await publishOperational(body);
      toast.success(
        taskEdit ? "Operational task updated" : "Operational task published",
      );
      resetTask();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save operational task",
      );
    } finally {
      setSaving(false);
    }
  }

  async function retire(
    kind: "training" | "checklist" | "operational",
    id: string,
  ) {
    if (
      !window.confirm(
        "Retire this organisation standard? Historical records will remain available.",
      )
    )
      return;
    try {
      if (kind === "training") await retireTraining({ publicationId: id });
      else if (kind === "checklist")
        await retireChecklist({ centralItemId: id });
      else await retireOperational({ centralItemId: id });
      toast.success("Organisation standard retired");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to retire item",
      );
    }
  }

  const stores = data?.locations ?? [];
  const trainingItemBeingEdited = trainingEdit
    ? data?.training.find((item) => item.id === trainingEdit)
    : undefined;
  const existingTrainingPdfAttached = Boolean(
    trainingItemBeingEdited?.attachmentStatus?.length &&
      trainingItemBeingEdited.attachmentStatus.every(
        (attachment) => attachment.status === "attached",
      ),
  );
  const storePicker = (
    all: boolean,
    setAll: (value: boolean) => void,
    values: Record<string, boolean>,
    setValues: (value: Record<string, boolean>) => void,
  ) => (
    <StorePicker
      locations={stores}
      allStores={all}
      setAllStores={setAll}
      stores={values}
      setStores={setValues}
    />
  );
  const taskLabel = (kind: string) =>
    ({
      opening: "Opening checklist",
      closing: "Closing checklist",
      cleaning: "Cleaning task",
      security_am: "AM Security",
      security_pm: "PM Security",
      additional: "Additional check",
    })[kind] ?? kind;

  if (!data)
    return (
      <div className="p-6 text-sm text-[#727a74]">
        Loading organisation controls…
      </div>
    );

  const recentChanges = (
    <section className="rounded-3xl border border-black/[0.07] bg-white p-5 shadow-[0_4px_16px_rgba(23,25,24,0.04)]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
        Recent organisation changes
      </p>
      <div className="mt-3 space-y-2">
        {data.recentChanges.slice(0, 8).map((change, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-2 text-sm"
          >
            <span className="font-semibold">{change.change}</span>
            <span className="text-xs text-[#89918b]">
              {change.actor} · {new Date(change.at).toLocaleString("en-GB")}
            </span>
          </div>
        ))}
        {!data.recentChanges.length && (
          <p className="mt-3 text-sm text-[#89918b]">
            No organisation changes recorded.
          </p>
        )}
      </div>
    </section>
  );
  const page = (title: string, content: ReactNode) => (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="text-[15px] font-semibold">Organisation Admin</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">
              {title}
            </p>
          </div>
          <Button variant="outline" onClick={() => setSection("home")}>
            <ArrowLeft className="mr-2 size-4" /> Back to Organisation Admin
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-8">
        {content}
      </main>
    </div>
  );

  if (section === "home")
    return (
      <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
        <header className="border-b border-black/[0.07] bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <div>
              <p className="text-[15px] font-semibold">Organisation Admin</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">
                Central control
              </p>
            </div>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 size-4" /> Back to Admin
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
            Organisation-wide controls
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Organisation Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#727a74]">
            Publish standards, manage access and review organisation activity
            across all stores.
          </p>
          <div className="mt-7">
            <OrganisationFeatureCards onSelect={setSection} />
          </div>
        </main>
      </div>
    );

  if (section === "access") return page("User Access", <UserAccessAdmin />);
  if (section === "library")
    return page("Document Library", <OrganisationLibraryAdmin />);
  if (section === "activity")
    return page("Organisation Activity", recentChanges);
  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <div>
            <p className="text-[15px] font-semibold">Organisation Admin</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">
              Central control
            </p>
          </div>
          <Button variant="outline" onClick={() => setSection("home")}>
            <ArrowLeft className="mr-2 size-4" /> Back to Organisation Admin
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-8">
        {section === "training" && (
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
                  Training &amp; Documents
                </p>
                <h1 className="mt-1 text-xl font-semibold">
                  {trainingEdit ? "Edit central training" : "Add training"}
                </h1>
                <p className="mt-1 text-sm text-[#727a74]">
                  Briefings and documents keep separate, store-level
                  acknowledgement history.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={resetTraining}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-sm font-semibold">Training type</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {([
                    ["briefing", "Briefing / instruction", "Instructions without a document"],
                    ["document", "Document / PDF", "Training supplied as a PDF"],
                  ] as const).map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTrainingFormat(value)}
                      className={`rounded-2xl border p-4 text-left transition ${trainingFormat === value ? "border-[#d5b72f] bg-[#fff9df] shadow-[0_4px_16px_rgba(23,25,24,0.06)]" : "border-black/[0.1] bg-white hover:border-[#e5d77b]"}`}
                      aria-pressed={trainingFormat === value}
                    >
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs font-normal text-[#727a74]">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-sm font-semibold">
                Title
                <Input
                  value={trainingTitle}
                  onChange={(event) => setTrainingTitle(event.target.value)}
                  className="mt-2 h-11"
                />
              </label>
              <label className="text-sm font-semibold md:col-span-2">
                Description / training instructions
                <textarea
                  value={trainingDescription}
                  onChange={(event) =>
                    setTrainingDescription(event.target.value)
                  }
                  className="mt-2 min-h-28 w-full rounded-xl border border-black/[0.1] p-3"
                />
              </label>
              <label className="text-sm font-semibold">
                Category
                <select
                  value={trainingCategory}
                  onChange={(event) => setTrainingCategory(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                >
                  <option value="other">Other</option>
                  <option value="food_safety">Food safety</option>
                  <option value="security">Security</option>
                  <option value="equipment">Equipment</option>
                  <option value="company_procedure">Company procedure</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Audience
                <select
                  value={trainingAudience}
                  onChange={(event) => setTrainingAudience(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                >
                  <option value="all_team">All team</option>
                  <option value="managers_only">Managers only</option>
                </select>
              </label>
              {trainingFormat === "document" && (
                <div className="rounded-2xl border border-[#e5d77b] bg-[#fffdf1] p-4 md:col-span-2">
                  <p className="text-sm font-semibold">PDF document</p>
                  {trainingEdit && existingTrainingPdfAttached && !trainingFile && (
                    <p className="mt-1 text-sm text-[#2d7951]">Current PDF attached</p>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setTrainingFile(event.target.files?.[0] ?? null)}
                    className="mt-3 block w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm"
                  />
                  <span className="mt-2 block text-xs font-normal text-[#89918b]">
                    {trainingEdit ? "Choose a replacement PDF if required · PDF · Maximum 25 MB" : "Required for Document / PDF training · PDF · Maximum 25 MB"}
                  </span>
                  {trainingFile && <span className="mt-2 block text-xs text-[#727a74]">Selected: {trainingFile.name} · {(trainingFile.size / (1024 * 1024)).toFixed(1)} MB</span>}
                </div>
              )}
              <div className="md:col-span-2">
                {storePicker(
                  trainingAllStores,
                  setTrainingAllStores,
                  trainingStores,
                  setTrainingStores,
                )}
              </div>
              {trainingEdit && trainingFormat === "briefing" && (
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={trainingReacknowledge}
                    onChange={(event) =>
                      setTrainingReacknowledge(event.target.checked)
                    }
                  />{" "}
                  Require staff to acknowledge this updated briefing again
                </label>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                className="bg-[#202522] text-white"
                disabled={saving || !trainingTitle.trim()}
                onClick={saveTraining}
              >
                {saving && trainingFile ? "Uploading PDF…" : trainingEdit ? "Save training" : "Publish training"}
              </Button>
              {trainingEdit && (
                <Button variant="outline" onClick={resetTraining}>
                  Cancel edit
                </Button>
              )}
            </div>
            <div className="mt-6 space-y-2">
              {data.training.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-[#fafbf9] p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {item.title}{" "}
                      <span className="ml-2 rounded-full bg-[#e9f0e6] px-2 py-1 text-[10px] font-semibold text-[#477152]">
                        {item.trainingFormat === "document"
                          ? "Document"
                          : "Briefing"}
                      </span>
                    </p>
                    <p className="text-xs text-[#727a74]">
                      {item.stores.join(", ")} · Version {item.version}
                    </p>
                    {item.trainingFormat === "document" && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {(item.attachmentStatus ?? []).map((attachment) => (
                          <span
                            key={attachment.locationId}
                            className={
                              attachment.status === "attached"
                                ? "rounded-full bg-[#e9f5ec] px-2 py-1 text-[#2d7951]"
                                : "rounded-full bg-[#fff2df] px-2 py-1 text-[#9a5b16]"
                            }
                          >
                            {attachment.store} —{" "}
                            {attachment.status === "attached"
                              ? "PDF attached"
                              : "Missing PDF"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Edit " + item.title}
                      onClick={() => startTrainingEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {item.trainingFormat === "document" && (
                      <label className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium hover:bg-black/[0.04]">
                        {item.attachmentStatus?.some(
                          (status) => status.status === "missing",
                        )
                          ? "Attach missing PDF"
                          : "Replace PDF"}
                        <input
                          className="hidden"
                          type="file"
                          accept="application/pdf"
                          disabled={saving}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void replaceTrainingDocument(item, file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    {item.trainingFormat === "document" &&
                      item.attachmentStatus?.some(
                        (status) => status.status === "attached",
                      ) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => void removeCentralTrainingDocument(item)}
                        >
                          Remove PDF
                        </Button>
                      )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#b64738]"
                      aria-label={"Retire " + item.title}
                      onClick={() => void retire("training", item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {section === "operational" && (
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
                  Operational Tasks
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {taskEdit
                    ? "Edit organisation standard"
                    : "Publish an organisation standard"}
                </h2>
                <p className="mt-1 text-sm text-[#727a74]">
                  One controlled publisher for checklists, cleaning, security
                  and recurring checks.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={resetTask}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold md:col-span-2">
                Task type
                <select
                  value={taskType}
                  disabled={Boolean(taskEdit)}
                  onChange={(event) => setTaskType(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                >
                  <option value="opening">Opening checklist item</option>
                  <option value="closing">Closing checklist item</option>
                  <option value="cleaning">Cleaning task</option>
                  <option value="security_am">AM Security check</option>
                  <option value="security_pm">PM Security check</option>
                  <option value="additional">
                    Additional / recurring check
                  </option>
                </select>
              </label>
              {(taskType === "opening" ||
                taskType === "closing" ||
                taskType.startsWith("security_")) && (
                <>
                  <label className="text-sm font-semibold md:col-span-2">
                    Question
                    <Input
                      value={taskQuestion}
                      onChange={(event) => setTaskQuestion(event.target.value)}
                      className="mt-2 h-11"
                    />
                  </label>
                  <label className="text-sm font-semibold md:col-span-2">
                    Description / instructions
                    <textarea
                      value={taskDescription}
                      onChange={(event) =>
                        setTaskDescription(event.target.value)
                      }
                      className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Item type
                    <select
                      value={taskTaskType}
                      onChange={(event) => {
                        const next = event.target.value as
                          | "simple"
                          | "with_steps";
                        setTaskTaskType(next);
                        if (next === "with_steps" && !taskSteps.length)
                          setTaskSteps([
                            {
                              id: "step_1",
                              label: "New step",
                              responseType: "confirm",
                              required: true,
                            },
                          ]);
                      }}
                      className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                    >
                      <option value="simple">Simple check</option>
                      <option value="with_steps">Task with steps</option>
                    </select>
                  </label>
                  {taskTaskType === "simple" && (
                    <label className="text-sm font-semibold">
                      Simple check behaviour
                      <select value={taskCompletionMode} onChange={(event) => setTaskCompletionMode(event.target.value as "question" | "task")} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3">
                        <option value="question">Question (Yes / No)</option>
                        <option value="task">Simple completion task</option>
                      </select>
                    </label>
                  )}
                  {taskTaskType === "with_steps" && (
                    <div className="md:col-span-2 rounded-xl border border-black/[0.08] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Child steps</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setTaskSteps((current) => [
                              ...current,
                              {
                                id: `step_${current.length + 1}`,
                                label: "New step",
                                responseType: "confirm",
                                required: true,
                              },
                            ])
                          }
                        >
                          Add step
                        </Button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {taskSteps.map((step, index) => (
                          <div
                            key={step.id}
                            className="rounded-xl bg-[#fafbf9] p-3"
                          >
                            <div className="flex gap-2">
                              <Input
                                value={step.label}
                                onChange={(event) =>
                                  setTaskSteps((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, label: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Step label"
                              />
                              <select
                                value={step.responseType}
                                onChange={(event) =>
                                  setTaskSteps((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            responseType: event.target
                                              .value as TaskStep["responseType"],
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className="h-10 rounded-xl border border-black/[0.1] bg-white px-2 text-xs"
                              >
                                <option value="confirm">Confirm</option>
                                <option value="yes_no">Yes / No</option>
                                <option value="number">Number</option>
                                <option value="short_text">Short text</option>
                              </select>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={index === 0}
                                onClick={() =>
                                  setTaskSteps((current) => {
                                    const next = [...current];
                                    [next[index - 1], next[index]] = [
                                      next[index],
                                      next[index - 1],
                                    ];
                                    return next;
                                  })
                                }
                              >
                                ↑
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={index === taskSteps.length - 1}
                                onClick={() =>
                                  setTaskSteps((current) => {
                                    const next = [...current];
                                    [next[index], next[index + 1]] = [
                                      next[index + 1],
                                      next[index],
                                    ];
                                    return next;
                                  })
                                }
                              >
                                ↓
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#b64738]"
                                onClick={() =>
                                  setTaskSteps((current) =>
                                    current.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </div>
                            <textarea
                              value={step.description ?? ""}
                              onChange={(event) =>
                                setTaskSteps((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          description: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className="mt-2 min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm"
                              placeholder="Step instructions"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {taskType === "cleaning" && (
                <>
                  <label className="text-sm font-semibold">
                    Task name
                    <Input
                      value={taskName}
                      onChange={(event) => setTaskName(event.target.value)}
                      className="mt-2 h-11"
                    />
                  </label>
                  <label className="text-sm font-semibold md:col-span-2">
                    Description / instructions
                    <textarea
                      value={taskDescription}
                      onChange={(event) =>
                        setTaskDescription(event.target.value)
                      }
                      className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Task format
                    <select
                      value={taskTaskType}
                      onChange={(event) => {
                        const next = event.target.value as
                          | "simple"
                          | "with_steps";
                        setTaskTaskType(next);
                        if (next === "with_steps" && !taskSteps.length)
                          setTaskSteps([
                            {
                              id: "step_1",
                              label: "New step",
                              responseType: "confirm",
                              required: true,
                            },
                          ]);
                      }}
                      className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                    >
                      <option value="simple">Simple check</option>
                      <option value="with_steps">Task with steps</option>
                    </select>
                  </label>
                  {taskTaskType === "simple" && (
                    <label className="text-sm font-semibold">
                      Simple completion behaviour
                      <select value={taskCompletionMode} onChange={(event) => setTaskCompletionMode(event.target.value as "question" | "task")} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3">
                        <option value="task">Simple completion task</option>
                        <option value="question">Question (Yes / No)</option>
                      </select>
                    </label>
                  )}
                  {taskTaskType === "with_steps" && (
                    <div className="md:col-span-2 rounded-xl border border-black/[0.08] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Child steps</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setTaskSteps((current) => [
                              ...current,
                              {
                                id: `step_${current.length + 1}`,
                                label: "New step",
                                responseType: "confirm",
                                required: true,
                              },
                            ])
                          }
                        >
                          Add step
                        </Button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {taskSteps.map((step, index) => (
                          <div
                            key={step.id}
                            className="rounded-xl bg-[#fafbf9] p-3"
                          >
                            <div className="flex gap-2">
                              <Input
                                value={step.label}
                                onChange={(event) =>
                                  setTaskSteps((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, label: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Step label"
                              />
                              <select
                                value={step.responseType}
                                onChange={(event) =>
                                  setTaskSteps((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            responseType: event.target
                                              .value as TaskStep["responseType"],
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className="h-10 rounded-xl border border-black/[0.1] bg-white px-2 text-xs"
                              >
                                <option value="confirm">Confirm</option>
                                <option value="yes_no">Yes / No</option>
                                <option value="number">Number</option>
                                <option value="short_text">Short text</option>
                              </select>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={index === 0}
                                onClick={() =>
                                  setTaskSteps((current) => {
                                    const next = [...current];
                                    [next[index - 1], next[index]] = [
                                      next[index],
                                      next[index - 1],
                                    ];
                                    return next;
                                  })
                                }
                              >
                                ↑
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={index === taskSteps.length - 1}
                                onClick={() =>
                                  setTaskSteps((current) => {
                                    const next = [...current];
                                    [next[index], next[index + 1]] = [
                                      next[index + 1],
                                      next[index],
                                    ];
                                    return next;
                                  })
                                }
                              >
                                ↓
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#b64738]"
                                onClick={() =>
                                  setTaskSteps((current) =>
                                    current.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </div>
                            <textarea
                              value={step.description ?? ""}
                              onChange={(event) =>
                                setTaskSteps((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          description: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className="mt-2 min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm"
                              placeholder="Step instructions"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <label className="text-sm font-semibold">
                    Frequency
                    <select
                      value={taskFrequency}
                      onChange={(event) => {
                        const next = event.target.value;
                        setTaskFrequency(next);
                        if (next === "weekly" && !taskWeekdays.length) setTaskWeekdays([1]);
                      }}
                      className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                    >
                      <option value="after_use">After use</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="specific_days">Specific days</option>
                    </select>
                  </label>
                  <div className="md:col-span-2"><CleaningScheduleFields frequency={taskFrequency} weekdays={taskWeekdays} onWeekdaysChange={setTaskWeekdays} /></div>
                </>
              )}
              {taskType === "additional" && (
                <>
                  <label className="text-sm font-semibold">
                    Title
                    <Input
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      className="mt-2 h-11"
                    />
                  </label>
                  <label className="text-sm font-semibold md:col-span-2">
                    Description
                    <textarea
                      value={taskDescription}
                      onChange={(event) =>
                        setTaskDescription(event.target.value)
                      }
                      className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <AdditionalScheduleFields
                      frequency={taskFrequency}
                      interval={taskInterval}
                      weekdays={taskWeekdays}
                      dayOfMonth={taskDayOfMonth}
                      nextDue={taskNextDue}
                      onFrequencyChange={setTaskFrequency}
                      onIntervalChange={setTaskInterval}
                      onWeekdaysChange={setTaskWeekdays}
                      onDayOfMonthChange={setTaskDayOfMonth}
                      onNextDueChange={setTaskNextDue}
                    />
                  </div>
                  <label className="text-sm font-semibold md:col-span-2">
                    Field definitions (JSON)
                    <textarea
                      value={JSON.stringify(taskFields, null, 2)}
                      onChange={(event) => {
                        try {
                          const parsed = JSON.parse(event.target.value);
                          if (Array.isArray(parsed)) setTaskFields(parsed);
                        } catch {
                          /* keep last valid field definition */
                        }
                      }}
                      className="mt-2 min-h-36 w-full rounded-xl border border-black/[0.1] p-3 font-mono text-xs"
                    />
                    <span className="mt-1 block text-xs font-normal text-[#89918b]">
                      Supports temperature, number, yes/no, completed, date,
                      text, actions and PDF fields.
                    </span>
                  </label>
                </>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                className="bg-[#202522] text-white"
                disabled={saving}
                onClick={saveTask}
              >
                {taskEdit
                  ? "Save organisation standard"
                  : "Publish operational task"}
              </Button>
              {taskEdit && (
                <Button variant="outline" onClick={resetTask}>
                  Cancel edit
                </Button>
              )}
            </div>
            <div className="mt-6 space-y-2">
              {data.checklists.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-[#fafbf9] p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{item.question}</p>
                    <p className="text-xs text-[#727a74]">
                      {item.checklist === "opening" ? "Opening" : "Closing"} ·{" "}
                      {item.stores.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        startTaskEdit({
                          ...item,
                          id: item.id,
                          kind: item.checklist,
                          allocationMode: item.allocationMode,
                          stores: item.stores,
                          locationIds: item.locationIds,
                          question: item.question,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#b64738]"
                      onClick={() => void retire("checklist", item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {data.operationalTasks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-[#fafbf9] p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {item.name ?? item.title ?? item.question}
                    </p>
                    <p className="text-xs text-[#727a74]">
                      {taskLabel(item.kind)} · {item.stores.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startTaskEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#b64738]"
                      onClick={() => void retire("operational", item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
