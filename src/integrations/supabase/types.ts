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
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          metadata: Json
          summary: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          summary: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          summary?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_penalties: {
        Row: {
          aml_alert_id: string | null
          amount: number
          created_at: string
          deducted_from_wallet: boolean
          group_id: string | null
          id: string
          issued_by: string | null
          penalty_type: string
          reason: string
          status: string
          transaction_id: string | null
          user_id: string
          waive_note: string | null
          waived_at: string | null
          waived_by: string | null
        }
        Insert: {
          aml_alert_id?: string | null
          amount: number
          created_at?: string
          deducted_from_wallet?: boolean
          group_id?: string | null
          id?: string
          issued_by?: string | null
          penalty_type: string
          reason: string
          status?: string
          transaction_id?: string | null
          user_id: string
          waive_note?: string | null
          waived_at?: string | null
          waived_by?: string | null
        }
        Update: {
          aml_alert_id?: string | null
          amount?: number
          created_at?: string
          deducted_from_wallet?: boolean
          group_id?: string | null
          id?: string
          issued_by?: string | null
          penalty_type?: string
          reason?: string
          status?: string
          transaction_id?: string | null
          user_id?: string
          waive_note?: string | null
          waived_at?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_penalties_aml_alert_id_fkey"
            columns: ["aml_alert_id"]
            isOneToOne: false
            referencedRelation: "aml_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_penalties_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_penalties_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_penalties_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_penalties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_penalties_waived_by_fkey"
            columns: ["waived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aml_alerts: {
        Row: {
          alert_key: string | null
          alert_type: string
          amount: number | null
          created_at: string
          description: string
          evidence: Json
          group_id: string | null
          id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number
          severity: string
          status: string
          title: string
          transaction_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alert_key?: string | null
          alert_type: string
          amount?: number | null
          created_at?: string
          description: string
          evidence?: Json
          group_id?: string | null
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number
          severity?: string
          status?: string
          title: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alert_key?: string | null
          alert_type?: string
          amount?: number | null
          created_at?: string
          description?: string
          evidence?: Json
          group_id?: string | null
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number
          severity?: string
          status?: string
          title?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aml_alerts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          cover_image_url: string | null
          created_at: string | null
          creator_id: string | null
          current_amount: number | null
          description: string | null
          enable_voting_rights: boolean | null
          end_date: string | null
          featured_priority: number
          frequency: string
          id: string
          is_pinned: boolean
          is_verified: boolean
          name: string
          privacy: string | null
          spotlight_label: string | null
          start_date: string | null
          status: string | null
          target_amount: number
          updated_at: string | null
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
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
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          current_amount?: number | null
          description?: string | null
          enable_voting_rights?: boolean | null
          end_date?: string | null
          featured_priority?: number
          frequency: string
          id?: string
          is_pinned?: boolean
          is_verified?: boolean
          name: string
          privacy?: string | null
          spotlight_label?: string | null
          start_date?: string | null
          status?: string | null
          target_amount: number
          updated_at?: string | null
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
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
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          current_amount?: number | null
          description?: string | null
          enable_voting_rights?: boolean | null
          end_date?: string | null
          featured_priority?: number
          frequency?: string
          id?: string
          is_pinned?: boolean
          is_verified?: boolean
          name?: string
          privacy?: string | null
          spotlight_label?: string | null
          start_date?: string | null
          status?: string | null
          target_amount?: number
          updated_at?: string | null
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
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
          {
            foreignKeyName: "contribution_groups_verified_by_fkey"
            columns: ["verified_by"]
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
      external_payment_tracks: {
        Row: {
          aml_flags: Json
          aml_risk_level: string
          amount: number
          created_at: string
          currency: string
          destination_account: string | null
          group_id: string | null
          id: string
          narration: string | null
          raw_metadata: Json
          reference_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_account_masked: string | null
          sender_bank: string | null
          sender_email: string | null
          sender_name: string | null
          source_channel: string
          transaction_id: string | null
          user_id: string | null
          verification_status: string
        }
        Insert: {
          aml_flags?: Json
          aml_risk_level?: string
          amount: number
          created_at?: string
          currency?: string
          destination_account?: string | null
          group_id?: string | null
          id?: string
          narration?: string | null
          raw_metadata?: Json
          reference_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_account_masked?: string | null
          sender_bank?: string | null
          sender_email?: string | null
          sender_name?: string | null
          source_channel: string
          transaction_id?: string | null
          user_id?: string | null
          verification_status?: string
        }
        Update: {
          aml_flags?: Json
          aml_risk_level?: string
          amount?: number
          created_at?: string
          currency?: string
          destination_account?: string | null
          group_id?: string | null
          id?: string
          narration?: string | null
          raw_metadata?: Json
          reference_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_account_masked?: string | null
          sender_bank?: string | null
          sender_email?: string | null
          sender_name?: string | null
          source_channel?: string
          transaction_id?: string | null
          user_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_payment_tracks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contribution_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payment_tracks_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payment_tracks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payment_tracks_user_id_fkey"
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
      platform_payment_settings: {
        Row: {
          flutterwave_encryption_key: string | null
          flutterwave_mode: string
          flutterwave_public_key: string | null
          flutterwave_secret_key: string | null
          flutterwave_webhook_hash: string | null
          id: string
          provider: string
          static_ip_address: string | null
          static_ip_proxy_secret: string | null
          static_ip_proxy_url: string | null
          transfers_enabled: boolean
          updated_at: string
          updated_by: string | null
          webhook_url: string
        }
        Insert: {
          flutterwave_encryption_key?: string | null
          flutterwave_mode?: string
          flutterwave_public_key?: string | null
          flutterwave_secret_key?: string | null
          flutterwave_webhook_hash?: string | null
          id?: string
          provider?: string
          static_ip_address?: string | null
          static_ip_proxy_secret?: string | null
          static_ip_proxy_url?: string | null
          transfers_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_url?: string
        }
        Update: {
          flutterwave_encryption_key?: string | null
          flutterwave_mode?: string
          flutterwave_public_key?: string | null
          flutterwave_secret_key?: string | null
          flutterwave_webhook_hash?: string | null
          id?: string
          provider?: string
          static_ip_address?: string | null
          static_ip_proxy_secret?: string | null
          static_ip_proxy_url?: string | null
          transfers_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_payment_settings_updated_by_fkey"
            columns: ["updated_by"]
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
          is_verified_organizer: boolean
          name: string | null
          organizer_badge_label: string | null
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
          is_verified_organizer?: boolean
          name?: string | null
          organizer_badge_label?: string | null
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
          is_verified_organizer?: boolean
          name?: string | null
          organizer_badge_label?: string | null
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
          fee_amount: number
          fee_percent: number
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
          fee_amount?: number
          fee_percent?: number
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
          fee_amount?: number
          fee_percent?: number
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
      _mask_secret: { Args: { p_val: string }; Returns: string }
      accept_group_invitation: { Args: { p_token: string }; Returns: Json }
      admin_adjust_user_wallet: {
        Args: {
          p_amount: number
          p_direction: string
          p_reason?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_create_aml_alert: {
        Args: {
          p_amount?: number
          p_description: string
          p_group_id?: string
          p_risk_score?: number
          p_severity?: string
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_deposit_to_user: {
        Args: {
          p_amount: number
          p_description?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_get_payment_settings: { Args: never; Returns: Json }
      admin_issue_penalty: {
        Args: {
          p_aml_alert_id?: string
          p_amount: number
          p_deduct_wallet?: boolean
          p_group_id?: string
          p_penalty_type: string
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_remove_user_bvn: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: Json
      }
      admin_review_external_payment: {
        Args: { p_note?: string; p_status: string; p_track_id: string }
        Returns: Json
      }
      admin_save_payment_settings: {
        Args: {
          p_encryption_key?: string
          p_mode?: string
          p_public_key?: string
          p_secret_key?: string
          p_static_ip_address?: string
          p_static_ip_proxy_secret?: string
          p_static_ip_proxy_url?: string
          p_transfers_enabled?: boolean
          p_webhook_hash?: string
          p_webhook_url?: string
        }
        Returns: Json
      }
      admin_scan_aml_alerts: { Args: never; Returns: Json }
      admin_toggle_verified_organizer: {
        Args: {
          p_apply_to_groups?: boolean
          p_badge_label?: string
          p_is_verified: boolean
          p_user_id: string
        }
        Returns: Json
      }
      admin_update_aml_alert: {
        Args: {
          p_alert_id: string
          p_resolution_note?: string
          p_status: string
        }
        Returns: Json
      }
      admin_update_group_spotlight: {
        Args: {
          p_featured_priority?: number
          p_group_id: string
          p_is_pinned?: boolean
          p_is_verified?: boolean
          p_note?: string
          p_spotlight_label?: string
        }
        Returns: Json
      }
      admin_update_group_status: {
        Args: {
          p_archived?: boolean
          p_group_id: string
          p_reason?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_update_user_status: {
        Args: { p_reason?: string; p_status: string; p_user_id: string }
        Returns: Json
      }
      admin_waive_penalty: {
        Args: {
          p_note?: string
          p_penalty_id: string
          p_refund_wallet?: boolean
        }
        Returns: Json
      }
      archive_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: Json
      }
      cast_refund_vote: {
        Args: { p_refund_request_id: string; p_vote: string }
        Returns: Json
      }
      cast_withdrawal_vote: {
        Args: { p_vote: boolean; p_withdrawal_id: string }
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
          p_pin?: string
          p_user_id: string
        }
        Returns: Json
      }
      create_group_invitation: {
        Args: { p_email: string; p_group_id: string }
        Returns: Json
      }
      create_group_with_fee_check: {
        Args: {
          p_category: string
          p_contribution_amount?: number
          p_cover_image_url?: string
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
      create_withdrawal_request_safe: {
        Args: {
          p_amount: number
          p_group_id: string
          p_pin?: string
          p_purpose: string
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
      get_platform_pricing: { Args: Record<never, never>; Returns: Json }
      get_group_transfer_analytics: { Args: { p_group_id: string; p_start: string; p_end: string }; Returns: Json }
      set_push_device: { Args: { p_endpoint: string; p_key: string; p_auth: string }; Returns: undefined }
      remove_push_device: { Args: { p_endpoint: string }; Returns: undefined }
      get_wallet_transfer_allowance: { Args: Record<never, never>; Returns: Json }
      admin_platform_pricing_report: { Args: Record<never, never>; Returns: Json }
      admin_update_platform_pricing: { Args: { p_daily_free: number; p_friday_free: boolean; p_withdrawal_percent: number }; Returns: Json }
      list_group_bank_transfer_assignments: {
        Args: { p_group_id: string }
        Returns: { id: string; amount: number; sender_name: string | null; sender_bank: string | null; reference_id: string; created_at: string; verification_status: string }[]
      }
      assign_group_bank_transfer: { Args: { p_payment_id: string; p_account: string; p_grant_vote: boolean }; Returns: undefined }
      get_public_payment_config: { Args: never; Returns: Json }
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
          p_pin?: string
          p_purpose: string
        }
        Returns: undefined
      }
      record_withdrawal_vote: {
        Args: { p_user_id: string; p_vote: boolean; p_withdrawal_id: string }
        Returns: undefined
      }
      resolve_admin_login_email: {
        Args: { p_identifier: string }
        Returns: string
      }
      revoke_group_invitation: {
        Args: { p_invitation_id: string }
        Returns: boolean
      }
      save_user_bvn: { Args: { p_bvn: string }; Returns: Json }
      service_adjust_wallet_balance: {
        Args: { p_delta: number; p_user_id: string }
        Returns: Json
      }
      set_user_transaction_pin: {
        Args: { p_current_pin?: string; p_new_pin: string }
        Returns: Json
      }
      unarchive_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: Json
      }
      verify_user_transaction_pin: { Args: { p_pin: string }; Returns: Json }
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
