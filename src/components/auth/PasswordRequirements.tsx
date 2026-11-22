import { CheckCircle2 } from "lucide-react";
import { passwordIssue } from "@/lib/passwordPolicy";

export function PasswordRequirements({ id, password }: { id: string; password: string }) {
  const issue = passwordIssue(password);

  return (
    <p id={id} role="status" className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
      {!issue && <CheckCircle2 size={15} aria-hidden="true" className="shrink-0 text-primary" />}
      {issue ?? "Password accepted"}
    </p>
  );
}
