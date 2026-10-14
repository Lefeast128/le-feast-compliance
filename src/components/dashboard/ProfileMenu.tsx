import { Building2, ClipboardList, LogOut, Settings, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthMembership, AuthUser } from "@/lib/api-client";

type Location = { _id: string; name: string };

type Props = {
  user: AuthUser;
  memberships: AuthMembership[];
  locations: Location[];
  currentLocationId: string | null;
  onLocationChange: (locationId: string) => void;
  onManagerReviews: () => void;
  onAdmin: () => void;
  onLogout: () => void | Promise<void>;
};

const displayName = (user: AuthUser) => user.name?.trim() || user.email;
const initials = (user: AuthUser) => displayName(user).split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();

export default function ProfileMenu({ user, memberships, locations, currentLocationId, onLocationChange, onManagerReviews, onAdmin, onLogout }: Props) {
  const organisationAdmin = user.role === "admin";
  const permittedIds = new Set(memberships.map(membership => membership.locationId));
  const permittedLocations = organisationAdmin ? locations : locations.filter(location => permittedIds.has(location._id));
  const currentLocation = permittedLocations.find(location => location._id === currentLocationId) ?? permittedLocations[0];
  const canManage = organisationAdmin || memberships.some(membership => membership.locationId === currentLocation?._id && membership.role === "manager");

  const logout = async () => {
    await onLogout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 rounded-xl text-[#202522] hover:bg-brand-yellow/20" aria-label="Open account menu">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-yellow text-xs font-bold text-[#202522]">{initials(user)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border-black/[0.08] bg-white p-2 shadow-[0_18px_60px_rgba(23,25,24,0.18)]">
        <DropdownMenuLabel className="px-3 py-2">
          <div className="flex items-center gap-3">
            <UserCircle className="size-5 text-[#68716a]" />
            <div className="min-w-0"><p className="truncate font-semibold text-[#202522]">{displayName(user)}</p><p className="truncate text-xs font-normal text-[#727a74]">{user.email}</p></div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#89918b]">Active store</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentLocation?._id ?? ""} onValueChange={onLocationChange} aria-label="Select active store">
          {permittedLocations.map(location => <DropdownMenuRadioItem key={location._id} value={location._id} className="rounded-xl py-2.5"><span className="truncate">{location.name}</span></DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        {!permittedLocations.length && <p className="px-3 py-2 text-sm text-[#727a74]">No assigned store</p>}
        {canManage && <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onManagerReviews} className="rounded-xl py-2.5"><ClipboardList className="size-4" />Manager reviews</DropdownMenuItem>
          {organisationAdmin && <DropdownMenuItem onSelect={onAdmin} className="rounded-xl py-2.5"><Settings className="size-4" />Administration</DropdownMenuItem>}
          {organisationAdmin && <p className="flex items-center gap-2 px-3 py-2 text-xs text-[#727a74]"><Building2 className="size-3.5" />Organisation-wide access</p>}
        </>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()} variant="destructive" className="rounded-xl py-2.5"><LogOut className="size-4" />Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
