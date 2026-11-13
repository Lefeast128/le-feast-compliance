import { checklistProgress, type LegacyCompletion, type StructuredCompletion, type UnifiedItem } from "@/lib/unified-checklist";

export function checklistIsReadyToSignOff(
  items: UnifiedItem[],
  legacyResponses: LegacyCompletion[],
  structuredResponses: StructuredCompletion[],
) {
  return checklistProgress(items, legacyResponses, structuredResponses).allComplete;
}
