import { useRef, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  Download,
  ExternalLink,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { getCategoryLabel } from "@/services/supabase/groupEnhancementService";
import { GroupJoinService } from "@/services/supabase/groupJoinService";
import { cn } from "@/lib/utils";

export interface ShareGroupButtonProps {
  groupId: string;
  groupName: string;
  groupDescription: string;
  category?: string | null;
  targetAmount?: number | null;
  currentAmount?: number | null;
  frequency?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  memberCount?: number | null;
  enableVotingRights?: boolean | null;
}

type PosterTheme = "emerald" | "mint" | "obsidian";
type PosterFormat = "story" | "square";

const POSTER_THEMES: Record<
  PosterTheme,
  {
    label: string;
    swatch: string;
    canvasBg: string;
    cardStyle: string;
    accentPill: string;
    progressTrack: string;
    progressFill: string;
    subtext: string;
    heading: string;
    bankBox: string;
    footerBg: string;
    footerText: string;
  }
> = {
  emerald: {
    label: "Emerald Blueprint",
    swatch: "bg-[#075847]",
    canvasBg: "#063b32",
    cardStyle:
      "background: radial-gradient(circle at 88% 12%, rgba(219,245,180,0.22) 0%, transparent 45%), linear-gradient(155deg, #075847 0%, #06382e 55%, #04241e 100%); color: #ffffff;",
    accentPill: "bg-[#dbf5b4] text-[#0c3027]",
    progressTrack: "bg-white/15",
    progressFill: "bg-[#dbf5b4]",
    subtext: "text-[#c5e5d5]",
    heading: "text-white",
    bankBox: "border-white/15 bg-white/[0.09] text-white",
    footerBg: "bg-[#041f1a]/90 border-t border-white/12",
    footerText: "text-[#dbf5b4]",
  },
  mint: {
    label: "Daylight Mint",
    swatch: "bg-[#dbf5b4]",
    canvasBg: "#edf8f1",
    cardStyle:
      "background: radial-gradient(circle at 90% 10%, rgba(16,120,88,0.12) 0%, transparent 45%), linear-gradient(160deg, #f5fcf7 0%, #e5f5eb 100%); color: #0b2d23;",
    accentPill: "bg-[#075847] text-[#dbf5b4]",
    progressTrack: "bg-[#075847]/15",
    progressFill: "bg-[#075847]",
    subtext: "text-[#355d4e]",
    heading: "text-[#092920]",
    bankBox: "border-[#075847]/18 bg-white/85 text-[#092920]",
    footerBg: "bg-[#075847] border-t border-[#075847]",
    footerText: "text-[#dbf5b4]",
  },
  obsidian: {
    label: "Obsidian Vault",
    swatch: "bg-[#0f1a17]",
    canvasBg: "#0c1412",
    cardStyle:
      "background: radial-gradient(circle at 18% 12%, rgba(38,173,106,0.28) 0%, transparent 48%), linear-gradient(160deg, #101b18 0%, #09100e 100%); color: #ffffff;",
    accentPill: "bg-[#26ad6a] text-white",
    progressTrack: "bg-white/12",
    progressFill: "bg-[#d6f786]",
    subtext: "text-[#a9c2b8]",
    heading: "text-white",
    bankBox: "border-emerald-400/20 bg-white/[0.06] text-white",
    footerBg: "bg-black/45 border-t border-white/10",
    footerText: "text-[#d6f786]",
  },
};

export function ShareGroupButton({
  groupId,
  groupName,
  groupDescription,
  category,
  targetAmount,
  currentAmount,
  frequency,
  accountNumber,
  bankName,
  accountName,
  memberCount,
  enableVotingRights = true,
}: ShareGroupButtonProps) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [theme, setTheme] = useState<PosterTheme>("emerald");
  const [formatMode, setFormatMode] = useState<PosterFormat>("story");
  const [isExporting, setIsExporting] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const shareLink = GroupJoinService.generateShareLink(groupId);
  const displayUrl = "collectipay.com.ng";
  const shortJoinPath = `collectipay.com.ng/join/${groupId.slice(0, 8)}…`;
  const raised = Number(currentAmount || 0);
  const target = Number(targetAmount || 0);
  const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

  const viralShareMessage = [
    `Support "${groupName}" on CollectiPay!`,
    groupDescription ? `\n${groupDescription.slice(0, 140)}${groupDescription.length > 140 ? "…" : ""}` : "",
    target > 0 ? `\nProgress: ₦${raised.toLocaleString("en-NG")} raised of ₦${target.toLocaleString("en-NG")} (${pct}%)` : "",
    accountNumber ? `\nDirect Transfer: ${accountNumber} (${bankName || "Virtual Bank"} — ${accountName || groupName})` : "",
    `\nJoin & contribute transparently:\n${shareLink}`,
    `\nPowered by CollectiPay · https://${displayUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const copyText = async (value: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(viralShareMessage)}`, "_blank", "noopener,noreferrer");
  };

  const shareToX = () => {
    const xText = `Support "${groupName}" on CollectiPay${target > 0 ? ` (${pct}% of ₦${target.toLocaleString("en-NG")} funded)` : ""}. Transparent group pooling with democratic voting.`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(shareLink)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}&quote=${encodeURIComponent(viralShareMessage)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const shareNativeText = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Support ${groupName} on CollectiPay`,
          text: viralShareMessage,
          url: shareLink,
        });
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          toast.error("Could not open system share");
        }
      }
    } else {
      copyText(shareLink, "link", "Group link");
    }
  };

  const renderPosterBlob = async (): Promise<Blob | null> => {
    const poster = posterRef.current;
    if (!poster) return null;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(poster, {
      scale: 3,
      backgroundColor: POSTER_THEMES[theme].canvasBg,
      useCORS: true,
      logging: false,
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  };

  const handleDownloadPoster = async () => {
    setIsExporting(true);
    try {
      const blob = await renderPosterBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `collectipay-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${formatMode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("HD Story poster saved! Ready to upload to WhatsApp Status.");
    } catch (error) {
      console.error("Poster export error:", error);
      toast.error("Could not export poster image");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareStoryToWhatsApp = async () => {
    setIsExporting(true);
    try {
      const blob = await renderPosterBlob();
      if (blob) {
        const file = new File(
          [blob],
          `collectipay-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-story.png`,
          { type: "image/png" }
        );
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${groupName} on CollectiPay`,
            text: viralShareMessage,
            files: [file],
          });
          toast.success("Story card shared!");
          return;
        }
      }
      // Desktop fallback: download poster + open WhatsApp with prefilled text
      await handleDownloadPoster();
      shareToWhatsApp();
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast.error("Could not share poster image");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const themeCfg = POSTER_THEMES[theme];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl font-semibold">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share &amp; Story Card</span>
          <span className="sm:hidden">Share</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-1.25rem)] max-h-[92dvh] max-w-xl overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-[#075847] to-[#063b32] px-5 py-4 text-left text-white">
          <div className="flex items-center gap-2.5">
            <CollectiPayMark size={26} />
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Share &amp; Promote Pool
              </DialogTitle>
              <DialogDescription className="text-xs text-[#cde9db]">
                Invite contributors on WhatsApp, X, Facebook, or post a branded WhatsApp Story card.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5">
          <Tabs defaultValue="story" className="w-full">
            <TabsList className="app-segmented mb-5 grid w-full grid-cols-2 bg-muted/60 p-1">
              <TabsTrigger value="story" className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                <span>WhatsApp Story Card</span>
              </TabsTrigger>
              <TabsTrigger value="social" className="gap-1.5">
                <Share2 className="h-4 w-4" />
                <span>Social &amp; Link</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: VIRAL WHATSAPP STATUS / STORY POSTER STUDIO */}
            <TabsContent value="story" className="space-y-4">
              {/* Theme & Ratio Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5" role="group" aria-label="Poster theme">
                  {(Object.keys(POSTER_THEMES) as PosterTheme[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTheme(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                        theme === key
                          ? "border-primary bg-accent text-primary shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <span className={cn("h-3 w-3 rounded-full border border-black/15", POSTER_THEMES[key].swatch)} />
                      {POSTER_THEMES[key].label.split(" ")[0]}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs font-semibold">
                  {(
                    [
                      { id: "story", label: "9:16 Story" },
                      { id: "square", label: "1:1 Post" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormatMode(f.id)}
                      className={cn(
                        "rounded-full px-2.5 py-1 transition-all",
                        formatMode === f.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exportable Branded Campaign Card */}
              <div className="flex justify-center">
                <div
                  ref={posterRef}
                  style={{
                    background:
                      theme === "emerald"
                        ? "radial-gradient(circle at 88% 12%, rgba(219,245,180,0.22) 0%, transparent 45%), linear-gradient(155deg, #075847 0%, #06382e 55%, #04241e 100%)"
                        : theme === "mint"
                        ? "radial-gradient(circle at 90% 10%, rgba(16,120,88,0.12) 0%, transparent 45%), linear-gradient(160deg, #f5fcf7 0%, #e5f5eb 100%)"
                        : "radial-gradient(circle at 18% 12%, rgba(38,173,106,0.28) 0%, transparent 48%), linear-gradient(160deg, #101b18 0%, #09100e 100%)",
                  }}
                  className={cn(
                    "relative flex w-full flex-col justify-between overflow-hidden rounded-[1.5rem] border border-black/10 shadow-xl",
                    formatMode === "story" ? "max-w-[20.5rem] min-h-[31rem]" : "max-w-[24rem] min-h-[24rem]"
                  )}
                >
                  {/* Top CollectiPay Brand Header */}
                  <div className="flex items-center justify-between gap-2 px-5 pt-5">
                    <div className="flex items-center gap-2">
                      <CollectiPayMark size={28} />
                      <div>
                        <span className={cn("block text-sm font-extrabold leading-none tracking-tight", themeCfg.heading)}>
                          CollectiPay
                        </span>
                        <span className={cn("block text-[10px] font-semibold tracking-wider uppercase", themeCfg.subtext)}>
                          Group Crowdfunding
                        </span>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider", themeCfg.accentPill)}>
                      <ShieldCheck className="h-3 w-3" />
                      Verified Pool
                    </span>
                  </div>

                  {/* Center Campaign Story Block */}
                  <div className="space-y-4 px-5 py-5">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-current/15 bg-black/5 px-2.5 py-1 text-[11px] font-semibold">
                      <CategoryIcon category={category || "community"} size={13} />
                      <span className={themeCfg.heading}>{getCategoryLabel(category || "community")}</span>
                      {frequency && (
                        <>
                          <span className={themeCfg.subtext}>·</span>
                          <span className={cn("capitalize", themeCfg.subtext)}>{frequency}</span>
                        </>
                      )}
                    </div>

                    <div>
                      <p className={cn("text-[11px] font-bold uppercase tracking-[0.14em]", themeCfg.subtext)}>
                        Support Our Shared Goal
                      </p>
                      <h3 className={cn("mt-1 text-2xl font-extrabold leading-tight tracking-tight", themeCfg.heading)}>
                        {groupName}
                      </h3>
                      {groupDescription && (
                        <p className={cn("mt-1.5 line-clamp-2 text-xs leading-relaxed", themeCfg.subtext)}>
                          {groupDescription}
                        </p>
                      )}
                    </div>

                    {/* Progress Card */}
                    {target > 0 && (
                      <div className={cn("rounded-2xl border p-3.5", themeCfg.bankBox)}>
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <span className={cn("block text-[10px] font-semibold uppercase tracking-wider", themeCfg.subtext)}>
                              Amount Pooled
                            </span>
                            <span className={cn("text-xl font-extrabold tabular-nums", themeCfg.heading)}>
                              ₦{raised.toLocaleString("en-NG")}
                            </span>
                          </div>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums", themeCfg.accentPill)}>
                            {pct}%
                          </span>
                        </div>
                        <div className={cn("mt-2.5 h-2 w-full overflow-hidden rounded-full", themeCfg.progressTrack)}>
                          <div
                            className={cn("h-full rounded-full", themeCfg.progressFill)}
                            style={{ width: `${Math.max(pct, 6)}%` }}
                          />
                        </div>
                        <div className={cn("mt-1.5 flex items-center justify-between text-[11px] font-medium tabular-nums", themeCfg.subtext)}>
                          <span>Goal: ₦{target.toLocaleString("en-NG")}</span>
                          {typeof memberCount === "number" && memberCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" /> {memberCount} backers
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Direct Transfer Details OR Democratic Trust Strip */}
                    {accountNumber ? (
                      <div className={cn("rounded-2xl border p-3.5", themeCfg.bankBox)}>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
                          <Building2 className="h-3.5 w-3.5" />
                          Transfer Directly to Pool Account
                        </div>
                        <p className={cn("mt-1 font-mono text-xl font-extrabold tracking-[0.08em] tabular-nums", themeCfg.heading)}>
                          {accountNumber}
                        </p>
                        <p className={cn("mt-0.5 truncate text-xs font-semibold", themeCfg.subtext)}>
                          {bankName || "Virtual Bank"} · {accountName || groupName}
                        </p>
                      </div>
                    ) : (
                      <div className={cn("flex items-center gap-2.5 rounded-2xl border p-3 text-xs", themeCfg.bankBox)}>
                        <Vote className="h-4 w-4 shrink-0" />
                        <span>
                          {enableVotingRights
                            ? "Transparent pool — contributors vote before any payout is released."
                            : "Verified CollectiPay pool with instant digital contribution receipts."}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Viral Free-Advertisement Footer Band */}
                  <div className={cn("px-5 py-3.5", themeCfg.footerBg)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("text-xs font-extrabold tracking-tight", themeCfg.footerText)}>
                          Contribute at {displayUrl}
                        </p>
                        <p className="truncate font-mono text-[10px] text-white/75">
                          {shortJoinPath}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white">
                        Save &amp; Vote Together
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Story Export & Direct WhatsApp Share Buttons */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={handleShareStoryToWhatsApp}
                  disabled={isExporting}
                  className="h-12 gap-2 rounded-xl bg-[#25D366] font-bold text-white hover:bg-[#1fb858]"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  {isExporting ? "Rendering HD Card…" : "Post to WhatsApp Story"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPoster}
                  disabled={isExporting}
                  className="h-12 gap-2 rounded-xl font-semibold"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Exporting…" : "Save HD Poster (PNG)"}
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: DIRECT SOCIAL CHANNELS & CAMPAIGN LINK */}
            <TabsContent value="social" className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Public Join &amp; Contribution Link
                </Label>
                <div className="flex gap-2">
                  <Input value={shareLink} readOnly className="h-11 flex-1 rounded-xl font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyText(shareLink, "link", "Join link")}
                    className="h-11 gap-1.5 rounded-xl px-4 font-semibold"
                  >
                    {copiedKey === "link" ? (
                      <>
                        <Check className="h-4 w-4 text-primary" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Share Directly To
                </Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={shareToWhatsApp}
                    className="cp-pressable flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#1fb858]"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={shareToX}
                    className="cp-pressable flex items-center justify-center gap-2 rounded-2xl bg-[#0f1419] px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-black"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Post on X
                  </button>

                  <button
                    type="button"
                    onClick={shareToFacebook}
                    className="cp-pressable flex items-center justify-center gap-2 rounded-2xl bg-[#1877F2] px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#1565d8]"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </button>
                </div>
              </div>

              {/* Pre-written Campaign Message Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ready-to-Send Campaign Caption
                  </Label>
                  <button
                    type="button"
                    onClick={() => copyText(viralShareMessage, "caption", "Campaign caption")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    {copiedKey === "caption" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === "caption" ? "Copied" : "Copy text"}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap rounded-2xl border bg-muted/40 p-3.5 font-sans text-xs leading-relaxed text-foreground">
                  {viralShareMessage}
                </pre>
              </div>

              {typeof navigator !== "undefined" && Boolean(navigator.share) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={shareNativeText}
                  className="h-11 w-full gap-2 rounded-xl font-semibold"
                >
                  <ExternalLink className="h-4 w-4" />
                  More Share Options
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
