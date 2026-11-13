import { useRef, useState } from "react";

export function PdfDropzone({ onFile }: { onFile: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return;
    onFile(file);
  };
  return <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files[0]); }} className={`mt-2 rounded-xl border border-dashed p-3 transition ${dragging ? "border-brand-yellow bg-brand-yellow/10" : "border-black/[0.12] bg-white"}`}>
    <button type="button" className="min-h-11 w-full text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow" onClick={() => inputRef.current?.click()}>Drop a PDF here or choose a file</button>
    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => accept(event.target.files?.[0])} />
  </div>;
}
