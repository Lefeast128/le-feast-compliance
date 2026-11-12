import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readVerifiedPdf } from "@/lib/verified-pdf";

type Props = {
  documentId?: string | null;
  documentUrl?: string | null;
  title: string;
  className?: string;
  onVerifiedChange?: (verified: boolean) => void;
};

export default function VerifiedPdfPreview({ documentId, documentUrl, title, className = "h-72", onVerifiedChange }: Props) {
  const [preview, setPreview] = useState<{ key: string; status: "ready" | "unavailable"; url?: string }>();
  const [retry, setRetry] = useState(0);
  const requestKey = `${documentId ?? ""}:${documentUrl ?? ""}:${retry}`;

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (!documentId || !documentUrl) {
      return () => { active = false; };
    }
    fetch(documentUrl, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/pdf" } })
      .then(response => readVerifiedPdf(response, documentId))
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ key: requestKey, status: "ready", url: objectUrl });
        onVerifiedChange?.(true);
      })
      .catch(() => {
        if (!active) return;
        setPreview({ key: requestKey, status: "unavailable" });
        onVerifiedChange?.(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, documentUrl, onVerifiedChange, requestKey]);

  if (!documentId || !documentUrl || (preview?.key === requestKey && preview.status === "unavailable")) return <div role="alert" className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-[#efc8c3] bg-white p-4 text-center text-sm text-[#a13d32] ${className}`}><p>This PDF preview is unavailable because the document could not be verified.</p>{documentId && documentUrl && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>Try again</Button>}</div>;
  if (preview?.key !== requestKey || !preview.url) return <div role="status" className={`flex items-center justify-center rounded-xl border border-black/[0.1] bg-white p-4 text-sm text-[#606861] ${className}`}>Verifying PDF…</div>;
  return <div className="space-y-2">
    <iframe title={`${title} PDF`} src={preview.url} className={`w-full rounded-xl border border-black/[0.1] ${className}`} />
    <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-black/[0.1] px-3 text-sm font-semibold text-[#202522]">Open verified PDF</a>
  </div>;
}
