import { dailyTaskStatusLabel, type DailyTaskIcon, type DailyTaskModel, type DailyTaskStatus } from "@/components/dashboard/daily-checks-model";
import { Check, ChevronRight, CircleAlert, ClipboardCheck, FileCheck2, ShieldCheck, Sparkles, Thermometer, Trash2, Utensils } from "lucide-react";

function TaskIcon({ icon }: { icon: DailyTaskIcon }) {
  if (icon === "temperature") return <Thermometer className="size-5" />;
  if (icon === "probe") return <Utensils className="size-5" />;
  if (icon === "cleaning") return <Sparkles className="size-5" />;
  if (icon === "additional") return <ClipboardCheck className="size-5" />;
  if (icon === "security") return <ShieldCheck className="size-5" />;
  if (icon === "wastage") return <Trash2 className="size-5" />;
  if (icon === "checklist") return <ClipboardCheck className="size-5" />;
  return <FileCheck2 className="size-5" />;
}

const statusStyles: Record<DailyTaskStatus, string> = {
  "not-started": "border-black/[0.08] bg-white",
  "in-progress": "border-[#ead797] bg-[#fffdf4]",
  completed: "border-[#cfe3d5] bg-[#fbfefb]",
  "completed-attention": "border-[#efc8c3] bg-[#fff8f6]",
  "due-later": "border-black/[0.06] bg-[#fbfcfa] opacity-80",
  attention: "border-[#efc8c3] bg-[#fff8f6]",
  "not-scheduled": "border-black/[0.05] bg-[#f8f9f7] opacity-75",
};

const markerStyles: Record<DailyTaskStatus, string> = {
  "not-started": "border-[#d9dcd7] bg-white text-[#7b827d]",
  "in-progress": "border-[#e1c451] bg-[#fff7dc] text-[#8a6b12]",
  completed: "border-[#b9d6c2] bg-[#e4f2e8] text-[#2d7951]",
  "completed-attention": "border-[#e5aaa2] bg-[#fff0ed] text-[#a13f34]",
  "due-later": "border-[#dfe3dd] bg-[#f1f2ef] text-[#89918b]",
  attention: "border-[#e5aaa2] bg-[#fff0ed] text-[#a13f34]",
  "not-scheduled": "border-[#e2e5e1] bg-[#f1f2ef] text-[#89918b]",
};

export function DailyTaskCard({
  task,
  onAction,
}: {
  task: DailyTaskModel;
  onAction: () => void;
}) {
  const complete = task.status === "completed" || task.status === "completed-attention";
  const attention = task.status === "attention" || task.status === "completed-attention";
  const disabled = task.status === "not-scheduled";
  const optional = !task.required && !complete && !attention && task.status !== "not-scheduled";
  const visibleStatus = dailyTaskStatusLabel(task);
  return (
    <li className={`relative rounded-3xl border shadow-[0_5px_18px_rgba(23,25,24,0.04)] transition ${optional ? "border-black/[0.06] bg-[#fbfcfa]" : statusStyles[task.status]}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={`${task.actionLabel}: ${task.title}`}
        onClick={onAction}
        className="group relative block min-h-[7.75rem] w-full rounded-3xl p-4 text-left outline-none transition-[transform,box-shadow,background-color] duration-200 hover:shadow-[0_8px_24px_rgba(23,25,24,0.08)] focus-visible:ring-2 focus-visible:ring-[#202522] focus-visible:ring-inset active:scale-[0.99] disabled:cursor-default disabled:hover:shadow-none disabled:active:scale-100 sm:min-h-[7.5rem] sm:p-5 motion-reduce:transition-none"
      >
        <div className="flex items-start gap-3 pr-8 sm:gap-4">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${optional ? "border-[#dfe3dd] bg-[#f1f2ef] text-[#89918b]" : markerStyles[task.status]}`} aria-hidden="true">
            <TaskIcon icon={task.icon} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight text-[#202522]">{task.title}</p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#727a74]">{task.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
              <span className={complete && !attention ? "text-[#2d7951]" : attention ? "text-[#a13f34]" : "text-[#727a74]"}>{visibleStatus}</span>
              <span className="text-[#a0a7a1]">·</span>
              <span className="text-[#89918b]">{task.detail}</span>
            </div>
          </div>
        </div>
        <ChevronRight className={`absolute bottom-4 right-4 size-5 transition-transform group-hover:translate-x-0.5 ${complete && !attention ? "text-[#2d7951]" : attention ? "text-[#a13f34]" : "text-[#89918b]"}`} aria-hidden="true" />
      </button>
    </li>
  );
}

export function IssuesAttentionIcon({ open }: { open: boolean }) {
  return open ? <CircleAlert className="size-5" /> : <Check className="size-5" />;
}
