import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import BrandLoader from "@/components/ui/BrandLoader";
import { GroupRules } from "./GroupRules";
import type { GroupRuleDetails } from "./GroupRules";

type PreviewGroup = GroupRuleDetails & {
  name: string;
  target_amount: number;
  privacy?: string | null;
  cover_image_url?: string | null;
  is_verified?: boolean | null;
  is_pinned?: boolean | null;
  spotlight_label?: string | null;
};

export function GroupJoinPreview({ group, loading, error, inviter, children }: {
  group?: PreviewGroup | null;
  loading: boolean;
  error: string;
  inviter?: string;
  children?: ReactNode;
}) {
  const title = group?.name || (loading ? "Group preview" : "Group unavailable");

  return (
    <div className="min-h-dvh">
      <Header mobilePanel />
      <main className="app-page app-panel-page max-w-xl">
        <section className="app-panel-hero" aria-labelledby="group-preview-title">
          <Button asChild variant="ghost" className="app-panel-secondary mb-3 gap-2">
            <Link to="/discover"><ArrowLeft size={16} aria-hidden="true" /> Discover</Link>
          </Button>
          <h1 id="group-preview-title" className="app-page-title">{title}</h1>
          {group && (
            <p className="panel-kicker mt-2 text-sm">
              {inviter ? `Invited by ${inviter}` : "Public group"} · ₦{Number(group.target_amount).toLocaleString("en-NG")} goal
            </p>
          )}
        </section>
        <div className="app-panel-body">
          {loading ? (
            <BrandLoader variant="page" message="Loading group details" />
          ) : group ? (
            <Card className="overflow-hidden rounded-2xl">
              {group.cover_image_url && (
                <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                  <img
                    src={group.cover_image_url}
                    alt={group.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-5 p-4 sm:p-6">
                <GroupRules group={group} />
                {children}
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl p-5 text-sm text-muted-foreground">{error}</Card>
          )}
        </div>
      </main>
    </div>
  );
}
