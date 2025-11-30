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
      game_permissions: {
        Row: {
          game_id: string
          granted_at: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          game_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id: string
        }
        Update: {
          game_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_permissions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archive_path: string | null
          archive_size: string | null
          banner_path: string | null
          created_at: string
          created_by: string
          description: string | null
          editing_progress: number
          game_description: string | null
          game_id: string
          id: string
          install_paths:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          is_active: boolean
          logo_path: string | null
          name: string
          platforms: string[]
          status: Database["public"]["Enums"]["game_status"]
          support_url: string | null
          team: string
          thumbnail_path: string | null
          translation_progress: number
          updated_at: string
          version: string | null
          video_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          editing_progress?: number
          game_description?: string | null
          game_id: string
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          is_active?: boolean
          logo_path?: string | null
          name: string
          platforms?: string[]
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team: string
          thumbnail_path?: string | null
          translation_progress?: number
          updated_at?: string
          version?: string | null
          video_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          editing_progress?: number
          game_description?: string | null
          game_id?: string
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          is_active?: boolean
          logo_path?: string | null
          name?: string
          platforms?: string[]
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team?: string
          thumbnail_path?: string | null
          translation_progress?: number
          updated_at?: string
          version?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_versions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          archive_path: string | null
          archive_size: string | null
          banner_path: string | null
          created_at: string
          created_by: string
          description: string | null
          editing_progress: number
          game_description: string | null
          id: string
          install_paths:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          logo_path: string | null
          name: string
          platforms: string[]
          project_id: string | null
          slug: string
          status: Database["public"]["Enums"]["game_status"]
          support_url: string | null
          team: string
          thumbnail_path: string | null
          translation_progress: number
          updated_at: string
          version: string
          video_url: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          editing_progress?: number
          game_description?: string | null
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          logo_path?: string | null
          name: string
          platforms?: string[]
          project_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team: string
          thumbnail_path?: string | null
          translation_progress?: number
          updated_at?: string
          version: string
          video_url?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          editing_progress?: number
          game_description?: string | null
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          logo_path?: string | null
          name?: string
          platforms?: string[]
          project_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team?: string
          thumbnail_path?: string | null
          translation_progress?: number
          updated_at?: string
          version?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      install_path_entries: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          path: string
          platform: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          path: string
          platform: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          path?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "install_path_entries_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_keys: {
        Row: {
          character_limit: number | null
          context: string | null
          created_at: string
          game_id: string
          id: string
          key: string
          notes: string | null
          original_language: string
          original_text: string
          updated_at: string
        }
        Insert: {
          character_limit?: number | null
          context?: string | null
          created_at?: string
          game_id: string
          id?: string
          key: string
          notes?: string | null
          original_language?: string
          original_text: string
          updated_at?: string
        }
        Update: {
          character_limit?: number | null
          context?: string | null
          created_at?: string
          game_id?: string
          id?: string
          key?: string
          notes?: string | null
          original_language?: string
          original_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_keys_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          created_at: string
          id: string
          key_id: string
          language: string
          reviewed_by: string | null
          status: string
          translated_by: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_id: string
          language?: string
          reviewed_by?: string | null
          status?: string
          translated_by?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key_id?: string
          language?: string
          reviewed_by?: string | null
          status?: string
          translated_by?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "translation_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_translated_by_fkey"
            columns: ["translated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          password_hash: string
          role: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          password_hash: string
          role?: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          password_hash?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      game_install_paths: {
        Row: {
          game_id: string | null
          install_paths: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "install_path_entries_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      game_status: "completed" | "in-progress" | "planned"
      install_source: "steam" | "gog"
    }
    CompositeTypes: {
      install_path_entry: {
        type: Database["public"]["Enums"]["install_source"] | null
        path: string | null
      }
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
    Enums: {
      game_status: ["completed", "in-progress", "planned"],
      install_source: ["steam", "gog"],
    },
  },
} as const
