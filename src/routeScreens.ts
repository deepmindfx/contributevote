import { lazy, type ComponentType } from "react";

const CHUNK_RELOAD_KEY = "cp_chunk_reload_at";
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
      ? error
      : "";
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk \d+ failed/i.test(
    message
  );
}

/**
 * Automatically refreshes the page once (with cooldown guard) when a stale tab
 * requests a lazy route chunk that was replaced by a newer production deploy.
 */
export function recoverFromStaleChunk(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleChunkError(error)) return false;
  try {
    const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
    if (Date.now() - lastReload < CHUNK_RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Proceed even if sessionStorage is unavailable
  }
  window.location.reload();
  return true;
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    const payload = "payload" in event ? (event as { payload?: unknown }).payload : event;
    if (recoverFromStaleChunk(payload)) {
      event.preventDefault();
    }
  });
}

function screen<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  const safeLoad = () =>
    load().catch((error) => {
      if (recoverFromStaleChunk(error)) {
        // Keep Suspense fallback visible while the browser reloads fresh assets
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    });
  return Object.assign(lazy(safeLoad), { preload: load });
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
  fixedSavings: screen(() => import("./pages/FixedSavings")),
  iceVaultTerms: screen(() => import("./pages/IceVaultTerms")),
  activity: screen(() => import("./pages/ActivityHistory")),
  votes: screen(() => import("./pages/Votes")),
  groups: screen(() => import("./pages/AllGroups")),
  join: screen(() => import("./pages/JoinGroup")),
  transfer: screen(() => import("./components/TransferForm")),
  bulkTransfer: screen(() => import("./pages/BulkTransfer")),
  bulkTransferHistory: screen(() => import("./pages/BulkTransferHistory")),
  payment: screen(() => import("./pages/PaymentCallback")),
  faq: screen(() => import("./pages/Faq")),
  support: screen(() => import("./pages/Support")),
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
  "/fixed-savings": "fixedSavings",
  "/terms/ice-vault/v1": "iceVaultTerms",
  "/activity": "activity",
  "/votes": "votes",
  "/all-groups": "groups",
  "/transfer": "transfer",
  "/transfer/bulk": "bulkTransfer",
  "/transfer/bulk/history": "bulkTransferHistory",
  "/payment-callback": "payment",
  "/faq": "faq",
  "/support": "support",
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

let workspaceWarmed = false;

/**
 * Quietly preloads core authenticated app screens during browser idle time
 * so tapping tabs, wallet actions, or groups feels instantaneous like a native app.
 */
export function preloadWorkspaceScreens() {
  if (workspaceWarmed || typeof window === "undefined") return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType?.endsWith("2g")) return;
  workspaceWarmed = true;

  const corePaths = [
    "/dashboard",
    "/all-groups",
    "/votes",
    "/discover",
    "/transfer",
    "/wallet-history",
    "/activity",
    "/settings",
    "/profile",
  ];

  const run = () => {
    for (const p of corePaths) preloadScreen(p);
  };

  const ric = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof ric === "function") {
    ric(run, { timeout: 2200 });
  } else {
    globalThis.setTimeout(run, 800);
  }
}
