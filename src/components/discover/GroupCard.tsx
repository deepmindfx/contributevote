import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Calendar, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CategoryIcon from "@/components/ui/CategoryIcon";
import {
  SpotlightBadge,
  VerifiedCrowdfunderBadge,
} from "@/components/contribution/VerifiedCrowdfunderBadge";
import { getCategoryLabel } from "@/services/supabase/groupEnhancementService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface GroupCardProps {
  group: any;
}

export default function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentAmount = Number(group.current_amount || 0);
  const targetAmount = Number(group.target_amount || 0);
  const progress =
    targetAmount > 0 ? Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100)) : 0;

  const contributorCount = Array.isArray(group.contributors)
    ? group.contributors[0]?.count ?? group.contributors.length
    : 0;
  const isFunded = progress >= 100;
  const isVerified = Boolean(group.is_verified);
  const isPinned = Boolean(group.is_pinned);
  const spotlightLabel = group.spotlight_label as string | null | undefined;
  const hasSpotlight = isPinned || Boolean(spotlightLabel);
  const coverImageUrl = group.cover_image_url as string | null | undefined;

  useEffect(() => {
    let active = true;
    const checkMembership = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) {
          setIsMember(false);
          return;
        }
        if (group.creator_id === user.id) {
          setIsMember(true);
          return;
        }
        const { data } = await supabase
          .from("contributors")
          .select("id")
          .eq("group_id", group.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (active) setIsMember(!!data);
      } catch {
        if (active) setIsMember(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    void checkMembership();
    return () => {
      active = false;
    };
  }, [group.id, group.creator_id]);

  const handlePrimaryAction = () => {
    navigate(isMember ? `/groups/${group.id}` : `/join/${group.id}`);
  };

  return (
    <Card
      onClick={handlePrimaryAction}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handlePrimaryAction();
        }
      }}
      className={cn(
        "cp-card-native cp-pressable group flex h-full min-w-0 cursor-pointer flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        hasSpotlight &&
          "border-amber-500/40 bg-gradient-to-b from-amber-500/[0.045] via-card to-card ring-1 ring-amber-500/15",
        !hasSpotlight && isVerified && "border-emerald-500/35"
      )}
    >
      <div>
        {/* Full-Bleed Group Cover Picture Banner (when provided) */}
        {coverImageUrl && (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
            <img
              src={coverImageUrl}
              alt={group.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/20" />
            {(hasSpotlight || isVerified) && (
              <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                {hasSpotlight && <SpotlightBadge label={spotlightLabel} isPinned={isPinned} onDark />}
                {isVerified && <VerifiedCrowdfunderBadge onDark />}
              </div>
            )}
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                <CategoryIcon category={group.category} size={12} className="text-[#dbf5b4]" />
                {getCategoryLabel(group.category)}
              </span>
              {isFunded ? (
                <span className="rounded-full bg-[#dbf5b4] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#0c3027]">
                  Funded
                </span>
              ) : group.enable_voting_rights !== false ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] font-semibold text-white/95 backdrop-blur-sm">
                  <ShieldCheck className="h-3 w-3 text-[#dbf5b4]" />
                  Vote-gated
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="p-5 pb-0">
          {/* Admin Spotlight & Verified Crowdfunder Ribbon (when no cover image) */}
          {!coverImageUrl && (hasSpotlight || isVerified) && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {hasSpotlight && <SpotlightBadge label={spotlightLabel} isPinned={isPinned} />}
              {isVerified && <VerifiedCrowdfunderBadge />}
            </div>
          )}

          {/* Top Row: Category Icon + Status Pill (when no cover image) */}
          {!coverImageUrl && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
                  <CategoryIcon category={group.category} size={20} />
                </span>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-primary">
                    {getCategoryLabel(group.category)}
                  </span>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.creator?.name || group.creator?.email || "Community organizer"}
                  </p>
                </div>
              </div>

              {isFunded ? (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  Funded
                </span>
              ) : group.enable_voting_rights !== false ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Vote-gated
                </span>
              ) : null}
            </div>
          )}

          {/* Title & Concise Summary */}
          <div className={coverImageUrl ? "" : "mt-4"}>
            <h3 className="line-clamp-1 text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              {group.name}
            </h3>
            <p className="mt-1 line-clamp-2 min-h-[2.3rem] text-xs leading-relaxed text-muted-foreground">
              {group.description || "Transparent community savings pool powered by CollectiPay."}
            </p>
          </div>
        </div>
      </div>

      {/* Funding Bar + Simple Action */}
      <div className="mt-5 space-y-4 p-5 pt-0">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-extrabold tracking-tight text-foreground tabular-nums">
              ₦{currentAmount.toLocaleString("en-NG")}
            </span>
            <span className="text-xs font-bold text-primary tabular-nums">
              {progress.toFixed(0)}%
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            of ₦{targetAmount.toLocaleString("en-NG")} goal
          </p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.max(progress, currentAmount > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-medium">
              <Users className="h-3.5 w-3.5" />
              {contributorCount}
            </span>
            <span className="inline-flex items-center gap-1 capitalize">
              <Calendar className="h-3.5 w-3.5" />
              {group.frequency || "Flexible"}
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant={isMember ? "secondary" : "default"}
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              handlePrimaryAction();
            }}
            className="h-9 gap-1 rounded-xl px-3.5 text-xs font-bold"
          >
            {isMember ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Open pool
              </>
            ) : (
              <>
                View &amp; Join
                <ArrowUpRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
