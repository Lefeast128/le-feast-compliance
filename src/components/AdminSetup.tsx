import ComplianceReports from "@/components/ComplianceReports";
import ManagerReviews from "@/components/ManagerReviews";
import AdminFeatureCards, {
  type AdminFeatureKey,
} from "@/components/admin/AdminFeatureCards";
import AdminStoreOverview from "@/components/admin/AdminStoreOverview";
import { AdminScopeNotice } from "@/components/admin/AdminScopeNotice";
import OrganisationAdmin from "@/components/OrganisationAdmin";
import type {
  AdminLocation,
  AdminOperation,
  AdminStore,
  AdminTeamResponse,
} from "@/components/admin/admin-types";
import WastageCatalogueAdmin from "@/components/WastageCatalogueAdmin";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { restApi, useRestQuery } from "@/lib/rest-domain";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

type Props = {
  onBack: () => void;
  onOpenDay?: (date: string, locationId: string) => void;
};

const featureTitles: Record<AdminFeatureKey, string> = {
  issues: "Issues & Reviews",
  reports: "Compliance Reports",
  opening: "Opening & Closing",
  cleaning: "Cleaning",
  security: "Security Checks",
  additional: "Additional Checks",
  training: "Training Requirements",
  team: "Team Members",
  fridges: "Fridges & Temperatures",
  probes: "Probe Products",
  wastage: "Wastage",
};

function FeatureHeader({
  title,
  storeName,
  onBack,
}: {
  title: string;
  storeName: string;
  onBack: () => void;
}) {
  return (
    <header className="border-b border-black/[0.07] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div>
          <p className="text-[15px] font-semibold">Admin</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">
            {storeName} · {title}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" /> Back to Admin
        </Button>
      </div>
    </header>
  );
}

export default function AdminSetup({ onBack, onOpenDay }: Props) {
  const { user } = useAuth();
  const isOrganisationAdmin = user?.role === "admin";
  const stores = useRestQuery<AdminOperation[]>(
    "operations",
    restApi.compliance.operations,
    true,
  );
  const [storeId, setStoreId] = useState<string | null>(null);
  const [feature, setFeature] = useState<AdminFeatureKey | null>(null);
  const [organisationAdminOpen, setOrganisationAdminOpen] = useState(false);
  const selected =
    stores?.find((entry) => entry.location._id === storeId) ?? stores?.[0];
  const selectedLocationId = selected?.location._id ?? null;
  const locations: AdminLocation[] = (stores ?? []).map(
    (entry) => entry.location,
  );
  const store = useRestQuery<AdminStore | null>(
    selectedLocationId ? `dashboard:${selectedLocationId}` : null,
    () =>
      restApi.compliance.dashboard({ locationId: selectedLocationId ?? "" }),
    Boolean(selectedLocationId),
  );
  const team = useRestQuery<AdminTeamResponse | null>(
    selectedLocationId ? `team:${selectedLocationId}` : null,
    () => restApi.compliance.team({ locationId: selectedLocationId ?? "" }),
    Boolean(selectedLocationId),
  );
  const currentStore =
    store?.location._id === selectedLocationId ? store : undefined;

  function selectStore(nextLocationId: string) {
    setStoreId(nextLocationId);
    setFeature(null);
  }

  if (organisationAdminOpen && isOrganisationAdmin) {
    return <OrganisationAdmin onBack={() => setOrganisationAdminOpen(false)} />;
  }

  if (!stores || (selectedLocationId && !currentStore)) {
    return (
      <div className="min-h-screen bg-[#f6f7f5] p-8 text-sm text-[#727a74]">
        Loading store setup…
      </div>
    );
  }

  if (feature && selectedLocationId && currentStore) {
    if (feature === "reports") {
      return (
        <ComplianceReports
          locationId={selectedLocationId}
          locations={locations}
          onBack={() => setFeature(null)}
          onOpenDay={(date, reportLocationId) =>
            onOpenDay?.(date, reportLocationId)
          }
        />
      );
    }
    if (feature === "issues") {
      return (
        <ManagerReviews
          locationId={selectedLocationId}
          locations={locations}
          onBack={() => setFeature(null)}
        />
      );
    }
    if (feature === "wastage") {
      return (
        <WastageCatalogueAdmin
          locationId={selectedLocationId}
          locations={locations}
          onClose={() => setFeature(null)}
        />
      );
    }
    return (
      <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
        <FeatureHeader
          title={featureTitles[feature]}
          storeName={currentStore.location.name}
          onBack={() => setFeature(null)}
        />
        <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8">
          <AdminStoreOverview
            key={`${selectedLocationId}:${feature}`}
            store={currentStore}
            team={team ?? undefined}
            onOpenCatalogue={() => setFeature("wastage")}
            scope={feature}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="text-[15px] font-semibold">Admin</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">
              Manage this store&apos;s compliance setup
            </p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" /> Back to Today
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
              Store Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Admin</h1>
            <p className="mt-2 text-sm text-[#727a74]">
              Manage this store&apos;s compliance setup.
            </p>
          </div>
          <label className="text-sm font-semibold sm:min-w-64">
            Selected store
            <select
              value={selectedLocationId ?? ""}
              onChange={(event) => selectStore(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
            >
              {(stores ?? []).map((entry) => (
                <option key={entry.location._id} value={entry.location._id}>
                  {entry.location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5">
          <AdminScopeNotice
            scope="store"
            title={`Store-only setup · ${selected?.location.name ?? "Selected store"}`}
            detail="Changes here apply only to this store. Organisation standards are read-only and managed through Organisation Admin."
          />
        </div>
        {isOrganisationAdmin && (
          <section className="mt-7 rounded-3xl border border-[#e5d77b] bg-[#fffdf1] p-5 shadow-[0_4px_16px_rgba(23,25,24,0.03)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
              Organisation Admin
            </p>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="mt-1 text-xl font-semibold">Central controls</h2>
                <p className="mt-1 text-sm text-[#727a74]">
                  User Access, central standards, training and organisation
                  activity.
                </p>
              </div>
              <Button
                className="bg-[#202522] text-white"
                onClick={() => setOrganisationAdminOpen(true)}
              >
                Open Organisation Admin
              </Button>
            </div>
          </section>
        )}
        <section className="mt-7">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Store setup</h2>
            <p className="mt-1 text-sm text-[#727a74]">
              Choose an area to manage. Your store selection stays with you as
              you move between pages.
            </p>
          </div>
          <AdminFeatureCards
            onSelect={setFeature}
            counts={
              currentStore
                ? {
                    issues: `${currentStore.issues.length} recorded`,
                    team: `${team?.members.length ?? 0} members`,
                    cleaning: `${currentStore.cleaningTasks.length} tasks`,
                    training: `${currentStore.trainingRequirements.length} requirements`,
                  }
                : undefined
            }
          />
        </section>
      </main>
    </div>
  );
}
