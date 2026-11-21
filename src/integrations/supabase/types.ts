export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contribution_groups: {
        Row: {
          account_details: Json | null
          account_name: string | null
          account_number: string | null
          account_reference: string | null
          archived: boolean | null
          archived_at: string | null
          archived_by: string | null
          bank_name: string | null
          category: string
          contribution_amount: number | null
          created_at: string | null
          creator_id: string | null
          current_amount: number | null
          description: string | null
          enable_voting_rights: boolean | null
          end_date: string | null
          frequency: string
          id: string
          name: string
          privacy: string | null
          start_date: string | null
          status: string | null
          target_amount: number
          updated_at: string | null
          voting_threshold: number | null
        }
        Insert: {
          account_details?: Json | null
          account_name?: string | null
          account_number?: string | null
          account_reference?: string | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          bank_name?: string | null
          category: string
          contribution_amount?: number | null
          created_at?: string | null
          creator_id?: string | null
          current_amount?: number | null
          description?: string | null
          enable_voting_rights?: boolean | null
          end_date?: string | null
          frequency: string
          id?: string
          name: string
          privacy?: string | null
          start_date?: string | null
          status?: string | null
          target_amount: number
          updated_at?: string | null
          voting_threshold?: number | null
        }
        Update: {
          account_details?: Json | null
          account_name?: string | null
          account_number?: string | null
          account_reference?: string | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          bank_name?: string | null
          category?: string
          contribution_amount?: number | null
          created_at?: string | null
          creator_id?: string | null
          current_amount?: number | null
          description?: string | null
          enable_voting_rights?: boolean | null
          end_date?: string | null
          frequency?: string
          id?: string
          name?: string
          privacy?: string | null
          start_date?: string | null
          status?: string | null
          target_amount?: number
          updated_at?: string | null
          voting_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_groups_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_groups_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contributors: {
        Row: {
          amount: number | null
          anonymous: boolean | null
          contribution_count: number
          created_at: string | null
          date: string | null
          group_id: string
          has_voting_rights: boolean | null
          id: string
          join_method: string | null
          joined_at: string | null
          last_contribution_at: string | null
          metadata: Json | null
          total_contributed: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          anonymous?: boolean | null
          contribution_count?: number
          created_at?: string | null
          date?: string | null
          group_id: string
          has_voting_rights?: boolean | null
          id?: string
          join_method?: string | null
          joined_at?: string | null
          last_contribution_at?: string | null
          metadata?: Json | null
          total_contributed?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          anonymous?: boolean | null
          contribution_count?: number
          created_at?: string | null
          date?: string | null
          group_id?: string
          has_voting_rights?: boolean | null
          id?: string
          join_method?: string | null
          joined_at?: string | null
          last_contribution_at?: string | null
          metadata?: Json | null
          total_contributed?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          expires_at: string
          group_id: string
          id: string
          invitee_email: string
          invitee_id: string | null
          inviter_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at: string
          group_id: string
          id?: string
          invitee_email: string
          invitee_id?: string | null
          inviter_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string
          group_id?: string
          id?: string
          invitee_email?: string
          invitee_id?: string | null
          inviter_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_refund_requests: {
        Row: {
          created_at: string | null
          executed_at: string | null
          execution_details: Json | null
          group_id: string | null
          id: string
          partial_percentage: number | null
          reason: string
          refund_type: string | null
          requester_id: string | null
          status: string | null
          total_eligible_voters: number | null
          total_votes_against: number | null
          total_votes_for: number | null
          updated_at: string | null
          votes: Json | null
          voting_deadline: string
        }
        Insert: {
          created_at?: string | null
          executed_at?: string | null
          execution_details?: Json | null
          group_id?: string | null
          id?: string
          partial_percentage?: number | null
          reason: string
          refund_type?: string | null
          requester_id?: string | null
          status?: string | null
          total_eligible_voters?: number | null
          total_votes_against?: number | null
          total_votes_for?: number | null
          updated_at?: string | null
          votes?: Json | null
          voting_deadline: string
        }
        Update: {
          created_at?: string | null
          executed_at?: string | null
          execution_details?: Json | null
          group_id?: string | null
          id?: string
          partial_percentage?: number | null
          reason?: string
          refund_type?: string | null
          requester_id?: string | null
          status?: string | null
          total_eligible_voters?: number | null
          total_votes_against?: number | null
          total_votes_for?: number | null
          updated_at?: string | null
          votes?: Json | null
          voting_deadline?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_refund_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_refund_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bvn: string | null
          created_at: string | null
          email: string | null
          groups_created_count: number | null
          groups_created_free_remaining: number | null
          id: string
          name: string | null
          phone: string | null
          preferences: Json | null
          role: string | null
          status: string | null
          updated_at: string | null
          wallet_balance: number | null
        }
        Insert: {
          bvn?: string | null
          created_at?: string | null
          email?: string | null
          groups_created_count?: number | null
          groups_created_free_remaining?: number | null
          id: string
          name?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          wallet_balance?: number | null
        }
        Update: {
          bvn?: string | null
          created_at?: string | null
          email?: string | null
          groups_created_count?: number | null
          groups_created_free_remaining?: number | null
          id?: string
          name?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          wallet_balance?: number | null
        }
        Relationships: []
      }
      recurring_contributions: {
        Row: {
          amount: number
          created_at: string | null
          end_date: string | null
          frequency: string
          group_id: string | null
          id: string
          is_active: boolean | null
          last_contribution_at: string | null
          metadata: Json | null
          next_contribution_date: string
          start_date: string
          total_amount: number | null
          total_contributions: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          end_date?: string | null
          frequency: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          last_contribution_at?: string | null
          metadata?: Json | null
          next_contribution_date: string
          start_date?: string
          total_amount?: number | null
          total_contributions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          end_date?: string | null
          frequency?: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          last_contribution_at?: string | null
          metadata?: Json | null
          next_contribution_date?: string
          start_date?: string
          total_amount?: number | null
          total_contributions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_transactions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          failure_reason: string | null
          group_id: string | null
          id: string
          original_contribution: number
          refund_amount: number
          refund_percentage: number | null
          refund_request_id: string | null
          status: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          group_id?: string | null
          id?: string
          original_contribution: number
          refund_amount: number
          refund_percentage?: number | null
          refund_request_id?: string | null
          status?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          group_id?: string | null
          id?: string
          original_contribution?: number
          refund_amount?: number
          refund_percentage?: number | null
          refund_request_id?: string | null
          status?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_transactions_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "group_refund_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_contributions: {
        Row: {
          amount: number
          created_at: string | null
          executed_at: string | null
          failure_reason: string | null
          group_id: string | null
          id: string
          metadata: Json | null
          scheduled_date: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          executed_at?: string | null
          failure_reason?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
          scheduled_date: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          executed_at?: string | null
          failure_reason?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
          scheduled_date?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          anonymous: boolean | null
          balance_after: number | null
          balance_before: number | null
          contribution_id: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          reference_id: string | null
          status: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          anonymous?: boolean | null
          balance_after?: number | null
          balance_before?: number | null
          contribution_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          reference_id?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          anonymous?: boolean | null
          balance_after?: number | null
          balance_before?: number | null
          contribution_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          reference_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          contribution_id: string
          created_at: string | null
          deadline: string
          id: string
          purpose: string
          requester_id: string
          status: string
          updated_at: string | null
          votes: Json | null
        }
        Insert: {
          amount: number
          contribution_id: string
          created_at?: string | null
          deadline: string
          id?: string
          purpose: string
          requester_id: string
          status?: string
          updated_at?: string | null
          votes?: Json | null
        }
        Update: {
          amount?: number
          contribution_id?: string
          created_at?: string | null
          deadline?: string
          id?: string
          purpose?: string
          requester_id?: string
          status?: string
          updated_at?: string | null
          votes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_deposit_to_user: {
        Args: {
          p_amount: number
          p_description?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      archive_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: Json
      }
      check_group_creation_eligibility: {
        Args: { p_user_id: string }
        Returns: Json
      }
      check_withdrawal_voting: {
        Args: { p_withdrawal_id: string }
        Returns: Json
      }
      contribute_from_wallet: {
        Args: {
          p_amount: number
          p_anonymous?: boolean
          p_group_id: string
          p_user_id: string
        }
        Returns: Json
      }
      create_group_with_fee_check: {
        Args: {
          p_category: string
          p_contribution_amount?: number
          p_description: string
          p_enable_voting_rights?: boolean
          p_end_date?: string
          p_frequency: string
          p_name: string
          p_privacy?: string
          p_start_date?: string
          p_target_amount: number
          p_user_id: string
          p_voting_threshold?: number
        }
        Returns: Json
      }
      expire_withdrawal_requests: { Args: never; Returns: undefined }
      get_group_contributors_safe: {
        Args: { p_group_id: string }
        Returns: {
          amount: number
          anonymous: boolean
          contribution_count: number
          contributor_avatar: string
          contributor_name: string
          created_at: string
          group_id: string
          has_voting_rights: boolean
          id: string
          join_method: string
          joined_at: string
          last_contribution_at: string
          metadata: Json
          total_contributed: number
          user_id: string
        }[]
      }
      get_group_voters: {
        Args: { p_group_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      lookup_user_id_by_email: { Args: { p_email: string }; Returns: string }
      process_approved_withdrawal: {
        Args: { p_withdrawal_id: string }
        Returns: Json
      }
      process_group_refund: {
        Args: { p_refund_request_id: string }
        Returns: Json
      }
      process_instant_withdrawal: {
        Args: {
          p_admin_id: string
          p_amount: number
          p_group_id: string
          p_purpose: string
        }
        Returns: undefined
      }
      record_withdrawal_vote: {
        Args: { p_user_id: string; p_vote: boolean; p_withdrawal_id: string }
        Returns: undefined
      }
      unarchive_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
