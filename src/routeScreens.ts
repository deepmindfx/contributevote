import { lazy, type ComponentType } from "react";

function screen<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return Object.assign(lazy(load), { preload: load });
}

export const screens = {
  index: screen(() => import("./pages/Index")),
  auth: screen(() => import("./pages/Auth")),
  adminAuth: screen(() => import("./pages/AdminAuth")),
  dashboard: screen(() => import("./pages/Dashboard")),
  createGroup: screen(() => import("./pages/CreateGroup")),
  contribute: screen(() => import("./pages/ContributePage")),
  contributeShare: screen(() => import("./pages/ContributeSharePage")),
  group: screen(() => import("./pages/GroupDetail")),
  settings: screen(() => import("./pages/UserSettings")),
  admin: screen(() => import("./pages/admin/Dashboard")),
  profile: screen(() => import("./pages/UserProfile")),
  discover: screen(() => import("./pages/Discover")),
  invite: screen(() => import("./pages/AcceptInvite")),
  walletHistory: screen(() => import("./pages/WalletHistory")),
  activity: screen(() => import("./pages/ActivityHistory")),
  votes: screen(() => import("./pages/Votes")),
  groups: screen(() => import("./pages/AllGroups")),
  join: screen(() => import("./pages/JoinGroup")),
  transfer: screen(() => import("./components/TransferForm")),
  payment: screen(() => import("./pages/PaymentCallback")),
};

const routes: Record<string, keyof typeof screens> = {
  "/": "index",
  "/auth": "auth",
  "/admin-login": "adminAuth",
  "/dashboard": "dashboard",
  "/create-group": "createGroup",
  "/settings": "settings",
  "/admin": "admin",
  "/profile": "profile",
  "/discover": "discover",
  "/wallet-history": "walletHistory",
  "/activity": "activity",
  "/votes": "votes",
  "/all-groups": "groups",
  "/transfer": "transfer",
  "/payment-callback": "payment",
};

const preloaded = new Set<string>();

export function preloadScreen(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const screen = Object.prototype.hasOwnProperty.call(routes, path) ? routes[path] :
    path.startsWith("/groups/") ? "group" :
    path.startsWith("/contribute/share/") ? "contributeShare" :
    path.startsWith("/contribute/") ? "contribute" :
    path.startsWith("/invite/") ? "invite" :
    path.startsWith("/join/") ? "join" :
    path.startsWith("/admin/") ? "admin" : undefined;
  if (!screen || preloaded.has(screen)) return;
  preloaded.add(screen);
  void screens[screen].preload().catch(() => preloaded.delete(screen));
}

export function preloadLinkedScreen(target: EventTarget | null) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!(target instanceof Element) || connection?.saveData || connection?.effectiveType?.endsWith("2g")) return;
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (link?.origin === location.origin && link.pathname !== location.pathname) preloadScreen(link.pathname);
}
