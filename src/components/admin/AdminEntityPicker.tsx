import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSearch } from "./AdminRecordPage";

export type AdminEntity = { id: string; name: string; description: string | null };

export function AdminEntityPicker({ scope, label, value, onChange, disabled }: {
  scope: "account" | "group";
  label: string;
  value: AdminEntity | null;
  onChange: (entity: AdminEntity | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const { user, isAdmin } = useSupabaseUser();
  const [draft, setDraft] = useState("");
  const search = useAdminSearch(draft);
  const results = useQuery({
    queryKey: ["admin-entity-picker", user?.id, scope, search],
    enabled: Boolean(isAdmin && user?.id && !value && search.length >= 3),
    retry: false,
    gcTime: 45_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_search_transaction_entities", { p_scope: scope, p_search: search }).abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });

  if (value) return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 p-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{value.name}</p>
          {value.description && <p className="break-all text-xs text-muted-foreground">{value.description}</p>}
        </div>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => { setDraft(""); onChange(null); }}>Change</Button>
      </div>
    </div>
  );

  const searching = draft.trim().length >= 3;
  const ready = search === draft.trim();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id={id} className="pl-9" value={draft} onChange={event => setDraft(event.target.value)} disabled={disabled}
          type="search" autoComplete="off" maxLength={120} placeholder={scope === "account" ? "Name, email, phone, or account ID" : "Group name or ID"} />
      </div>
      {!searching && <p className="text-xs text-muted-foreground">Enter at least three characters to search.</p>}
      {searching && (!ready || results.isPending) && <p role="status" className="text-xs text-muted-foreground">Searching…</p>}
      {searching && ready && results.isError && <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
        Search failed. <Button type="button" size="sm" variant="outline" onClick={() => void results.refetch()}>Retry</Button>
      </div>}
      {searching && ready && results.data?.length === 0 && <p role="status" className="text-xs text-muted-foreground">No matching {scope === "account" ? "accounts" : "groups"}.</p>}
      {searching && ready && Boolean(results.data?.length) && <ul className="max-h-44 divide-y overflow-y-auto rounded-xl border">
        {results.data?.map(item => <li key={item.id}>
          <button type="button" className="w-full rounded-sm px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => onChange(item)} disabled={disabled}>
            <span className="block break-words text-sm font-semibold">{item.name}</span>
            {item.description && <span className="block break-all text-xs text-muted-foreground">{item.description}</span>}
          </button>
        </li>)}
      </ul>}
      {searching && ready && results.data?.length === 25 && <p className="text-xs text-muted-foreground">Showing 25 matches. Enter more details to narrow the search.</p>}
    </div>
  );
}
