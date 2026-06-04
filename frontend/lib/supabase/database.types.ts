export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      budget_categories: {
        Row: {
          budget_id: number;
          created_at: string;
          expected_amount: number;
          id: number;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          budget_id: number;
          created_at?: string;
          expected_amount?: number;
          id?: number;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          budget_id?: number;
          created_at?: string;
          expected_amount?: number;
          id?: number;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_categories_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "project_budgets";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_transactions: {
        Row: {
          amount: number;
          budget_id: number;
          category_id: number;
          created_at: string;
          created_by: number | null;
          description: string | null;
          id: number;
          occurred_on: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          budget_id: number;
          category_id: number;
          created_at?: string;
          created_by?: number | null;
          description?: string | null;
          id?: number;
          occurred_on: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          budget_id?: number;
          category_id?: number;
          created_at?: string;
          created_by?: number | null;
          description?: string | null;
          id?: number;
          occurred_on?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_transactions_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "project_budgets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "budget_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_chat_messages: {
        Row: {
          attachments: Json | null;
          content: string;
          created_at: string;
          id: number;
          is_cancelled: boolean;
          model_preference: string | null;
          role: string;
          session_id: number;
          sources: Json | null;
        };
        Insert: {
          attachments?: Json | null;
          content: string;
          created_at?: string;
          id?: number;
          is_cancelled?: boolean;
          model_preference?: string | null;
          role: string;
          session_id: number;
          sources?: Json | null;
        };
        Update: {
          attachments?: Json | null;
          content?: string;
          created_at?: string;
          id?: number;
          is_cancelled?: boolean;
          model_preference?: string | null;
          role?: string;
          session_id?: number;
          sources?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_chat_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "client_chat_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      client_chat_sessions: {
        Row: {
          created_at: string;
          id: number;
          metadata: Json | null;
          project_id: number | null;
          title: string | null;
          uid: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          metadata?: Json | null;
          project_id?: number | null;
          title?: string | null;
          uid?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          metadata?: Json | null;
          project_id?: number | null;
          title?: string | null;
          uid?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_chat_sessions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      client_files: {
        Row: {
          created_at: string;
          file_name: string;
          file_size: number | null;
          file_type: string | null;
          id: number;
          metadata: Json | null;
          storage_path: string;
          uid: string | null;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: number;
          metadata?: Json | null;
          storage_path: string;
          uid?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: number;
          metadata?: Json | null;
          storage_path?: string;
          uid?: string | null;
        };
        Relationships: [];
      };
      client_knowledge: {
        Row: {
          content: string;
          created_at: string;
          embedding: string | null;
          id: number;
          metadata: Json | null;
          uid: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          embedding?: string | null;
          id?: number;
          metadata?: Json | null;
          uid?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          embedding?: string | null;
          id?: number;
          metadata?: Json | null;
          uid?: string;
        };
        Relationships: [];
      };
      conversation_reads: {
        Row: {
          conversation_id: number;
          last_read_at: string;
          profile_id: number;
        };
        Insert: {
          conversation_id: number;
          last_read_at?: string;
          profile_id: number;
        };
        Update: {
          conversation_id?: number;
          last_read_at?: string;
          profile_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          client_profile_id: number | null;
          created_at: string;
          director_profile_id: number | null;
          id: number;
          project_id: number | null;
        };
        Insert: {
          client_profile_id?: number | null;
          created_at?: string;
          director_profile_id?: number | null;
          id?: number;
          project_id?: number | null;
        };
        Update: {
          client_profile_id?: number | null;
          created_at?: string;
          director_profile_id?: number | null;
          id?: number;
          project_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_client_profile_id_fkey";
            columns: ["client_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_director_profile_id_fkey";
            columns: ["director_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_form_assignments: {
        Row: {
          created_at: string;
          form_id: number;
          id: number;
          project_id: number | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          form_id: number;
          id?: number;
          project_id?: number | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          form_id?: number;
          id?: number;
          project_id?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "custom_form_assignments_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "custom_form_schemas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_form_assignments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_form_schemas: {
        Row: {
          assigned_to: string[] | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          fields: Json;
          id: number;
          is_active: boolean | null;
          title: string;
          updated_at: string | null;
          version: number;
        };
        Insert: {
          assigned_to?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fields?: Json;
          id?: number;
          is_active?: boolean | null;
          title: string;
          updated_at?: string | null;
          version?: number;
        };
        Update: {
          assigned_to?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fields?: Json;
          id?: number;
          is_active?: boolean | null;
          title?: string;
          updated_at?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      custom_form_submissions: {
        Row: {
          created_at: string | null;
          data: Json;
          form_id: number;
          id: number;
          project_id: number | null;
          schema_version: number;
          status: string;
          submitted_at: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          data?: Json;
          form_id: number;
          id?: number;
          project_id?: number | null;
          schema_version?: number;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string | null;
          data?: Json;
          form_id?: number;
          id?: number;
          project_id?: number | null;
          schema_version?: number;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_form_submissions_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "custom_form_schemas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_form_submissions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      finances: {
        Row: {
          created_at: string;
          id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
        };
        Update: {
          created_at?: string;
          id?: number;
        };
        Relationships: [];
      };
      legal_documents: {
        Row: {
          content: string | null;
          embedding: string | null;
          id: number;
          metadata: Json | null;
        };
        Insert: {
          content?: string | null;
          embedding?: string | null;
          id?: number;
          metadata?: Json | null;
        };
        Update: {
          content?: string | null;
          embedding?: string | null;
          id?: number;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      lifecycle_projects: {
        Row: {
          completed: boolean;
          created_at: string;
          id: number;
          image: string | null;
          project_id: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          id?: number;
          image?: string | null;
          project_id: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          id?: number;
          image?: string | null;
          project_id?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lifecycle_projects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      lifecycle_task_assignees: {
        Row: {
          created_at: string;
          id: number;
          profile_id: number;
          task_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          profile_id: number;
          task_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          profile_id?: number;
          task_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lifecycle_task_assignees_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lifecycle_task_assignees_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "lifecycle_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      lifecycle_tasks: {
        Row: {
          assigned_by: number | null;
          created_at: string;
          description: string | null;
          due_date: string;
          id: number;
          lifecycle_project_id: number;
          priority: "extreme" | "high" | "medium" | "low" | "stretch";
          status:
            | "not_started"
            | "in_progress"
            | "pending_approval"
            | "completed";
          team:
            | "technology"
            | "architecture"
            | "public_relations"
            | "engineering"
            | "finance"
            | "research"
            | "legal"
            | "executive";
          tentative: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_by?: number | null;
          created_at?: string;
          description?: string | null;
          due_date: string;
          id?: number;
          lifecycle_project_id: number;
          priority?: "extreme" | "high" | "medium" | "low" | "stretch";
          status?:
            | "not_started"
            | "in_progress"
            | "pending_approval"
            | "completed";
          team:
            | "technology"
            | "architecture"
            | "public_relations"
            | "engineering"
            | "finance"
            | "research"
            | "legal"
            | "executive";
          tentative?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: number | null;
          created_at?: string;
          description?: string | null;
          due_date?: string;
          id?: number;
          lifecycle_project_id?: number;
          priority?: "extreme" | "high" | "medium" | "low" | "stretch";
          status?:
            | "not_started"
            | "in_progress"
            | "pending_approval"
            | "completed";
          team?:
            | "technology"
            | "architecture"
            | "public_relations"
            | "engineering"
            | "finance"
            | "research"
            | "legal"
            | "executive";
          tentative?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lifecycle_tasks_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lifecycle_tasks_lifecycle_project_id_fkey";
            columns: ["lifecycle_project_id"];
            isOneToOne: false;
            referencedRelation: "lifecycle_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      message_attachments: {
        Row: {
          created_at: string;
          id: number;
          message_id: number;
          meta: Json | null;
          mime_type: string | null;
          name: string;
          path: string;
          sort_index: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          message_id: number;
          meta?: Json | null;
          mime_type?: string | null;
          name: string;
          path: string;
          sort_index?: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          message_id?: number;
          meta?: Json | null;
          mime_type?: string | null;
          name?: string;
          path?: string;
          sort_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      message_unfurls: {
        Row: {
          description: string | null;
          fetched_at: string;
          image_url: string | null;
          message_id: number;
          site_name: string | null;
          title: string | null;
          url: string;
        };
        Insert: {
          description?: string | null;
          fetched_at?: string;
          image_url?: string | null;
          message_id: number;
          site_name?: string | null;
          title?: string | null;
          url: string;
        };
        Update: {
          description?: string | null;
          fetched_at?: string;
          image_url?: string | null;
          message_id?: number;
          site_name?: string | null;
          title?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_unfurls_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: true;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string | null;
          conversation_id: number | null;
          created_at: string;
          edited_at: string | null;
          id: number;
          is_pinned: boolean;
          pinned_at: string | null;
          reply_to_id: number | null;
          sender_profile_id: number | null;
          sender_role: string;
          sender_uid: string | null;
        };
        Insert: {
          content?: string | null;
          conversation_id?: number | null;
          created_at?: string;
          edited_at?: string | null;
          id?: number;
          is_pinned?: boolean;
          pinned_at?: string | null;
          reply_to_id?: number | null;
          sender_profile_id?: number | null;
          sender_role: string;
          sender_uid?: string | null;
        };
        Update: {
          content?: string | null;
          conversation_id?: number | null;
          created_at?: string;
          edited_at?: string | null;
          id?: number;
          is_pinned?: boolean;
          pinned_at?: string | null;
          reply_to_id?: number | null;
          sender_profile_id?: number | null;
          sender_role?: string;
          sender_uid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey";
            columns: ["sender_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          config: Json | null;
          created_at: string;
          department: string | null;
          discord_id: number | null;
          eid: string | null;
          email: string | null;
          graduation: number | null;
          id: number;
          name: string;
          role: "client" | "director" | "member";
          uid: string;
          updated_at: string;
        };
        Insert: {
          config?: Json | null;
          created_at?: string;
          department?: string | null;
          discord_id?: number | null;
          eid?: string | null;
          email?: string | null;
          graduation?: number | null;
          id?: number;
          name: string;
          role: "client" | "director" | "member";
          uid: string;
          updated_at?: string;
        };
        Update: {
          config?: Json | null;
          created_at?: string;
          department?: string | null;
          discord_id?: number | null;
          eid?: string | null;
          email?: string | null;
          graduation?: number | null;
          id?: number;
          name?: string;
          role?: "client" | "director" | "member";
          uid?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_budgets: {
        Row: {
          created_at: string;
          created_by: number | null;
          currency: string;
          id: number;
          period_end: string;
          period_start: string;
          project_id: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: number | null;
          currency?: string;
          id?: number;
          period_end: string;
          period_start: string;
          project_id: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: number | null;
          currency?: string;
          id?: number;
          period_end?: string;
          period_start?: string;
          project_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_budgets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          assigned_by: number | null;
          created_at: string;
          id: number;
          profile_id: number;
          project_id: number;
          role: "owner" | "director" | "member";
        };
        Insert: {
          assigned_by?: number | null;
          created_at?: string;
          id?: number;
          profile_id: number;
          project_id: number;
          role: "owner" | "director" | "member";
        };
        Update: {
          assigned_by?: number | null;
          created_at?: string;
          id?: number;
          profile_id?: number;
          project_id?: number;
          role?: "owner" | "director" | "member";
        };
        Relationships: [
          {
            foreignKeyName: "project_members_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          company_name: string;
          config: Json | null;
          created_at: string;
          created_by: number | null;
          id: number;
          updated_at: string;
          url_slug: string;
        };
        Insert: {
          company_name: string;
          config?: Json | null;
          created_at?: string;
          created_by?: number | null;
          id?: number;
          updated_at?: string;
          url_slug: string;
        };
        Update: {
          company_name?: string;
          config?: Json | null;
          created_at?: string;
          created_by?: number | null;
          id?: number;
          updated_at?: string;
          url_slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      questionnaire_responses: {
        Row: {
          created_at: string;
          id: number;
          responses: Json;
          submitted_forms: string[];
          uid: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          responses?: Json;
          submitted_forms?: string[];
          uid: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          responses?: Json;
          submitted_forms?: string[];
          uid?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          assign_to: string | null;
          attachments: Json | null;
          created_at: string;
          customer_id: string | null;
          department: string | null;
          director: string | null;
          email: string | null;
          id: number;
          message: string;
          name: string | null;
          numid: string | null;
          project: string | null;
          project_id: number | null;
          status: "pending" | "denied" | "in-progress" | "done" | null;
          subject: string;
          ticket_type: "report" | "request";
          title: string | null;
          uid: string | null;
          updated_at: string;
        };
        Insert: {
          assign_to?: string | null;
          attachments?: Json | null;
          created_at?: string;
          customer_id?: string | null;
          department?: string | null;
          director?: string | null;
          email?: string | null;
          id?: number;
          message: string;
          name?: string | null;
          numid?: string | null;
          project?: string | null;
          project_id?: number | null;
          status?: "pending" | "denied" | "in-progress" | "done" | null;
          subject: string;
          ticket_type: "report" | "request";
          title?: string | null;
          uid?: string | null;
          updated_at?: string;
        };
        Update: {
          assign_to?: string | null;
          attachments?: Json | null;
          created_at?: string;
          customer_id?: string | null;
          department?: string | null;
          director?: string | null;
          email?: string | null;
          id?: number;
          message?: string;
          name?: string | null;
          numid?: string | null;
          project?: string | null;
          project_id?: number | null;
          status?: "pending" | "denied" | "in-progress" | "done" | null;
          subject?: string;
          ticket_type?: "report" | "request";
          title?: string | null;
          uid?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      website_forms: {
        Row: {
          created_at: string;
          email: string | null;
          id: number;
          ip_address: string | null;
          message: string | null;
          name: string | null;
          subject: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: number;
          ip_address?: string | null;
          message?: string | null;
          name?: string | null;
          subject?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: number;
          ip_address?: string | null;
          message?: string | null;
          name?: string | null;
          subject?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_role: { Args: never; Returns: string };
      hybrid_search: {
        Args: {
          _filter_client_id?: string;
          _full_text_weight?: number;
          _match_count?: number;
          _query_embedding: string;
          _query_text: string;
          _semantic_weight?: number;
        };
        Returns: {
          content: string;
          id: number;
          metadata: Json;
          similarity: number;
        }[];
      };
      is_director: { Args: { check_uid: string }; Returns: boolean };
      is_project_director: { Args: { _project_id: number }; Returns: boolean };
      is_project_member: { Args: { _project_id: number }; Returns: boolean };
      mark_conversation_read: {
        Args: { p_conversation_id: number };
        Returns: undefined;
      };
      match_client_knowledge: {
        Args: {
          _filter_uid?: string;
          _match_count?: number;
          _query_embedding: string;
          _similarity_threshold?: number;
        };
        Returns: {
          content: string;
          id: number;
          metadata: Json;
          similarity: number;
        }[];
      };
      user_profile_id: { Args: { check_uid: string }; Returns: number };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
