import {
  BookOpenCheck,
  ClipboardCheck,
  FileBarChart,
  Flame,
  Gauge,
  ListChecks,
  MessageSquareWarning,
  PackageSearch,
  ShieldCheck,
  Users,
  Wrench,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

export type AdminFeatureKey =
  | "issues"
  | "reports"
  | "opening"
  | "cleaning"
  | "security"
  | "additional"
  | "training"
  | "team"
  | "fridges"
  | "probes"
  | "wastage";

type Feature = {
  key: AdminFeatureKey;
  title: string;
  description: string;
  icon: LucideIcon;
};

const features: Feature[] = [
  {
    key: "issues",
    title: "Issues & Reviews",
    description: "Review open issues and manager follow-up.",
    icon: MessageSquareWarning,
  },
  {
    key: "reports",
    title: "Compliance Reports",
    description: "Inspect completion, exceptions and exports.",
    icon: FileBarChart,
  },
  {
    key: "opening",
    title: "Opening & Closing",
    description: "Manage opening and closing checks.",
    icon: ClipboardCheck,
  },
  {
    key: "cleaning",
    title: "Cleaning",
    description: "Manage cleaning tasks and schedules.",
    icon: Wrench,
  },
  {
    key: "security",
    title: "Security Checks",
    description: "Manage AM and PM security checks.",
    icon: ShieldCheck,
  },
  {
    key: "additional",
    title: "Additional Checks",
    description: "Manage recurring and one-off checks.",
    icon: ListChecks,
  },
  {
    key: "training",
    title: "Training Requirements",
    description: "Manage this store's training requirements.",
    icon: BookOpenCheck,
  },
  {
    key: "team",
    title: "Team Members",
    description: "Manage operational team attribution.",
    icon: Users,
  },
  {
    key: "fridges",
    title: "Fridges & Temperatures",
    description: "Manage equipment and temperature limits.",
    icon: Gauge,
  },
  {
    key: "probes",
    title: "Probe Products",
    description: "Manage food probe products and limits.",
    icon: Flame,
  },
  {
    key: "wastage",
    title: "Wastage",
    description: "Open the TouchOffice-backed wastage catalogue.",
    icon: PackageSearch,
  },
];

export default function AdminFeatureCards({
  onSelect,
  counts = {},
}: {
  onSelect: (key: AdminFeatureKey) => void;
  counts?: Partial<Record<AdminFeatureKey, string>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {features.map(({ key, title, description, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          aria-label={`Open ${title}`}
          className="group flex min-h-36 items-center gap-4 rounded-3xl border border-black/[0.07] bg-white p-5 text-left shadow-[0_4px_16px_rgba(23,25,24,0.04)] transition hover:-translate-y-0.5 hover:border-[#e5d77b] active:scale-[0.99]"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff7dc] text-[#8a6b12]">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[#171918]">
              {title}
            </span>
            <span className="mt-1 block text-sm leading-5 text-[#727a74]">
              {description}
            </span>
            {counts[key] && (
              <span className="mt-3 block text-xs font-semibold text-[#89918b]">
                {counts[key]}
              </span>
            )}
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
