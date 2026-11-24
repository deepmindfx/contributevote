import { useRef, useState } from "react";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { screens } from "@/routeScreens";

export default function StaffEntry() {
  const [revealed, setRevealed] = useState(false);
  const gesture = useRef({ count: 0, last: 0 });

  if (revealed) return <screens.adminAuth />;

  const activate = () => {
    const now = performance.now();
    const count = now - gesture.current.last <= 1800 ? gesture.current.count + 1 : 1;
    gesture.current = { count, last: now };
    if (count === 3) setRevealed(true);
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-background">
      <button type="button" onClick={activate} aria-label="CollectiPay"
        className="grid size-14 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <CollectiPayMark size={32} />
      </button>
    </main>
  );
}
