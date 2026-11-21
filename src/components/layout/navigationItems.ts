import { Activity, Compass, Home, Settings, UserRound, Users, Vote, Wallet } from "lucide-react";

export const collectipayMark = "/lovable-uploads/91e5c361-b912-4a7e-bcf3-4602a512cb51.png";

export const workspaceLinks = [
  { to: "/dashboard", label: "Overview", mobileLabel: "Home", icon: Home },
  { to: "/all-groups", label: "My groups", mobileLabel: "Groups", icon: Users },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/votes", label: "Votes", mobileLabel: "Votes", icon: Vote },
  { to: "/wallet-history", label: "Wallet history", icon: Wallet },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", mobileLabel: "Account", icon: Settings, mobileIcon: UserRound },
];

export function getWorkspaceLink(pathname: string) {
  const path = pathname.toLowerCase().replace(/\/$/, "");
  if (path.startsWith("/groups/") || path === "/create-group") return workspaceLinks[1];
  if (path === "/profile") return workspaceLinks.find((link) => link.to === "/settings");
  return workspaceLinks.find((link) => link.to === path);
}
