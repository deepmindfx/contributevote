import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LifeBuoy, Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import { SupportInbox } from "@/components/support/SupportInbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupportTicket, isSupportCategory, isTicketId, supportCategories, type SupportCategory } from "@/services/supabase/supportService";

function NewTicket({ initialCategory, initialReference, onCreate, onClose }: {
  initialCategory: SupportCategory; initialReference: string; onCreate: (id: string) => void; onClose: () => void;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [reference, setReference] = useState(initialReference);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<string>();
  return (
    <form className="cp-card-native space-y-4 p-4 sm:p-6" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError("");
      attempt.current ??= crypto.randomUUID();
      try {
        onCreate(await createSupportTicket({ key: attempt.current, category, reference, subject, body }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn’t open the ticket. Try again.");
      } finally { setBusy(false); }
    }}>
      <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-2" onClick={onClose} disabled={busy}><ArrowLeft size={16} /> All tickets</Button>
      <h2 className="text-lg font-semibold">Open a support ticket</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ticket-topic">Topic</Label>
          <select id="ticket-topic" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={category} disabled={busy} onChange={(event) => {
            setCategory(event.target.value as SupportCategory);
            setReference("");
          }}>
            {Object.entries(supportCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {category !== "general" && <div className="space-y-1.5">
          <Label htmlFor="ticket-reference">Reference <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="ticket-reference" value={reference} disabled={busy} maxLength={120} onChange={(event) => setReference(event.target.value)} placeholder="From your receipt or batch" />
        </div>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input id="ticket-subject" value={subject} disabled={busy} minLength={5} maxLength={100} required onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-message">What happened?</Label>
        <Textarea id="ticket-message" value={body} disabled={busy} minLength={2} maxLength={4000} required onChange={(event) => setBody(event.target.value)} placeholder="Include what you expected to happen and what you saw." />
        <p className="text-xs text-muted-foreground">Keep your PIN, password, BVN, and full card details private.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || subject.trim().length < 5 || body.trim().length < 2}>{busy ? "Opening…" : "Open ticket"}</Button>
    </form>
  );
}

export default function Support() {
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const adding = params.get("new") === "1";
  const ticketParam = params.get("ticket");
  const selected = isTicketId(ticketParam) ? ticketParam : null;
  const category = params.get("category");
  const initialCategory = isSupportCategory(category) ? category : "general";
  const select = (id: string | null) => setParams(id ? { ticket: id } : {});

  return (
    <div className="min-h-dvh">
      <Header mobilePanel />
      <main className="app-page app-panel-page mx-auto max-w-4xl">
        <section className="app-panel-hero group-detail-hero">
          <Button asChild variant="ghost" className="app-panel-secondary mb-3 gap-2"><Link to="/faq"><ArrowLeft size={16} /> Help &amp; FAQ</Link></Button>
          <h1 className="app-page-title flex items-center gap-2"><LifeBuoy size={24} aria-hidden="true" /> Support</h1>
          <p className="panel-kicker mt-2 text-sm">Open a ticket or follow an existing conversation about your account or payments.</p>
        </section>
        <div className="app-panel-body space-y-4">
          {adding ? <NewTicket initialCategory={initialCategory} initialReference={initialCategory === "general" ? "" : (params.get("reference") ?? "").slice(0, 120)} onCreate={(id) => {
            void cache.invalidateQueries({ queryKey: ["support"] });
            select(id);
          }} onClose={() => select(null)} /> : <>
            {!selected && <div className="flex justify-end"><Button onClick={() => setParams({ new: "1" })} className="gap-2"><Plus size={17} /> New ticket</Button></div>}
            <SupportInbox selected={selected} onSelect={select} />
          </>}
        </div>
      </main>
    </div>
  );
}
