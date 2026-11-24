import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity, ArrowUpRight, BarChart3, Building2, ChevronDown, ChevronRight, ClipboardList, Gavel, KeyRound,
  LayoutDashboard, LifeBuoy, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ReceiptText, RefreshCw, ShieldAlert,
  Snowflake, Users, Vote, Wallet, ArrowDownToLine, ListOrdered,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./admin-shell.css";

const navigation = [
  {
    label: "Workspace",
    items: [
      { id: "operations", label: "Operations", icon: LayoutDashboard },
      { id: "support", label: "Support tickets", icon: LifeBuoy },
    ],
  },
  {
    label: "People & groups",
    items: [
      { id: "users", label: "Users", icon: Users },
      { id: "groups", label: "Groups", icon: Building2 },
      { id: "governance", label: "Group governance", icon: Vote },
    ],
  },
  {
    label: "Payments",
    items: [
      { id: "ledger", label: "Ledger", icon: ReceiptText },
      { id: "external", label: "Outside payments", icon: ArrowDownToLine },
      { id: "bulk-transfers", label: "Bulk transfers", icon: ListOrdered },
      { id: "ice-vault", label: "Ice Vault", icon: Snowflake },
      { id: "volume", label: "Transaction analytics", icon: Activity },
      { id: "pricing", label: "Pricing & revenue", icon: BarChart3 },
    ],
  },
  {
    label: "Risk & settings",
    items: [
      { id: "aml", label: "AML alerts", icon: ShieldAlert },
      { id: "penalties", label: "Penalties", icon: Gavel },
      { id: "audit", label: "Audit log", icon: ClipboardList },
      { id: "gateway", label: "Payment gateway", icon: KeyRound },
    ],
  },
] as const;

type Destination = typeof navigation[number]["items"][number];
export type AdminSection = Destination["id"];

const destinations: readonly Destination[] = navigation.flatMap<Destination>(group => [...group.items]);
const preferenceKey = "collectipay-admin-sidebar";

export function resolveAdminSection(value: string | null): AdminSection {
  return destinations.find(destination => destination.id === value)?.id ?? "operations";
}

function AdminNavigation({ active, collapsed, counts, href, onNavigate }: {
  active: AdminSection;
  collapsed: boolean;
  counts: Partial<Record<AdminSection, number>>;
  href: (section: AdminSection) => string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Super Admin sections" className="admin-nav">
      {navigation.map(group => (
        <div className="admin-nav-group" key={group.label}>
          <p className={cn("admin-nav-label", collapsed && "sr-only")}>{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ id, label, icon: Icon }) => {
              const count = counts[id] ?? 0;
              const item = (
                <Link to={href(id)} aria-current={active === id ? "page" : undefined}
                  aria-label={collapsed ? label + (count ? " (" + count + ")" : "") : undefined}
                  className={cn("admin-nav-link", collapsed && "admin-nav-link--icon")} onClick={onNavigate}>
                  <Icon aria-hidden="true" className="size-[17px] shrink-0" strokeWidth={1.8} />
                  {!collapsed && <span className="min-w-0 flex-1">{label}</span>}
                  {count > 0 && <span className={cn("admin-nav-count", collapsed && "admin-nav-count--dot")} aria-hidden={collapsed || undefined}>
                    {!collapsed && (count > 99 ? "99+" : count)}
                  </span>}
                </Link>
              );
              return (
                <li key={id}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{item}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12}>{label}</TooltipContent>
                    </Tooltip>
                  ) : item}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ active, href, counts, name, refreshing, onRefresh, onSignOut, actions, children }: {
  active: AdminSection;
  href: (section: AdminSection) => string;
  counts: Partial<Record<AdminSection, number>>;
  name: string;
  refreshing: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(preferenceKey) === "collapsed"; }
    catch { return false; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const previousSection = useRef(active);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = destinations.find(destination => destination.id === active)?.label ?? "Operations";
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "A";

  useEffect(() => {
    try { window.localStorage.setItem(preferenceKey, collapsed ? "collapsed" : "expanded"); }
    catch { /* The sidebar works in memory when browser storage is unavailable. */ }
  }, [collapsed]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => { if (desktop.matches) setDrawerOpen(false); };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  useEffect(() => {
    if (previousSection.current === active) return;
    previousSection.current = active;
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [active]);

  return (
    <div className="admin-shell" data-nav={collapsed ? "collapsed" : "expanded"}>
      <a href="#admin-content" className="admin-skip-link">Skip to content</a>
      <aside className="admin-rail" id="admin-rail">
        <Link to={href("operations")} className="admin-brand" aria-label="CollectiPay operations">
          <CollectiPayMark size={31} />
          {!collapsed && <span className="min-w-0"><span className="block text-sm font-semibold">CollectiPay</span><span className="admin-brand-caption">Super Admin</span></span>}
        </Link>
        <AdminNavigation active={active} collapsed={collapsed} counts={counts} href={href} />
        <div className="admin-rail-footer">
          <Link to="/dashboard" className={cn("admin-nav-link", collapsed && "admin-nav-link--icon")} aria-label="Return to wallet" title={collapsed ? "Return to wallet" : undefined}>
            <Wallet size={17} aria-hidden="true" />
            {!collapsed && <><span className="flex-1">Return to wallet</span><ArrowUpRight className="size-3.5 opacity-65" aria-hidden="true" /></>}
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Open admin navigation">
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="admin-drawer">
                <div className="admin-brand">
                  <CollectiPayMark size={31} />
                  <div>
                    <SheetTitle className="text-sm font-semibold text-inherit">CollectiPay</SheetTitle>
                    <SheetDescription className="admin-brand-caption">Super Admin navigation</SheetDescription>
                  </div>
                </div>
                <AdminNavigation active={active} collapsed={false} counts={counts} href={href} onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>
            <Button type="button" variant="ghost" size="icon" onClick={() => setCollapsed(value => !value)}
              className="hidden shrink-0 lg:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed} aria-controls="admin-rail" title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </Button>
            <div className="min-w-0">
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">Super Admin <ChevronRight size={11} aria-hidden="true" /></span>
              <h1 ref={heading} id="admin-section-title" tabIndex={-1} className="break-words text-base font-semibold leading-tight tracking-tight focus:outline-none sm:text-lg">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Button type="button" variant="ghost" size="icon" disabled={refreshing} onClick={onRefresh}
              aria-label="Refresh platform data" title="Refresh platform data">
              <RefreshCw className={cn("size-4", refreshing && "motion-safe:animate-spin")} aria-hidden="true" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-11 gap-2 rounded-xl px-1.5 sm:px-2.5" aria-label="Administrator account">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">{initials}</span>
                  <span className="hidden max-w-32 truncate lg:inline">{name}</span>
                  <ChevronDown className="hidden size-3 text-muted-foreground sm:block" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/settings"><KeyRound className="mr-2 size-4" aria-hidden="true" /> Account settings &amp; PIN</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/dashboard"><Wallet className="mr-2 size-4" aria-hidden="true" /> Return to wallet</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onSignOut}><LogOut className="mr-2 size-4" aria-hidden="true" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="admin-content" tabIndex={-1} aria-labelledby="admin-section-title" className="admin-content space-y-5 focus:outline-none">
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
