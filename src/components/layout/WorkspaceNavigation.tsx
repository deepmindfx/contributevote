import { Link, useLocation } from "react-router-dom";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Building2, ChevronRight, Plus, ReceiptText } from "lucide-react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { getWorkspaceLink, workspaceLinks } from "./navigationItems";

const mobileLinks = workspaceLinks.filter(({ mobileLabel }) => mobileLabel);
const moneyLinks = [
  { to: "/dashboard?wallet=add", label: "Add money", detail: "Fund your CollectiPay wallet", icon: ArrowDownLeft },
  { to: "/transfer", label: "Send money", detail: "Transfer to a bank account", icon: ArrowUpRight },
  { to: "/dashboard?wallet=bank", label: "Bank details", detail: "View your deposit account", icon: Building2 },
  { to: "/wallet-history", label: "Wallet history", detail: "See your wallet transactions", icon: ReceiptText },
];

export default function WorkspaceNavigation() {
  const { pathname } = useLocation();
  const { user } = useSupabaseUser();
  const { contributions, withdrawalRequests } = useSupabaseContribution();
  const active = getWorkspaceLink(pathname);
  const mobileActive =
    active?.to === "/discover"
      ? "/all-groups"
      : active?.to === "/admin"
      ? "/settings"
      : "mobileLabel" in (active || {}) && (active as any)?.mobileLabel
      ? active!.to
      : "/dashboard";
  const pendingVotes = user
    ? withdrawalRequests.filter((request) => {
        if (request.status !== "pending") return false;
        const group: any = contributions.find((c) => c.id === request.contribution_id);
        const canVoteInGroup = Array.isArray(group?.contributors)
          ? group.contributors.some((c: any) => c.user_id === user.id && c.has_voting_rights === true)
          : false;
        if (!canVoteInGroup) return false;
        const votes = Array.isArray(request.votes) ? (request.votes as { user_id?: string }[]) : [];
        return !votes.some((vote) => vote?.user_id === user.id);
      }).length
    : 0;

  const votesLabel = pendingVotes ? `Votes, ${pendingVotes} pending` : undefined;
  const votesBadge = pendingVotes > 9 ? "9+" : pendingVotes;
  const renderMobileLink = ({ to, mobileLabel, icon, mobileIcon }: (typeof mobileLinks)[number]) => {
    const Icon = mobileIcon || icon;

    return (
      <Link
        key={to}
        to={to}
        className="app-tab-link"
        aria-current={mobileActive === to ? "page" : undefined}
        aria-label={to === "/votes" ? votesLabel : undefined}
      >
        <span className="app-tab-icon">
          <Icon size={22} strokeWidth={mobileActive === to ? 2.15 : 1.75} aria-hidden="true" />
          {to === "/votes" && pendingVotes > 0 && <span className="app-tab-badge" aria-hidden="true">{votesBadge}</span>}
        </span>
        <span className="app-tab-label">{mobileLabel}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className="workspace-sidebar">
        <Link to="/dashboard" className="app-brand workspace-brand">
          <CollectiPayMark size={32} />
          <span>CollectiPay</span>
        </Link>
        <Button asChild className="workspace-create gap-2">
          <Link to="/create-group"><Plus size={17} aria-hidden="true" /> Create group</Link>
        </Button>
        <nav className="workspace-links" aria-label="Workspace navigation">
          {workspaceLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              aria-current={active?.to === to ? "page" : undefined}
              aria-label={to === "/votes" ? votesLabel : undefined}
              className={to === "/settings" ? "workspace-settings" : undefined}
            >
              <Icon size={18} strokeWidth={1.85} aria-hidden="true" />
              <span>{label}</span>
              {to === "/votes" && pendingVotes > 0 && <span className="workspace-vote-count" aria-hidden="true">{votesBadge}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      <nav className="app-tabbar" aria-label="Mobile navigation">
        {mobileLinks.slice(0, 2).map(renderMobileLink)}
        <Dialog>
          <DialogTrigger className="app-tab-action">
            <span className="app-tab-action-icon"><ArrowLeftRight size={23} strokeWidth={2.1} aria-hidden="true" /></span>
            <span className="app-tab-label">Move money</span>
          </DialogTrigger>
          <DialogContent className="app-money-sheet">
            <DialogHeader>
              <DialogTitle>Move money</DialogTitle>
              <DialogDescription className="sr-only">Choose a wallet action.</DialogDescription>
            </DialogHeader>
            <div className="divide-y overflow-hidden rounded-2xl border">
              {moneyLinks.map(({ to, label, detail, icon: Icon }) => (
                <DialogClose asChild key={to}>
                  <Link to={to} className="flex min-h-[4.25rem] items-center gap-3 px-3 py-2.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Icon size={19} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-sm text-muted-foreground">{detail}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </DialogClose>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        {mobileLinks.slice(2).map(renderMobileLink)}
      </nav>
    </>
  );
}
