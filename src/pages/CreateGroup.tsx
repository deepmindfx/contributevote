import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import GroupForm from "@/components/create-group/GroupForm";

export default function CreateGroup() {
  return (
    <div className="min-h-dvh">
      <Header mobilePanel />
      <main className="app-page app-panel-page desktop-panel-split max-w-2xl">
        <section className="app-panel-hero" aria-labelledby="create-group-title">
          <Button asChild variant="ghost" className="app-panel-secondary mb-4 gap-1">
            <Link to="/all-groups"><ChevronLeft size={18} aria-hidden="true" /> My groups</Link>
          </Button>
          <h1 id="create-group-title" className="app-page-title">Create a group</h1>
          <p className="panel-kicker mt-2">Save together for something that matters.</p>
        </section>
        <div className="app-panel-body">
          <GroupForm />
        </div>
      </main>
    </div>
  );
}
