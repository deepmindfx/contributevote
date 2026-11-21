import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Invitation = Database["public"]["Tables"]["group_invitations"]["Row"];
type Group = Database["public"]["Tables"]["contribution_groups"]["Row"];

export type InvitationPreview = {
  group_id: string;
  status: "pending" | "accepted";
  group: Pick<Group, "name" | "description" | "target_amount" | "frequency" | "privacy" | "contribution_amount" | "end_date" | "enable_voting_rights">;
  inviter: { name: string };
};

type InvitationResult = {
  success?: boolean;
  error?: string;
  token?: string;
  group_id?: string;
  invitation?: InvitationPreview;
};

export function invitationUrl(token: string) {
  return `${window.location.origin}/invite/${encodeURIComponent(token)}`;
}

export const InvitationService = {
  async sendInvitation(groupId: string, email: string) {
    const { data, error } = await supabase.rpc("create_group_invitation", { p_group_id: groupId, p_email: email });
    if (error) throw error;
    const result = data as InvitationResult | null;
    if (!result?.success || !result.token) throw new Error(result?.error || "Couldn’t create the invitation.");
    return invitationUrl(result.token);
  },

  async getInvitationByToken(token: string) {
    const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });
    if (error) throw error;
    const result = data as InvitationResult | null;
    if (!result?.success || !result.invitation) throw new Error(result?.error || "Invitation unavailable.");
    return result.invitation;
  },

  async acceptInvitation(token: string) {
    const { data, error } = await supabase.rpc("accept_group_invitation", { p_token: token });
    if (error) throw error;
    const result = data as InvitationResult | null;
    if (!result?.success || !result.group_id) throw new Error(result?.error || "Couldn’t accept the invitation.");
    return result.group_id;
  },

  async getGroupInvitations(groupId: string) {
    const { data, error } = await supabase
      .from("group_invitations")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getInvitationLinkById(invitationId: string) {
    const { data, error } = await supabase.from("group_invitations").select("token").eq("id", invitationId).maybeSingle();
    if (error || !data) return null;
    return invitationUrl(data.token);
  },

  async cancelInvitation(invitationId: string) {
    const { data, error } = await supabase.rpc("revoke_group_invitation", { p_invitation_id: invitationId });
    if (error || !data) throw new Error("Couldn’t revoke the invitation.");
  },
};
