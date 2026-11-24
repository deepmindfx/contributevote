import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Moon, Sun, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyAppearance, usesDarkMode } from "@/lib/appearance";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { NotificationCenter } from "./NotificationCenter";
import { getWorkspaceLink, workspaceLinks } from "./navigationItems";

export default function Header({
  mobileGreeting,
  mobilePanel,
}: {
  mobileGreeting?: string;
  mobilePanel?: boolean;
} = {}) {
  const { user, isAuthenticated, isAdmin, logout, updateProfile } = useSupabaseUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = getWorkspaceLink(pathname);
  const preferences = (user?.preferences || {}) as Record<string, unknown>;
  const darkAppearance = usesDarkMode(preferences);
  const profileImage =
    typeof preferences.profileImage === "string" ? preferences.profileImage : undefined;
  const initials = user?.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const toggleDarkMode = async () => {
    const darkMode = !darkAppearance;
    applyAppearance(darkMode);
    if (user) {
      try {
        await updateProfile({ preferences: { darkMode } });
      } catch {
        applyAppearance(!darkMode);
        toast.error("Could not save your appearance.");
      }
    }
  };

  return (
    <header
      className={
        mobileGreeting
          ? "app-header app-header-wallet"
          : mobilePanel
          ? "app-header app-header-panel"
          : "app-header"
      }
    >
      <div className="app-header-inner">
        <Link to={isAdmin ? "/admin" : isAuthenticated ? "/dashboard" : "/"} className="app-brand">
          <CollectiPayMark size={32} />
          <span>CollectiPay</span>
        </Link>

        {isAuthenticated ? (
          <>
            <span className="workspace-header-label">{section?.label}</span>
            {!isAdmin && <nav className="app-desktop-nav app-context-nav" aria-label="Main navigation">
              {workspaceLinks
                .filter(({ mobileLabel, to }) => (mobileLabel && to !== "/settings") || to === "/discover")
                .map(({ to, label }) => (
                  <Link key={to} to={to} aria-current={section?.to === to ? "page" : undefined}>
                    {label}
                  </Link>
                ))}
            </nav>}

            {mobileGreeting && (
              <div className="app-wallet-greeting" aria-hidden="true">
                <p>{mobileGreeting}</p>
                <span>CollectiPay</span>
              </div>
            )}
            <div className="app-header-controls flex shrink-0 items-center gap-2">
              <NotificationCenter />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="app-account-button h-11 w-11 rounded-full p-1"
                    aria-label="Account menu"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profileImage} alt="" />
                      <AvatarFallback className="app-account-initials bg-primary/10 text-sm font-bold text-primary">
                        {initials || <User size={18} />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={12} className="z-[70] w-52 rounded-xl">
                  <DropdownMenuLabel className="truncate">
                    {user?.name || "My account"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link to="/profile">
                      <User size={16} className="mr-2" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link to="/settings">
                      <Settings size={16} className="mr-2" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => {
                      void toggleDarkMode();
                    }}
                  >
                    {darkAppearance ? (
                      <Sun size={16} className="mr-2" />
                    ) : (
                      <Moon size={16} className="mr-2" />
                    )}
                    {darkAppearance ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => {
                      navigate("/", { replace: true });
                      void logout();
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
            <NavLink to="/discover" className="hidden rounded-md px-2 py-3 text-sm font-semibold sm:block">
              Discover
            </NavLink>
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link to={pathname === "/auth" ? "/" : "/auth"}>
                {pathname === "/auth" ? "Home" : "Sign in"}
              </Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
