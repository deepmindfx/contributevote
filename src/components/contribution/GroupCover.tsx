import type { ComponentProps, ReactNode } from "react";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { cn } from "@/lib/utils";
import { useGroupCoverUrl } from "@/hooks/useGroupCoverUrl";

export function GroupCoverImage({ reference, ...imageProps }: Omit<ComponentProps<"img">, "src"> & { reference: string }) {
  const url = useGroupCoverUrl(reference);
  return url ? <img {...imageProps} key={url} src={url} /> : null;
}

export function GroupCover({ url, name, category, className, children }: {
  url?: string | null;
  name: string;
  category?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const imageUrl = useGroupCoverUrl(url);
  return (
    <div className={cn("relative isolate aspect-[16/9] overflow-hidden bg-[#103d34]", className)}>
      <div aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[repeating-radial-gradient(ellipse_at_64%_50%,#b7ecd324_0_1px,transparent_1px_27px)] text-[#dbf5b4]">
        <span className="grid size-14 place-items-center rounded-full border border-white/20 bg-[#133f34] shadow-lg"><CategoryIcon category={category} size={25} strokeWidth={1.5} /></span>
      </div>
      {imageUrl && <img key={imageUrl} src={imageUrl} alt={`${name} cover`} onError={(event) => { event.currentTarget.hidden = true; }} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
      <span className="absolute bottom-2.5 left-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/20 bg-[#082b24]/90 px-2 py-1 text-[10px] font-semibold leading-tight text-white shadow-sm backdrop-blur-sm sm:bottom-3 sm:left-3 sm:text-xs">
        <CollectiPayMark size={17} /> Created with CollectiPay
      </span>
      {children && <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3">{children}</div>}
    </div>
  );
}
