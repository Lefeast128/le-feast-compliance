import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Progress = {
  complete: number;
  total: number;
  label?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  date?: string;
  progress?: Progress;
  onBack: () => void;
};

/** Shared mobile-safe header for focused operational workflows and records. */
export default function OperationalHeader({
  title,
  subtitle,
  eyebrow,
  date,
  progress,
  onBack,
}: Props) {
  const percentage = progress && progress.total > 0
    ? Math.round((progress.complete / progress.total) * 100)
    : 0;
  const progressLabel = progress?.label ?? "completed";

  return (
    <header className="border-b border-black/[0.07] bg-white/95 shadow-[0_1px_10px_rgba(23,25,24,0.04)] backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to daily checks"
            className="mt-0.5 shrink-0 rounded-full"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#89918b]">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-0.5 break-words text-lg font-bold leading-tight text-[#171918] sm:text-xl">
              {title}
            </h1>
            {date && (
              <p className="mt-1 text-sm text-[#59625c]">{date}</p>
            )}
            {subtitle && (
              <p className="mt-1 break-words text-xs leading-5 text-[#89918b]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {progress && (
          <div className="mt-4 pl-12" aria-label={`${progress.complete} of ${progress.total} ${progressLabel}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-[#303631]">
                {progress.complete} of {progress.total} {progressLabel}
              </p>
              <p className="text-xs font-semibold text-[#89918b]">{percentage}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9ede8]">
              <div
                className="h-full rounded-full bg-[#2d7951] transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${percentage}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
