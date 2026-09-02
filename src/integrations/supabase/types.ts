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
      app_settings: {
        Row: {
          accent_hue: number
          app_name: string
          chat_backgrounds: Json
          chat_enabled: boolean
          chat_prompt_text: string
          chat_ttl_days: number
          color_female: string
          color_male: string
          color_other: string
          created_at: string
          daily_signal_limit: number
          default_radius_m: number
          default_theme: string
          empty_radar_text: string
          font_family: string
          id: string
          location_sharing_enabled: boolean
          logo_url: string | null
          max_message_len: number
          max_radius_m: number
          min_age: number
          presence_timeout_min: number
          privacy_text: string
          push_enabled: boolean
          radar_sweep_enabled: boolean
          radar_tones: Json
          reports_enabled: boolean
          signal_expiry_hours: number
          signups_enabled: boolean
          support_email: string
          tagline: string
          terms_text: string
          updated_at: string
          verification_enabled: boolean
          verified_badge_color: string
          verified_badge_style: string
          web_app_enabled: boolean
          welcome_text: string
        }
        Insert: {
          accent_hue?: number
          app_name?: string
          chat_backgrounds?: Json
          chat_enabled?: boolean
          chat_prompt_text?: string
          chat_ttl_days?: number
          color_female?: string
          color_male?: string
          color_other?: string
          created_at?: string
          daily_signal_limit?: number
          default_radius_m?: number
          default_theme?: string
          empty_radar_text?: string
          font_family?: string
          id?: string
          location_sharing_enabled?: boolean
          logo_url?: string | null
          max_message_len?: number
          max_radius_m?: number
          min_age?: number
          presence_timeout_min?: number
          privacy_text?: string
          push_enabled?: boolean
          radar_sweep_enabled?: boolean
          radar_tones?: Json
          reports_enabled?: boolean
          signal_expiry_hours?: number
          signups_enabled?: boolean
          support_email?: string
          tagline?: string
          terms_text?: string
          updated_at?: string
          verification_enabled?: boolean
          verified_badge_color?: string
          verified_badge_style?: string
          web_app_enabled?: boolean
          welcome_text?: string
        }
        Update: {
          accent_hue?: number
          app_name?: string
          chat_backgrounds?: Json
          chat_enabled?: boolean
          chat_prompt_text?: string
          chat_ttl_days?: number
          color_female?: string
          color_male?: string
          color_other?: string
          created_at?: string
          daily_signal_limit?: number
          default_radius_m?: number
          default_theme?: string
          empty_radar_text?: string
          font_family?: string
          id?: string
          location_sharing_enabled?: boolean
          logo_url?: string | null
          max_message_len?: number
          max_radius_m?: number
          min_age?: number
          presence_timeout_min?: number
          privacy_text?: string
          push_enabled?: boolean
          radar_sweep_enabled?: boolean
          radar_tones?: Json
          reports_enabled?: boolean
          signal_expiry_hours?: number
          signups_enabled?: boolean
          support_email?: string
          tagline?: string
          terms_text?: string
          updated_at?: string
          verification_enabled?: boolean
          verified_badge_color?: string
          verified_badge_style?: string
          web_app_enabled?: boolean
          welcome_text?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          destination: string
          error: string | null
          id: string
          object_key: string | null
          size_bytes: number | null
          status: string
        }
        Insert: {
          created_at?: string
          destination: string
          error?: string | null
          id?: string
          object_key?: string | null
          size_bytes?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          destination?: string
          error?: string | null
          id?: string
          object_key?: string | null
          size_bytes?: number | null
          status?: string
        }
        Relationships: []
      }
      backup_settings: {
        Row: {
          created_at: string
          destination: string
          gdrive_client_id: string | null
          gdrive_client_secret: string | null
          gdrive_folder_id: string | null
          gdrive_refresh_token: string | null
          id: string
          last_run_at: string | null
          s3_access_key_id: string | null
          s3_bucket: string | null
          s3_endpoint: string | null
          s3_prefix: string | null
          s3_region: string | null
          s3_secret_access_key: string | null
          schedule: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination?: string
          gdrive_client_id?: string | null
          gdrive_client_secret?: string | null
          gdrive_folder_id?: string | null
          gdrive_refresh_token?: string | null
          id?: string
          last_run_at?: string | null
          s3_access_key_id?: string | null
          s3_bucket?: string | null
          s3_endpoint?: string | null
          s3_prefix?: string | null
          s3_region?: string | null
          s3_secret_access_key?: string | null
          schedule?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string
          gdrive_client_id?: string | null
          gdrive_client_secret?: string | null
          gdrive_folder_id?: string | null
          gdrive_refresh_token?: string | null
          id?: string
          last_run_at?: string | null
          s3_access_key_id?: string | null
          s3_bucket?: string | null
          s3_endpoint?: string | null
          s3_prefix?: string | null
          s3_region?: string | null
          s3_secret_access_key?: string | null
          schedule?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_settings: {
        Row: {
          currency: string
          enabled: boolean
          free_daily_signals: number
          free_max_radius_m: number
          free_messages_per_match: number
          id: string
          monthly_amount: number
          paystack_public_key: string | null
          paystack_secret_key: string | null
          pro_chat_ttl_days: number
          pro_custom_beacon: boolean
          pro_extended_chat_history: boolean
          pro_extended_radius: boolean
          pro_label: string
          pro_pitch: string
          pro_priority_beacon: boolean
          pro_see_who_signaled: boolean
          pro_unlimited_messages: boolean
          pro_unlimited_signals: boolean
          provider: string
          rc_android_api_key: string | null
          rc_entitlement_id: string
          rc_ios_api_key: string | null
          rc_monthly_product_id: string | null
          rc_secret_api_key: string | null
          rc_webhook_secret: string | null
          rc_webhook_url: string | null
          rc_yearly_product_id: string | null
          updated_at: string
          web_checkout_enabled: boolean
          web_currency: string
          web_monthly_amount: number
          web_site_url: string | null
          web_yearly_amount: number
          yearly_amount: number
        }
        Insert: {
          currency?: string
          enabled?: boolean
          free_daily_signals?: number
          free_max_radius_m?: number
          free_messages_per_match?: number
          id?: string
          monthly_amount?: number
          paystack_public_key?: string | null
          paystack_secret_key?: string | null
          pro_chat_ttl_days?: number
          pro_custom_beacon?: boolean
          pro_extended_chat_history?: boolean
          pro_extended_radius?: boolean
          pro_label?: string
          pro_pitch?: string
          pro_priority_beacon?: boolean
          pro_see_who_signaled?: boolean
          pro_unlimited_messages?: boolean
          pro_unlimited_signals?: boolean
          provider?: string
          rc_android_api_key?: string | null
          rc_entitlement_id?: string
          rc_ios_api_key?: string | null
          rc_monthly_product_id?: string | null
          rc_secret_api_key?: string | null
          rc_webhook_secret?: string | null
          rc_webhook_url?: string | null
          rc_yearly_product_id?: string | null
          updated_at?: string
          web_checkout_enabled?: boolean
          web_currency?: string
          web_monthly_amount?: number
          web_site_url?: string | null
          web_yearly_amount?: number
          yearly_amount?: number
        }
        Update: {
          currency?: string
          enabled?: boolean
          free_daily_signals?: number
          free_max_radius_m?: number
          free_messages_per_match?: number
          id?: string
          monthly_amount?: number
          paystack_public_key?: string | null
          paystack_secret_key?: string | null
          pro_chat_ttl_days?: number
          pro_custom_beacon?: boolean
          pro_extended_chat_history?: boolean
          pro_extended_radius?: boolean
          pro_label?: string
          pro_pitch?: string
          pro_priority_beacon?: boolean
          pro_see_who_signaled?: boolean
          pro_unlimited_messages?: boolean
          pro_unlimited_signals?: boolean
          provider?: string
          rc_android_api_key?: string | null
          rc_entitlement_id?: string
          rc_ios_api_key?: string | null
          rc_monthly_product_id?: string | null
          rc_secret_api_key?: string | null
          rc_webhook_secret?: string | null
          rc_webhook_url?: string | null
          rc_yearly_product_id?: string | null
          updated_at?: string
          web_checkout_enabled?: boolean
          web_currency?: string
          web_monthly_amount?: number
          web_site_url?: string | null
          web_yearly_amount?: number
          yearly_amount?: number
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked: string
          blocker: string
          created_at: string
          id: string
        }
        Insert: {
          blocked: string
          blocker: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked?: string
          blocker?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          created_at: string
          device_id: string
          device_label: string
          last_seen: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_label?: string
          last_seen?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_label?: string
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          enabled: boolean
          from_email: string | null
          from_name: string | null
          id: string
          last_test_at: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          provider: string
          reply_to: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean
          smtp_user: string | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          from_email?: string | null
          from_name?: string | null
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          provider?: string
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_user?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          from_email?: string | null
          from_name?: string | null
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          provider?: string
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_user?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          accuracy_m: number | null
          is_visible: boolean
          lat: number
          lng: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          is_visible?: boolean
          lat: number
          lng: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          is_visible?: boolean
          lat?: number
          lng?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          match_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          match_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          user_id: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          plan: string
          raw: Json | null
          reference: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          plan?: string
          raw?: Json | null
          reference: string
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          plan?: string
          raw?: Json | null
          reference?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pro_features: {
        Row: {
          description: string
          key: string
          label: string
          pro_only: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          description?: string
          key: string
          label: string
          pro_only?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          description?: string
          key?: string
          label?: string
          pro_only?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pro_packages: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string
          entitlement_id: string
          features: string[]
          id: string
          monthly_amount: number
          monthly_product_id: string | null
          name: string
          sort_order: number
          updated_at: string
          yearly_amount: number
          yearly_product_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string
          entitlement_id?: string
          features?: string[]
          id?: string
          monthly_amount?: number
          monthly_product_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          yearly_amount?: number
          yearly_product_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string
          entitlement_id?: string
          features?: string[]
          id?: string
          monthly_amount?: number
          monthly_product_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          yearly_amount?: number
          yearly_product_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          banned_at: string | null
          banned_reason: string | null
          beacon_style: string
          bio: string | null
          chat_background: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          gender: string | null
          id: string
          last_seen: string
          radar_sound: boolean
          radar_tone: string | null
          updated_at: string
          username: string
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          beacon_style?: string
          bio?: string | null
          chat_background?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          gender?: string | null
          id: string
          last_seen?: string
          radar_sound?: boolean
          radar_tone?: string | null
          updated_at?: string
          username: string
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          beacon_style?: string
          bio?: string | null
          chat_background?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string
          last_seen?: string
          radar_sound?: boolean
          radar_tone?: string | null
          updated_at?: string
          username?: string
          verified?: boolean
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reactivation_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported: string
          reporter: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported: string
          reporter: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported?: string
          reporter?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          created_at: string
          expires_at: string
          from_user: string
          id: string
          to_user: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          from_user: string
          id?: string
          to_user: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          from_user?: string
          id?: string
          to_user?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          expires_at: string | null
          id: string
          plan: string
          reference: string | null
          source: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          plan?: string
          reference?: string | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          plan?: string
          reference?: string | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          created_at: string
          id: string
          reviewed_at: string | null
          selfie_path: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          selfie_path?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          selfie_path?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_activity_report: {
        Args: { _days?: number }
        Returns: {
          active_people: number
          day: string
          matches: number
          messages: number
          reports: number
          signals: number
          signups: number
        }[]
      }
      admin_billing_stats: {
        Args: never
        Returns: {
          active_subs: number
          expiring_30d: number
          paid_total: number
          revenue_minor: number
        }[]
      }
      admin_exists: { Args: never; Returns: boolean }
      admin_maintenance_overview: {
        Args: never
        Returns: {
          empty_matches: number
          expired_signals: number
          old_notifications: number
          old_reports: number
          stale_locations: number
        }[]
      }
      admin_purge_empty_matches: { Args: { _days?: number }; Returns: number }
      admin_purge_old_notifications: {
        Args: { _days?: number }
        Returns: number
      }
      admin_purge_old_reports: { Args: { _days?: number }; Returns: number }
      admin_purge_stale_locations: { Args: never; Returns: number }
      admin_review_reactivation: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      admin_set_ban: {
        Args: { _banned: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      admin_set_subscription: {
        Args: {
          _active: boolean
          _days?: number
          _plan?: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_stats: {
        Args: never
        Returns: {
          blocks: number
          matches: number
          messages: number
          online: number
          people: number
          reports: number
          signals: number
          verified: number
        }[]
      }
      admin_wipe_user_activity: {
        Args: { _user_id: string }
        Returns: undefined
      }
      billing_public_info: {
        Args: never
        Returns: {
          android_api_key: string
          currency: string
          enabled: boolean
          entitlement_id: string
          free_daily_signals: number
          free_max_radius_m: number
          free_messages_per_match: number
          ios_api_key: string
          monthly_amount: number
          monthly_product_id: string
          pro_custom_beacon: boolean
          pro_extended_radius: boolean
          pro_label: string
          pro_pitch: string
          pro_priority_beacon: boolean
          pro_see_who_signaled: boolean
          pro_unlimited_messages: boolean
          pro_unlimited_signals: boolean
          provider: string
          yearly_amount: number
          yearly_product_id: string
        }[]
      }
      chat_retention: {
        Args: never
        Returns: {
          effective_days: number
          free_days: number
          is_pro: boolean
          pro_days: number
        }[]
      }
      claim_first_admin: { Args: never; Returns: boolean }
      my_profile_private: {
        Args: never
        Returns: {
          banned: boolean
          banned_at: string
          banned_reason: string
          date_of_birth: string
        }[]
      }
      nearby_people: {
        Args: { radius_m?: number }
        Returns: {
          accuracy_m: number
          avatar_url: string
          beacon_style: string
          bearing_deg: number
          bio: string
          display_name: string
          distance_m: number
          gender: string
          i_signaled: boolean
          id: string
          is_online: boolean
          is_pro: boolean
          match_id: string
          they_signaled: boolean
          updated_age_s: number
          username: string
          verified: boolean
        }[]
      }
      purge_expired_signals: { Args: never; Returns: undefined }
      purge_old_chats: { Args: never; Returns: number }
      staff_profiles: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          banned: boolean
          banned_reason: string
          bio: string
          created_at: string
          display_name: string
          gender: string
          id: string
          last_seen: string
          username: string
          verified: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
