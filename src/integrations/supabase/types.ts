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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_by: string
          created_at: string
          id: string
          organization_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_by: string
          created_at?: string
          id?: string
          organization_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_by?: string
          created_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_tickets: {
        Row: {
          email: string
          event_id: string
          id: string
          sent_at: string
          ticket_type: string
        }
        Insert: {
          email: string
          event_id: string
          id?: string
          sent_at?: string
          ticket_type: string
        }
        Update: {
          email?: string
          event_id?: string
          id?: string
          sent_at?: string
          ticket_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string
          age_restriction: string
          category: string
          city: string
          clicks: number
          country: string
          created_at: string
          date: string | null
          date_changes_count: number
          description: string
          doors: string | null
          end_date: string | null
          end_time: string | null
          event_type: string
          explore_clicks: number
          flyer_url: string | null
          gallery: Json
          id: string
          instagram_clicks: number
          lat: number | null
          lineup: Json
          lng: number | null
          location_state: string
          organization_id: string
          place_id: string
          postal_code: string
          price: string
          sales_disabled: boolean
          short_description: string
          show_end_time: boolean
          status: Database["public"]["Enums"]["event_status"]
          tickets: Json
          time: string | null
          title: string
          updated_at: string
          venue: string
        }
        Insert: {
          address?: string
          age_restriction?: string
          category?: string
          city?: string
          clicks?: number
          country?: string
          created_at?: string
          date?: string | null
          date_changes_count?: number
          description?: string
          doors?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string
          explore_clicks?: number
          flyer_url?: string | null
          gallery?: Json
          id?: string
          instagram_clicks?: number
          lat?: number | null
          lineup?: Json
          lng?: number | null
          location_state?: string
          organization_id: string
          place_id?: string
          postal_code?: string
          price?: string
          sales_disabled?: boolean
          short_description?: string
          show_end_time?: boolean
          status?: Database["public"]["Enums"]["event_status"]
          tickets?: Json
          time?: string | null
          title?: string
          updated_at?: string
          venue?: string
        }
        Update: {
          address?: string
          age_restriction?: string
          category?: string
          city?: string
          clicks?: number
          country?: string
          created_at?: string
          date?: string | null
          date_changes_count?: number
          description?: string
          doors?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string
          explore_clicks?: number
          flyer_url?: string | null
          gallery?: Json
          id?: string
          instagram_clicks?: number
          lat?: number | null
          lineup?: Json
          lng?: number | null
          location_state?: string
          organization_id?: string
          place_id?: string
          postal_code?: string
          price?: string
          sales_disabled?: boolean
          short_description?: string
          show_end_time?: boolean
          status?: Database["public"]["Enums"]["event_status"]
          tickets?: Json
          time?: string | null
          title?: string
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_state: string | null
          billing_zip: string | null
          checked_in: boolean
          checked_in_at: string | null
          created_at: string
          discount: number
          event_id: string
          id: string
          order_group_id: string
          promo_code: string | null
          public_ticket_token: string
          quantity: number
          ref_source: string
          refunded_amount: number
          refunded_at: string | null
          service_fee: number
          status: string
          ticket_name: string
          ticket_type_id: string
          total: number
          unit_price: number
          user_id: string
        }
        Insert: {
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          discount?: number
          event_id: string
          id?: string
          order_group_id?: string
          promo_code?: string | null
          public_ticket_token?: string
          quantity?: number
          ref_source?: string
          refunded_amount?: number
          refunded_at?: string | null
          service_fee?: number
          status?: string
          ticket_name?: string
          ticket_type_id: string
          total?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          discount?: number
          event_id?: string
          id?: string
          order_group_id?: string
          promo_code?: string | null
          public_ticket_token?: string
          quantity?: number
          ref_source?: string
          refunded_amount?: number
          refunded_at?: string | null
          service_fee?: number
          status?: string
          ticket_name?: string
          ticket_type_id?: string
          total?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_followers: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_followers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          avatar_url: string | null
          country: string
          created_at: string
          created_by: string
          id: string
          links: Json
          name: string
          region: string
          slug: string
          socials: Json
          state: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string
          created_at?: string
          created_by: string
          id?: string
          links?: Json
          name: string
          region?: string
          slug: string
          socials?: Json
          state?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string
          created_at?: string
          created_by?: string
          id?: string
          links?: Json
          name?: string
          region?: string
          slug?: string
          socials?: Json
          state?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          instagram: string | null
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          instagram?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          instagram?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: string
          event_id: string
          id: string
          max_uses: number
          ticket_type: string
          used: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value: string
          event_id: string
          id?: string
          max_uses?: number
          ticket_type?: string
          used?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: string
          event_id?: string
          id?: string
          max_uses?: number
          ticket_type?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      promoted_events: {
        Row: {
          background_url: string | null
          created_at: string
          event_link: string
          id: string
          location: string
          placement: string
          sort_order: number
          subtitle: string
          title: string
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          event_link?: string
          id?: string
          location?: string
          placement?: string
          sort_order?: number
          subtitle?: string
          title: string
        }
        Update: {
          background_url?: string | null
          created_at?: string
          event_link?: string
          id?: string
          location?: string
          placement?: string
          sort_order?: number
          subtitle?: string
          title?: string
        }
        Relationships: []
      }
      scanner_pins: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          label: string
          pin: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          label?: string
          pin: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          label?: string
          pin?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanner_pins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_sections: {
        Row: {
          capacity: number | null
          created_at: string
          event_id: string
          id: string
          is_general_admission: boolean
          name: string
          price: string
          rows_count: number
          seats_per_row: number
          sort_order: number
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          event_id: string
          id?: string
          is_general_admission?: boolean
          name: string
          price?: string
          rows_count?: number
          seats_per_row?: number
          sort_order?: number
        }
        Update: {
          capacity?: number | null
          created_at?: string
          event_id?: string
          id?: string
          is_general_admission?: boolean
          name?: string
          price?: string
          rows_count?: number
          seats_per_row?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "seating_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          blocked: boolean
          created_at: string
          event_id: string
          id: string
          is_special: boolean
          label: string | null
          layout_row_index: number
          layout_seat_index: number
          order_id: string | null
          price: string | null
          row_label: string
          seat_number: number
          section_id: string
          status: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          event_id: string
          id?: string
          is_special?: boolean
          label?: string | null
          layout_row_index: number
          layout_seat_index: number
          order_id?: string | null
          price?: string | null
          row_label: string
          seat_number: number
          section_id: string
          status?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          event_id?: string
          id?: string
          is_special?: boolean
          label?: string | null
          layout_row_index?: number
          layout_seat_index?: number
          order_id?: string | null
          price?: string | null
          row_label?: string
          seat_number?: number
          section_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "seating_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_by: string | null
          created_at: string
          email: string
          event_id: string
          id: string
          invited_by: string
          organization_id: string
          permissions: Json
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          email: string
          event_id: string
          id?: string
          invited_by: string
          organization_id: string
          permissions?: Json
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          invited_by?: string
          organization_id?: string
          permissions?: Json
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_requests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          message: string | null
          quantity: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          ticket_type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          message?: string | null
          quantity?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          ticket_type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          message?: string | null
          quantity?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          ticket_type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_requests_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          approval_required: boolean
          available_date: string | null
          available_soon: boolean
          created_at: string
          event_id: string
          hidden: boolean
          id: string
          max_per_order: number
          name: string
          price: string
          quantity: number
          sold: number
          sold_out: boolean
        }
        Insert: {
          approval_required?: boolean
          available_date?: string | null
          available_soon?: boolean
          created_at?: string
          event_id: string
          hidden?: boolean
          id?: string
          max_per_order?: number
          name: string
          price?: string
          quantity?: number
          sold?: number
          sold_out?: boolean
        }
        Update: {
          approval_required?: boolean
          available_date?: string | null
          available_soon?: boolean
          created_at?: string
          event_id?: string
          hidden?: boolean
          id?: string
          max_per_order?: number
          name?: string
          price?: string
          quantity?: number
          sold?: number
          sold_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_links: {
        Row: {
          clicks: number
          created_at: string
          created_by: string
          created_by_admin: boolean
          event_id: string
          id: string
          label: string
          slug: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          created_by: string
          created_by_admin?: boolean
          event_id: string
          id?: string
          label: string
          slug: string
        }
        Update: {
          clicks?: number
          created_at?: string
          created_by?: string
          created_by_admin?: boolean
          event_id?: string
          id?: string
          label?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      accept_team_invitation: { Args: { _token: string }; Returns: Json }
      get_event_scan_counts: {
        Args: { _event_id: string }
        Returns: {
          scanned_tickets: number
          total_tickets: number
        }[]
      }
      get_event_team_members: {
        Args: { _event_id: string }
        Returns: {
          accepted_by: string
          avatar_url: string
          email: string
          id: string
          name: string
          permissions: Json
          role: string
          status: string
          total_clicks: number
          total_revenue: number
          total_sales: number
        }[]
      }
      get_org_attendee_counts: {
        Args: never
        Returns: {
          attendee_count: number
          organization_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_event_clicks: {
        Args: { _event_id: string }
        Returns: undefined
      }
      increment_event_explore_clicks: {
        Args: { _event_id: string }
        Returns: undefined
      }
      increment_event_instagram_clicks: {
        Args: { _event_id: string }
        Returns: undefined
      }
      increment_tracking_link_clicks: {
        Args: { _slug: string }
        Returns: undefined
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_blocked_by_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      purchase_tickets: {
        Args: { _quantity: number; _ticket_type_id: string }
        Returns: undefined
      }
      refund_order: {
        Args: { _order_id: string; _refund_amount: number }
        Returns: {
          billing_city: string | null
          billing_country: string | null
          billing_state: string | null
          billing_zip: string | null
          checked_in: boolean
          checked_in_at: string | null
          created_at: string
          discount: number
          event_id: string
          id: string
          order_group_id: string
          promo_code: string | null
          public_ticket_token: string
          quantity: number
          ref_source: string
          refunded_amount: number
          refunded_at: string | null
          service_fee: number
          status: string
          ticket_name: string
          ticket_type_id: string
          total: number
          unit_price: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_seated_ticket_type: {
        Args: { _event_id: string; _name: string; _price: string }
        Returns: string
      }
      resolve_team_invitation: {
        Args: { _token: string }
        Returns: {
          accepted_by: string
          email: string
          event_id: string
          event_title: string
          id: string
          invited_by: string
          org_name: string
          org_slug: string
          organization_id: string
          permissions: Json
          role: string
          status: string
        }[]
      }
      resolve_tracking_link: {
        Args: { _slug: string }
        Returns: {
          event_id: string
          slug: string
        }[]
      }
      validate_ticket_token: {
        Args: { _scanner_pin?: string; _token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      event_status: "draft" | "live" | "sold_out" | "cancelled"
      org_member_role: "owner" | "admin" | "member"
      org_type: "venue" | "event_organizer" | "person" | "community"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      event_status: ["draft", "live", "sold_out", "cancelled"],
      org_member_role: ["owner", "admin", "member"],
      org_type: ["venue", "event_organizer", "person", "community"],
    },
  },
} as const
