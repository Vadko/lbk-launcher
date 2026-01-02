*   Trying 10.0.1.22:8080...
* TCP_NODELAY set
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0* Connected to 10.0.1.22 (10.0.1.22) port 8080 (#0)
> GET /generators/typescript HTTP/1.1
> Host: 10.0.1.22:8080
> User-Agent: curl/7.68.0
> Accept: */*
> 
* Mark bundle as not supporting multiuse
< HTTP/1.1 200 OK
< access-control-allow-origin: *
< content-type: text/plain; charset=utf-8
< content-length: 139023
< Date: Fri, 02 Jan 2026 03:27:00 GMT
< Connection: keep-alive
< Keep-Alive: timeout=72
< 
{ [81655 bytes data]
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  _realtime: {
    Tables: {
      extensions: {
        Row: {
          id: string
          inserted_at: string
          settings: Json | null
          tenant_external_id: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          id: string
          inserted_at: string
          settings?: Json | null
          tenant_external_id?: string | null
          type?: string | null
          updated_at: string
        }
        Update: {
          id?: string
          inserted_at?: string
          settings?: Json | null
          tenant_external_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extensions_tenant_external_id_fkey"
            columns: ["tenant_external_id"]
            referencedRelation: "tenants"
            referencedColumns: ["external_id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          inserted_at: string | null
          version: number
        }
        Insert: {
          inserted_at?: string | null
          version: number
        }
        Update: {
          inserted_at?: string | null
          version?: number
        }
        Relationships: []
      }
      tenants: {
        Row: {
          external_id: string | null
          id: string
          inserted_at: string
          jwt_jwks: Json | null
          jwt_secret: string | null
          max_bytes_per_second: number
          max_channels_per_client: number
          max_concurrent_users: number
          max_events_per_second: number
          max_joins_per_second: number
          name: string | null
          notify_private_alpha: boolean | null
          postgres_cdc_default: string | null
          private_only: boolean
          suspend: boolean | null
          updated_at: string
        }
        Insert: {
          external_id?: string | null
          id: string
          inserted_at: string
          jwt_jwks?: Json | null
          jwt_secret?: string | null
          max_bytes_per_second?: number
          max_channels_per_client?: number
          max_concurrent_users?: number
          max_events_per_second?: number
          max_joins_per_second?: number
          name?: string | null
          notify_private_alpha?: boolean | null
          postgres_cdc_default?: string | null
          private_only?: boolean
          suspend?: boolean | null
          updated_at: string
        }
        Update: {
          external_id?: string | null
          id?: string
          inserted_at?: string
          jwt_jwks?: Json | null
          jwt_secret?: string | null
          max_bytes_per_second?: number
          max_channels_per_client?: number
          max_concurrent_users?: number
          max_events_per_second?: number
          max_joins_per_second?: number
          name?: string | null
          notify_private_alpha?: boolean | null
          postgres_cdc_default?: string | null
          private_only?: boolean
          suspend?: boolean | null
          updated_at?: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  auth: {
    Tables: {
      audit_log_entries: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string | null
          ip_address: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Relationships: []
      }
      flow_state: {
        Row: {
          auth_code: string
          auth_code_issued_at: string | null
          authentication_method: string
          code_challenge: string
          code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"]
          created_at: string | null
          id: string
          provider_access_token: string | null
          provider_refresh_token: string | null
          provider_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_code: string
          auth_code_issued_at?: string | null
          authentication_method: string
          code_challenge: string
          code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"]
          created_at?: string | null
          id: string
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_code?: string
          auth_code_issued_at?: string | null
          authentication_method?: string
          code_challenge?: string
          code_challenge_method?: Database["auth"]["Enums"]["code_challenge_method"]
          created_at?: string | null
          id?: string
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      identities: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          identity_data: Json
          last_sign_in_at: string | null
          provider: string
          provider_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data: Json
          last_sign_in_at?: string | null
          provider: string
          provider_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data?: Json
          last_sign_in_at?: string | null
          provider?: string
          provider_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          created_at: string | null
          id: string
          raw_base_config: string | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      mfa_amr_claims: {
        Row: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Update: {
          authentication_method?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_amr_claims_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_challenges: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code: string | null
          verified_at: string | null
          web_authn_session_data: Json | null
        }
        Insert: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          ip_address?: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_challenges_auth_factor_id_fkey"
            columns: ["factor_id"]
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_factors: {
        Row: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name: string | null
          id: string
          last_challenged_at: string | null
          last_webauthn_challenge_data: Json | null
          phone: string | null
          secret: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid: string | null
          web_authn_credential: Json | null
        }
        Insert: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Update: {
          created_at?: string
          factor_type?: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id?: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status?: Database["auth"]["Enums"]["factor_status"]
          updated_at?: string
          user_id?: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_factors_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorizations: {
        Row: {
          approved_at: string | null
          authorization_code: string | null
          authorization_id: string
          client_id: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string
          expires_at: string
          id: string
          nonce: string | null
          redirect_uri: string
          resource: string | null
          response_type: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state: string | null
          status: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id: string
          client_id: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id: string
          nonce?: string | null
          redirect_uri: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id?: string
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri?: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope?: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorizations_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorizations_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_client_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Insert: {
          code_verifier?: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          id?: string
          provider_type?: string
        }
        Relationships: []
      }
      oauth_clients: {
        Row: {
          client_name: string | null
          client_secret_hash: string | null
          client_type: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri: string | null
          created_at: string
          deleted_at: string | null
          grant_types: string
          id: string
          logo_uri: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types: string
          id: string
          logo_uri?: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types?: string
          id?: string
          logo_uri?: string | null
          redirect_uris?: string
          registration_type?: Database["auth"]["Enums"]["oauth_registration_type"]
          updated_at?: string
        }
        Relationships: []
      }
      oauth_consents: {
        Row: {
          client_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          scopes: string
          user_id: string
        }
        Insert: {
          client_id: string
          granted_at?: string
          id: string
          revoked_at?: string | null
          scopes: string
          user_id: string
        }
        Update: {
          client_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_consents_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_tokens: {
        Row: {
          created_at: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relates_to?: string
          token_hash?: string
          token_type?: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_tokens_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          id: number
          instance_id: string | null
          parent: string | null
          revoked: boolean | null
          session_id: string | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_providers: {
        Row: {
          attribute_mapping: Json | null
          created_at: string | null
          entity_id: string
          id: string
          metadata_url: string | null
          metadata_xml: string
          name_id_format: string | null
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id: string
          id: string
          metadata_url?: string | null
          metadata_xml: string
          name_id_format?: string | null
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id?: string
          id?: string
          metadata_url?: string | null
          metadata_xml?: string
          name_id_format?: string | null
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_providers_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_relay_states: {
        Row: {
          created_at: string | null
          flow_state_id: string | null
          for_email: string | null
          id: string
          redirect_to: string | null
          request_id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id: string
          redirect_to?: string | null
          request_id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id?: string
          redirect_to?: string | null
          request_id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_relay_states_flow_state_id_fkey"
            columns: ["flow_state_id"]
            referencedRelation: "flow_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saml_relay_states_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          version: string
        }
        Insert: {
          version: string
        }
        Update: {
          version?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          aal: Database["auth"]["Enums"]["aal_level"] | null
          created_at: string | null
          factor_id: string | null
          id: string
          ip: unknown | null
          not_after: string | null
          oauth_client_id: string | null
          refresh_token_counter: number | null
          refresh_token_hmac_key: string | null
          refreshed_at: string | null
          scopes: string | null
          tag: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id: string
          ip?: unknown | null
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id?: string
          ip?: unknown | null
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domains_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_providers: {
        Row: {
          created_at: string | null
          disabled: boolean | null
          id: string
          resource_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled?: boolean | null
          id: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean
          is_sso_user: boolean
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      jwt: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      aal_level: "aal1" | "aal2" | "aal3"
      code_challenge_method: "s256" | "plain"
      factor_status: "unverified" | "verified"
      factor_type: "totp" | "webauthn" | "phone"
      oauth_authorization_status: "pending" | "approved" | "denied" | "expired"
      oauth_client_type: "public" | "confidential"
      oauth_registration_type: "dynamic" | "manual"
      oauth_response_type: "code"
      one_time_token_type:
        | "confirmation_token"
        | "reauthentication_token"
        | "recovery_token"
        | "email_change_token_new"
        | "email_change_token_current"
        | "phone_change_token"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  cron: {
    Tables: {
      job: {
        Row: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string | null
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }
        Insert: {
          active?: boolean
          command: string
          database?: string
          jobid?: number
          jobname?: string | null
          nodename?: string
          nodeport?: number
          schedule: string
          username?: string
        }
        Update: {
          active?: boolean
          command?: string
          database?: string
          jobid?: number
          jobname?: string | null
          nodename?: string
          nodeport?: number
          schedule?: string
          username?: string
        }
        Relationships: []
      }
      job_run_details: {
        Row: {
          command: string | null
          database: string | null
          end_time: string | null
          job_pid: number | null
          jobid: number | null
          return_message: string | null
          runid: number
          start_time: string | null
          status: string | null
          username: string | null
        }
        Insert: {
          command?: string | null
          database?: string | null
          end_time?: string | null
          job_pid?: number | null
          jobid?: number | null
          return_message?: string | null
          runid?: number
          start_time?: string | null
          status?: string | null
          username?: string | null
        }
        Update: {
          command?: string | null
          database?: string | null
          end_time?: string | null
          job_pid?: number | null
          jobid?: number | null
          return_message?: string | null
          runid?: number
          start_time?: string | null
          status?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alter_job: {
        Args: {
          job_id: number
          schedule?: string
          command?: string
          database?: string
          username?: string
          active?: boolean
        }
        Returns: undefined
      }
      schedule: {
        Args:
          | { job_name: string; schedule: string; command: string }
          | { schedule: string; command: string }
        Returns: number
      }
      schedule_in_database: {
        Args: {
          job_name: string
          schedule: string
          command: string
          database: string
          username?: string
          active?: boolean
        }
        Returns: number
      }
      unschedule: {
        Args: { job_id: number } | { job_name: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  extensions: {
    Tables: {
      wrappers_fdw_stats: {
        Row: {
          bytes_in: number | null
          bytes_out: number | null
          create_times: number | null
          created_at: string
          fdw_name: string
          metadata: Json | null
          rows_in: number | null
          rows_out: number | null
          updated_at: string
        }
        Insert: {
          bytes_in?: number | null
          bytes_out?: number | null
          create_times?: number | null
          created_at?: string
          fdw_name: string
          metadata?: Json | null
          rows_in?: number | null
          rows_out?: number | null
          updated_at?: string
        }
        Update: {
          bytes_in?: number | null
          bytes_out?: number | null
          create_times?: number | null
          created_at?: string
          fdw_name?: string
          metadata?: Json | null
          rows_in?: number | null
          rows_out?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      pg_stat_statements: {
        Row: {
          blk_read_time: number | null
          blk_write_time: number | null
          calls: number | null
          dbid: unknown | null
          jit_emission_count: number | null
          jit_emission_time: number | null
          jit_functions: number | null
          jit_generation_time: number | null
          jit_inlining_count: number | null
          jit_inlining_time: number | null
          jit_optimization_count: number | null
          jit_optimization_time: number | null
          local_blks_dirtied: number | null
          local_blks_hit: number | null
          local_blks_read: number | null
          local_blks_written: number | null
          max_exec_time: number | null
          max_plan_time: number | null
          mean_exec_time: number | null
          mean_plan_time: number | null
          min_exec_time: number | null
          min_plan_time: number | null
          plans: number | null
          query: string | null
          queryid: number | null
          rows: number | null
          shared_blks_dirtied: number | null
          shared_blks_hit: number | null
          shared_blks_read: number | null
          shared_blks_written: number | null
          stddev_exec_time: number | null
          stddev_plan_time: number | null
          temp_blk_read_time: number | null
          temp_blk_write_time: number | null
          temp_blks_read: number | null
          temp_blks_written: number | null
          toplevel: boolean | null
          total_exec_time: number | null
          total_plan_time: number | null
          userid: unknown | null
          wal_bytes: number | null
          wal_fpi: number | null
          wal_records: number | null
        }
        Relationships: []
      }
      pg_stat_statements_info: {
        Row: {
          dealloc: number | null
          stats_reset: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      airtable_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      airtable_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      airtable_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      algorithm_sign: {
        Args: { signables: string; secret: string; algorithm: string }
        Returns: string
      }
      armor: {
        Args: { "": string }
        Returns: string
      }
      auth0_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      auth0_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      auth0_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      big_query_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      big_query_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      big_query_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      click_house_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      click_house_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      click_house_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      cognito_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      cognito_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      cognito_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      dearmor: {
        Args: { "": string }
        Returns: string
      }
      firebase_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      firebase_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      firebase_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      gen_random_bytes: {
        Args: { "": number }
        Returns: string
      }
      gen_random_uuid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      gen_salt: {
        Args: { "": string }
        Returns: string
      }
      hello_world_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      hello_world_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      hello_world_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      http: {
        Args: {
          request: Database["extensions"]["CompositeTypes"]["http_request"]
        }
        Returns: Database["extensions"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { uri: string }
          | { uri: string; content: string; content_type: string }
        Returns: Database["extensions"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { uri: string } | { uri: string; data: Json }
        Returns: Database["extensions"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["extensions"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["extensions"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { uri: string; content: string; content_type: string }
        Returns: Database["extensions"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { uri: string; content: string; content_type: string }
          | { uri: string; data: Json }
        Returns: Database["extensions"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { uri: string; content: string; content_type: string }
        Returns: Database["extensions"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      logflare_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      logflare_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      logflare_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      mssql_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      mssql_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      mssql_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      pg_stat_statements: {
        Args: { showtext: boolean }
        Returns: Record<string, unknown>[]
      }
      pg_stat_statements_info: {
        Args: Record<PropertyKey, never>
        Returns: Record<string, unknown>
      }
      pg_stat_statements_reset: {
        Args: { userid?: unknown; dbid?: unknown; queryid?: number }
        Returns: undefined
      }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgp_key_id: {
        Args: { "": string }
        Returns: string
      }
      redis_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      redis_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      redis_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      s3_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      s3_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      s3_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      sign: {
        Args: { payload: Json; secret: string; algorithm?: string }
        Returns: string
      }
      stripe_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      stripe_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      stripe_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      try_cast_double: {
        Args: { inp: string }
        Returns: number
      }
      url_decode: {
        Args: { data: string }
        Returns: string
      }
      url_encode: {
        Args: { data: string }
        Returns: string
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
      uuid_generate_v1: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uuid_generate_v1mc: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uuid_generate_v3: {
        Args: { namespace: string; name: string }
        Returns: string
      }
      uuid_generate_v4: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uuid_generate_v5: {
        Args: { namespace: string; name: string }
        Returns: string
      }
      uuid_nil: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uuid_ns_dns: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uuid_ns_oid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uuid_ns_url: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      uuid_ns_x500: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      verify: {
        Args: { token: string; secret: string; algorithm?: string }
        Returns: {
          header: Json
          payload: Json
          valid: boolean
        }[]
      }
      wasm_fdw_handler: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      wasm_fdw_meta: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          version: string
          author: string
          website: string
        }[]
      }
      wasm_fdw_validator: {
        Args: { options: string[]; catalog: unknown }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers:
          | Database["extensions"]["CompositeTypes"]["http_header"][]
          | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers:
          | Database["extensions"]["CompositeTypes"]["http_header"][]
          | null
        content: string | null
      }
    }
  }
  graphql: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _internal_resolve: {
        Args: {
          query: string
          variables?: Json
          operationName?: string
          extensions?: Json
        }
        Returns: Json
      }
      comment_directive: {
        Args: { comment_: string }
        Returns: Json
      }
      exception: {
        Args: { message: string }
        Returns: string
      }
      get_schema_version: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      resolve: {
        Args: {
          query: string
          variables?: Json
          operationName?: string
          extensions?: Json
        }
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
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
  net: {
    Tables: {
      _http_response: {
        Row: {
          content: string | null
          content_type: string | null
          created: string
          error_msg: string | null
          headers: Json | null
          id: number | null
          status_code: number | null
          timed_out: boolean | null
        }
        Insert: {
          content?: string | null
          content_type?: string | null
          created?: string
          error_msg?: string | null
          headers?: Json | null
          id?: number | null
          status_code?: number | null
          timed_out?: boolean | null
        }
        Update: {
          content?: string | null
          content_type?: string | null
          created?: string
          error_msg?: string | null
          headers?: Json | null
          id?: number | null
          status_code?: number | null
          timed_out?: boolean | null
        }
        Relationships: []
      }
      http_request_queue: {
        Row: {
          body: string | null
          headers: Json
          id: number
          method: string
          timeout_milliseconds: number
          url: string
        }
        Insert: {
          body?: string | null
          headers: Json
          id?: number
          method: string
          timeout_milliseconds: number
          url: string
        }
        Update: {
          body?: string | null
          headers?: Json
          id?: number
          method?: string
          timeout_milliseconds?: number
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _await_response: {
        Args: { request_id: number }
        Returns: boolean
      }
      _encode_url_with_params_array: {
        Args: { url: string; params_array: string[] }
        Returns: string
      }
      _http_collect_response: {
        Args: { request_id: number; async?: boolean }
        Returns: Database["net"]["CompositeTypes"]["http_response_result"]
      }
      _urlencode_string: {
        Args: { string: string }
        Returns: string
      }
      check_worker_is_up: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      http_collect_response: {
        Args: { request_id: number; async?: boolean }
        Returns: Database["net"]["CompositeTypes"]["http_response_result"]
      }
      http_delete: {
        Args: {
          url: string
          params?: Json
          headers?: Json
          timeout_milliseconds?: number
        }
        Returns: number
      }
      http_get: {
        Args: {
          url: string
          params?: Json
          headers?: Json
          timeout_milliseconds?: number
        }
        Returns: number
      }
      http_post: {
        Args: {
          url: string
          body?: Json
          params?: Json
          headers?: Json
          timeout_milliseconds?: number
        }
        Returns: number
      }
      worker_restart: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      request_status: "PENDING" | "SUCCESS" | "ERROR"
    }
    CompositeTypes: {
      http_response: {
        status_code: number | null
        headers: Json | null
        body: string | null
      }
      http_response_result: {
        status: Database["net"]["Enums"]["request_status"] | null
        message: string | null
        response: Database["net"]["CompositeTypes"]["http_response"] | null
      }
    }
  }
  pgbouncer: {
    Tables: {
      [_ in never]: never
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
  pgsodium: {
    Tables: {
      key: {
        Row: {
          associated_data: string | null
          comment: string | null
          created: string
          expires: string | null
          id: string
          key_context: string | null
          key_id: number | null
          key_type: Database["pgsodium"]["Enums"]["key_type"] | null
          name: string | null
          parent_key: string | null
          raw_key: string | null
          raw_key_nonce: string | null
          status: Database["pgsodium"]["Enums"]["key_status"] | null
          user_data: string | null
        }
        Insert: {
          associated_data?: string | null
          comment?: string | null
          created?: string
          expires?: string | null
          id?: string
          key_context?: string | null
          key_id?: number | null
          key_type?: Database["pgsodium"]["Enums"]["key_type"] | null
          name?: string | null
          parent_key?: string | null
          raw_key?: string | null
          raw_key_nonce?: string | null
          status?: Database["pgsodium"]["Enums"]["key_status"] | null
          user_data?: string | null
        }
        Update: {
          associated_data?: string | null
          comment?: string | null
          created?: string
          expires?: string | null
          id?: string
          key_context?: string | null
          key_id?: number | null
          key_type?: Database["pgsodium"]["Enums"]["key_type"] | null
          name?: string | null
          parent_key?: string | null
          raw_key?: string | null
          raw_key_nonce?: string | null
          status?: Database["pgsodium"]["Enums"]["key_status"] | null
          user_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_parent_key_fkey"
            columns: ["parent_key"]
            referencedRelation: "decrypted_key"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_parent_key_fkey"
            columns: ["parent_key"]
            referencedRelation: "key"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_parent_key_fkey"
            columns: ["parent_key"]
            referencedRelation: "valid_key"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      decrypted_key: {
        Row: {
          associated_data: string | null
          comment: string | null
          created: string | null
          decrypted_raw_key: string | null
          expires: string | null
          id: string | null
          key_context: string | null
          key_id: number | null
          key_type: Database["pgsodium"]["Enums"]["key_type"] | null
          name: string | null
          parent_key: string | null
          raw_key: string | null
          raw_key_nonce: string | null
          status: Database["pgsodium"]["Enums"]["key_status"] | null
        }
        Insert: {
          associated_data?: string | null
          comment?: string | null
          created?: string | null
          decrypted_raw_key?: never
          expires?: string | null
          id?: string | null
          key_context?: string | null
          key_id?: number | null
          key_type?: Database["pgsodium"]["Enums"]["key_type"] | null
          name?: string | null
          parent_key?: string | null
          raw_key?: string | null
          raw_key_nonce?: string | null
          status?: Database["pgsodium"]["Enums"]["key_status"] | null
        }
        Update: {
          associated_data?: string | null
          comment?: string | null
          created?: string | null
          decrypted_raw_key?: never
          expires?: string | null
          id?: string | null
          key_context?: string | null
          key_id?: number | null
          key_type?: Database["pgsodium"]["Enums"]["key_type"] | null
          name?: string | null
          parent_key?: string | null
          raw_key?: string | null
          raw_key_nonce?: string | null
          status?: Database["pgsodium"]["Enums"]["key_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "key_parent_key_fkey"
            columns: ["parent_key"]
            referencedRelation: "decrypted_key"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_parent_key_fkey"
            columns: ["parent_key"]
            referencedRelation: "key"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_parent_key_fkey"
            columns: ["parent_key"]
            referencedRelation: "valid_key"
            referencedColumns: ["id"]
          },
        ]
      }
      mask_columns: {
        Row: {
          associated_columns: string | null
          attname: unknown | null
          attrelid: unknown | null
          format_type: string | null
          key_id: string | null
          key_id_column: string | null
          nonce_column: string | null
        }
        Relationships: []
      }
      masking_rule: {
        Row: {
          associated_columns: string | null
          attname: unknown | null
          attnum: number | null
          attrelid: unknown | null
          col_description: string | null
          format_type: string | null
          key_id: string | null
          key_id_column: string | null
          nonce_column: string | null
          priority: number | null
          relname: unknown | null
          relnamespace: unknown | null
          security_invoker: boolean | null
          view_name: string | null
        }
        Relationships: []
      }
      valid_key: {
        Row: {
          associated_data: string | null
          created: string | null
          expires: string | null
          id: string | null
          key_context: string | null
          key_id: number | null
          key_type: Database["pgsodium"]["Enums"]["key_type"] | null
          name: string | null
          status: Database["pgsodium"]["Enums"]["key_status"] | null
        }
        Insert: {
          associated_data?: string | null
          created?: string | null
          expires?: string | null
          id?: string | null
          key_context?: string | null
          key_id?: number | null
          key_type?: Database["pgsodium"]["Enums"]["key_type"] | null
          name?: string | null
          status?: Database["pgsodium"]["Enums"]["key_status"] | null
        }
        Update: {
          associated_data?: string | null
          created?: string | null
          expires?: string | null
          id?: string | null
          key_context?: string | null
          key_id?: number | null
          key_type?: Database["pgsodium"]["Enums"]["key_type"] | null
          name?: string | null
          status?: Database["pgsodium"]["Enums"]["key_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_key: {
        Args: {
          key_type?: Database["pgsodium"]["Enums"]["key_type"]
          name?: string
          raw_key?: string
          raw_key_nonce?: string
          parent_key?: string
          key_context?: string
          expires?: string
          associated_data?: string
        }
        Returns: {
          associated_data: string | null
          created: string | null
          expires: string | null
          id: string | null
          key_context: string | null
          key_id: number | null
          key_type: Database["pgsodium"]["Enums"]["key_type"] | null
          name: string | null
          status: Database["pgsodium"]["Enums"]["key_status"] | null
        }
      }
      create_mask_view: {
        Args:
          | { relid: unknown; debug?: boolean }
          | { relid: unknown; subid: number; debug?: boolean }
        Returns: undefined
      }
      crypto_aead_det_decrypt: {
        Args:
          | {
              ciphertext: string
              additional: string
              key: string
              nonce?: string
            }
          | {
              message: string
              additional: string
              key_id: number
              context?: string
              nonce?: string
            }
          | { message: string; additional: string; key_uuid: string }
          | {
              message: string
              additional: string
              key_uuid: string
              nonce: string
            }
        Returns: string
      }
      crypto_aead_det_encrypt: {
        Args:
          | { message: string; additional: string; key: string; nonce?: string }
          | {
              message: string
              additional: string
              key_id: number
              context?: string
              nonce?: string
            }
          | { message: string; additional: string; key_uuid: string }
          | {
              message: string
              additional: string
              key_uuid: string
              nonce: string
            }
        Returns: string
      }
      crypto_aead_det_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_aead_det_noncegen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_aead_ietf_decrypt: {
        Args:
          | { message: string; additional: string; nonce: string; key: string }
          | {
              message: string
              additional: string
              nonce: string
              key_id: number
              context?: string
            }
          | {
              message: string
              additional: string
              nonce: string
              key_uuid: string
            }
        Returns: string
      }
      crypto_aead_ietf_encrypt: {
        Args:
          | { message: string; additional: string; nonce: string; key: string }
          | {
              message: string
              additional: string
              nonce: string
              key_id: number
              context?: string
            }
          | {
              message: string
              additional: string
              nonce: string
              key_uuid: string
            }
        Returns: string
      }
      crypto_aead_ietf_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_aead_ietf_noncegen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_auth: {
        Args:
          | { message: string; key: string }
          | { message: string; key_id: number; context?: string }
          | { message: string; key_uuid: string }
        Returns: string
      }
      crypto_auth_hmacsha256: {
        Args:
          | { message: string; key_id: number; context?: string }
          | { message: string; key_uuid: string }
          | { message: string; secret: string }
        Returns: string
      }
      crypto_auth_hmacsha256_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_auth_hmacsha256_verify: {
        Args:
          | { hash: string; message: string; key_id: number; context?: string }
          | { hash: string; message: string; secret: string }
          | { signature: string; message: string; key_uuid: string }
        Returns: boolean
      }
      crypto_auth_hmacsha512: {
        Args:
          | { message: string; key_id: number; context?: string }
          | { message: string; key_uuid: string }
          | { message: string; secret: string }
        Returns: string
      }
      crypto_auth_hmacsha512_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_auth_hmacsha512_verify: {
        Args:
          | { hash: string; message: string; key_id: number; context?: string }
          | { hash: string; message: string; secret: string }
          | { signature: string; message: string; key_uuid: string }
        Returns: boolean
      }
      crypto_auth_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_auth_verify: {
        Args:
          | { mac: string; message: string; key: string }
          | { mac: string; message: string; key_id: number; context?: string }
          | { mac: string; message: string; key_uuid: string }
        Returns: boolean
      }
      crypto_box: {
        Args: { message: string; nonce: string; public: string; secret: string }
        Returns: string
      }
      crypto_box_new_keypair: {
        Args: Record<PropertyKey, never>
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_box_keypair"]
      }
      crypto_box_new_seed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_box_noncegen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_box_open: {
        Args: {
          ciphertext: string
          nonce: string
          public: string
          secret: string
        }
        Returns: string
      }
      crypto_box_seal: {
        Args: { message: string; public_key: string }
        Returns: string
      }
      crypto_box_seal_open: {
        Args: { ciphertext: string; public_key: string; secret_key: string }
        Returns: string
      }
      crypto_box_seed_new_keypair: {
        Args: { seed: string }
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_box_keypair"]
      }
      crypto_generichash: {
        Args:
          | { message: string; key: number; context?: string }
          | { message: string; key?: string }
          | { message: string; key_uuid: string }
        Returns: string
      }
      crypto_generichash_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_hash_sha256: {
        Args: { message: string }
        Returns: string
      }
      crypto_hash_sha512: {
        Args: { message: string }
        Returns: string
      }
      crypto_kdf_derive_from_key: {
        Args:
          | {
              subkey_size: number
              subkey_id: number
              context: string
              primary_key: string
            }
          | {
              subkey_size: number
              subkey_id: number
              context: string
              primary_key: string
            }
        Returns: string
      }
      crypto_kdf_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_kx_client_session_keys: {
        Args: { client_pk: string; client_sk: string; server_pk: string }
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_kx_session"]
      }
      crypto_kx_new_keypair: {
        Args: Record<PropertyKey, never>
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_kx_keypair"]
      }
      crypto_kx_new_seed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_kx_seed_new_keypair: {
        Args: { seed: string }
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_kx_keypair"]
      }
      crypto_kx_server_session_keys: {
        Args: { server_pk: string; server_sk: string; client_pk: string }
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_kx_session"]
      }
      crypto_pwhash: {
        Args: { password: string; salt: string }
        Returns: string
      }
      crypto_pwhash_saltgen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_pwhash_str: {
        Args: { password: string }
        Returns: string
      }
      crypto_pwhash_str_verify: {
        Args: { hashed_password: string; password: string }
        Returns: boolean
      }
      crypto_secretbox: {
        Args:
          | { message: string; nonce: string; key: string }
          | { message: string; nonce: string; key_id: number; context?: string }
          | { message: string; nonce: string; key_uuid: string }
        Returns: string
      }
      crypto_secretbox_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_secretbox_noncegen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_secretbox_open: {
        Args:
          | { ciphertext: string; nonce: string; key: string }
          | { message: string; nonce: string; key_id: number; context?: string }
          | { message: string; nonce: string; key_uuid: string }
        Returns: string
      }
      crypto_secretstream_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_shorthash: {
        Args:
          | { message: string; key: number; context?: string }
          | { message: string; key: string }
          | { message: string; key_uuid: string }
        Returns: string
      }
      crypto_shorthash_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_sign: {
        Args: { message: string; key: string }
        Returns: string
      }
      crypto_sign_detached: {
        Args: { message: string; key: string }
        Returns: string
      }
      crypto_sign_final_create: {
        Args: { state: string; key: string }
        Returns: string
      }
      crypto_sign_final_verify: {
        Args: { state: string; signature: string; key: string }
        Returns: boolean
      }
      crypto_sign_init: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_sign_new_keypair: {
        Args: Record<PropertyKey, never>
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_sign_keypair"]
      }
      crypto_sign_new_seed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_sign_open: {
        Args: { signed_message: string; key: string }
        Returns: string
      }
      crypto_sign_seed_new_keypair: {
        Args: { seed: string }
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_sign_keypair"]
      }
      crypto_sign_update: {
        Args: { state: string; message: string }
        Returns: string
      }
      crypto_sign_update_agg1: {
        Args: { state: string; message: string }
        Returns: string
      }
      crypto_sign_update_agg2: {
        Args: { cur_state: string; initial_state: string; message: string }
        Returns: string
      }
      crypto_sign_verify_detached: {
        Args: { sig: string; message: string; key: string }
        Returns: boolean
      }
      crypto_signcrypt_new_keypair: {
        Args: Record<PropertyKey, never>
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_signcrypt_keypair"]
      }
      crypto_signcrypt_sign_after: {
        Args: { state: string; sender_sk: string; ciphertext: string }
        Returns: string
      }
      crypto_signcrypt_sign_before: {
        Args: {
          sender: string
          recipient: string
          sender_sk: string
          recipient_pk: string
          additional: string
        }
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_signcrypt_state_key"]
      }
      crypto_signcrypt_verify_after: {
        Args: {
          state: string
          signature: string
          sender_pk: string
          ciphertext: string
        }
        Returns: boolean
      }
      crypto_signcrypt_verify_before: {
        Args: {
          signature: string
          sender: string
          recipient: string
          additional: string
          sender_pk: string
          recipient_sk: string
        }
        Returns: Database["pgsodium"]["CompositeTypes"]["crypto_signcrypt_state_key"]
      }
      crypto_signcrypt_verify_public: {
        Args: {
          signature: string
          sender: string
          recipient: string
          additional: string
          sender_pk: string
          ciphertext: string
        }
        Returns: boolean
      }
      crypto_stream_xchacha20_keygen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      crypto_stream_xchacha20_noncegen: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      decrypted_columns: {
        Args: { relid: unknown }
        Returns: string
      }
      derive_key: {
        Args: { key_id: number; key_len?: number; context?: string }
        Returns: string
      }
      disable_security_label_trigger: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      enable_security_label_trigger: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      encrypted_column: {
        Args: { relid: unknown; m: Record<string, unknown> }
        Returns: string
      }
      encrypted_columns: {
        Args: { relid: unknown }
        Returns: string
      }
      get_key_by_id: {
        Args: { "": string }
        Returns: {
          associated_data: string | null
          created: string | null
          expires: string | null
          id: string | null
          key_context: string | null
          key_id: number | null
          key_type: Database["pgsodium"]["Enums"]["key_type"] | null
          name: string | null
          status: Database["pgsodium"]["Enums"]["key_status"] | null
        }
      }
      get_key_by_name: {
        Args: { "": string }
        Returns: {
          associated_data: string | null
          created: string | null
          expires: string | null
          id: string | null
          key_context: string | null
          key_id: number | null
          key_type: Database["pgsodium"]["Enums"]["key_type"] | null
          name: string | null
          status: Database["pgsodium"]["Enums"]["key_status"] | null
        }
      }
      get_named_keys: {
        Args: { filter?: string }
        Returns: {
          associated_data: string | null
          created: string | null
          expires: string | null
          id: string | null
          key_context: string | null
          key_id: number | null
          key_type: Database["pgsodium"]["Enums"]["key_type"] | null
          name: string | null
          status: Database["pgsodium"]["Enums"]["key_status"] | null
        }[]
      }
      has_mask: {
        Args: { role: unknown; source_name: string }
        Returns: boolean
      }
      mask_columns: {
        Args: { source_relid: unknown }
        Returns: {
          attname: unknown
          key_id: string
          key_id_column: string
          associated_column: string
          nonce_column: string
          format_type: string
        }[]
      }
      mask_role: {
        Args: { masked_role: unknown; source_name: string; view_name: string }
        Returns: undefined
      }
      pgsodium_derive: {
        Args: { key_id: number; key_len?: number; context?: string }
        Returns: string
      }
      randombytes_buf: {
        Args: { size: number }
        Returns: string
      }
      randombytes_buf_deterministic: {
        Args: { size: number; seed: string }
        Returns: string
      }
      randombytes_new_seed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      randombytes_random: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      randombytes_uniform: {
        Args: { upper_bound: number }
        Returns: number
      }
      sodium_base642bin: {
        Args: { base64: string }
        Returns: string
      }
      sodium_bin2base64: {
        Args: { bin: string }
        Returns: string
      }
      update_mask: {
        Args: { target: unknown; debug?: boolean }
        Returns: undefined
      }
      update_masks: {
        Args: { debug?: boolean }
        Returns: undefined
      }
      version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      key_status: "default" | "valid" | "invalid" | "expired"
      key_type:
        | "aead-ietf"
        | "aead-det"
        | "hmacsha512"
        | "hmacsha256"
        | "auth"
        | "shorthash"
        | "generichash"
        | "kdf"
        | "secretbox"
        | "secretstream"
        | "stream_xchacha20"
    }
    CompositeTypes: {
      _key_id_context: {
        key_id: number | null
        key_context: string | null
      }
      crypto_box_keypair: {
        public: string | null
        secret: string | null
      }
      crypto_kx_keypair: {
        public: string | null
        secret: string | null
      }
      crypto_kx_session: {
        rx: string | null
        tx: string | null
      }
      crypto_sign_keypair: {
        public: string | null
        secret: string | null
      }
      crypto_signcrypt_keypair: {
        public: string | null
        secret: string | null
      }
      crypto_signcrypt_state_key: {
        state: string | null
        shared_key: string | null
      }
    }
  }
  pgsodium_masks: {
    Tables: {
      [_ in never]: never
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
          machine_id: string | null
          user_identifier: string
        }
        Insert: {
          downloaded_at?: string | null
          game_id: string
          id?: string
          machine_id?: string | null
          user_identifier: string
        }
        Update: {
          downloaded_at?: string | null
          game_id?: string
          id?: string
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
          ai: boolean
          approved_at: string | null
          approved_by: string | null
          archive_file_list: Json | null
          archive_hash: string | null
          archive_path: string | null
          archive_size: string | null
          banner_path: string | null
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
          ai?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
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
          ai?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
          archive_hash?: string | null
          archive_path?: string | null
          archive_size?: string | null
          banner_path?: string | null
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
          ai: boolean
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          archive_file_list: Json | null
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
          ai?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
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
          ai?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archive_file_list?: Json | null
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
          p_user_identifier: string
          p_size_threshold_mb?: number
          p_max_downloads?: number
          p_time_window_hours?: number
        }
        Returns: {
          allowed: boolean
          downloads_today: number
          max_allowed: number
          next_available_at: string
        }[]
      }
      generate_author_slug: {
        Args: { author_name: string }
        Returns: string
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_game_downloads: {
        Args:
          | { p_game_id: string; p_user_identifier: string }
          | {
              p_game_id: string
              p_user_identifier: string
              p_machine_id?: string
            }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_or_moderator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_moderator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_verified_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      remove_game_subscription: {
        Args: { p_game_id: string; p_user_identifier: string }
        Returns: undefined
      }
      search_steam_apps: {
        Args: { search_query: string; limit_val?: number; offset_val?: number }
        Returns: {
          app_id: number
          name: string
          installdir: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sync_steam_apps_cron: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      validate_install_paths: {
        Args: { paths: Json }
        Returns: boolean
      }
    }
    Enums: {
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
  realtime: {
    Tables: {
      messages: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages_2025_12_30: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages_2025_12_31: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages_2026_01_01: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages_2026_01_02: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages_2026_01_03: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages_2026_01_04: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages_2026_01_05: {
        Row: {
          event: string | null
          extension: string
          id: string
          inserted_at: string
          payload: Json | null
          private: boolean | null
          topic: string
          updated_at: string
        }
        Insert: {
          event?: string | null
          extension: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic: string
          updated_at?: string
        }
        Update: {
          event?: string | null
          extension?: string
          id?: string
          inserted_at?: string
          payload?: Json | null
          private?: boolean | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      schema_migrations: {
        Row: {
          inserted_at: string | null
          version: number
        }
        Insert: {
          inserted_at?: string | null
          version: number
        }
        Update: {
          inserted_at?: string | null
          version?: number
        }
        Relationships: []
      }
      subscription: {
        Row: {
          claims: Json
          claims_role: unknown
          created_at: string
          entity: unknown
          filters: Database["realtime"]["CompositeTypes"]["user_defined_filter"][]
          id: number
          subscription_id: string
        }
        Insert: {
          claims: Json
          claims_role?: unknown
          created_at?: string
          entity: unknown
          filters?: Database["realtime"]["CompositeTypes"]["user_defined_filter"][]
          id?: never
          subscription_id: string
        }
        Update: {
          claims?: Json
          claims_role?: unknown
          created_at?: string
          entity?: unknown
          filters?: Database["realtime"]["CompositeTypes"]["user_defined_filter"][]
          id?: never
          subscription_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_rls: {
        Args: { wal: Json; max_record_bytes?: number }
        Returns: Database["realtime"]["CompositeTypes"]["wal_rls"][]
      }
      broadcast_changes: {
        Args: {
          topic_name: string
          event_name: string
          operation: string
          table_name: string
          table_schema: string
          new: Record<string, unknown>
          old: Record<string, unknown>
          level?: string
        }
        Returns: undefined
      }
      build_prepared_statement_sql: {
        Args: {
          prepared_statement_name: string
          entity: unknown
          columns: Database["realtime"]["CompositeTypes"]["wal_column"][]
        }
        Returns: string
      }
      cast: {
        Args: { val: string; type_: unknown }
        Returns: Json
      }
      check_equality_op: {
        Args: {
          op: Database["realtime"]["Enums"]["equality_op"]
          type_: unknown
          val_1: string
          val_2: string
        }
        Returns: boolean
      }
      is_visible_through_filters: {
        Args: {
          columns: Database["realtime"]["CompositeTypes"]["wal_column"][]
          filters: Database["realtime"]["CompositeTypes"]["user_defined_filter"][]
        }
        Returns: boolean
      }
      list_changes: {
        Args: {
          publication: unknown
          slot_name: unknown
          max_changes: number
          max_record_bytes: number
        }
        Returns: Database["realtime"]["CompositeTypes"]["wal_rls"][]
      }
      quote_wal2json: {
        Args: { entity: unknown }
        Returns: string
      }
      send: {
        Args: { payload: Json; event: string; topic: string; private?: boolean }
        Returns: undefined
      }
      to_regrole: {
        Args: { role_name: string }
        Returns: unknown
      }
      topic: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      action: "INSERT" | "UPDATE" | "DELETE" | "TRUNCATE" | "ERROR"
      equality_op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in"
    }
    CompositeTypes: {
      user_defined_filter: {
        column_name: string | null
        op: Database["realtime"]["Enums"]["equality_op"] | null
        value: string | null
      }
      wal_column: {
        name: string | null
        type_name: string | null
        type_oid: unknown | null
        value: Json | null
        is_pkey: boolean | null
        is_selectable: boolean | null
      }
      wal_rls: {
        wal: Json | null
        is_rls_enabled: boolean | null
        subscription_ids: string[] | null
        errors: string[] | null
      }
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; name: string; owner: string; metadata: Json }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_level: {
        Args: { name: string }
        Returns: number
      }
      get_prefix: {
        Args: { name: string }
        Returns: string
      }
      get_prefixes: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_legacy_v1: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_v1_optimised: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_v2: {
        Args: {
          prefix: string
          bucket_name: string
          limits?: number
          levels?: number
          start_after?: string
          sort_order?: string
          sort_column?: string
          sort_column_after?: string
        }
        Returns: {
          key: string
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  supabase_functions: {
    Tables: {
      hooks: {
        Row: {
          created_at: string
          hook_name: string
          hook_table_id: number
          id: number
          request_id: number | null
        }
        Insert: {
          created_at?: string
          hook_name: string
          hook_table_id: number
          id?: number
          request_id?: number | null
        }
        Update: {
          created_at?: string
          hook_name?: string
          hook_table_id?: number
          id?: number
          request_id?: number | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          inserted_at: string
          version: string
        }
        Insert: {
          inserted_at?: string
          version: string
        }
        Update: {
          inserted_at?: string
          version?: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  vault: {
    Tables: {
      secrets: {
        Row: {
          created_at: string
          description: string
          id: string
          key_id: string | null
          name: string | null
          nonce: string | null
          secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      decrypted_secrets: {
        Row: {
          created_at: string | null
          decrypted_secret: string | null
          description: string | null
          id: string | null
          key_id: string | null
          name: string | null
          nonce: string | null
          secret: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decrypted_secret?: never
          description?: string | null
          id?: string | null
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decrypted_secret?: never
          description?: string | null
          id?: string | null
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_secret: {
        Args: {
          new_secret: string
          new_name?: string
          new_description?: string
          new_key_id?: string
        }
        Returns: string
      }
      update_secret: {
        Args: {
          secret_id: string
          new_secret?: string
          new_name?: string
          new_description?: string
          new_key_id?: string
        }
        Returns: undefined
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
  TableName extends DefaultSchemaTableNameOr100  135k  100  135k    0     0   196k      0 --:--:-- --:--:-- --:--:--  196k
* Connection #0 to host 10.0.1.22 left intact
Options extends {
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
  _realtime: {
    Enums: {},
  },
  auth: {
    Enums: {
      aal_level: ["aal1", "aal2", "aal3"],
      code_challenge_method: ["s256", "plain"],
      factor_status: ["unverified", "verified"],
      factor_type: ["totp", "webauthn", "phone"],
      oauth_authorization_status: ["pending", "approved", "denied", "expired"],
      oauth_client_type: ["public", "confidential"],
      oauth_registration_type: ["dynamic", "manual"],
      oauth_response_type: ["code"],
      one_time_token_type: [
        "confirmation_token",
        "reauthentication_token",
        "recovery_token",
        "email_change_token_new",
        "email_change_token_current",
        "phone_change_token",
      ],
    },
  },
  cron: {
    Enums: {},
  },
  extensions: {
    Enums: {},
  },
  graphql: {
    Enums: {},
  },
  graphql_public: {
    Enums: {},
  },
  net: {
    Enums: {
      request_status: ["PENDING", "SUCCESS", "ERROR"],
    },
  },
  pgbouncer: {
    Enums: {},
  },
  pgsodium: {
    Enums: {
      key_status: ["default", "valid", "invalid", "expired"],
      key_type: [
        "aead-ietf",
        "aead-det",
        "hmacsha512",
        "hmacsha256",
        "auth",
        "shorthash",
        "generichash",
        "kdf",
        "secretbox",
        "secretstream",
        "stream_xchacha20",
      ],
    },
  },
  pgsodium_masks: {
    Enums: {},
  },
  public: {
    Enums: {
      game_status: ["completed", "in-progress", "planned"],
      install_source: ["steam", "gog", "emulator", "epic", "rockstar", "other"],
      user_role: ["admin", "moderator", "translator", "user"],
    },
  },
  realtime: {
    Enums: {
      action: ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "ERROR"],
      equality_op: ["eq", "neq", "lt", "lte", "gt", "gte", "in"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
  supabase_functions: {
    Enums: {},
  },
  vault: {
    Enums: {},
  },
} as const
