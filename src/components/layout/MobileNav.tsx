import { Compass, Home, Settings, Users, Vote } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";

export const tabs = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/votes", label: "Votes", icon: Vote },
  { to: "/all-groups", label: "Groups", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function getActiveTab(pathname: string) {
  const path = pathname.toLowerCase().replace(/\/$/, "");
  if (["/wallet-history", "/activity"].includes(path)) return "/dashboard";
  if (path.startsWith("/groups/") || path === "/create-group") return "/all-groups";
  if (path === "/profile") return "/settings";
  return tabs.find(({ to }) => to === path)?.to;
}

export default function MobileNav() {
  const { pathname } = useLocation();
  const { user } = useSupabaseUser();
  const { withdrawalRequests } = useSupabaseContribution();
  const activeTab = getActiveTab(pathname);
  const pendingVotes = user ? withdrawalRequests.filter((request) => {
    const votes = Array.isArray(request.votes) ? request.votes as { user_id?: string }[] : [];
    return request.status === "pending" && !votes.some((vote) => vote?.user_id === user.id);
  }).length : 0;

  return (
    <nav className="app-tabbar" aria-label="Mobile navigation">
      {tabs.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          aria-current={activeTab === to ? "page" : undefined}
          aria-label={to === "/votes" && pendingVotes ? `Votes, ${pendingVotes} pending` : undefined}
        >
          <span className="app-tab-icon">
            <Icon size={20} aria-hidden="true" />
            {to === "/votes" && pendingVotes > 0 && <span className="app-tab-badge">{pendingVotes > 9 ? "9+" : pendingVotes}</span>}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
