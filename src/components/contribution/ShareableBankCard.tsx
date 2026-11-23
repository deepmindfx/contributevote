import { useMemo, useState } from "react";
import { Building2, Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getCategoryLabel } from "@/services/supabase/groupEnhancementService";
import { GroupSharePreview } from "./GroupSharePreview";
import { COLLECTIPAY_SHARE_HOST } from "./groupShareImage";
import type { GroupShareArtwork } from "./groupShareImage";

interface ShareableBankCardProps {
  groupName: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  category?: string | null;
  coverUrl?: string | null;
  joinLink?: string;
  active: boolean;
}

export function ShareableBankCard({
  groupName, accountNumber, bankName, accountName, category, coverUrl, joinLink, active,
}: ShareableBankCardProps) {
  const [copied, setCopied] = useState<"number" | "details">();
  const artwork = useMemo<GroupShareArtwork>(() => ({
    kind: "bank", name: groupName, category: getCategoryLabel(category || "community"), coverUrl, joinLink,
    bank: { number: accountNumber, bank: bankName, name: accountName },
  }), [accountName, accountNumber, bankName, category, coverUrl, groupName, joinLink]);
  const caption = [
    groupName + " · CollectiPay group account",
    accountNumber,
    bankName,
    accountName,
    joinLink || "https://" + COLLECTIPAY_SHARE_HOST,
  ].join("\n");

  const copy = async (field: "number" | "details") => {
    try {
      await navigator.clipboard.writeText(field === "number" ? accountNumber : caption);
      setCopied(field);
      window.setTimeout(() => setCopied((current) => current === field ? undefined : current), 2_000);
      toast.success(field === "number" ? "Account number copied" : "Account details copied");
    } catch {
      toast.error("Couldn’t copy. Try again.");
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="flex items-start gap-3 bg-[#0b3d31] p-4 text-white sm:p-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#ddefc4]">
            <Building2 size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#cee8da]">Dedicated group account</p>
            <h3 className="mt-0.5 break-words text-lg font-semibold leading-snug">{groupName}</h3>
          </div>
        </div>
        <dl className="divide-y px-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 py-4">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">Account number</dt>
              <dd className="mt-1 font-mono text-xl font-bold tabular-nums tracking-wider sm:text-2xl">{accountNumber}</dd>
            </div>
            {active && <Button type="button" variant="outline" size="sm" onClick={() => void copy("number")} className="h-10 gap-2 rounded-xl">
              {copied === "number" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "number" ? "Copied" : "Copy number"}
            </Button>}
          </div>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">Bank</dt>
              <dd className="mt-1 break-words text-sm font-semibold">{bankName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">Account name</dt>
              <dd className="mt-1 break-words text-sm font-semibold">{accountName}</dd>
            </div>
          </div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t bg-muted/35 px-4 py-3 text-xs sm:px-5">
          <span className="flex items-center gap-1.5 font-semibold"><CollectiPayMark size={18} /> Created with CollectiPay</span>
          <span className="text-muted-foreground">{COLLECTIPAY_SHARE_HOST}</span>
        </div>
      </div>
      {active && <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => void copy("details")} className="h-11 gap-2 rounded-xl">
          {copied === "details" ? <Check size={16} /> : <Copy size={16} />} Copy details
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" className="h-11 gap-2 rounded-xl"><Share2 size={16} /> Share card</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92dvh] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Share bank details</DialogTitle>
              <DialogDescription>Send a CollectiPay card with the group’s transfer details.</DialogDescription>
            </DialogHeader>
            <GroupSharePreview artwork={artwork} caption={caption} />
            <a href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noopener noreferrer"
              className="justify-self-center rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2">
              Send details as text on WhatsApp
            </a>
          </DialogContent>
        </Dialog>
      </div>}
    </div>
  );
}
