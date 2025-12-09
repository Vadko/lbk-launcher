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
      deleted_games: {
        Row: {
          deleted_at: string
          game_id: string
          id: string
        }
        Insert: {
          deleted_at?: string
          game_id: string
          id?: string
        }
        Update: {
          deleted_at?: string
          game_id?: string
          id?: string
        }
        Relationships: []
      }
      game_downloads: {
        Row: {
          downloaded_at: string | null
          game_id: string
          id: string
          user_identifier: string
        }
        Insert: {
          downloaded_at?: string | null
          game_id: string
          id?: string
          user_identifier: string
        }
        Update: {
          downloaded_at?: string | null
          game_id?: string
          id?: string
          user_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_downloads_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_versions: {
        Row: {
          achievements_archive_hash: string | null
          achievements_archive_path: string | null
          achievements_archive_size: string | null
          approved_at: string | null
          approved_by: string | null
          archive_hash: string | null
          archive_path: string | null
          archive_size: string | null
          banner_path: string | null
          created_at: string
          created_by: string
          description: string | null
          discord: string | null
          editing_progress: number
          fonts_progress: number | null
          fundraising_current: number | null
          fundraising_goal: number | null
          game_description: string | null
          game_id: string
          id: string
          install_paths:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path: string | null
          installation_file_windows_path: string | null
          is_active: boolean
          is_adult: boolean
          logo_path: string | null
          name: string
          platforms: string[]
          status: Database["public"]["Enums"]["game_status"]
          support_url: string | null
          team: string
          telegram: string | null
          textures_progress: number | null
          thumbnail_path: string | null
          translation_progress: number
          twitter: string | null
          updated_at: string
          version: string | null
          video_url: string | null
          voice_archive_hash: string | null
          voice_archive_path: string | null
          voice_archive_size: string | null
          voice_progress: number | null
          website: string | null
          youtube: string | null
        }
        Insert: {
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discord?: string | null
          editing_progress?: number
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          game_id: string
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_active?: boolean
          is_adult?: boolean
          logo_path?: string | null
          name: string
          platforms?: string[]
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team: string
          telegram?: string | null
          textures_progress?: number | null
          thumbnail_path?: string | null
          translation_progress?: number
          twitter?: string | null
          updated_at?: string
          version?: string | null
          video_url?: string | null
          voice_archive_hash?: string | null
          voice_archive_path?: string | null
          voice_archive_size?: string | null
          voice_progress?: number | null
          website?: string | null
          youtube?: string | null
        }
        Update: {
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discord?: string | null
          editing_progress?: number
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          game_id?: string
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_active?: boolean
          is_adult?: boolean
          logo_path?: string | null
          name?: string
          platforms?: string[]
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team?: string
          telegram?: string | null
          textures_progress?: number | null
          thumbnail_path?: string | null
          translation_progress?: number
          twitter?: string | null
          updated_at?: string
          version?: string | null
          video_url?: string | null
          voice_archive_hash?: string | null
          voice_archive_path?: string | null
          voice_archive_size?: string | null
          voice_progress?: number | null
          website?: string | null
          youtube?: string | null
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
          achievements_archive_hash: string | null
          achievements_archive_path: string | null
          achievements_archive_size: string | null
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          archive_hash: string | null
          archive_path: string | null
          archive_size: string | null
          banner_path: string | null
          created_at: string
          created_by: string
          description: string | null
          discord: string | null
          downloads: number | null
          editing_progress: number
          fonts_progress: number | null
          fundraising_current: number | null
          fundraising_goal: number | null
          game_description: string | null
          id: string
          install_paths:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path: string | null
          installation_file_windows_path: string | null
          is_adult: boolean
          logo_path: string | null
          name: string
          platforms: string[]
          project_id: string | null
          slug: string
          status: Database["public"]["Enums"]["game_status"]
          support_url: string | null
          team: string
          telegram: string | null
          textures_progress: number | null
          thumbnail_path: string | null
          translation_progress: number
          twitter: string | null
          updated_at: string
          version: string | null
          video_url: string | null
          voice_archive_hash: string | null
          voice_archive_path: string | null
          voice_archive_size: string | null
          voice_progress: number | null
          website: string | null
          youtube: string | null
        }
        Insert: {
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discord?: string | null
          downloads?: number | null
          editing_progress?: number
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_adult?: boolean
          logo_path?: string | null
          name: string
          platforms?: string[]
          project_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team: string
          telegram?: string | null
          textures_progress?: number | null
          thumbnail_path?: string | null
          translation_progress?: number
          twitter?: string | null
          updated_at?: string
          version?: string | null
          video_url?: string | null
          voice_archive_hash?: string | null
          voice_archive_path?: string | null
          voice_archive_size?: string | null
          voice_progress?: number | null
          website?: string | null
          youtube?: string | null
        }
        Update: {
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discord?: string | null
          downloads?: number | null
          editing_progress?: number
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_adult?: boolean
          logo_path?: string | null
          name?: string
          platforms?: string[]
          project_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["game_status"]
          support_url?: string | null
          team?: string
          telegram?: string | null
          textures_progress?: number | null
          thumbnail_path?: string | null
          translation_progress?: number
          twitter?: string | null
          updated_at?: string
          version?: string | null
          video_url?: string | null
          voice_archive_hash?: string | null
          voice_archive_path?: string | null
          voice_archive_size?: string | null
          voice_progress?: number | null
          website?: string | null
          youtube?: string | null
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
        ]
      }
      steam_apps: {
        Row: {
          app_id: number
          created_at: string
          name: string
        }
        Insert: {
          app_id: number
          created_at?: string
          name: string
        }
        Update: {
          app_id?: number
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      steam_sync_metadata: {
        Row: {
          id: number
          last_sync_at: string | null
          sync_status: string | null
          total_apps: number | null
        }
        Insert: {
          id?: number
          last_sync_at?: string | null
          sync_status?: string | null
          total_apps?: number | null
        }
        Update: {
          id?: number
          last_sync_at?: string | null
          sync_status?: string | null
          total_apps?: number | null
        }
        Relationships: []
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
          verified_user: boolean
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
          verified_user?: boolean
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
          verified_user?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_game_downloads: {
        Args: { p_game_id: string; p_user_identifier: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_verified_user: { Args: never; Returns: boolean }
      search_steam_apps: {
        Args: { limit_val?: number; offset_val?: number; search_query: string }
        Returns: {
          app_id: number
          name: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_steam_apps_cron: { Args: never; Returns: undefined }
      validate_install_paths: { Args: { paths: Json }; Returns: boolean }
    }
    Enums: {
      game_status: "completed" | "in-progress" | "planned"
      install_source: "steam" | "gog" | "emulator" | "epic"
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
      install_source: ["steam", "gog", "emulator", "epic"],
    },
  },
} as const
