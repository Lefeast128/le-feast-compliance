import ComplianceReports from "@/components/ComplianceReports";
import ManagerReviews from "@/components/ManagerReviews";
import AdminStoreOverview from "@/components/admin/AdminStoreOverview";
import type { AdminLocation, AdminOperation, AdminStore, AdminTeamResponse } from "@/components/admin/admin-types";
import WastageCatalogueAdmin from "@/components/WastageCatalogueAdmin";
import UserAccessAdmin from "@/components/UserAccessAdmin";
import { Button } from "@/components/ui/button";
import { restApi, useRestQuery } from "@/lib/rest-domain";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

type Props = {
  onBack: () => void;
  onOpenDay?: (date: string, locationId: string) => void;
};

export default function AdminSetup({ onBack, onOpenDay }: Props) {
  const { user } = useAuth();
  const isOrganisationAdmin = user?.role === "admin";
  const stores = useRestQuery<AdminOperation[]>("operations", restApi.compliance.operations, true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const selected = stores?.find((entry) => entry.location._id === storeId) ?? stores?.[0];
  const selectedLocationId = selected?.location._id ?? null;
  const locations: AdminLocation[] = (stores ?? []).map((entry) => entry.location);
  const store = useRestQuery<AdminStore | null>(
    selectedLocationId ? `dashboard:${selectedLocationId}` : null,
    () => restApi.compliance.dashboard({ locationId: selectedLocationId ?? "" }),
    Boolean(selectedLocationId),
  );
  const team = useRestQuery<AdminTeamResponse | null>(
    selectedLocationId ? `team:${selectedLocationId}` : null,
    () => restApi.compliance.team({ locationId: selectedLocationId ?? "" }),
    Boolean(selectedLocationId),
  );
  const currentStore = store?.location._id === selectedLocationId ? store : undefined;

  function selectStore(nextLocationId: string) {
    setStoreId(nextLocationId);
    setCatalogueOpen(false);
    setReportsOpen(false);
    setReviewsOpen(false);
  }

  if (catalogueOpen && selectedLocationId) {
    return (
      <WastageCatalogueAdmin
        locationId={selectedLocationId}
        locations={locations}
        onClose={() => setCatalogueOpen(false)}
        onOpenReports={() => {
          setCatalogueOpen(false);
          setReportsOpen(true);
        }}
      />
    );
  }

  if (reportsOpen && selectedLocationId) {
    return (
      <ComplianceReports
        locationId={selectedLocationId}
        locations={locations}
        onBack={() => setReportsOpen(false)}
        onOpenDay={(date, reportLocationId) => onOpenDay?.(date, reportLocationId)}
      />
    );
  }

  if (reviewsOpen && selectedLocationId) {
    return <ManagerReviews locationId={selectedLocationId} locations={locations} onBack={() => setReviewsOpen(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <div>
            <p className="text-[15px] font-semibold">Your Daily Checks</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">Admin setup</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" /> Back to Today
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Configuration</p>
        <h1 className="mt-2 text-3xl font-semibold">Current setup</h1>
        <UserAccessAdmin visible={isOrganisationAdmin} />
        {selectedLocationId && <section className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Management</p><h2 className="mt-1 text-xl font-semibold">Manager controls</h2><p className="mt-1 text-sm text-[#727a74]">Review issues, complete management reviews and inspect compliance for this store.</p><div className="mt-4 flex flex-wrap gap-2"><Button className="bg-[#202522] text-white" onClick={() => setReviewsOpen(true)}>Open Issues &amp; Reviews</Button><Button variant="outline" onClick={() => setReportsOpen(true)}>Open Compliance Reports</Button></div></section>}
        <div className="mt-5 flex flex-wrap gap-2">
          {(stores ?? []).map((entry) => (
            <Button
              key={entry.location._id}
              variant={(selectedLocationId ?? storeId) === entry.location._id ? "default" : "outline"}
              onClick={() => selectStore(entry.location._id)}
            >
              {entry.location.name}
            </Button>
          ))}
        </div>
        {!stores && <p className="mt-8 text-sm text-[#727a74]">Loading store setup…</p>}
        {stores && !currentStore && selectedLocationId && <p className="mt-8 text-sm text-[#727a74]">Loading store setup…</p>}
        {currentStore && (
          <AdminStoreOverview
            key={selectedLocationId}
            store={currentStore}
            team={team ?? undefined}
            onOpenCatalogue={() => setCatalogueOpen(true)}
          />
        )}
      </main>
    </div>
  );
}
