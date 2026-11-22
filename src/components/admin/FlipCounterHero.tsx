import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Radio, ShieldCheck, Layers, Wallet, Globe2 } from "lucide-react";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FlipDigitProps {
  char: string;
  size?: "hero" | "fullscreen";
  delayMs?: number;
}

const FlipDigit: React.FC<FlipDigitProps> = ({ char, size = "hero", delayMs = 0 }) => {
  const [current, setCurrent] = useState(char);
  const [previous, setPrevious] = useState(char);
  const [flipping, setFlipping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (char !== current) {
      setPrevious(current);
      const start = setTimeout(() => {
        setCurrent(char);
        setFlipping(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setPrevious(char);
          setFlipping(false);
        }, 560);
      }, delayMs);

      return () => clearTimeout(start);
    }
  }, [char, current, delayMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (char === ",") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "select-none self-end font-black text-[#dbf5b4]/85",
          size === "fullscreen"
            ? "mx-1 pb-3 text-5xl sm:text-7xl"
            : "mx-0.5 pb-1.5 text-3xl sm:text-5xl"
        )}
      >
        ,
      </span>
    );
  }

  return (
    <div
      className={cn(
        "cp-flip-unit relative select-none font-mono font-black tabular-nums",
        size === "fullscreen"
          ? "h-24 w-16 text-6xl sm:h-36 sm:w-24 sm:text-8xl md:h-44 md:w-32 md:text-[7rem]"
          : "h-16 w-11 text-4xl sm:h-24 sm:w-16 sm:text-6xl md:h-28 md:w-20 md:text-7xl"
      )}
    >
      {/* Static Top Half (New Digit) */}
      <div className="cp-flip-half cp-flip-top">
        <span>{current}</span>
      </div>

      {/* Static Bottom Half (Old Digit while flipping, else New Digit) */}
      <div className="cp-flip-half cp-flip-bottom">
        <span>{flipping ? previous : current}</span>
      </div>

      {/* Animated Top Flap folding down (Old Digit) */}
      {flipping && (
        <div className="cp-flip-half cp-flip-top cp-flip-flap-top">
          <span>{previous}</span>
        </div>
      )}

      {/* Animated Bottom Flap unfolding down (New Digit) */}
      {flipping && (
        <div className="cp-flip-half cp-flip-bottom cp-flip-flap-bottom">
          <span>{current}</span>
        </div>
      )}

      {/* Mechanical Center Split Crease & Pin Notches */}
      <div className="cp-flip-crease" aria-hidden="true" />
      <span className="cp-flip-notch cp-flip-notch-l" aria-hidden="true" />
      <span className="cp-flip-notch cp-flip-notch-r" aria-hidden="true" />
    </div>
  );
};

interface FlipCounterHeroProps {
  userCount: number;
  bvnVerifiedCount: number;
  groupCount: number;
  totalLiquidity: number;
  externalPaymentsCount: number;
}

export const FlipCounterHero: React.FC<FlipCounterHeroProps> = ({
  userCount,
  bvnVerifiedCount,
  groupCount,
  totalLiquidity,
  externalPaymentsCount,
}) => {
  const [displayCount, setDisplayCount] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Trigger dramatic mechanical flip-up when real user count loads or increments
  useEffect(() => {
    const t = setTimeout(() => {
      setDisplayCount(Math.max(0, Math.floor(userCount)));
    }, 180);
    return () => clearTimeout(t);
  }, [userCount]);

  const paddedRaw = String(displayCount).padStart(Math.max(5, String(displayCount).length), "0");
  const formattedChars = paddedRaw
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    .split("");

  const renderBoard = (mode: "hero" | "fullscreen") => (
    <div
      className={cn(
        "relative overflow-hidden border text-white",
        mode === "fullscreen"
          ? "flex min-h-dvh w-full flex-col items-center justify-center border-none bg-[#041b16] p-6 sm:p-12"
          : "rounded-[1.6rem] border-[#1f5947]/60 bg-gradient-to-br from-[#06241d] via-[#082f25] to-[#041814] p-5 shadow-xl sm:p-7"
      )}
    >
      {/* Subtle architectural concentric ring glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#26ad6a]/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#dbf5b4]/10 blur-3xl"
      />

      {/* Top Row */}
      <div
        className={cn(
          "relative z-10 flex w-full flex-wrap items-center justify-between gap-3",
          mode === "fullscreen" && "max-w-5xl"
        )}
      >
        <div className="flex items-center gap-3">
          <CollectiPayMark size={mode === "fullscreen" ? 42 : 30} />
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#dbf5b4]">
                <Radio className="h-3 w-3 animate-pulse text-[#dbf5b4]" />
                Live Growth Board
              </span>
              <span className="hidden text-xs font-medium text-[#9cc6b4] sm:inline">
                collectipay.com.ng
              </span>
            </div>
            <h2
              className={cn(
                "mt-1 font-extrabold tracking-tight text-white",
                mode === "fullscreen" ? "text-2xl sm:text-3xl" : "text-base sm:text-lg"
              )}
            >
              Total Registered CollectiPay Users
            </h2>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setFullscreen((v) => !v)}
          className="h-9 gap-1.5 rounded-xl border border-white/15 bg-white/10 text-xs font-semibold text-white hover:bg-white/20 hover:text-white"
        >
          {fullscreen ? (
            <>
              <Minimize2 className="h-3.5 w-3.5" /> Exit Display
            </>
          ) : (
            <>
              <Maximize2 className="h-3.5 w-3.5" /> Big Screen Display
            </>
          )}
        </Button>
      </div>

      {/* Mechanical Split-Flap Counter Display */}
      <div
        className={cn(
          "relative z-10 flex w-full flex-col items-center justify-center",
          mode === "fullscreen" ? "my-12" : "my-6"
        )}
      >
        <div
          className="inline-flex items-center gap-1.5 rounded-[1.4rem] border border-white/12 bg-black/45 p-3 shadow-[inset_0_2px_18px_rgba(0,0,0,0.7)] sm:gap-2.5 sm:p-4"
          aria-label={`${userCount.toLocaleString()} registered users`}
        >
          {formattedChars.map((ch, i) => (
            <FlipDigit
              key={`${i}-${formattedChars.length}`}
              char={ch}
              size={mode}
              delayMs={i * 55}
            />
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#b4dcc9]">
          Verified Community Members · Auto-Flipping Live
        </p>
      </div>

      {/* Bottom Live Milestone Ticker */}
      <div
        className={cn(
          "relative z-10 grid w-full grid-cols-2 gap-2.5 border-t border-white/12 pt-4 sm:grid-cols-4",
          mode === "fullscreen" && "max-w-5xl"
        )}
      >
        <div className="rounded-xl bg-white/[0.06] px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#a8d1be]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#dbf5b4]" /> BVN Verified
          </span>
          <span className="mt-0.5 block text-lg font-extrabold tabular-nums text-white">
            {bvnVerifiedCount.toLocaleString()}
          </span>
        </div>
        <div className="rounded-xl bg-white/[0.06] px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#a8d1be]">
            <Layers className="h-3.5 w-3.5 text-[#dbf5b4]" /> Active Pools
          </span>
          <span className="mt-0.5 block text-lg font-extrabold tabular-nums text-white">
            {groupCount.toLocaleString()}
          </span>
        </div>
        <div className="rounded-xl bg-white/[0.06] px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#a8d1be]">
            <Wallet className="h-3.5 w-3.5 text-[#dbf5b4]" /> Group Liquidity
          </span>
          <span className="mt-0.5 block truncate text-lg font-extrabold tabular-nums text-[#dbf5b4]">
            ₦{totalLiquidity.toLocaleString("en-NG")}
          </span>
        </div>
        <div className="rounded-xl bg-white/[0.06] px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#a8d1be]">
            <Globe2 className="h-3.5 w-3.5 text-[#dbf5b4]" /> Outside Payments
          </span>
          <span className="mt-0.5 block text-lg font-extrabold tabular-nums text-white">
            {externalPaymentsCount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderBoard("hero")}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-[#041b16]"
          role="dialog"
          aria-modal="true"
          aria-label="Live CollectiPay User Counter Display"
        >
          {renderBoard("fullscreen")}
        </div>
      )}
    </>
  );
};
