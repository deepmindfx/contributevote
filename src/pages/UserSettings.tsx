import { Link } from "react-router-dom";
import { ChevronLeft, HelpCircle, ShieldCheck } from "lucide-react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import UserSettingsForm from "@/components/settings/UserSettingsForm";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { hasTransactionPin } from "@/lib/transactionPin";

const UserSettings = () => {
  const { user } = useSupabaseUser();
  const hasPin = hasTransactionPin(user?.preferences);

  return (
    <div className="min-h-dvh bg-background">
      <Header mobilePanel />
      <main className="app-page app-panel-page cp-page-enter max-w-4xl">
        <section className="app-panel-hero" aria-labelledby="settings-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" className="app-panel-secondary gap-1 rounded-xl">
              <Link to="/profile">
                <ChevronLeft size={18} aria-hidden="true" />
                Profile
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" className="app-panel-secondary gap-1.5 rounded-xl">
                <Link to="/faq">
                  <HelpCircle size={15} aria-hidden="true" />
                  Help &amp; FAQ
                </Link>
              </Button>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#dbf5b4]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {hasPin ? "PIN Security Active" : "Finish Security Setup"}
              </span>
            </div>
          </div>

          <h1 id="settings-title" className="app-page-title mt-4">
            Account settings
          </h1>
          <p className="panel-kicker mt-1.5 text-sm">
            Personalize your profile, protect transfers with a 4-digit PIN, and tune app preferences.
          </p>
        </section>

        <div className="app-panel-body">
          <UserSettingsForm />
        </div>
      </main>
    </div>
  );
};

export default UserSettings;
