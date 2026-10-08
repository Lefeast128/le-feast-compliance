import { Top } from "@/components/dashboard/DashboardPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, ChevronRight, FileText, Search, ShieldCheck, Store, X } from "lucide-react";
import { useMemo, useState } from "react";

type LibraryDocument = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  important: boolean;
  updatedAt?: string | number | Date;
  documentUrl?: string | null;
};
type Props = {
  locationName: string;
  documents: LibraryDocument[];
  onBack: () => void;
};

const categoryDescriptions: Record<string, string> = {
  food_safety: "Food safety diaries, EHO guidance and essential records.",
  food_safety_eho: "Food safety diaries, EHO guidance and essential records.",
  store_station: "Store, station and day-to-day operating guidance.",
  health_safety: "Health, safety and fire reference material.",
  policies_procedures: "Company policies and practical procedures.",
  other: "Other essential store reference documents.",
};
const categoryLabel = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const dateLabel = (value?: string | number | Date) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Recently updated";

function categoryIcon(category: string) {
  if (category.includes("safety") || category.includes("eho")) return ShieldCheck;
  if (category.includes("store") || category.includes("station")) return Store;
  return BookOpen;
}

export default function LibraryView({ locationName, documents, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryDocument | null>(null);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter(document => (!category || document.category === category) && (!term || `${document.title} ${document.description ?? ""} ${document.category}`.toLowerCase().includes(term)));
  }, [category, documents, search]);
  const categories = useMemo(() => [...new Set(documents.map(document => document.category))].sort((a, b) => a.localeCompare(b)), [documents]);
  const byCategory = category ? [] : categories;

  if (selected) {
    return <div className="min-h-screen bg-[#f6f7f5] pb-24 text-[#171918]"><Top title="Library document" onBack={() => setSelected(null)} /><main className="mx-auto max-w-3xl px-4 py-7 sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">{locationName}</p><h1 className="mt-2 text-3xl font-semibold">{selected.title}</h1>{selected.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#727a74]">{selected.description}</p>}<div className="mt-6 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_4px_16px_rgba(23,25,24,0.04)]"><iframe title={`PDF: ${selected.title}`} src={selected.documentUrl ?? ""} className="h-[65vh] min-h-[420px] w-full" /></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-[#727a74]">Reference PDF</p>{selected.documentUrl && <Button variant="outline" asChild><a href={selected.documentUrl} target="_blank" rel="noreferrer">Open PDF</a></Button>}</div></main></div>;
  }

  return <div className="min-h-screen bg-[#f6f7f5] pb-24 text-[#171918]"><Top title="Library" onBack={onBack} /><main className="mx-auto max-w-3xl px-4 py-7 sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">{locationName}</p><h1 className="mt-2 text-3xl font-semibold">Library</h1><p className="mt-2 text-sm text-[#727a74]">Essential store documents and guides</p><div className="relative mt-6"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#89918b]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search documents" aria-label="Search documents" className="h-12 rounded-2xl bg-white pl-10" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727a74]"><X className="size-4" /></button>}</div>{!documents.length ? <div className="mt-8 rounded-2xl border border-black/[0.07] bg-white p-7 text-center text-sm text-[#727a74]">No store documents have been published yet.</div> : search || category ? <section className="mt-8 space-y-3"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">{category ? categoryLabel(category) : "Search results"}</p>{category && <Button variant="ghost" size="sm" onClick={() => setCategory(null)}>All categories</Button>}</div>{filtered.map(document => <DocumentCard key={document.id} document={document} onOpen={() => setSelected(document)} />)}{!filtered.length && <div className="rounded-2xl border border-black/[0.07] bg-white p-7 text-center text-sm text-[#727a74]">No matching documents.</div>}</section> : <section className="mt-8 grid gap-4 sm:grid-cols-2">{byCategory.map(value => { const Icon = categoryIcon(value); const count = documents.filter(document => document.category === value).length; return <button type="button" key={value} onClick={() => setCategory(value)} className="rounded-3xl border border-black/[0.07] bg-white p-5 text-left shadow-[0_4px_16px_rgba(23,25,24,0.04)] transition hover:-translate-y-0.5 hover:border-[#e5d77b] active:scale-[0.99]"><div className="flex items-center gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff7dc] text-[#8a6b12]"><Icon className="size-6" /></span><span className="min-w-0 flex-1"><span className="block text-lg font-semibold">{categoryLabel(value)}</span><span className="mt-1 block text-sm text-[#727a74]">{categoryDescriptions[value] ?? "Essential store reference material."}</span><span className="mt-3 block text-xs font-semibold text-[#89918b]">{count} {count === 1 ? "document" : "documents"}</span></span><ChevronRight className="size-5 shrink-0 text-[#89918b]" /></div></button>; })}</section>}</main></div>;
}

function DocumentCard({ document, onOpen }: { document: LibraryDocument; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} aria-label={`Open ${document.title}`} className="group flex w-full items-center gap-4 rounded-2xl border border-black/[0.07] bg-white p-5 text-left shadow-[0_4px_16px_rgba(23,25,24,0.04)] transition hover:-translate-y-0.5 hover:border-[#e5d77b] active:scale-[0.99]"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f4f0] text-[#4e5851]"><FileText className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{document.title}</span>{document.important && <span className="rounded-full bg-[#fff7dc] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a6b12]">Important</span>}</span>{document.description && <span className="mt-1 block line-clamp-2 text-sm text-[#727a74]">{document.description}</span>}<span className="mt-3 block text-xs text-[#89918b]">{categoryLabel(document.category)} · Updated {dateLabel(document.updatedAt)} · PDF</span></span><ChevronRight className="size-5 shrink-0 text-[#89918b] transition-transform group-hover:translate-x-0.5" /></button>;
}
