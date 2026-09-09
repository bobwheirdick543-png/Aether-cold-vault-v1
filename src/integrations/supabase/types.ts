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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          correlation_id: string | null
          created_at: string
          detail: Json
          id: string
          project_id: string | null
          severity: string
          success: boolean
          target_id: string | null
          target_path: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          correlation_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          project_id?: string | null
          severity?: string
          success?: boolean
          target_id?: string | null
          target_path?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          correlation_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          project_id?: string | null
          severity?: string
          success?: boolean
          target_id?: string | null
          target_path?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      mcp_clients: {
        Row: {
          created_at: string
          description: string
          expires_at: string | null
          id: string
          last_protocol_version: string | null
          last_used_at: string | null
          name: string
          owner_id: string
          project_ids: string[]
          request_count: number
          revoked_at: string | null
          scopes: string[]
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          last_protocol_version?: string | null
          last_used_at?: string | null
          name: string
          owner_id: string
          project_ids?: string[]
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          last_protocol_version?: string | null
          last_used_at?: string | null
          name?: string
          owner_id?: string
          project_ids?: string[]
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      project_nodes: {
        Row: {
          content_hash: string | null
          created_at: string
          depth: number
          id: string
          is_sensitive: boolean
          mime_type: string | null
          name: string
          parent_id: string | null
          path: string
          project_id: string
          size_bytes: number
          storage_key: string | null
          type: Database["public"]["Enums"]["node_type"]
          updated_at: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          depth?: number
          id?: string
          is_sensitive?: boolean
          mime_type?: string | null
          name: string
          parent_id?: string | null
          path: string
          project_id: string
          size_bytes?: number
          storage_key?: string | null
          type: Database["public"]["Enums"]["node_type"]
          updated_at?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          depth?: number
          id?: string
          is_sensitive?: boolean
          mime_type?: string | null
          name?: string
          parent_id?: string | null
          path?: string
          project_id?: string
          size_bytes?: number
          storage_key?: string | null
          type?: Database["public"]["Enums"]["node_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          current_version: number
          description: string
          file_count: number
          folder_count: number
          id: string
          name: string
          owner_id: string
          status: Database["public"]["Enums"]["project_status"]
          storage_bytes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          description?: string
          file_count?: number
          folder_count?: number
          id?: string
          name: string
          owner_id: string
          status?: Database["public"]["Enums"]["project_status"]
          storage_bytes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: number
          description?: string
          file_count?: number
          folder_count?: number
          id?: string
          name?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          storage_bytes?: number
          updated_at?: string
        }
        Relationships: []
      }
      snapshot_entries: {
        Row: {
          content_hash: string | null
          id: string
          is_sensitive: boolean
          mime_type: string | null
          path: string
          project_id: string
          size_bytes: number
          snapshot_id: string
          storage_key: string | null
          type: Database["public"]["Enums"]["node_type"]
        }
        Insert: {
          content_hash?: string | null
          id?: string
          is_sensitive?: boolean
          mime_type?: string | null
          path: string
          project_id: string
          size_bytes?: number
          snapshot_id: string
          storage_key?: string | null
          type: Database["public"]["Enums"]["node_type"]
        }
        Update: {
          content_hash?: string | null
          id?: string
          is_sensitive?: boolean
          mime_type?: string | null
          path?: string
          project_id?: string
          size_bytes?: number
          snapshot_id?: string
          storage_key?: string | null
          type?: Database["public"]["Enums"]["node_type"]
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_entries_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots: {
        Row: {
          created_at: string
          created_by: string
          file_count: number
          folder_count: number
          id: string
          label: string
          message: string
          origin: string
          project_id: string
          storage_bytes: number
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          file_count?: number
          folder_count?: number
          id?: string
          label: string
          message?: string
          origin?: string
          project_id: string
          storage_bytes?: number
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          file_count?: number
          folder_count?: number
          id?: string
          label?: string
          message?: string
          origin?: string
          project_id?: string
          storage_bytes?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_status: "active" | "disabled"
      actor_type: "user" | "admin" | "system" | "mcp"
      app_role: "user" | "admin" | "platform_owner"
      node_type: "file" | "folder"
      project_status: "active" | "archived"
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
    Enums: {
      account_status: ["active", "disabled"],
      actor_type: ["user", "admin", "system", "mcp"],
      app_role: ["user", "admin", "platform_owner"],
      node_type: ["file", "folder"],
      project_status: ["active", "archived"],
    },
  },
} as const
