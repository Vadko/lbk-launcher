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
      authors: {
        Row: {
          created_at: string | null
          games_count: number | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          games_count?: number | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          games_count?: number | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
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
      game_authors: {
        Row: {
          author_id: string
          created_at: string | null
          game_id: string
          id: string
          is_primary: boolean | null
        }
        Insert: {
          author_id: string
          created_at?: string | null
          game_id: string
          id?: string
          is_primary?: boolean | null
        }
        Update: {
          author_id?: string
          created_at?: string | null
          game_id?: string
          id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "game_authors_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_authors_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_downloads: {
        Row: {
          downloaded_at: string | null
          game_id: string
          id: string
          is_first_session: boolean | null
          machine_id: string | null
          user_identifier: string
        }
        Insert: {
          downloaded_at?: string | null
          game_id: string
          id?: string
          is_first_session?: boolean | null
          machine_id?: string | null
          user_identifier: string
        }
        Update: {
          downloaded_at?: string | null
          game_id?: string
          id?: string
          is_first_session?: boolean | null
          machine_id?: string | null
          user_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_downloads_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_subscriptions: {
        Row: {
          game_id: string
          id: string
          subscribed_at: string | null
          user_identifier: string
        }
        Insert: {
          game_id: string
          id?: string
          subscribed_at?: string | null
          user_identifier: string
        }
        Update: {
          game_id?: string
          id?: string
          subscribed_at?: string | null
          user_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_subscriptions_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_version_authors: {
        Row: {
          author_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          version_id: string
        }
        Insert: {
          author_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          version_id: string
        }
        Update: {
          author_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_version_authors_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_version_authors_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_versions: {
        Row: {
          achievements_archive_file_list: Json | null
          achievements_archive_hash: string | null
          achievements_archive_path: string | null
          achievements_archive_size: string | null
          achievements_third_party: string | null
          additional_path: string | null
          ai: string | null
          approved_at: string | null
          approved_by: string | null
          archive_file_list: Json | null
          archive_hash: string | null
          archive_path: string | null
          archive_size: string | null
          banner_path: string | null
          capsule_path: string | null
          created_at: string
          created_by: string
          description: string | null
          discord: string | null
          editing_progress: number
          epic_archive_file_list: Json | null
          epic_archive_hash: string | null
          epic_archive_path: string | null
          epic_archive_size: string | null
          fonts_progress: number | null
          fundraising_current: number | null
          fundraising_goal: number | null
          game_description: string | null
          game_id: string
          hide: boolean
          id: string
          install_paths:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path: string | null
          installation_file_windows_path: string | null
          is_active: boolean
          is_adult: boolean
          license_only: boolean
          logo_path: string | null
          name: string
          platforms: string[]
          status: Database["public"]["Enums"]["game_status"]
          steam_app_id: number | null
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
          voice_archive_file_list: Json | null
          voice_archive_hash: string | null
          voice_archive_path: string | null
          voice_archive_size: string | null
          voice_progress: number | null
          website: string | null
          youtube: string | null
        }
        Insert: {
          achievements_archive_file_list?: Json | null
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          achievements_third_party?: string | null
          additional_path?: string | null
          ai?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          capsule_path?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discord?: string | null
          editing_progress?: number
          epic_archive_file_list?: Json | null
          epic_archive_hash?: string | null
          epic_archive_path?: string | null
          epic_archive_size?: string | null
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          game_id: string
          hide?: boolean
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_active?: boolean
          is_adult?: boolean
          license_only?: boolean
          logo_path?: string | null
          name: string
          platforms?: string[]
          status?: Database["public"]["Enums"]["game_status"]
          steam_app_id?: number | null
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
          voice_archive_file_list?: Json | null
          voice_archive_hash?: string | null
          voice_archive_path?: string | null
          voice_archive_size?: string | null
          voice_progress?: number | null
          website?: string | null
          youtube?: string | null
        }
        Update: {
          achievements_archive_file_list?: Json | null
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          achievements_third_party?: string | null
          additional_path?: string | null
          ai?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          capsule_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discord?: string | null
          editing_progress?: number
          epic_archive_file_list?: Json | null
          epic_archive_hash?: string | null
          epic_archive_path?: string | null
          epic_archive_size?: string | null
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          game_id?: string
          hide?: boolean
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_active?: boolean
          is_adult?: boolean
          license_only?: boolean
          logo_path?: string | null
          name?: string
          platforms?: string[]
          status?: Database["public"]["Enums"]["game_status"]
          steam_app_id?: number | null
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
          voice_archive_file_list?: Json | null
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_versions_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          achievements_archive_file_list: Json | null
          achievements_archive_hash: string | null
          achievements_archive_path: string | null
          achievements_archive_size: string | null
          achievements_third_party: string | null
          additional_path: string | null
          ai: string | null
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          archive_file_list: Json | null
          archive_hash: string | null
          archive_path: string | null
          archive_size: string | null
          banner_path: string | null
          capsule_path: string | null
          created_at: string
          created_by: string
          description: string | null
          discord: string | null
          downloads: number | null
          editing_progress: number
          epic_archive_file_list: Json | null
          epic_archive_hash: string | null
          epic_archive_path: string | null
          epic_archive_size: string | null
          fonts_progress: number | null
          fundraising_current: number | null
          fundraising_goal: number | null
          game_description: string | null
          hide: boolean
          id: string
          install_paths:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path: string | null
          installation_file_windows_path: string | null
          is_adult: boolean
          license_only: boolean
          logo_path: string | null
          name: string
          name_fts: unknown
          name_search: string | null
          platforms: string[]
          project_id: string | null
          slug: string
          status: Database["public"]["Enums"]["game_status"]
          steam_app_id: number | null
          subscriptions: number | null
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
          voice_archive_file_list: Json | null
          voice_archive_hash: string | null
          voice_archive_path: string | null
          voice_archive_size: string | null
          voice_progress: number | null
          website: string | null
          youtube: string | null
        }
        Insert: {
          achievements_archive_file_list?: Json | null
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          achievements_third_party?: string | null
          additional_path?: string | null
          ai?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          capsule_path?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discord?: string | null
          downloads?: number | null
          editing_progress?: number
          epic_archive_file_list?: Json | null
          epic_archive_hash?: string | null
          epic_archive_path?: string | null
          epic_archive_size?: string | null
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          hide?: boolean
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_adult?: boolean
          license_only?: boolean
          logo_path?: string | null
          name: string
          name_fts?: unknown
          name_search?: string | null
          platforms?: string[]
          project_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["game_status"]
          steam_app_id?: number | null
          subscriptions?: number | null
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
          voice_archive_file_list?: Json | null
          voice_archive_hash?: string | null
          voice_archive_path?: string | null
          voice_archive_size?: string | null
          voice_progress?: number | null
          website?: string | null
          youtube?: string | null
        }
        Update: {
          achievements_archive_file_list?: Json | null
          achievements_archive_hash?: string | null
          achievements_archive_path?: string | null
          achievements_archive_size?: string | null
          achievements_third_party?: string | null
          additional_path?: string | null
          ai?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
          capsule_path?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discord?: string | null
          downloads?: number | null
          editing_progress?: number
          epic_archive_file_list?: Json | null
          epic_archive_hash?: string | null
          epic_archive_path?: string | null
          epic_archive_size?: string | null
          fonts_progress?: number | null
          fundraising_current?: number | null
          fundraising_goal?: number | null
          game_description?: string | null
          hide?: boolean
          id?: string
          install_paths?:
            | Database["public"]["CompositeTypes"]["install_path_entry"][]
            | null
          installation_file_linux_path?: string | null
          installation_file_windows_path?: string | null
          is_adult?: boolean
          license_only?: boolean
          logo_path?: string | null
          name?: string
          name_fts?: unknown
          name_search?: string | null
          platforms?: string[]
          project_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["game_status"]
          steam_app_id?: number | null
          subscriptions?: number | null
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
          voice_archive_file_list?: Json | null
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kurin_imports: {
        Row: {
          game_id: string
          imported_at: string
          kurin_id: number
        }
        Insert: {
          game_id: string
          imported_at?: string
          kurin_id: number
        }
        Update: {
          game_id?: string
          imported_at?: string
          kurin_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "kurin_imports_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      kurin_skipped: {
        Row: {
          id: string
          kurin_id: number
          reason: string | null
          skipped_at: string | null
          skipped_by: string | null
        }
        Insert: {
          id?: string
          kurin_id: number
          reason?: string | null
          skipped_at?: string | null
          skipped_by?: string | null
        }
        Update: {
          id?: string
          kurin_id?: number
          reason?: string | null
          skipped_at?: string | null
          skipped_by?: string | null
        }
        Relationships: []
      }
      launcher_sessions: {
        Row: {
          app_version: string | null
          ended_at: string | null
          id: string
          is_first_launch: boolean | null
          started_at: string | null
          user_identifier: string
        }
        Insert: {
          app_version?: string | null
          ended_at?: string | null
          id?: string
          is_first_launch?: boolean | null
          started_at?: string | null
          user_identifier: string
        }
        Update: {
          app_version?: string | null
          ended_at?: string | null
          id?: string
          is_first_launch?: boolean | null
          started_at?: string | null
          user_identifier?: string
        }
        Relationships: []
      }
      media_upload_queue: {
        Row: {
          additional_path: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_hash: string | null
          file_size: number | null
          game_id: string
          id: string
          locked_at: string | null
          locked_by: string | null
          retry_count: number
          slug: string | null
          source_url: string
          started_at: string | null
          status: string
          target_path: string | null
          task_type: string
          version: string | null
          version_id: string | null
        }
        Insert: {
          additional_path?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_size?: number | null
          game_id: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          retry_count?: number
          slug?: string | null
          source_url: string
          started_at?: string | null
          status?: string
          target_path?: string | null
          task_type: string
          version?: string | null
          version_id?: string | null
        }
        Update: {
          additional_path?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_size?: number | null
          game_id?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          retry_count?: number
          slug?: string | null
          source_url?: string
          started_at?: string | null
          status?: string
          target_path?: string | null
          task_type?: string
          version?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_upload_queue_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_upload_queue_version_id_fkey"
            columns: ["version_id"]
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_apps: {
        Row: {
          app_id: number
          created_at: string
          installdir: string | null
          name: string
        }
        Insert: {
          app_id: number
          created_at?: string
          installdir?: string | null
          name: string
        }
        Update: {
          app_id?: number
          created_at?: string
          installdir?: string | null
          name?: string
        }
        Relationships: []
      }
      steam_library_rate_limits: {
        Row: {
          created_at: string
          machine_id: string
          request_count: number
          reset_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          machine_id: string
          request_count?: number
          reset_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          machine_id?: string
          request_count?: number
          reset_date?: string
          updated_at?: string
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
      support_clicks: {
        Row: {
          clicked_at: string | null
          game_id: string
          id: string
          user_identifier: string
        }
        Insert: {
          clicked_at?: string | null
          game_id: string
          id?: string
          user_identifier: string
        }
        Update: {
          clicked_at?: string | null
          game_id?: string
          id?: string
          user_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_clicks_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_uninstalls: {
        Row: {
          game_id: string
          id: string
          uninstalled_at: string | null
          user_identifier: string
        }
        Insert: {
          game_id: string
          id?: string
          uninstalled_at?: string | null
          user_identifier: string
        }
        Update: {
          game_id?: string
          id?: string
          uninstalled_at?: string | null
          user_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_uninstalls_game_id_fkey"
            columns: ["game_id"]
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_threads: {
        Row: {
          created_at: string | null
          first_name: string | null
          is_banned: boolean | null
          thread_id: number
          user_id: number
          username: string | null
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          is_banned?: boolean | null
          thread_id: number
          user_id: number
          username?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          is_banned?: boolean | null
          thread_id?: number
          user_id?: number
          username?: string | null
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
          email_notifications: boolean
          full_name: string | null
          id: string
          password_hash: string
          role: Database["public"]["Enums"]["user_role"]
          unsubscribe_token: string
          updated_at: string
          verified_user: boolean
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          email_notifications?: boolean
          full_name?: string | null
          id?: string
          password_hash: string
          role?: Database["public"]["Enums"]["user_role"]
          unsubscribe_token?: string
          updated_at?: string
          verified_user?: boolean
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          email_notifications?: boolean
          full_name?: string | null
          id?: string
          password_hash?: string
          role?: Database["public"]["Enums"]["user_role"]
          unsubscribe_token?: string
          updated_at?: string
          verified_user?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      games_grouped: {
        Row: {
          banner_path: string | null
          is_adult: boolean | null
          latest_updated_at: string | null
          name: string | null
          name_fts: unknown
          slug: string | null
          thumbnail_path: string | null
          translations: Json | null
          translations_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_game_subscription: {
        Args: { p_game_id: string; p_user_identifier: string }
        Returns: undefined
      }
      check_download_rate_limit: {
        Args: {
          p_game_id: string
          p_max_downloads?: number
          p_size_threshold_mb?: number
          p_time_window_hours?: number
          p_user_identifier: string
        }
        Returns: {
          allowed: boolean
          downloads_today: number
          max_allowed: number
          next_available_at: string
        }[]
      }
      check_steam_library_rate_limit: {
        Args: { p_daily_limit?: number; p_machine_id: string }
        Returns: number
      }
      cleanup_steam_library_rate_limits: { Args: never; Returns: number }
      generate_author_slug: { Args: { author_name: string }; Returns: string }
      get_active_users: {
        Args: { p_date?: string }
        Returns: {
          dau: number
          mau: number
          wau: number
        }[]
      }
      get_downloads_per_player: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          downloads_count: number
          percentage: number
          players_count: number
        }[]
      }
      get_first_session_downloads: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          conversion_rate: number
          first_session_downloads: number
          total_first_launches: number
        }[]
      }
      get_players_with_downloads: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          percentage: number
          players_with_downloads: number
          total_unique_players: number
        }[]
      }
      get_subscription_statistics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_subscriptions_per_user: number
          total_subscriptions: number
          unique_games_subscribed: number
          unique_users_subscribed: number
        }[]
      }
      get_support_statistics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_supports_per_user: number
          total_clicks: number
          unique_users: number
          users_who_supported: number
        }[]
      }
      get_team_statistics: {
        Args: never
        Returns: {
          ai_count: number
          completed_count: number
          games_count: number
          team_name: string
          total_downloads: number
          with_textures_count: number
          with_voice_count: number
        }[]
      }
      get_trending_games: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          downloads: number
          game_id: string
        }[]
      }
      get_uninstall_statistics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_uninstalls_per_user: number
          total_uninstalls: number
          unique_users_uninstalled: number
        }[]
      }
      increment_game_downloads:
        | {
            Args: { p_game_id: string; p_user_identifier: string }
            Returns: undefined
          }
        | {
            Args: {
              p_game_id: string
              p_machine_id?: string
              p_user_identifier: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_game_id: string
              p_is_first_session?: boolean
              p_machine_id?: string
              p_user_identifier: string
            }
            Returns: undefined
          }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_moderator: { Args: never; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      is_verified_user: { Args: never; Returns: boolean }
      remove_game_subscription: {
        Args: { p_game_id: string; p_user_identifier: string }
        Returns: undefined
      }
      search_steam_apps: {
        Args: { limit_val?: number; offset_val?: number; search_query: string }
        Returns: {
          app_id: number
          installdir: string
          name: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_steam_apps_cron: { Args: never; Returns: undefined }
      validate_install_paths: { Args: { paths: Json }; Returns: boolean }
    }
    Enums: {
      ai_status: "edited" | "non-edited"
      game_status: "completed" | "in-progress" | "planned"
      install_source:
        | "steam"
        | "gog"
        | "emulator"
        | "epic"
        | "rockstar"
        | "other"
      user_role: "admin" | "moderator" | "translator" | "user"
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
      ai_status: ["edited", "non-edited"],
      game_status: ["completed", "in-progress", "planned"],
      install_source: ["steam", "gog", "emulator", "epic", "rockstar", "other"],
      user_role: ["admin", "moderator", "translator", "user"],
    },
  },
} as const
