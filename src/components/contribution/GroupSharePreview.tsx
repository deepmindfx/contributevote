import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { renderGroupShareImage } from "./groupShareImage";
import type { GroupShareArtwork } from "./groupShareImage";

type ShareImage = Awaited<ReturnType<typeof renderGroupShareImage>>;

export function GroupSharePreview({ artwork, caption }: { artwork: GroupShareArtwork; caption: string }) {
  const [revision, retry] = useState(0);
  const [result, setResult] = useState<{ artwork: GroupShareArtwork; revision: number; image: ShareImage | null }>();
  const displayRef = useRef<HTMLCanvasElement>(null);
  const current = result?.artwork === artwork && result.revision === revision ? result : undefined;
  const image = current?.image;

  useEffect(() => {
    let active = true;
    void renderGroupShareImage(artwork).then(
      (image) => { if (active) setResult({ artwork, revision, image }); },
      () => { if (active) setResult({ artwork, revision, image: null }); },
    );
    return () => { active = false; };
  }, [artwork, revision]);

  useEffect(() => {
    if (!image || !displayRef.current) return;
    const preview = displayRef.current;
    preview.width = 540;
    preview.height = image.canvas.height / 2;
    preview.getContext("2d")?.drawImage(image.canvas, 0, 0, preview.width, preview.height);
  }, [image]);

  const save = () => {
    if (!image) return;
    const url = URL.createObjectURL(image.file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = image.file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    toast.success("Card image saved");
  };

  const share = async () => {
    if (!image) return;
    const files = [image.file];
    if (!navigator.share || !navigator.canShare?.({ files })) {
      save();
      return;
    }
    try {
      await navigator.share({ files, title: artwork.name, text: caption });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      save();
    }
  };

  return (
    <div className="grid gap-4">
      {image ? (
        <canvas ref={displayRef} className="mx-auto max-h-[48dvh] max-w-full rounded-2xl border object-contain shadow-sm" role="img" aria-label={`Share card for ${artwork.name}`} />
      ) : (
        <div className="grid min-h-40 place-items-center gap-2 rounded-2xl border bg-muted/35 p-5 text-center text-sm text-muted-foreground" role="status">
          {current ? <><p>Couldn’t render the card.</p><Button type="button" variant="outline" onClick={() => retry((value) => value + 1)}>Try again</Button></> : "Preparing your card…"}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={save} disabled={!image} className="h-11 gap-2 rounded-xl px-2">
          <Download size={16} aria-hidden="true" /> Save PNG
        </Button>
        <Button type="button" onClick={() => void share()} disabled={!image} className="h-11 gap-2 rounded-xl px-2">
          <Share2 size={16} aria-hidden="true" /> Share image
        </Button>
      </div>
    </div>
  );
}
