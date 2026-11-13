import { Building2, Store as StoreIcon } from "lucide-react";

export type AdminStoreOption = { id: string; name: string };

export function AdminScopeNotice({
  scope,
  title,
  detail,
}: {
  scope: "store" | "organisation";
  title: string;
  detail: string;
}) {
  const Icon = scope === "organisation" ? Building2 : StoreIcon;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#e5d77b] bg-[#fffdf1] p-4 text-sm">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1b8] text-[#80610e]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-[#727a74]">{detail}</p>
      </div>
    </div>
  );
}

export function AllocationImpact({
  allStores,
  locationIds,
  locations,
  editing,
  training,
  reacknowledge,
}: {
  allStores: boolean;
  locationIds: string[];
  locations: AdminStoreOption[];
  editing: boolean;
  training?: boolean;
  reacknowledge?: boolean;
}) {
  const selected = allStores
    ? locations
    : locations.filter((location) => locationIds.includes(location.id));
  const storeLabel = allStores
    ? `All ${locations.length} stores`
    : selected.length
      ? selected.map((location) => location.name).join(", ")
      : "No stores selected";

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-[#fafbf9] p-4 text-sm">
      <p className="font-semibold">Before you {editing ? "save this change" : "publish"}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-[#89918b]">Affected stores</dt>
        <dd className="font-medium">{storeLabel}</dd>
        <dt className="text-[#89918b]">What happens</dt>
        <dd className="text-[#727a74]">
          {editing
            ? "The current standard is versioned for the selected stores. Past responses and completed evidence stay unchanged."
            : "A central standard is created for the selected stores. Store managers cannot edit it locally."}
        </dd>
        {training && (
          <>
            <dt className="text-[#89918b]">Acknowledgement</dt>
            <dd className="text-[#727a74]">
              {reacknowledge
                ? "Staff will be asked to acknowledge the updated training version."
                : "Existing acknowledgement history is preserved; no new acknowledgement is requested by this change."}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
