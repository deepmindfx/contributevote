import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  Building2,
  Calendar,
  ChevronRight,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Users,
  Wallet,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BrandLoader from "@/components/ui/BrandLoader";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { cn } from "@/lib/utils";
import { hasTransactionPin } from "@/lib/transactionPin";

const UserProfile = () => {
  const { user, unreadNotificationCount, logout } = useSupabaseUser();
  const { contributions, transactions } = useSupabaseContribution();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  const preferences = (user.preferences || {}) as Record<string, any>;
  const displayName = user.name || user.email?.split("@")[0] || "User";
  const username = preferences.username ? `@${preferences.username}` : null;
  const hasPin = hasTransactionPin(preferences);
  const hasBvn = Boolean(user.bvn && String(user.bvn).trim().length >= 11);
  const hasVirtualAccount = Boolean(preferences.virtualAccount?.accountNumber);

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const totalGroups = contributions.length;
  const totalAmountContributed = transactions
    .filter(
      (t) =>
        t.user_id === user.id &&
        t.type === "contribution" &&
        t.status === "completed"
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const activeGroups = contributions.filter(
    (c) =>
      !c.archived &&
      Number(c.current_amount || 0) < Number(c.target_amount || 0)
  ).length;

  const quickActions = [
    {
      to: "/settings",
      label: "Edit Profile & Personal Info",
      detail: "Name, username, photo, and phone number",
      icon: Settings,
    },
    {
      to: "/settings?tab=security",
      label: "Security & 4-Digit Transfer PIN",
      detail: hasPin ? "PIN active · Manage PIN or password" : "Action needed · Set your transfer PIN",
      icon: KeyRound,
      badge: hasPin ? undefined : "Setup",
    },
    {
      to: "/dashboard?wallet=bank",
      label: "Wallet & Deposit Account",
      detail: hasVirtualAccount
        ? `${preferences.virtualAccount.bankName || "Virtual Account"} · ${preferences.virtualAccount.accountNumber}`
        : "Generate or view your NGN deposit account",
      icon: Building2,
    },
    {
      to: "/activity",
      label: "Activity & Verified Receipts",
      detail: `${transactions.length} recorded transactions · ${unreadNotificationCount} unread alerts`,
      icon: Activity,
    },
  ];

  return (
    <div className="min-h-dvh">
      {isLoggingOut && (
        <BrandLoader
          variant="overlay"
          message="Signing you out"
          submessage="Securing your CollectiPay session…"
        />
      )}

      <Header mobilePanel />

      <main className="app-page app-panel-page cp-page-enter max-w-5xl">
        {/* Deep-Emerald Native Profile Hero */}
        <section className="app-panel-hero" aria-labelledby="profile-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 border-2 border-[#dbf5b4]/60 shadow-lg">
                  <AvatarImage src={preferences.profileImage || ""} alt={displayName} />
                  <AvatarFallback className="bg-[#dbf5b4] text-2xl font-extrabold text-[#0c3027]">
                    {initials || "U"}
                  </AvatarFallback>
                </Avatar>
                <Link
                  to="/settings"
                  aria-label="Edit profile photo"
                  className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-[#075847] bg-[#dbf5b4] text-[#0c3027] shadow-sm transition-transform hover:scale-105"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="min-w-0">
                <p className="panel-kicker text-xs font-semibold uppercase tracking-wider">
                  CollectiPay Member
                </p>
                <h1 id="profile-heading" className="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-0.5 truncate text-sm text-[#cce7da]">
                  {username ? `${username} · ` : ""}
                  {user.email}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      hasPin
                        ? "bg-[#dbf5b4]/20 text-[#dbf5b4]"
                        : "bg-amber-400/20 text-amber-100"
                    )}
                  >
                    {hasPin ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                    {hasPin ? "PIN Protected" : "PIN Not Set"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {hasBvn ? "BVN Verified" : "Standard Tier"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="app-panel-primary h-11 rounded-xl font-semibold">
                <Link to="/settings">
                  <Settings className="mr-1.5 h-4 w-4" />
                  Manage Settings
                </Link>
              </Button>
            </div>
          </div>

          {/* Translucent Fintech Summary Strip */}
          <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] font-medium text-[#c2e4d4]">Wallet Balance</span>
              <span className="mt-1 block truncate text-lg font-extrabold tabular-nums text-white sm:text-xl">
                ₦{Number(user.wallet_balance || 0).toLocaleString("en-NG")}
              </span>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] font-medium text-[#c2e4d4]">Total Pooled</span>
              <span className="mt-1 block truncate text-lg font-extrabold tabular-nums text-[#dbf5b4] sm:text-xl">
                ₦{totalAmountContributed.toLocaleString("en-NG")}
              </span>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] font-medium text-[#c2e4d4]">Active Pools</span>
              <span className="mt-1 block text-lg font-extrabold tabular-nums text-white sm:text-xl">
                {activeGroups}{" "}
                <span className="text-xs font-medium text-[#b5dac8]">/ {totalGroups}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Overlapping Native Sheet Body */}
        <div className="app-panel-body space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Account Navigation + Identity Details */}
            <div className="space-y-6 lg:col-span-5">
              {/* Native Action Menu */}
              <div className="cp-card-native overflow-hidden">
                <div className="border-b px-5 py-3.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Account &amp; Security
                  </h2>
                </div>
                <div className="divide-y divide-border/70">
                  {quickActions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-muted/50"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                                {item.badge}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.detail}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Identity Card */}
              <div className="cp-card-native overflow-hidden">
                <div className="border-b px-5 py-3.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Identity Details
                  </h2>
                </div>
                <dl className="divide-y divide-border/70 px-5 text-sm">
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <UserIcon className="h-4 w-4" /> Full name
                    </dt>
                    <dd className="truncate font-semibold text-foreground">{displayName}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> Email
                    </dt>
                    <dd className="truncate font-semibold text-foreground">{user.email}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> Phone
                    </dt>
                    <dd className="font-semibold text-foreground">{user.phone || "Not added"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" /> Joined
                    </dt>
                    <dd className="font-semibold text-foreground">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Member"}
                    </dd>
                  </div>
                </dl>
              </div>

              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-12 w-full rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out of CollectiPay
              </Button>
            </div>

            {/* Right Column: Recent Contribution Groups */}
            <div className="space-y-6 lg:col-span-7">
              <div className="cp-card-native overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Your Group Pools</h2>
                    <p className="text-xs text-muted-foreground">
                      Track live funding progress across your pools
                    </p>
                  </div>
                  <Button asChild size="sm" className="h-9 rounded-xl gap-1">
                    <Link to="/create-group">
                      <Plus className="h-4 w-4" /> New Pool
                    </Link>
                  </Button>
                </div>

                <div className="p-4">
                  {contributions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                        <Users className="h-6 w-6" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        No group pools yet
                      </p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Create a group with friends, family, or colleagues to pool money transparently.
                      </p>
                      <Button asChild className="mt-4 rounded-xl">
                        <Link to="/create-group">Create Your First Group</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contributions.slice(0, 5).map((group: any) => {
                        const current = Number(group.current_amount || 0);
                        const target = Math.max(1, Number(group.target_amount || 1));
                        const pct = Math.min(100, Math.round((current / target) * 100));
                        const memberCount = Array.isArray(group.contributors)
                          ? group.contributors.length
                          : 0;

                        return (
                          <Link
                            key={group.id}
                            to={`/groups/${group.id}`}
                            className="cp-pressable group flex items-center gap-3.5 rounded-2xl border bg-background/60 p-3.5 hover:border-primary/45 hover:bg-accent/30"
                          >
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                              <CategoryIcon category={group.category} size={20} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="truncate text-sm font-bold text-foreground">
                                  {group.name}
                                </h3>
                                <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                                  {pct}%
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="tabular-nums font-medium text-foreground/85">
                                  ₦{current.toLocaleString("en-NG")}
                                </span>
                                <span>of ₦{Number(group.target_amount || 0).toLocaleString("en-NG")}</span>
                                <span>·</span>
                                <span className="capitalize">{group.frequency}</span>
                                {memberCount > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{memberCount} members</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                          </Link>
                        );
                      })}

                      {contributions.length > 5 && (
                        <Button asChild variant="outline" className="h-11 w-full rounded-xl">
                          <Link to="/all-groups">View all {contributions.length} groups</Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Wallet Quick Card */}
              <div className="cp-card-native flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3.5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">Need to move funds?</p>
                    <p className="text-xs text-muted-foreground">
                      Top up your wallet or send money directly to any Nigerian bank account.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="h-10 rounded-xl">
                    <Link to="/dashboard?wallet=add">Add money</Link>
                  </Button>
                  <Button asChild size="sm" className="h-10 rounded-xl">
                    <Link to="/transfer">Transfer</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
