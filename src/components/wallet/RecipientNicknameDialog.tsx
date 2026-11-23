import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RecipientNicknameDialogProps {
  accountName: string;
  initialNickname?: string;
  onClose: () => void;
  onSave: (nickname: string) => Promise<void>;
}

export function RecipientNicknameDialog({ accountName, initialNickname, onClose, onSave }: RecipientNicknameDialogProps) {
  const inputId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const submitting = useRef(false);
  const [nickname, setNickname] = useState(initialNickname || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    if (!panel) return;
    const viewport = window.visualViewport;
    const update = () => {
      // Fixed elements stay attached to the layout viewport on mobile Chrome and Safari.
      // Keep the editor centered in the part of the screen the keyboard leaves visible.
      panel.style.setProperty("--nickname-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      panel.style.setProperty("--nickname-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [panel]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(nickname.trim());
      onClose();
    } catch {
      setError("Couldn’t save the nickname. Try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting.current) onClose(); }}>
      <DialogContent
        ref={setPanel}
        className="bottom-auto w-[calc(100%-1.5rem)] max-w-sm -translate-y-1/2 rounded-2xl p-4 sm:inset-x-0 sm:left-0 sm:mx-auto sm:max-w-sm sm:translate-x-0 sm:p-5"
        style={{
          animation: "none",
          top: "calc(var(--nickname-viewport-top, 0px) + var(--nickname-viewport-height, 100dvh) / 2)",
          maxHeight: "calc(var(--nickname-viewport-height, 100dvh) - 1.5rem)",
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const previous = document.activeElement;
          if (panel?.contains(previous)) return;
          returnFocus.current = previous instanceof HTMLElement ? previous : null;
          heading.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
        }}
      >
        <DialogHeader>
          <DialogTitle ref={heading} tabIndex={-1} className="outline-none">
            {initialNickname ? "Edit nickname" : "Save nickname"}
          </DialogTitle>
          <DialogDescription className="break-words">{accountName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={inputId}>Nickname</Label>
            <Input
              id={inputId}
              value={nickname}
              maxLength={40}
              placeholder="e.g. Mom or Rent"
              enterKeyHint="done"
              autoComplete="off"
              readOnly={saving}
              onChange={(event) => setNickname(event.target.value)}
              className="rounded-xl"
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" className="h-11 rounded-xl" disabled={saving}>{saving ? "Saving…" : "Save nickname"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
