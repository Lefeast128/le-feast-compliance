import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Coffee,
  Droplets,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Timer,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const fmtTime = (value?: number) => value ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
const fmtDate = () => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

function BrandMark() {
  return <div className="flex size-9 items-center justify-center rounded-xl bg-[#f4c542] text-[#171717]"><Coffee className="size-5" /></div>;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<"today" | "operations">("today");
  const [showRound, setShowRound] = useState(false);
  const [showProbe, setShowProbe] = useState(false);
  const [roundId, setRoundId] = useState<any>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [temperature, setTemperature] = useState("");
  const [probeProduct, setProbeProduct] = useState("Sausages");
  const [probeTemp, setProbeTemp] = useState("");
  const [probeAction, setProbeAction] = useState("");
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const initializeDemo = useMutation(api.compliance.initializeDemo);
  const startRound = useMutation(api.compliance.startRound);
  const recordTemperature = useMutation(api.compliance.recordTemperature);
  const completeRound = useMutation(api.compliance.completeRound);
  const recordFoodCheck = useMutation(api.compliance.recordFoodCheck);
  const resolveIssue = useMutation(api.compliance.resolveIssue);
  const dashboard = useQuery(api.compliance.dashboard, {});
  const operations = useQuery(api.compliance.operations, view === "operations" ? {} : "skip");

  useEffect(() => { void initializeDemo(); }, [initializeDemo]);
  const completed = dashboard?.tasks.filter((task) => task.status === "complete").length ?? 0;
  const total = dashboard?.tasks.length ?? 0;
  const openIssues = dashboard?.issues.filter((issue) => issue.status !== "resolved") ?? [];
  const activeEquipment = dashboard?.equipment ?? [];
  const currentEquipment = activeEquipment[roundIndex];
  const recentReadings = useMemo(() => (dashboard?.readings ?? []).sort((a, b) => b.createdAt - a.createdAt).slice(0, 4), [dashboard?.readings]);

  async function beginRound() {
    if (!dashboard) return;
    const id = await startRound({ locationId: dashboard.location._id, session: "AM" });
    setRoundId(id); setRoundIndex(0); setTemperature(""); setShowRound(true);
  }
  async function saveTemperature() {
    if (!dashboard || !roundId || !currentEquipment || temperature === "") return;
    const value = Number(temperature);
    if (Number.isNaN(value)) return;
    await recordTemperature({ roundId, locationId: dashboard.location._id, equipmentId: currentEquipment._id, temperature: value });
    if (value > 8) toast.error("Temperature requires action", { description: `${currentEquipment.name} recorded ${value}°C. An issue has been opened.` });
    else toast.success("Reading saved", { description: `${currentEquipment.name} · ${value}°C` });
    if (roundIndex + 1 >= activeEquipment.length) {
      await completeRound({ roundId, locationId: dashboard.location._id });
      setShowRound(false); setRoundId(null); toast.success("AM round complete", { description: "All active equipment has been recorded." });
    } else { setRoundIndex((index) => index + 1); setTemperature(""); }
  }
  async function saveProbe() {
    if (!dashboard || !probeTemp) return;
    const value = Number(probeTemp);
    if (Number.isNaN(value)) return;
    await recordFoodCheck({ locationId: dashboard.location._id, product: probeProduct, temperature: value, action: value < 76 ? probeAction || "Continued cooking and recheck required" : "Held for at least 2 minutes" });
    if (value < 76) toast.error("Not ready to serve", { description: "Continue cooking and recheck at 76°C or above." });
    else toast.success("Food probe recorded", { description: `${probeProduct} · ${value}°C · Pass` });
    setShowProbe(false); setProbeTemp(""); setProbeAction("");
  }
  async function closeIssue(issueId: any) {
    await resolveIssue({ issueId, action: "Rechecked and confirmed safe. Manager review completed." });
    toast.success("Issue resolved");
  }
  async function logout() { await signOut(); navigate("/"); }

  if (view === "operations") {
    return <OperationsView data={operations} onBack={() => setView("today")} onSelect={(store: any) => setSelectedStore(store)} selectedStore={selectedStore} />;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="sticky top-0 z-20 border-b border-black/[0.07] bg-[#f6f7f5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3"><BrandMark /><div><p className="text-[15px] font-semibold tracking-tight">Le Feast</p><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#747b76]">Food safety</p></div></div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden gap-2 text-[#59605b] sm:flex" onClick={() => setView("operations")}><ShieldCheck className="size-4" /> Operations</Button>
            <Button variant="ghost" size="icon" className="text-[#59605b]" onClick={logout} aria-label="Sign out"><LogOut className="size-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-sm font-medium text-[#7b827d]">{fmtDate()}</p><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Good morning{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</h1><div className="mt-3 flex items-center gap-2 text-sm text-[#69716b]"><MapPin className="size-4 text-[#9a7511]" /> {dashboard?.location.name ?? "Loading your store…"}<span className="text-[#bbc0bc]">·</span><span>Europe/London</span></div></div>
          <div className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-4 py-3"><div className="flex size-10 items-center justify-center rounded-full bg-[#f7eab7] text-[#80620e]"><ClipboardCheck className="size-5" /></div><div><p className="text-sm font-semibold">{completed} of {total || 6} complete</p><p className="text-xs text-[#7b827d]">{openIssues.length ? `${openIssues.length} issue${openIssues.length > 1 ? "s" : ""} requires action` : "All clear so far"}</p></div></div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="space-y-5">
            {showRound ? <RoundCard equipment={currentEquipment} index={roundIndex} total={activeEquipment.length} temperature={temperature} setTemperature={setTemperature} onSave={saveTemperature} onCancel={() => setShowRound(false)} /> : <TaskCard icon={<Thermometer className="size-5" />} eyebrow="Temperature round" title="AM Fridge Checks" detail={dashboard?.tasks.find((task) => task.session === "AM")?.status === "complete" ? "Completed" : "Due now · walk the store in order"} state={dashboard?.tasks.find((task) => task.session === "AM")?.status === "complete" ? "complete" : "due"} action={beginRound} actionLabel="Start round" />}
            <TaskCard icon={<Utensils className="size-5" />} eyebrow="Food probe" title="Cooking temperature" detail="Required when the first cooked batch is ready" state={dashboard?.foodChecks.length ? "complete" : "upcoming"} action={() => setShowProbe(true)} actionLabel="Record check" />
            <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#89918b]">Recent readings</p><h2 className="mt-1 text-lg font-semibold tracking-tight">Latest evidence</h2></div><RefreshCw className="size-4 text-[#a2a8a3]" /></div>{recentReadings.length ? <div className="divide-y divide-black/[0.06]">{recentReadings.map((reading) => { const eq = activeEquipment.find((item) => item._id === reading.equipmentId); return <div key={reading._id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium">{eq?.name ?? "Equipment"}</p><p className="mt-0.5 text-xs text-[#89918b]">{fmtTime(reading.createdAt)} · {reading.result === "fail" ? "Action required" : "AM round"}</p></div><span className={`font-mono text-sm font-semibold ${reading.result === "fail" ? "text-[#b64738]" : "text-[#2b6a4b]"}`}>{reading.temperature}°C</span></div>})}</div> : <p className="rounded-xl bg-[#f6f7f5] px-4 py-3 text-sm text-[#737b75]">Your completed readings will appear here.</p>}</div>
          </section>
          <aside className="space-y-5">
            <div className="rounded-2xl border border-black/[0.07] bg-[#202522] p-5 text-white sm:p-6"><div className="flex items-center gap-2 text-[#f4c542]"><AlertTriangle className="size-4" /><p className="text-xs font-semibold uppercase tracking-[0.15em]">Action required</p></div>{openIssues.length ? <div className="mt-5 space-y-4">{openIssues.map((issue) => <div key={issue._id} className="border-t border-white/10 pt-4 first:border-0 first:pt-0"><p className="text-sm font-semibold">{issue.title}</p><p className="mt-1 text-xs leading-5 text-white/60">{issue.description}</p>{issue.action ? <p className="mt-3 rounded-lg bg-white/[0.07] px-3 py-2 text-xs text-white/80">{issue.action}</p> : null}<Button size="sm" className="mt-3 h-9 bg-[#f4c542] px-3 text-[#1e211f] hover:bg-[#f8d568]" onClick={() => closeIssue(issue._id)}>Resolve issue</Button></div>)}</div> : <div className="mt-5"><p className="text-sm text-white/70">Nothing needs your attention right now.</p><div className="mt-4 flex items-center gap-2 text-xs text-[#b6d5c2]"><CheckCircle2 className="size-4" /> Checks are on track</div></div>}</div>
            <div className="rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#89918b]">Your store</p><div className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-[#727a74]">Chilled maximum</span><strong>8°C</strong></div><div className="flex items-center justify-between"><span className="text-[#727a74]">Cooking standard</span><strong>76°C / 2 min</strong></div><div className="flex items-center justify-between"><span className="text-[#727a74]">Active equipment</span><strong>{activeEquipment.length || "—"}</strong></div></div></div>
          </aside>
        </div>
      </main>
      {showProbe && <ProbeModal product={probeProduct} setProduct={setProbeProduct} temp={probeTemp} setTemp={setProbeTemp} action={probeAction} setAction={setProbeAction} onSave={saveProbe} onClose={() => setShowProbe(false)} />}
      <div className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-2xl border border-black/[0.08] bg-white p-1 shadow-lg shadow-black/10 sm:hidden"><Button size="sm" className="bg-[#202522] text-white" onClick={() => setView("today")}><Menu className="mr-2 size-4" />Today</Button><Button size="sm" variant="ghost" onClick={() => setView("operations")}><ShieldCheck className="mr-2 size-4" />Ops</Button></div>
    </div>
  );
}

function TaskCard({ icon, eyebrow, title, detail, state, action, actionLabel }: any) { return <motion.div whileHover={{ y: -2 }} className="flex items-center gap-4 rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"><div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${state === "complete" ? "bg-[#e4f2e8] text-[#2d7951]" : "bg-[#fff5d4] text-[#8a6b12]"}`}>{state === "complete" ? <Check className="size-5" /> : icon}</div><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#89918b]">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-[#727a74]">{detail}</p></div>{state === "complete" ? <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Done</div> : <Button className="shrink-0 bg-[#202522] text-white hover:bg-[#353c37]" onClick={action}>{actionLabel}<ChevronRight className="ml-1 size-4" /></Button>}</motion.div>; }
function RoundCard({ equipment, index, total, temperature, setTemperature, onSave, onCancel }: any) { return <motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-[#d6c47a] bg-[#fffdf4] p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#997813]">AM fridge checks</p><p className="mt-2 text-sm text-[#6e746f]">Unit {index + 1} of {total}</p></div><Button variant="ghost" size="sm" onClick={onCancel}><X className="mr-1 size-4" /> Close</Button></div><div className="mt-7 flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-xl bg-[#f4c542] text-[#27251c]"><Thermometer className="size-6" /></div><div><h2 className="text-xl font-semibold tracking-tight">{equipment?.name ?? "Equipment"}</h2><p className="text-sm text-[#737a73]">{equipment?.type ?? "Temperature-controlled equipment"}</p></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-black/[0.07] bg-white px-4 py-3"><p className="text-xs text-[#7f877f]">Operational target</p><p className="mt-1 font-semibold">5°C or below</p></div><div className="rounded-xl border border-black/[0.07] bg-white px-4 py-3"><p className="text-xs text-[#7f877f]">Maximum permitted</p><p className="mt-1 font-semibold">8°C</p></div></div><div className="mt-7"><label className="text-sm font-semibold">Temperature reading</label><div className="mt-2 flex gap-3"><Input autoFocus inputMode="decimal" type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="e.g. 4.5" className="h-14 bg-white text-xl font-semibold" /><Button className="h-14 bg-[#202522] px-6 text-white" onClick={onSave} disabled={!temperature}>Save & next <ChevronRight className="ml-1 size-4" /></Button></div><p className="mt-2 text-xs text-[#858c85]">Enter the exact reading shown on the probe. Do not round.</p></div></motion.div>; }
function ProbeModal({ product, setProduct, temp, setTemp, action, setAction, onSave, onClose }: any) { return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5"><motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-lg rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#89918b]">Food probe</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Record a cooking check</h2><p className="mt-2 text-sm text-[#727a74]">Le Feast standard: 76°C or above, held for 2 minutes.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button></div><div className="mt-7 space-y-4"><div><label className="text-sm font-semibold">Food / product</label><Input className="mt-2 h-12" value={product} onChange={(e) => setProduct(e.target.value)} /></div><div><label className="text-sm font-semibold">Core temperature</label><div className="mt-2 flex items-center gap-3"><Input autoFocus inputMode="decimal" type="number" step="0.1" className="h-14 text-xl font-semibold" placeholder="e.g. 81.2" value={temp} onChange={(e) => setTemp(e.target.value)} /><span className="text-lg font-semibold">°C</span></div></div>{temp && Number(temp) < 76 && <div className="rounded-xl border border-[#efc8c3] bg-[#fff3f1] p-4 text-sm text-[#8f3a31]"><p className="font-semibold">Not ready to serve</p><p className="mt-1">Continue cooking and recheck before serving.</p><Input className="mt-3 bg-white" placeholder="What action did you take?" value={action} onChange={(e) => setAction(e.target.value)} /></div>}</div><Button className="mt-7 h-12 w-full bg-[#202522] text-white" disabled={!temp} onClick={onSave}>Save food check <Check className="ml-2 size-4" /></Button></motion.div></div>; }

function OperationsView({ data, onBack, onSelect, selectedStore }: any) { return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]"><header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8"><div className="flex items-center gap-3"><BrandMark /><div><p className="text-[15px] font-semibold">Le Feast</p><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#747b76]">Operations</p></div></div><Button variant="outline" className="gap-2" onClick={onBack}><ArrowLeft className="size-4" /> My Today</Button></div></header><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12"><div className="mb-8"><p className="text-sm font-medium text-[#7b827d]">Group view · {fmtDate()}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Which store needs attention?</h1><p className="mt-2 text-sm text-[#727a74]">A focused view of today&apos;s compliance exceptions across Le Feast.</p></div>{selectedStore ? <div className="mb-6 rounded-2xl border border-black/[0.07] bg-white p-6"><Button variant="ghost" size="sm" className="mb-4 -ml-3" onClick={() => onSelect(null)}><ArrowLeft className="mr-1 size-4" /> All stores</Button><h2 className="text-xl font-semibold">{selectedStore.location.name}</h2><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Checks complete" value={`${selectedStore.complete}/${selectedStore.total}`} /><Metric label="Outstanding" value={selectedStore.outstanding} danger={selectedStore.outstanding > 0} /><Metric label="Open issues" value={selectedStore.issues} danger={selectedStore.issues > 0} /></div>{selectedStore.latestIssue && <div className="mt-5 rounded-xl bg-[#fff7dc] p-4 text-sm"><p className="font-semibold">Latest follow-up</p><p className="mt-1 text-[#6c6652]">{selectedStore.latestIssue.title}</p></div>}</div> : <><div className="grid gap-4 sm:grid-cols-3"><Metric label="Morning checks" value={`${(data ?? []).reduce((sum: number, store: any) => sum + store.complete, 0)} / ${(data ?? []).reduce((sum: number, store: any) => sum + store.total, 0)}`} /><Metric label="Checks outstanding" value={(data ?? []).reduce((sum: number, store: any) => sum + store.outstanding, 0)} danger /><Metric label="Issues requiring review" value={(data ?? []).reduce((sum: number, store: any) => sum + store.issues, 0)} danger /></div><div className="mt-7 grid gap-4 md:grid-cols-2">{(data ?? []).map((store: any, index: number) => <motion.button whileHover={{ y: -2 }} key={store.location._id} onClick={() => onSelect(store)} className="cursor-pointer rounded-2xl border border-black/[0.07] bg-white p-5 text-left transition-colors hover:border-[#c7a82e]"><div className="flex items-start justify-between"><div><p className="text-lg font-semibold">{store.location.name}</p><p className="mt-1 text-xs text-[#89918b]">{store.outstanding ? "Needs attention" : "Morning complete"}</p></div><span className={`flex size-9 items-center justify-center rounded-full ${store.issues ? "bg-[#fff0ed] text-[#b64738]" : store.outstanding ? "bg-[#fff7dc] text-[#9a7511]" : "bg-[#e4f2e8] text-[#2d7951]"}`}>{store.issues ? <AlertTriangle className="size-4" /> : store.outstanding ? <Timer className="size-4" /> : <Check className="size-4" />}</span></div><div className="mt-5 flex items-end justify-between"><div><p className="text-2xl font-semibold tracking-tight">{store.complete}<span className="text-base text-[#9ca39d]">/{store.total}</span></p><p className="mt-1 text-xs text-[#89918b]">scheduled checks complete</p></div>{store.latestIssue && <p className="max-w-[150px] text-right text-xs leading-4 text-[#b64738]">{store.latestIssue.title}</p>}</div></motion.button>)}</div></>}</main></div>; }
function Metric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) { return <div className="rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#89918b]">{label}</p><p className={`mt-3 text-3xl font-semibold tracking-tight ${danger ? "text-[#b64738]" : "text-[#202522]"}`}>{value}</p></div>; }
