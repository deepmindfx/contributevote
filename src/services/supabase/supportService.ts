import { supabase } from "@/integrations/supabase/client";

export const supportCategories = {
  general: "Account or other issue",
  transfer: "Bank transfer",
  bulk_transfer: "Bulk transfer",
  ice_vault: "Ice Vault",
  group_withdrawal: "Group payout",
  group_refund: "Group refund",
} as const;
export type SupportCategory = keyof typeof supportCategories;

export const supportStatuses = {
  open: "Open",
  in_review: "In review",
  waiting: "Waiting for reply",
  resolved: "Resolved",
} as const;
export type SupportStatus = keyof typeof supportStatuses;

export type SupportTicket = {
  id: string;
  category: SupportCategory;
  reference: string | null;
  subject: string;
  status: SupportStatus;
  revision: number;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
};

export type SupportMessage = {
  id: number;
  from_support: boolean;
  body: string;
  created_at: string;
};

export type SupportThread = SupportTicket & { messages: SupportMessage[] };
export const supportPageSize = 30;
export const isSupportCategory = (value: string | null): value is SupportCategory =>
  value !== null && Object.prototype.hasOwnProperty.call(supportCategories, value);
export const isTicketId = (value: string | null): value is string =>
  value !== null && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export const supportLink = (category: SupportCategory, reference: string) =>
  `/support?${new URLSearchParams({ new: "1", category, reference })}`;

export async function listSupportTickets(admin: boolean, filters: { status: SupportStatus | ""; category: SupportCategory | ""; search: string }, cursor: SupportTicket | null, signal: AbortSignal) {
  const { data, error } = await supabase.rpc("list_support_tickets", {
    p_admin: admin, p_status: filters.status || null, p_search: filters.search, p_category: filters.category || undefined,
    p_before: cursor?.created_at ?? null, p_before_id: cursor?.id ?? null,
  }).abortSignal(signal);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SupportTicket[];
}

export async function loadSupportTicket(id: string, admin: boolean, signal: AbortSignal, before?: number) {
  const { data, error } = await supabase.rpc("get_support_ticket", {
    p_ticket_id: id, p_admin: admin, p_before_message: before,
  }).abortSignal(signal);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This ticket is unavailable.");
  return data as unknown as SupportThread;
}

export async function createSupportTicket(input: { key: string; category: SupportCategory; reference: string; subject: string; body: string }) {
  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_client_id: input.key, p_category: input.category, p_reference: input.reference.trim(),
    p_subject: input.subject.trim(), p_body: input.body.trim(),
  });
  if (error || !data) throw new Error(error?.message ?? "Couldn’t open this ticket.");
  return data;
}

export async function replyToSupportTicket(id: string, admin: boolean, key: string, body: string) {
  const { error } = await supabase.rpc("reply_support_ticket", {
    p_ticket_id: id, p_admin: admin, p_client_id: key, p_body: body.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function updateSupportTickets(status: SupportStatus, tickets: SupportTicket[]) {
  const { data, error } = await supabase.rpc("admin_update_support_tickets", {
    p_status: status, p_tickets: tickets.map(({ id, revision }) => ({ id, revision })),
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}
