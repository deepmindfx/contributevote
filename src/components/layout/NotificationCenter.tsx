import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Mail,
  MailOpen,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
  Vote,
} from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";
import { toast } from "sonner";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { InvitationService } from "@/services/supabase/invitationService";
import {
  notificationCategory,
  type NotificationRecord,
} from "@/services/supabase/notificationService";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread" | "wallet" | "group" | "activity";

const LONG_MESSAGE_THRESHOLD = 110;
const PAGE_SIZE = 20;

function getNotificationIcon(type: string) {
  switch (type) {
    case "withdrawal_request":
    case "vote":
      return { icon: Vote, tone: "bg-accent text-primary" };
    case "group_invitation":
      return { icon: Mail, tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" };
    case "deposit":
    case "wallet_deposit":
    case "bank_transfer_received":
    case "group_payment_received":
    case "contribution":
      return { icon: ArrowDownLeft, tone: "bg-accent text-primary" };
    case "transfer":
    case "transfer_completed":
    case "withdrawal":
      return { icon: ArrowUpRight, tone: "bg-muted text-foreground" };
    case "refund":
    case "refund_request":
      return { icon: RefreshCw, tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300" };
    case "penalty":
      return { icon: AlertTriangle, tone: "bg-red-500/12 text-red-700 dark:text-red-300" };
    case "security_alert":
    case "transfer_failed":
      return { icon: ShieldAlert, tone: "bg-red-500/12 text-red-700 dark:text-red-300" };
    case "group_update":
      return { icon: Users, tone: "bg-accent text-primary" };
    default:
      return { icon: Bell, tone: "bg-accent text-primary" };
  }
}

export function NotificationCenter() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    toggleNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearReadNotifications,
    clearAllNotifications,
  } = useSupabaseUser();

  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const [filter, setFilter] = useState<FilterTab>("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) {
      setConfirmClearAll(false);
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  const readCount = useMemo(
    () => notifications.filter((n) => n.is_read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === "unread") return !item.is_read;
      if (filter === "wallet" || filter === "group" || filter === "activity") {
        return notificationCategory(item.type) === filter;
      }
      return true;
    });
  }, [notifications, filter]);

  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const remainingCount = Math.max(0, filtered.length - visibleItems.length);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.is_read) {
      void markNotificationRead(notification.id);
    }
    setOpen(false);
    const { type, related_id: relatedId } = notification;
    if (type.startsWith("fixed_savings_")) {
      navigate("/fixed-savings");
    } else if (type === "withdrawal_request") {
      navigate("/votes");
    } else if (type === "group_invitation" && relatedId) {
      const href = await InvitationService.getInvitationLinkById(relatedId);
      if (href) {
        try {
          const parsed = new URL(href, window.location.origin);
          navigate(parsed.pathname + parsed.search);
        } catch {
          toast.error("This invitation link is invalid.");
        }
      } else {
        toast.error("This invitation is unavailable. Open the link shared by the group creator.");
      }
    } else if (relatedId) {
      navigate(`/groups/${relatedId}`);
    } else if (notificationCategory(type) === "wallet") {
      navigate("/wallet-history");
    }
  };

  const handleToggleRead = async (notification: NotificationRecord) => {
    setBusyId(notification.id);
    const ok = await toggleNotificationRead(notification.id, !notification.is_read);
    setBusyId(null);
    if (!ok) toast.error("Could not update notification.");
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    const ok = await deleteNotification(id);
    setBusyId(null);
    if (!ok) {
      toast.error("Could not delete notification.");
    }
  };

  const handleClearRead = async () => {
    if (readCount === 0 || clearing) return;
    setClearing(true);
    const ok = await clearReadNotifications();
    setClearing(false);
    if (ok) toast.success("Cleared read notifications");
    else toast.error("Could not clear read notifications.");
  };

  const handleClearAll = async () => {
    if (notifications.length === 0 || clearing) return;
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    setClearing(true);
    const ok = await clearAllNotifications();
    setClearing(false);
    setConfirmClearAll(false);
    if (ok) toast.success("All notifications cleared");
    else toast.error("Could not clear notifications.");
  };

  const filterOptions: { id: FilterTab; label: string; count?: number }[] = [
    { id: "all", label: "All", count: notifications.length },
    { id: "unread", label: "Unread", count: unreadNotificationCount },
    { id: "wallet", label: "Money" },
    { id: "group", label: "Groups" },
    { id: "activity", label: "Activity" },
  ];

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={isMobile ? () => setOpen(true) : undefined}
      className="app-notification-button relative h-11 w-11 rounded-full border border-border bg-card"
      aria-label={
        unreadNotificationCount
          ? `Notifications, ${unreadNotificationCount} unread`
          : "Notifications"
      }
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadNotificationCount > 0 && (
        <span className="app-notification-dot cp-notif-ping absolute right-2 top-2 h-2.5 w-2.5 rounded-full border border-card bg-primary" />
      )}
    </Button>
  );

  const panelBody = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-popover text-popover-foreground">
      {/* Sticky Deep-Emerald Header */}
      <div className="cp-notif-header shrink-0 px-4 pb-3.5 pt-3.5">
        {isMobile && (
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        )}
        <div className={cn("flex items-center justify-between gap-2", isMobile && "pr-9")}>
          <div className="flex min-w-0 items-center gap-2.5">
            <CollectiPayMark size={24} />
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-bold tracking-tight text-white">
                Notifications
              </h2>
              {unreadNotificationCount > 0 && (
                <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#dbf5b4] px-1.5 text-[11px] font-bold text-[#0c3027] tabular-nums">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </div>
          </div>

          {unreadNotificationCount > 0 && (
            <button
              type="button"
              onClick={() => {
                void markAllNotificationsRead();
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/12 px-2.5 py-1.5 text-xs font-semibold text-[#e6f7ee] transition-colors hover:bg-white/20"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills + Manage Bar */}
      <div className="shrink-0 space-y-2 border-b bg-card/80 px-3.5 py-2.5">
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter notifications"
        >
          {filterOptions.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(tab.id);
                  setVisibleCount(PAGE_SIZE);
                  setConfirmClearAll(false);
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {tab.count > 99 ? "99+" : tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Manage Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <Link
            to="/settings?tab=preferences#device-notifications"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <Settings className="h-3.5 w-3.5" />
            Device alerts
          </Link>

          {notifications.length > 0 && (
            <div className="flex items-center gap-1.5">
              {readCount > 0 && (
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => void handleClearRead()}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  Clear read ({readCount})
                </button>
              )}
              <button
                type="button"
                disabled={clearing}
                onClick={() => void handleClearAll()}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50",
                  confirmClearAll
                    ? "bg-destructive text-destructive-foreground"
                    : "text-destructive/90 hover:bg-destructive/10"
                )}
              >
                {confirmClearAll ? "Tap again to clear all" : "Clear all"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Native Smooth Scrollable List (Bounded, Zero Horizontal Overflow) */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/65">
              <CollectiPayMark size={30} className="opacity-85" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {filter === "unread"
                ? "No unread notifications"
                : notifications.length === 0
                ? "All caught up"
                : "No alerts in this category"}
            </p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
              {filter !== "all"
                ? "Switch back to All to view your full alert history."
                : "Pool activity, votes, deposits, and transfer alerts will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {visibleItems.map((notification) => {
              const { icon: NotifIcon, tone } = getNotificationIcon(notification.type);
              const isUnread = !notification.is_read;
              const category = notificationCategory(notification.type);
              const amount =
                category === "activity"
                  ? undefined
                  : notification.message.match(/₦[\d,]+(?:\.\d{1,2})?/)?.[0];
              const isLong = (notification.message || "").length > LONG_MESSAGE_THRESHOLD;
              const isExpanded = Boolean(expandedIds[notification.id]);
              const isBusy = busyId === notification.id;
              const hasTarget = Boolean(
                notification.type === "withdrawal_request" ||
                  notification.related_id ||
                  category === "wallet"
              );

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "px-4 py-3.5 transition-colors",
                    isUnread ? "bg-primary/[0.05]" : "bg-transparent",
                    isBusy && "opacity-60"
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                        tone
                      )}
                    >
                      <NotifIcon className="h-4 w-4" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      {/* Clickable content area */}
                      <button
                        type="button"
                        onClick={() => void openNotification(notification)}
                        className="group block w-full min-w-0 text-left focus-visible:outline-none"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                            {notification.title}
                          </span>
                          <span className="mt-1 flex shrink-0 items-center gap-1">
                            {isUnread && (
                              <span
                                className="h-2 w-2 rounded-full bg-primary"
                                aria-label="Unread"
                              />
                            )}
                            {hasTarget && (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/55 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                            )}
                          </span>
                        </div>

                        {amount && (
                          <span className="mt-1.5 inline-flex max-w-full flex-wrap items-baseline gap-1.5 rounded-lg bg-accent/65 px-2.5 py-1">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {category === "group" ? "Group payment" : "Wallet activity"}
                            </span>
                            <strong className="text-xs font-bold tabular-nums text-primary">
                              {amount}
                            </strong>
                          </span>
                        )}

                        <p
                          className={cn(
                            "mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs leading-relaxed text-muted-foreground",
                            isLong && !isExpanded && "line-clamp-3"
                          )}
                        >
                          {notification.message}
                        </p>
                      </button>

                      {/* Footer row: timestamp + Read more + Manage buttons */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {(() => {
                            if (!notification.created_at) return null;
                            const parsedDate = new Date(notification.created_at);
                            if (!isValid(parsedDate)) return null;
                            return (
                              <span className="text-[11px] font-medium text-muted-foreground/80">
                                {formatDistanceToNow(parsedDate, { addSuffix: true })}
                              </span>
                            );
                          })()}
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(notification.id)}
                              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-accent"
                            >
                              {isExpanded ? (
                                <>
                                  Show less <ChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  Read more <ChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleRead(notification)}
                            aria-label={isUnread ? "Mark as read" : "Mark as unread"}
                            title={isUnread ? "Mark as read" : "Mark as unread"}
                            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            {isUnread ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only">Read</span>
                              </>
                            ) : (
                              <>
                                <MailOpen className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only">Unread</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDelete(notification.id)}
                            aria-label="Delete notification"
                            title="Delete notification"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/12 hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {remainingCount > 0 && (
              <div className="p-3 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="h-9 w-full rounded-xl text-xs font-semibold"
                >
                  Show more ({remainingCount} remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex h-[84dvh] max-h-[86dvh] flex-col gap-0 overflow-hidden p-0 pb-[env(safe-area-inset-bottom)]">
            <DialogHeader className="sr-only">
              <DialogTitle>Notifications</DialogTitle>
              <DialogDescription>
                View, filter, read, and clear your CollectiPay alerts.
              </DialogDescription>
            </DialogHeader>
            {panelBody}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="z-[70] flex max-h-[min(39rem,calc(100dvh-5.5rem))] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border p-0 shadow-2xl"
      >
        {panelBody}
      </PopoverContent>
    </Popover>
  );
}
