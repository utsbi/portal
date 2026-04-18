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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      client_chat_sessions: {
        Row: {
          created_at: string
          id: number
          metadata: Json | null
          title: string | null
          uid: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          metadata?: Json | null
          title?: string | null
          uid?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          metadata?: Json | null
          title?: string | null
          uid?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: number
          metadata: Json | null
          storage_path: string
          uid: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: number
          metadata?: Json | null
          storage_path: string
          uid?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: number
          metadata?: Json | null
          storage_path?: string
          uid?: string | null
        }
        Relationships: []
      }
      client_knowledge: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: number
          metadata: Json | null
          uid: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
          uid?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
          uid?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          client_profile_id: number | null
          created_at: string
          director_profile_id: number | null
          id: number
          project_id: number | null
        }
        Insert: {
          client_profile_id?: number | null
          created_at?: string
          director_profile_id?: number | null
          id?: number
          project_id?: number | null
        }
        Update: {
          client_profile_id?: number | null
          created_at?: string
          director_profile_id?: number | null
          id?: number
          project_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_director_profile_id_fkey"
            columns: ["director_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_form_schemas: {
        Row: {
          assigned_to: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          id: number
          is_active: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: number
          is_active?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: number
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_form_submissions: {
        Row: {
          created_at: string | null
          data: Json
          form_id: number
          id: number
          updated_at: string | null
          url_slug: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json
          form_id: number
          id?: number
          updated_at?: string | null
          url_slug?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          form_id?: number
          id?: number
          updated_at?: string | null
          url_slug?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "custom_form_schemas"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          content: string | null
          conversation_id: number | null
          created_at: string
          id: number
          sender_profile_id: number | null
          sender_role: string
          sender_uid: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string | null
          conversation_id?: number | null
          created_at?: string
          id?: number
          sender_profile_id?: number | null
          sender_role: string
          sender_uid?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string | null
          conversation_id?: number | null
          created_at?: string
          id?: number
          sender_profile_id?: number | null
          sender_role?: string
          sender_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          config: Json | null
          created_at: string
          department: string | null
          discord_id: number | null
          eid: string | null
          email: string | null
          graduation: number | null
          id: number
          name: string
          role: "client" | "director" | "member"
          uid: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          department?: string | null
          discord_id?: number | null
          eid?: string | null
          email?: string | null
          graduation?: number | null
          id?: number
          name: string
          role: "client" | "director" | "member"
          uid: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          department?: string | null
          discord_id?: number | null
          eid?: string | null
          email?: string | null
          graduation?: number | null
          id?: number
          name?: string
          role?: "client" | "director" | "member"
          uid?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          assigned_by: number | null
          created_at: string
          id: number
          profile_id: number
          project_id: number
          role: "owner" | "director" | "member"
        }
        Insert: {
          assigned_by?: number | null
          created_at?: string
          id?: number
          profile_id: number
          project_id: number
          role: "owner" | "director" | "member"
        }
        Update: {
          assigned_by?: number | null
          created_at?: string
          id?: number
          profile_id?: number
          project_id?: number
          role?: "owner" | "director" | "member"
        }
        Relationships: [
          {
            foreignKeyName: "project_members_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_name: string
          config: Json | null
          created_at: string
          created_by: number | null
          id: number
          updated_at: string
          url_slug: string
        }
        Insert: {
          company_name: string
          config?: Json | null
          created_at?: string
          created_by?: number | null
          id?: number
          updated_at?: string
          url_slug: string
        }
        Update: {
          company_name?: string
          config?: Json | null
          created_at?: string
          created_by?: number | null
          id?: number
          updated_at?: string
          url_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_responses: {
        Row: {
          created_at: string
          id: number
          responses: Json
          submitted_forms: string[]
          uid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          responses?: Json
          submitted_forms?: string[]
          uid: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          responses?: Json
          submitted_forms?: string[]
          uid?: string
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assign_to: string | null
          attachments: Json | null
          created_at: string
          customer_id: string | null
          department: string | null
          director: string | null
          email: string | null
          id: number
          message: string
          name: string | null
          numid: string | null
          project: string | null
          project_id: number | null
          status: "pending" | "denied" | "in-progress" | "done" | null
          subject: string
          ticket_type: "report" | "request"
          title: string | null
          uid: string | null
          updated_at: string
        }
        Insert: {
          assign_to?: string | null
          attachments?: Json | null
          created_at?: string
          customer_id?: string | null
          department?: string | null
          director?: string | null
          email?: string | null
          id?: number
          message: string
          name?: string | null
          numid?: string | null
          project?: string | null
          project_id?: number | null
          status?: "pending" | "denied" | "in-progress" | "done" | null
          subject: string
          ticket_type: "report" | "request"
          title?: string | null
          uid?: string | null
          updated_at?: string
        }
        Update: {
          assign_to?: string | null
          attachments?: Json | null
          created_at?: string
          customer_id?: string | null
          department?: string | null
          director?: string | null
          email?: string | null
          id?: number
          message?: string
          name?: string | null
          numid?: string | null
          project?: string | null
          project_id?: number | null
          status?: "pending" | "denied" | "in-progress" | "done" | null
          subject?: string
          ticket_type?: "report" | "request"
          title?: string | null
          uid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      website_forms: {
        Row: {
          created_at: string
          email: string | null
          id: number
          ip_address: string | null
          message: string | null
          name: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          ip_address?: string | null
          message?: string | null
          name?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          ip_address?: string | null
          message?: string | null
          name?: string | null
          subject?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hybrid_search: {
        Args: {
          _filter_client_id?: string
          _full_text_weight?: number
          _match_count?: number
          _query_embedding: string
          _query_text: string
          _semantic_weight?: number
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      is_director: { Args: { check_uid: string }; Returns: boolean }
      match_client_knowledge: {
        Args: {
          _filter_uid?: string
          _match_count?: number
          _query_embedding: string
          _similarity_threshold?: number
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      user_profile_id: { Args: { check_uid: string }; Returns: number }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
