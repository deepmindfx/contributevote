import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Contact, Copy, Mail, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvitationService, invitationUrl } from "@/services/supabase/invitationService";
import type { Invitation } from "@/services/supabase/invitationService";
import BrandLoader from "@/components/ui/BrandLoader";

type ContactNavigator = Navigator & {
  contacts?: { select: (fields: ["email"], options: { multiple: false }) => Promise<{ email?: string[] }[]> };
};

export function InviteMembersDialog({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [activeLink, setActiveLink] = useState<{ email: string; url: string } | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [listError, setListError] = useState(false);
  const [listVersion, refreshList] = useState(0);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const contactPicker = (navigator as ContactNavigator).contacts;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setListError(false);
    void InvitationService.getGroupInvitations(groupId).then(
      (result) => { if (active) setInvitations(result); },
      () => { if (active) setListError(true); },
    );
    return () => { active = false; };
  }, [groupId, open, listVersion]);

  const pickContact = async () => {
    if (!contactPicker) return;
    try {
      const [contact] = await contactPicker.select(["email"], { multiple: false });
      if (!contact) return;
      const selected = contact.email?.[0];
      if (selected) {
        setEmail(selected);
        setError("");
      } else {
        setError("This contact has no email address. Enter one below.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setError("Couldn’t open contacts. Enter an email address instead.");
      }
    }
  };

  const createLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;
    const recipient = email.trim().toLowerCase();
    setWorking(true);
    setError("");
    try {
      const url = await InvitationService.sendInvitation(groupId, recipient);
      setActiveLink({ email: recipient, url });
      setEmail("");
      refreshList((version) => version + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t create an invitation. Try again.");
    } finally {
      setWorking(false);
    }
  };

  const revoke = async (invitation: Invitation) => {
    if (revokingId) return;
    setRevokingId(invitation.id);
    try {
      await InvitationService.cancelInvitation(invitation.id);
      if (activeLink?.url === invitationUrl(invitation.token)) setActiveLink(null);
      setInvitations((previous) => previous.filter(({ id }) => id !== invitation.id));
      refreshList((version) => version + 1);
      toast.success("Invitation revoked.");
    } catch (error) {
      toast.error("Couldn’t revoke the invitation.");
    } finally {
      setRevokingId(null);
    }
  };

  const copyLink = async () => {
    if (!activeLink) return;
    try {
      await navigator.clipboard.writeText(activeLink.url);
      toast.success("Invitation link copied.");
    } catch {
      toast.error("Select the link to copy it.");
    }
  };

  const shareLink = async () => {
    if (!activeLink || !navigator.share) return;
    try {
      await navigator.share({ title: `Join ${groupName}`, url: activeLink.url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Couldn’t share the link. You can copy it instead.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 gap-2 rounded-xl"><UserPlus size={16} aria-hidden="true" /> Invite</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>Only someone signed in with the invited email can use the link. Invitations expire after seven days.</DialogDescription>
        </DialogHeader>
        <form onSubmit={createLink} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input id="invite-email" type="email" autoComplete="email" required maxLength={254} placeholder="name@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {contactPicker && <Button type="button" variant="outline" className="flex-1 gap-2" onClick={pickContact}><Contact size={16} aria-hidden="true" /> Contacts</Button>}
            <Button type="submit" className="flex-1" disabled={working}>{working ? "Creating…" : "Create invite link"}</Button>
          </div>
          {working && (
            <div className="flex justify-center pt-1">
              <BrandLoader variant="inline" size={34} message="Creating private invite link…" />
            </div>
          )}
        </form>
        {activeLink && (
          <div className="min-w-0 space-y-2 rounded-2xl border bg-accent/40 p-3">
            <p className="break-all text-sm font-semibold" role="status">Link ready for {activeLink.email}</p>
            <Input aria-label="Invitation link" readOnly value={activeLink.url} onFocus={(event) => event.target.select()} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyLink} className="gap-2"><Copy size={15} aria-hidden="true" /> Copy</Button>
              <Button variant="outline" asChild className="gap-2">
                <a href={`mailto:${encodeURIComponent(activeLink.email)}?subject=${encodeURIComponent(`Join ${groupName}`)}&body=${encodeURIComponent(activeLink.url)}`}><Mail size={15} aria-hidden="true" /> Email</a>
              </Button>
              {typeof navigator.share === "function" && <Button variant="outline" onClick={shareLink} className="gap-2"><Share2 size={15} aria-hidden="true" /> Share</Button>}
            </div>
          </div>
        )}
        {listError && <p role="status" className="text-sm text-muted-foreground">Couldn’t load pending invitations.</p>}
        {invitations.length > 0 && (
          <details className="rounded-xl border px-3">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Pending invitations ({invitations.length})</summary>
            <ul className="divide-y">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-x-2 py-2 text-sm">
                  <button type="button" className="min-h-11 min-w-0 break-all text-left font-medium text-primary" onClick={() => setActiveLink({ email: invitation.invitee_email, url: invitationUrl(invitation.token) })}>{invitation.invitee_email}</button>
                  <Button variant="ghost" disabled={revokingId !== null} onClick={() => void revoke(invitation)}>Revoke</Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </DialogContent>
    </Dialog>
  );
}
