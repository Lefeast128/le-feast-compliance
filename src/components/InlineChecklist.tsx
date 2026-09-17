import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

type Props = {
  title: string;
  questions: any[];
  responses: any[];
  onComplete: (questionId: any) => Promise<void>;
  onIssue: (questionId: any, problem: string, action: string) => Promise<void>;
  onBack: () => void;
};

export default function InlineChecklist({ title, questions, responses, onComplete, onIssue, onBack }: Props) {
  const [issueQuestion, setIssueQuestion] = useState<any>(null);
  const [problem, setProblem] = useState("");
  const [action, setAction] = useState("");
  const responseFor = (id: any) => responses.find((response) => response.questionId === id);
  async function saveIssue() { if (!issueQuestion || !problem.trim() || !action.trim()) return; await onIssue(issueQuestion._id, problem, action); setIssueQuestion(null); setProblem(""); setAction(""); }
  return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]"><header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4"><Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="size-5" /></Button><div><p className="font-semibold">{title}</p><p className="text-xs text-[#89918b]">Complete jobs in any order</p></div></div></header><main className="mx-auto max-w-2xl px-4 py-7 sm:px-6"><div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Daily checklist</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1></div><p className="text-sm text-[#727a74]">{responses.length} of {questions.length}</p></div><div className="space-y-2">{questions.map((question) => { const response = responseFor(question._id); const issueOpen = issueQuestion?._id === question._id; return <div key={question._id} className={`rounded-2xl border bg-white p-4 ${response?.answer === "no" ? "border-[#efc8c3]" : "border-black/[0.07]"}`}><div className="flex items-center justify-between gap-4"><p className={`text-sm font-semibold ${response ? "text-[#59625c]" : "text-[#171918]"}`}>{question.question}</p>{response ? <span className={`flex shrink-0 items-center gap-1 text-sm font-semibold ${response.answer === "no" ? "text-[#b64738]" : "text-[#2d7951]"}`}>{response.answer === "no" ? "Issue" : "Completed"} <Check className="size-4" /></span> : <div className="flex shrink-0 gap-2"><Button size="sm" className="bg-[#f4c542] font-semibold text-[#171717] hover:bg-[#f7d363]" onClick={() => onComplete(question._id)}>Complete <Check className="ml-1 size-4" /></Button><Button size="sm" variant="outline" onClick={() => { setIssueQuestion(question); setProblem(""); setAction(""); }}>Issue</Button></div>}</div>{response?.answer === "no" && <div className="mt-3 rounded-xl bg-[#fff5f3] p-3 text-sm"><p className="font-semibold text-[#8f3a31]">Action recorded</p><p className="mt-1 text-[#727a74]">{response.action}</p></div>}{issueOpen && <div className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-4"><p className="font-semibold text-[#8f3a31]">Action required</p><label className="mt-3 block text-sm font-semibold">What was wrong?<textarea value={problem} onChange={(event) => setProblem(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3" placeholder="Enter details" /></label><label className="mt-3 block text-sm font-semibold">What action was taken?<textarea value={action} onChange={(event) => setAction(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3" placeholder="Enter corrective action" /></label><Button disabled={!problem.trim() || !action.trim()} className="mt-3 h-11 bg-[#202522] text-white" onClick={saveIssue}>Save issue</Button></div>}</div>; })}</div><Button variant="outline" className="mt-7 w-full" onClick={onBack}>View all checks <ChevronRight className="ml-2 size-4" /></Button></main></div>;
}
