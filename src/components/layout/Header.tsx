import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  LogOut,
  Moon,
  Sun,
  Settings,
  ShieldCheck,
  User,
  Vote,
  Mail,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InvitationService } from "@/services/supabase/invitationService";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { getWorkspaceLink, workspaceLinks } from "./navigationItems";
import { cn } from "@/lib/utils";

function getNotificationIcon(type: string) {
  switch (type) {
    case "withdrawal_request":
    case "vote":
      return { icon: Vote, tone: "bg-accent text-primary" };
    case "group_invitation":
      return { icon: Mail, tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" };
    case "deposit":
    case "contribution":
      return { icon: ArrowDownLeft, tone: "bg-accent text-primary" };
    case "transfer":
    case "withdrawal":
      return { icon: ArrowUpRight, tone: "bg-muted text-foreground" };
    case "refund":
    case "refund_request":
      return { icon: RefreshCw, tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300" };
    default:
      return { icon: Bell, tone: "bg-accent text-primary" };
  }
}

export default function Header({ mobileGreeting, mobilePanel }: { mobileGreeting?: string; mobilePanel?: boolean } = {}) {
  const {
    user, isAuthenticated, isAdmin, logout, notifications, unreadNotificationCount,
    markNotificationRead, markAllNotificationsRead, updateProfile,
  } = useSupabaseUser();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = getWorkspaceLink(pathname);
  const preferences = (user?.preferences || {}) as Record<string, unknown>;
  const profileImage = typeof preferences.profileImage === "string" ? preferences.profileImage : undefined;
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const toggleDarkMode = async () => {
    const darkMode = document.documentElement.classList.toggle("dark");
    if (user) {
      try {
        await updateProfile({ preferences: { ...preferences, darkMode } });
      } catch {
        document.documentElement.classList.toggle("dark", !darkMode);
        toast.error("Could not save your appearance.");
      }
    }
  };

  const openNotification = async (id: string, type: string, relatedId?: string | null) => {
    await markNotificationRead(id);
    setNotificationsOpen(false);
    if (type === "withdrawal_request") {
      navigate("/votes");
    } else if (type === "group_invitation" && relatedId) {
      const href = await InvitationService.getInvitationLinkById(relatedId);
      if (href) navigate(new URL(href).pathname);
      else toast.error("This invitation is unavailable. Open the link shared by the group creator.");
    } else if (relatedId) {
      navigate(`/groups/${relatedId}`);
    }
  };

  return (
    <header className={mobileGreeting ? "app-header app-header-wallet" : mobilePanel ? "app-header app-header-panel" : "app-header"}>
      <div className="app-header-inner">
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="app-brand">
          <CollectiPayMark size={32} />
          <span>CollectiPay</span>
        </Link>

        {isAuthenticated ? (
          <>
            <span className="workspace-header-label">{section?.label}</span>
            <nav className="app-desktop-nav app-context-nav" aria-label="Main navigation">
              {workspaceLinks.filter(({ mobileLabel, to }) => (mobileLabel && to !== "/settings") || to === "/discover").map(({ to, label }) => (
                <Link key={to} to={to} aria-current={section?.to === to ? "page" : undefined}>{label}</Link>
              ))}
            </nav>

            {mobileGreeting && (
              <div className="app-wallet-greeting" aria-hidden="true">
                <p>{mobileGreeting}</p>
                <span>CollectiPay</span>
              </div>
            )}
            <div className="app-header-controls flex shrink-0 items-center gap-2">
              <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="app-notification-button relative h-11 w-11 rounded-full border border-border bg-card"
                    aria-label={unreadNotificationCount ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"}
                  >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {unreadNotificationCount > 0 && (
                      <span className="app-notification-dot cp-notif-ping absolute right-2 top-2 h-2.5 w-2.5 rounded-full border border-card bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={12}
                  className="z-[70] w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border p-0 shadow-2xl"
                >
                  {/* CollectiPay Emerald Notification Header */}
                  <div className="cp-notif-header flex items-center justify-between gap-2 px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <CollectiPayMark size={24} />
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold tracking-tight text-white">Notifications</h2>
                        {unreadNotificationCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#dbf5b4] px-1.5 text-[11px] font-bold text-[#0c3027] tabular-nums">
                            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                          </span>
                        )}
                      </div>
                    </div>
                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={() => { void markAllNotificationsRead(); }}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2.5 py-1.5 text-xs font-semibold text-[#e6f7ee] transition-colors hover:bg-white/20"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                      <div className="relative mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/65">
                        <CollectiPayMark size={30} className="opacity-85" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">All caught up</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pool activity, votes, and transfer alerts will appear here.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[min(23rem,58dvh)]">
                      <div className="divide-y divide-border/70">
                        {notifications.map((notification, index) => {
                          const { icon: NotifIcon, tone } = getNotificationIcon(notification.type);
                          const isUnread = !notification.is_read;

                          return (
                            <button
                              type="button"
                              key={notification.id}
                              style={{ animationDelay: `${Math.min(index * 35, 220)}ms` }}
                              onClick={() => { void openNotification(notification.id, notification.type, notification.related_id); }}
                              className={cn(
                                "cp-notif-item group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                                isUnread && "bg-primary/[0.045]"
                              )}
                            >
                              <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}>
                                <NotifIcon className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-foreground">
                                    {notification.title}
                                  </span>
                                  {isUnread && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                                  )}
                                </div>
                                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                                  {notification.message}
                                </span>
                                {notification.created_at && (
                                  <span className="mt-1.5 block text-[11px] font-medium text-muted-foreground/80">
                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                              <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="app-account-button h-11 w-11 rounded-full p-1" aria-label="Account menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profileImage} alt="" />
                      <AvatarFallback className="app-account-initials bg-primary/10 text-sm font-bold text-primary">{initials || <User size={18} />}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={12} className="z-[70] w-52 rounded-xl">
                  <DropdownMenuLabel className="truncate">{user?.name || "My account"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link to="/profile"><User size={16} className="mr-2" /> Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link to="/settings"><Settings size={16} className="mr-2" /> Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11" onSelect={() => { void toggleDarkMode(); }}>
                    {preferences.darkMode ? <Sun size={16} className="mr-2" /> : <Moon size={16} className="mr-2" />}
                    {preferences.darkMode ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild className="min-h-11">
                      <Link to="/admin"><ShieldCheck size={16} className="mr-2" /> Admin dashboard</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={async () => {
                      await logout();
                      navigate("/");
                    }}
                  >
                    <LogOut size={16} className="mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : (
          <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4">
            <NavLink to="/discover" className="hidden rounded-md px-2 py-3 text-sm font-semibold sm:block">Discover</NavLink>
            <NavLink to="/admin-login" className="hidden rounded-md px-2 py-3 text-sm text-muted-foreground md:block">Admin</NavLink>
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link to={pathname === "/auth" ? "/" : "/auth"}>{pathname === "/auth" ? "Home" : "Sign in"}</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
