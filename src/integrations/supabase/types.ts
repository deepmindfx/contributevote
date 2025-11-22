export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      contribution_groups: {
        Row: {
          account_details: Json | null
          account_name: string | null
          account_number: string | null
          account_reference: string | null
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
          amount: number
          anonymous: boolean | null
          date: string | null
          group_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          amount: number
          anonymous?: boolean | null
          date?: string | null
          group_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          anonymous?: boolean | null
          date?: string | null
          group_id?: string | null
          id?: string
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
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          user_id?: string | null
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
      transactions: {
        Row: {
          amount: number
          anonymous: boolean | null
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
          contribution_id: string | null
          created_at: string | null
          deadline: string | null
          id: string
          purpose: string | null
          requester_id: string | null
          status: string | null
          votes: Json | null
        }
        Insert: {
          amount: number
          contribution_id?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          purpose?: string | null
          requester_id?: string | null
          status?: string | null
          votes?: Json | null
        }
        Update: {
          amount?: number
          contribution_id?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          purpose?: string | null
          requester_id?: string | null
          status?: string | null
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
