import { Button } from "@/components/ui/button";
import { dailyTaskStatusLabel, type DailyTaskIcon, type DailyTaskModel, type DailyTaskStatus } from "@/components/dashboard/daily-checks-model";
import { Check, ChevronRight, CircleAlert, ClipboardCheck, FileCheck2, ShieldCheck, Sparkles, Thermometer, Trash2, Utensils } from "lucide-react";

function TaskIcon({ icon, complete }: { icon: DailyTaskIcon; complete: boolean }) {
  if (complete) return <Check className="size-5" strokeWidth={2.5} />;
  if (icon === "temperature") return <Thermometer className="size-5" />;
  if (icon === "probe") return <Utensils className="size-5" />;
  if (icon === "cleaning") return <Sparkles className="size-5" />;
  if (icon === "additional") return <ClipboardCheck className="size-5" />;
  if (icon === "security") return <ShieldCheck className="size-5" />;
  if (icon === "wastage") return <Trash2 className="size-5" />;
  return <FileCheck2 className="size-5" />;
}

const statusStyles: Record<DailyTaskStatus, string> = {
  "not-started": "border-black/[0.08] bg-white",
  "in-progress": "border-[#ead797] bg-[#fffdf4]",
  completed: "border-[#cfe3d5] bg-[#fbfefb]",
  "due-later": "border-black/[0.06] bg-[#fbfcfa] opacity-80",
  attention: "border-[#efc8c3] bg-[#fff8f6]",
  "not-scheduled": "border-black/[0.05] bg-[#f8f9f7] opacity-75",
};

const markerStyles: Record<DailyTaskStatus, string> = {
  "not-started": "border-[#d9dcd7] bg-white text-[#7b827d]",
  "in-progress": "border-[#e1c451] bg-[#fff7dc] text-[#8a6b12]",
  completed: "border-[#b9d6c2] bg-[#e4f2e8] text-[#2d7951]",
  "due-later": "border-[#dfe3dd] bg-[#f1f2ef] text-[#89918b]",
  attention: "border-[#e5aaa2] bg-[#fff0ed] text-[#a13f34]",
  "not-scheduled": "border-[#e2e5e1] bg-[#f1f2ef] text-[#89918b]",
};

export function DailyTaskCard({
  task,
  step,
  onAction,
}: {
  task: DailyTaskModel;
  step: number;
  onAction: () => void;
}) {
  const complete = task.status === "completed";
  const disabled = task.status === "not-scheduled";
  const optional = !task.required && !complete && task.status !== "attention" && task.status !== "not-scheduled";
  const visibleStatus = dailyTaskStatusLabel(task);
  return (
    <li className={`relative rounded-3xl border p-4 shadow-[0_5px_18px_rgba(23,25,24,0.04)] transition sm:p-5 ${optional ? "border-black/[0.06] bg-[#fbfcfa]" : statusStyles[task.status]}`}>
      <div className="flex items-start gap-4">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${optional ? "border-[#dfe3dd] bg-[#f1f2ef] text-[#89918b]" : markerStyles[task.status]}`} aria-label={`Step ${step}: ${visibleStatus}`}>
          {complete ? <TaskIcon icon={task.icon} complete /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold tracking-tight text-[#202522]">{task.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#727a74]">{task.description}</p>
            </div>
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${complete ? "bg-[#e4f2e8] text-[#2d7951]" : task.status === "attention" ? "bg-[#fff0ed] text-[#a13f34]" : "bg-[#fff7dc] text-[#8a6b12]"}`} aria-hidden="true">
              <TaskIcon icon={task.icon} complete={false} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold">
            <span className={complete ? "text-[#2d7951]" : task.status === "attention" ? "text-[#a13f34]" : "text-[#727a74]"}>{visibleStatus}</span>
            <span className="text-[#a0a7a1]">·</span>
            <span className="text-[#89918b]">{task.detail}</span>
          </div>
          <Button
            type="button"
            disabled={disabled}
            variant={complete || disabled || optional ? "outline" : "default"}
            className={`mt-4 h-11 w-full justify-between font-semibold sm:w-auto sm:min-w-48 ${complete ? "bg-white text-[#202522]" : disabled || optional ? "bg-white text-[#4e5851]" : task.status === "attention" ? "bg-[#202522] text-white hover:bg-[#333b36]" : "bg-[#ffde56] text-[#171717] hover:bg-[#f7d363]"}`}
            onClick={onAction}
          >
            {task.actionLabel}
            <ChevronRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export function IssuesAttentionIcon({ open }: { open: boolean }) {
  return open ? <CircleAlert className="size-5" /> : <Check className="size-5" />;
}
