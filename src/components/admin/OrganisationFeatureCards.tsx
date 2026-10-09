import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  FileText,
  Users,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

export type OrganisationFeatureKey =
  | "access"
  | "training"
  | "operational"
  | "library"
  | "activity";

const cards: Array<{
  key: OrganisationFeatureKey;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    key: "access",
    title: "User Access",
    description: "Manage login accounts, store access and roles.",
    icon: Users,
  },
  {
    key: "training",
    title: "Training Requirements",
    description: "Publish central briefing and document training.",
    icon: BookOpenCheck,
  },
  {
    key: "operational",
    title: "Operational Standards",
    description: "Manage opening, cleaning, security and recurring standards.",
    icon: ClipboardList,
  },
  {
    key: "library",
    title: "Document Library",
    description: "Publish reference documents to stores.",
    icon: FileText,
  },
  {
    key: "activity",
    title: "Organisation Activity",
    description: "Review recent organisation changes.",
    icon: Activity,
  },
];

export default function OrganisationFeatureCards({
  onSelect,
}: {
  onSelect: (key: OrganisationFeatureKey) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ key, title, description, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          aria-label={`Open ${title}`}
          className="group flex min-h-36 items-center gap-4 rounded-3xl border border-black/[0.07] bg-white p-5 text-left shadow-[0_4px_16px_rgba(23,25,24,0.04)] transition hover:-translate-y-0.5 hover:border-[#e5d77b] active:scale-[0.99]"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-yellow/20 text-[#171717]">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[#171918]">
              {title}
            </span>
            <span className="mt-1 block text-sm leading-5 text-[#727a74]">
              {description}
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-[#89918b] transition group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
