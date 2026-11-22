import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";

export function WalletFlow({ title, description, headerRight, children, onBack, backDisabled = false, wide = false }: {
  title: string;
  description?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
  wide?: boolean;
}) {
  const backLabel = <><ArrowLeft size={16} aria-hidden="true" /> {onBack ? "Back" : "Wallet"}</>;
  return (
    <div className="min-h-dvh">
      <Header mobilePanel />
      <main className={cn("app-page app-panel-page desktop-panel-split", wide ? "max-w-3xl" : "max-w-xl")}>
        <section className="app-panel-hero group-detail-hero">
          <div className="mb-2 flex items-center justify-between gap-2">
            {onBack ? (
              <Button type="button" variant="ghost" className="group-detail-back gap-2 px-0" onClick={onBack} disabled={backDisabled}>{backLabel}</Button>
            ) : (
              <Button asChild variant="ghost" className="group-detail-back gap-2 px-0"><Link to="/dashboard">{backLabel}</Link></Button>
            )}
            {headerRight}
          </div>
          <h1 className="app-page-title">{title}</h1>
          {description && <div className="panel-kicker mt-2 text-sm">{description}</div>}
        </section>
        <div className="app-panel-body">{children}</div>
      </main>
    </div>
  );
}
