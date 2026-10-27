import { Button } from "@/components/ui/button";

/** Navigation only; workflow validation and evidence writes stay with the caller. */
export function WorkflowSteps({ steps, step, onBack, onNext, canNext, busy = false, confirm = "Confirm" }: {
  steps: string[]; step: number; onBack: () => void; onNext: () => void;
  canNext: boolean; busy?: boolean; confirm?: string;
}) {
  return <div className="mt-5 border-t border-black/10 pt-4">
    <p aria-live="polite" className="mb-3 text-sm text-neutral-600">Step {step + 1} of {steps.length} · {steps[step]}</p>
    <div className="flex gap-3">
      <Button variant="outline" className="min-h-11 flex-1" disabled={step === 0 || busy} onClick={onBack}>Back</Button>
      <Button className="min-h-11 flex-1 bg-brand-yellow text-black" disabled={!canNext || busy} onClick={onNext}>{busy ? "Saving…" : step === steps.length - 1 ? confirm : "Next"}</Button>
    </div>
  </div>;
}
