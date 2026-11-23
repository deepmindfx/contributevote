import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { getCategoryLabel } from "@/services/supabase/groupEnhancementService";
import { GroupJoinService } from "@/services/supabase/groupJoinService";
import { cn } from "@/lib/utils";
import { GroupSharePreview } from "./GroupSharePreview";
import type { GroupShareArtwork, GroupShareFormat, GroupShareTheme } from "./groupShareImage";

interface ShareGroupButtonProps {
  groupId: string;
  shareSlug?: string | null;
  groupName: string;
  groupDescription?: string | null;
  category?: string | null;
  coverUrl?: string | null;
  targetAmount: number;
  currentAmount: number;
  accountNumber?: string | null;
  bankName?: string | null;
  accountName?: string | null;
}

const themes: { id: GroupShareTheme; label: string; color: string }[] = [
  { id: "emerald", label: "Emerald", color: "#0d634e" },
  { id: "mint", label: "Mint", color: "#bbebcb" },
  { id: "midnight", label: "Midnight", color: "#293b46" },
];

export function ShareGroupButton({
  groupId, shareSlug, groupName, groupDescription, category, coverUrl, targetAmount, currentAmount,
  accountNumber, bankName, accountName,
}: ShareGroupButtonProps) {
  const [format, setFormat] = useState<GroupShareFormat>("story");
  const [theme, setTheme] = useState<GroupShareTheme>("emerald");
  const [copied, setCopied] = useState<"link" | "caption">();
  const link = GroupJoinService.generateShareLink(groupId, shareSlug);
  const artwork = useMemo<GroupShareArtwork>(() => ({
    kind: "poster", name: groupName, category: getCategoryLabel(category || "community"), coverUrl, joinLink: link,
    description: groupDescription?.trim(), raised: currentAmount, target: targetAmount, theme, format,
    bank: accountNumber && bankName ? { number: accountNumber, bank: bankName, name: accountName || groupName } : undefined,
  }), [accountName, accountNumber, bankName, category, coverUrl, currentAmount, format, groupDescription, groupName, link, targetAmount, theme]);
  const caption = [
    'Support ' + groupName + ' on CollectiPay',
    groupDescription?.trim().slice(0, 220),
    targetAmount > 0 ? '₦' + currentAmount.toLocaleString("en-NG") + ' raised of ₦' + targetAmount.toLocaleString("en-NG") : undefined,
    artwork.bank ? artwork.bank.number + ' · ' + artwork.bank.bank + ' · ' + artwork.bank.name : undefined,
    link,
  ].filter(Boolean).join("\n\n");

  const copy = async (field: "link" | "caption") => {
    try {
      await navigator.clipboard.writeText(field === "link" ? link : caption);
      setCopied(field);
      window.setTimeout(() => setCopied((current) => current === field ? undefined : current), 2_000);
      toast.success(field === "link" ? "Group link copied" : "Caption copied");
    } catch {
      toast.error("Couldn’t copy. Try again.");
    }
  };

  const shareLinks = [
    ["WhatsApp", 'https://wa.me/?text=' + encodeURIComponent(caption)],
    ["X", 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Support ' + groupName + ' on CollectiPay') + '&url=' + encodeURIComponent(link)],
    ["Facebook", 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link)],
  ];

  const shareText = async () => {
    try {
      await navigator.share({ title: `${groupName} on CollectiPay`, text: caption });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy("link");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl font-semibold">
          <Share2 size={16} aria-hidden="true" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-5 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 space-y-0">
          <CollectiPayMark size={34} />
          <div>
            <DialogTitle>Share your group</DialogTitle>
            <DialogDescription className="mt-1">Create a post or send the group link.</DialogDescription>
          </div>
        </DialogHeader>
        <Tabs defaultValue="image" className="min-w-0">
          <TabsList className="app-segmented grid w-full grid-cols-2">
            <TabsTrigger value="image">Share card</TabsTrigger>
            <TabsTrigger value="link">Link &amp; caption</TabsTrigger>
          </TabsList>
          <TabsContent value="image" className="space-y-4 pt-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex flex-wrap gap-1" role="group" aria-label="Card colour">
                {themes.map(({ id, label, color }) => (
                  <Button key={id} type="button" size="sm" variant={theme === id ? "secondary" : "ghost"} aria-pressed={theme === id}
                    onClick={() => setTheme(id)} className="min-h-9 gap-1.5 rounded-xl px-2.5 text-xs">
                    <span className="size-3 rounded-full border border-foreground/15" style={{ backgroundColor: color }} />
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1 rounded-xl border p-0.5" role="group" aria-label="Card format">
                {(["story", "square"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={format === value} onClick={() => setFormat(value)}
                    className={cn("min-h-8 rounded-lg px-2.5 text-xs font-semibold", format === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                    {value === "story" ? "Story 9:16" : "Post 1:1"}
                  </button>
                ))}
              </div>
            </div>
            <GroupSharePreview artwork={artwork} caption={caption} />
          </TabsContent>
          <TabsContent value="link" className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-share-link">Public group link</Label>
              <div className="flex gap-2">
                <Input id="group-share-link" value={link} readOnly className="min-w-0 rounded-xl" />
                <Button type="button" variant="outline" onClick={() => void copy("link")} className="shrink-0 gap-2 rounded-xl">
                  {copied === "link" ? <Check size={16} /> : <Copy size={16} />} Copy
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Caption</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void copy("caption")} className="gap-1.5">
                  {copied === "caption" ? <Check size={15} /> : <Copy size={15} />} Copy text
                </Button>
              </div>
              <p className="whitespace-pre-wrap break-words rounded-xl border bg-muted/35 p-3 text-sm">{caption}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {shareLinks.map(([label, href]) => (
                <Button key={label} asChild variant="outline" className="min-w-0 gap-1.5 rounded-xl px-2 text-xs sm:text-sm">
                  <a href={href} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={13} aria-hidden="true" /></a>
                </Button>
              ))}
            </div>
            {typeof navigator.share === "function" && (
              <Button type="button" variant="outline" onClick={() => void shareText()} className="w-full gap-2 rounded-xl">
                <Share2 size={16} aria-hidden="true" /> Share link
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
