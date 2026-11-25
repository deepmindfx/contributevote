import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Button } from "@/components/ui/button";
import BrandLoader from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { GroupRules } from "./GroupRules";
import type { GroupRuleDetails } from "./GroupRules";
import { GroupCover } from "./GroupCover";
import "@/styles/landing.css";

type PreviewGroup = GroupRuleDetails & {
  name: string;
  category?: string | null;
  target_amount: number;
  privacy?: string | null;
  cover_image_url?: string | null;
  is_verified?: boolean | null;
  is_pinned?: boolean | null;
  spotlight_label?: string | null;
};

export function GroupJoinPreview({
  group,
  loading,
  error,
  inviter,
  onRetry,
  children,
}: {
  group?: PreviewGroup | null;
  loading: boolean;
  error: string;
  inviter?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  const { isAuthenticated } = useSupabaseUser();
  const title = group?.name || (loading ? "Group preview" : "Group unavailable");
  const startPath = isAuthenticated ? "/create-group" : "/auth?mode=signup";

  return (
    <div className="cb-public-light min-h-dvh">
      {isAuthenticated ? (
        <Header />
      ) : (
        <LandingHeader isAuthenticated={false} startPath={startPath} />
      )}

      <main
        className={
          isAuthenticated
            ? "cb-discover-main cb-discover-main--workspace cp-page-enter"
            : "cb-discover-main cb-discover-main--guest cp-page-enter"
        }
      >
        <section className="cb-discover-hero pb-8" aria-labelledby="group-preview-title">
          <div className="cb-hero-grid-bg" aria-hidden="true" />
          <div className="cb-discover-glow" aria-hidden="true" />

          <div className="mx-auto max-w-2xl px-4 sm:px-6 relative z-10">
            <Link
              to="/discover"
              className="mb-5 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#0f1729] shadow-sm transition-colors hover:bg-[#edf3f0]"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back to Public Pools
            </Link>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="cb-hero-kicker">
                <span className="cb-hero-kicker-tag">{inviter ? "INVITE" : "PUBLIC POOL"}</span>
                <span className="cb-hero-kicker-text">
                  {inviter
                    ? `Invited by ${inviter}`
                    : group
                    ? `Goal: ₦${Number(group.target_amount).toLocaleString("en-NG")}`
                    : "CollectiPay Pool"}
                </span>
              </div>
              {group?.enable_voting_rights !== false && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e1f6eb] px-3 py-1 text-xs font-bold text-[#047857]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Vote-Protected
                </span>
              )}
            </div>

            <h1 id="group-preview-title" className="cb-discover-title">
              {title}
            </h1>
          </div>
        </section>

        <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
          {loading ? (
            <BrandLoader variant="page" message="Loading group details" />
          ) : group ? (
            <div className="cb-light-surface-card overflow-hidden">
              {group.cover_image_url && (
                <GroupCover url={group.cover_image_url} name={group.name} category={group.category} />
              )}
              <div className="space-y-5 p-5 sm:p-7">
                <GroupRules group={group} />
                {children}
              </div>
            </div>
          ) : (
            <div className="cb-light-surface-card space-y-4 p-7 text-sm text-[#64717d]">
              <p>{error}</p>
              {onRetry && (
                <Button type="button" variant="outline" onClick={onRetry} className="rounded-xl">
                  Retry
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
