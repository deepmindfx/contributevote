import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut, Moon, Settings, ShieldCheck, User } from "lucide-react";
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
import { getActiveTab, tabs } from "./MobileNav";

const logo = "/lovable-uploads/91e5c361-b912-4a7e-bcf3-4602a512cb51.png";

export default function Header() {
  const {
    user, isAuthenticated, isAdmin, logout, notifications, unreadNotificationCount,
    markNotificationRead, markAllNotificationsRead, updateProfile,
  } = useSupabaseUser();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeTab = getActiveTab(pathname);
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
    } else if (relatedId) {
      navigate(`/groups/${relatedId}`);
    }
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="app-brand">
          <img src={logo} alt="" width="32" height="32" />
          CollectiPay
        </Link>

        {isAuthenticated ? (
          <>
            <nav className="app-desktop-nav" aria-label="Main navigation">
              {tabs.filter((tab) => tab.to !== "/settings").map(({ to, label }) => (
                <Link key={to} to={to} aria-current={activeTab === to ? "page" : undefined}>{label}</Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-11 w-11 rounded-full border border-border bg-card"
                    aria-label={unreadNotificationCount ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"}
                  >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-card bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={12} className="z-[70] w-[min(22rem,calc(100vw-2rem))] p-0">
                  <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
                    <h2 className="font-semibold">Notifications</h2>
                    {unreadNotificationCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => { void markAllNotificationsRead(); }}>Mark all read</Button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
                  ) : (
                    <ScrollArea className="h-[min(22rem,55dvh)]">
                      {notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => { void openNotification(notification.id, notification.type, notification.related_id); }}
                          className={`block w-full border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${notification.is_read ? "" : "bg-primary/5"}`}
                        >
                          <span className="block text-sm font-semibold">{notification.title}</span>
                          <span className="block text-sm text-muted-foreground">{notification.message}</span>
                          {notification.created_at && (
                            <span className="mt-1 block text-xs text-muted-foreground">{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                          )}
                        </button>
                      ))}
                    </ScrollArea>
                  )}
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full p-1" aria-label="Account menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profileImage} alt="" />
                      <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">{initials || <User size={18} />}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={12} className="z-[70] w-52">
                  <DropdownMenuLabel className="truncate">{user?.name || "My account"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link to="/profile"><User size={16} className="mr-2" /> Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link to="/settings"><Settings size={16} className="mr-2" /> Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11" onSelect={() => { void toggleDarkMode(); }}>
                    <Moon size={16} className="mr-2" /> {preferences.darkMode ? "Light mode" : "Dark mode"}
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
