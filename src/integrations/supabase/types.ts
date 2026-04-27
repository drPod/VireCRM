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
      advisor_audit_log: {
        Row: {
          command: string
          created_at: string
          duration_ms: number
          error_count: number
          error_message: string | null
          handlers: Json | null
          id: string
          ok_count: number
          organization_id: string
          phase: string
          plan: Json | null
          results: Json | null
          skipped_count: number
          summary: string | null
          user_id: string | null
        }
        Insert: {
          command: string
          created_at?: string
          duration_ms?: number
          error_count?: number
          error_message?: string | null
          handlers?: Json | null
          id?: string
          ok_count?: number
          organization_id: string
          phase: string
          plan?: Json | null
          results?: Json | null
          skipped_count?: number
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          command?: string
          created_at?: string
          duration_ms?: number
          error_count?: number
          error_message?: string | null
          handlers?: Json | null
          id?: string
          ok_count?: number
          organization_id?: string
          phase?: string
          plan?: Json | null
          results?: Json | null
          skipped_count?: number
          summary?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analyses: {
        Row: {
          business_description: string
          created_at: string
          icp: Json | null
          id: string
          organization_id: string
          search_filters: Json | null
          strategic_hook: string | null
          user_id: string
        }
        Insert: {
          business_description: string
          created_at?: string
          icp?: Json | null
          id?: string
          organization_id: string
          search_filters?: Json | null
          strategic_hook?: string | null
          user_id: string
        }
        Update: {
          business_description?: string
          created_at?: string
          icp?: Json | null
          id?: string
          organization_id?: string
          search_filters?: Json | null
          strategic_hook?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_log: {
        Row: {
          attempt_index: number
          created_at: string
          error_message: string | null
          feature: string
          http_status: number | null
          id: string
          latency_ms: number
          metadata: Json | null
          model: string
          organization_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          attempt_index?: number
          created_at?: string
          error_message?: string | null
          feature: string
          http_status?: number | null
          id?: string
          latency_ms?: number
          metadata?: Json | null
          model: string
          organization_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          attempt_index?: number
          created_at?: string
          error_message?: string | null
          feature?: string
          http_status?: number | null
          id?: string
          latency_ms?: number
          metadata?: Json | null
          model?: string
          organization_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          assigned_to: string | null
          calendar_id: string | null
          created_at: string
          ends_at: string
          id: string
          lead_id: string | null
          location: string | null
          meeting_url: string | null
          notes: string | null
          organization_id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          calendar_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          organization_id: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          calendar_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          organization_id?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          access_password_hash: string | null
          availability: Json
          buffer_minutes: number
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          slot_duration_minutes: number
          slug: string
          updated_at: string
        }
        Insert: {
          access_password_hash?: string | null
          availability?: Json
          buffer_minutes?: number
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          slot_duration_minutes?: number
          slug: string
          updated_at?: string
        }
        Update: {
          access_password_hash?: string | null
          availability?: Json
          buffer_minutes?: number
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          slot_duration_minutes?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          leads_count: number | null
          name: string
          objective: string | null
          organization_id: string
          replies_count: number | null
          sent_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leads_count?: number | null
          name: string
          objective?: string | null
          organization_id: string
          replies_count?: number | null
          sent_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leads_count?: number | null
          name?: string
          objective?: string | null
          organization_id?: string
          replies_count?: number | null
          sent_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          environment: string
          hosted_invoice_url: string | null
          id: string
          interval: string | null
          invoice_pdf: string | null
          is_recurring: boolean
          lead_id: string | null
          line_items: Json
          number: string | null
          organization_id: string
          paid_at: string | null
          sent_at: string | null
          status: string
          stripe_account_id: string
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          environment?: string
          hosted_invoice_url?: string | null
          id?: string
          interval?: string | null
          invoice_pdf?: string | null
          is_recurring?: boolean
          lead_id?: string | null
          line_items?: Json
          number?: string | null
          organization_id: string
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          stripe_account_id: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          environment?: string
          hosted_invoice_url?: string | null
          id?: string
          interval?: string | null
          invoice_pdf?: string | null
          is_recurring?: boolean
          lead_id?: string | null
          line_items?: Json
          number?: string | null
          organization_id?: string
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          stripe_account_id?: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stripe_accounts: {
        Row: {
          charges_enabled: boolean
          country: string | null
          created_at: string
          created_by: string | null
          default_currency: string | null
          details_submitted: boolean
          email: string | null
          environment: string
          id: string
          organization_id: string
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_currency?: string | null
          details_submitted?: boolean
          email?: string | null
          environment?: string
          id?: string
          organization_id: string
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_currency?: string | null
          details_submitted?: boolean
          email?: string | null
          environment?: string
          id?: string
          organization_id?: string
          payouts_enabled?: boolean
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_stripe_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_earnings: {
        Row: {
          commission_cents: number
          created_at: string
          currency: string
          deal_value_cents: number
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_reference: string | null
          rule_snapshot: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_cents?: number
          created_at?: string
          currency?: string
          deal_value_cents?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          payment_reference?: string | null
          rule_snapshot?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_cents?: number
          created_at?: string
          currency?: string
          deal_value_cents?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_reference?: string | null
          rule_snapshot?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_earnings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_earnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          created_at: string
          flat_cents: number
          id: string
          is_active: boolean
          organization_id: string
          percent: number
          rule_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          flat_cents?: number
          id?: string
          is_active?: boolean
          organization_id: string
          percent?: number
          rule_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          flat_cents?: number
          id?: string
          is_active?: boolean
          organization_id?: string
          percent?: number
          rule_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_activity_log: {
        Row: {
          action: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          lead_id: string | null
          organization_id: string
          payload: Json
          provider: string
          status: string
          summary: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          payload?: Json
          provider: string
          status?: string
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          payload?: Json
          provider?: string
          status?: string
          summary?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          organization_id: string
          sender: string | null
          sent_at: string
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          direction?: string
          id?: string
          organization_id: string
          sender?: string | null
          sent_at?: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          organization_id?: string
          sender?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          organization_id: string
          status: string
          subject: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id: string
          status?: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id?: string
          status?: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_domain_audit_log: {
        Row: {
          created_at: string
          details: Json
          domain_id: string | null
          event_type: string
          hostname: string
          id: string
          message: string | null
          organization_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          domain_id?: string | null
          event_type: string
          hostname: string
          id?: string
          message?: string | null
          organization_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          domain_id?: string | null
          event_type?: string
          hostname?: string
          id?: string
          message?: string | null
          organization_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_domain_audit_log_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "org_custom_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_domain_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_builtin: boolean
          name: string
          organization_id: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"]
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          organization_id: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          organization_id?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          component_stack: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          organization_id: string | null
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          organization_id?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          organization_id?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          incurred_at: string
          organization_id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          incurred_at?: string
          organization_id: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          incurred_at?: string
          organization_id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          conversions_count: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          organization_id: string
          published_url: string | null
          slug: string
          status: string
          steps: Json
          updated_at: string
          visits_count: number
        }
        Insert: {
          conversions_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          organization_id: string
          published_url?: string | null
          slug: string
          status?: string
          steps?: Json
          updated_at?: string
          visits_count?: number
        }
        Update: {
          conversions_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          published_url?: string | null
          slug?: string
          status?: string
          steps?: Json
          updated_at?: string
          visits_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "funnels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          custom_role_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          custom_role_id?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          custom_role_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignees: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          lead_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignees_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sync_log: {
        Row: {
          created_at: string
          duplicates: number
          duration_ms: number
          error_code: string | null
          error_message: string | null
          fetched: number
          id: string
          inserted: number
          metadata: Json | null
          no_email: number
          organization_id: string
          provider: string
          revealed: number
          source: string
          status: string
          updated: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duplicates?: number
          duration_ms?: number
          error_code?: string | null
          error_message?: string | null
          fetched?: number
          id?: string
          inserted?: number
          metadata?: Json | null
          no_email?: number
          organization_id: string
          provider: string
          revealed?: number
          source: string
          status?: string
          updated?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duplicates?: number
          duration_ms?: number
          error_code?: string | null
          error_message?: string | null
          fetched?: number
          id?: string
          inserted?: number
          metadata?: Json | null
          no_email?: number
          organization_id?: string
          provider?: string
          revealed?: number
          source?: string
          status?: string
          updated?: number
          user_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          annual_kwh: number | null
          assigned_to: string | null
          closed_at: string | null
          closed_by_user_id: string | null
          company: string | null
          contract_end_date: string | null
          created_at: string
          current_supplier: string | null
          deal_currency: string
          deal_value_cents: number | null
          email: string | null
          id: string
          last_contact: string | null
          name: string
          next_action: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          score: number | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          annual_kwh?: number | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          company?: string | null
          contract_end_date?: string | null
          created_at?: string
          current_supplier?: string | null
          deal_currency?: string
          deal_value_cents?: number | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          next_action?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          score?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          annual_kwh?: number | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          company?: string | null
          contract_end_date?: string | null
          created_at?: string
          current_supplier?: string | null
          deal_currency?: string
          deal_value_cents?: number | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          next_action?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          score?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string | null
          organization_id: string
          sentiment: string | null
          status: string
          subject: string | null
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id?: string | null
          organization_id: string
          sentiment?: string | null
          status?: string
          subject?: string | null
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          organization_id?: string
          sentiment?: string | null
          status?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_connectors: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          enabled_by: string | null
          id: string
          organization_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          enabled_by?: string | null
          id?: string
          organization_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          enabled_by?: string | null
          id?: string
          organization_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_connectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_custom_domains: {
        Row: {
          created_at: string
          created_by: string | null
          hostname: string
          id: string
          is_primary: boolean
          organization_id: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hostname: string
          id?: string
          is_primary?: boolean
          organization_id: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hostname?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_custom_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_features: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          enabled_at: string
          enabled_by: string | null
          expires_at: string | null
          feature_key: string
          id: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          enabled_at?: string
          enabled_by?: string | null
          expires_at?: string | null
          feature_key: string
          id?: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          enabled_at?: string
          enabled_by?: string | null
          expires_at?: string | null
          feature_key?: string
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_integrations: {
        Row: {
          api_key: string
          config: Json
          created_at: string
          id: string
          last_verified_at: string | null
          notes: string | null
          organization_id: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          config?: Json
          created_at?: string
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          organization_id?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          config?: Json
          created_at?: string
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          organization_id?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          accent_color: string | null
          ai_tokens_limit: number
          ai_tokens_used: number
          audit_log_retention_days: number
          auto_invoice_on_stage: string | null
          auto_invoice_template: Json
          brand_name: string | null
          button_color: string | null
          commission_rate: number
          created_at: string
          custom_domain: string | null
          domain_verification_token: string
          domain_verified_at: string | null
          email_signature: string | null
          favicon_url: string | null
          font_family: string | null
          id: string
          is_reseller: boolean
          lead_period_start: string
          leads_used_this_period: number
          logo_url: string | null
          monthly_lead_quota: number
          name: string
          notes: string | null
          parent_organization_id: string | null
          plan: string
          primary_color: string | null
          secondary_color: string | null
          sidebar_color: string | null
          slug: string
          support_email: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          ai_tokens_limit?: number
          ai_tokens_used?: number
          audit_log_retention_days?: number
          auto_invoice_on_stage?: string | null
          auto_invoice_template?: Json
          brand_name?: string | null
          button_color?: string | null
          commission_rate?: number
          created_at?: string
          custom_domain?: string | null
          domain_verification_token?: string
          domain_verified_at?: string | null
          email_signature?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          is_reseller?: boolean
          lead_period_start?: string
          leads_used_this_period?: number
          logo_url?: string | null
          monthly_lead_quota?: number
          name: string
          notes?: string | null
          parent_organization_id?: string | null
          plan?: string
          primary_color?: string | null
          secondary_color?: string | null
          sidebar_color?: string | null
          slug: string
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          ai_tokens_limit?: number
          ai_tokens_used?: number
          audit_log_retention_days?: number
          auto_invoice_on_stage?: string | null
          auto_invoice_template?: Json
          brand_name?: string | null
          button_color?: string | null
          commission_rate?: number
          created_at?: string
          custom_domain?: string | null
          domain_verification_token?: string
          domain_verified_at?: string | null
          email_signature?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          is_reseller?: boolean
          lead_period_start?: string
          leads_used_this_period?: number
          logo_url?: string | null
          monthly_lead_quota?: number
          name?: string
          notes?: string | null
          parent_organization_id?: string | null
          plan?: string
          primary_color?: string | null
          secondary_color?: string | null
          sidebar_color?: string | null
          slug?: string
          support_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequence_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step_index: number
          enrolled_at: string
          enrolled_by: string | null
          id: string
          last_sent_at: string | null
          lead_id: string
          next_send_at: string | null
          organization_id: string
          sequence_id: string
          status: string
          stop_reason: string | null
          stopped_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step_index?: number
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          last_sent_at?: string | null
          lead_id: string
          next_send_at?: string | null
          organization_id: string
          sequence_id: string
          status?: string
          stop_reason?: string | null
          stopped_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step_index?: number
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          last_sent_at?: string | null
          lead_id?: string
          next_send_at?: string | null
          organization_id?: string
          sequence_id?: string
          status?: string
          stop_reason?: string | null
          stopped_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sequence_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequence_step_log: {
        Row: {
          enrollment_id: string
          error_message: string | null
          id: string
          lead_id: string
          message_id: string | null
          organization_id: string
          sent_at: string
          sequence_id: string
          status: string
          step_id: string | null
          step_index: number
          subject: string | null
        }
        Insert: {
          enrollment_id: string
          error_message?: string | null
          id?: string
          lead_id: string
          message_id?: string | null
          organization_id: string
          sent_at?: string
          sequence_id: string
          status: string
          step_id?: string | null
          step_index: number
          subject?: string | null
        }
        Update: {
          enrollment_id?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          message_id?: string | null
          organization_id?: string
          sent_at?: string
          sequence_id?: string
          status?: string
          step_id?: string | null
          step_index?: number
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequence_step_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sequence_step_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequence_steps: {
        Row: {
          body_override: string | null
          created_at: string
          delay_days: number
          delay_hours: number
          id: string
          is_active: boolean
          organization_id: string
          sequence_id: string
          step_index: number
          subject_override: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          body_override?: string | null
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          is_active?: boolean
          organization_id: string
          sequence_id: string
          step_index: number
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          body_override?: string | null
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          is_active?: boolean
          organization_id?: string
          sequence_id?: string
          step_index?: number
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequence_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "outreach_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          send_on_weekends: boolean
          send_window_end_hour: number
          send_window_start_hour: number
          status: string
          stop_on_meeting_booked: boolean
          stop_on_positive_sentiment: boolean
          stop_on_reply: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          send_on_weekends?: boolean
          send_window_end_hour?: number
          send_window_start_hour?: number
          status?: string
          stop_on_meeting_booked?: boolean
          stop_on_positive_sentiment?: boolean
          stop_on_reply?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          send_on_weekends?: boolean
          send_window_end_hour?: number
          send_window_start_hour?: number
          status?: string
          stop_on_meeting_booked?: boolean
          stop_on_positive_sentiment?: boolean
          stop_on_reply?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_line_items: {
        Row: {
          amount_cents: number
          base_cost_cents: number
          client_name: string | null
          client_org_id: string | null
          commission_cents: number
          created_at: string
          id: string
          markup_cents: number
          payout_id: string
          refund_transaction_id: string | null
          subscription_id: string
        }
        Insert: {
          amount_cents: number
          base_cost_cents?: number
          client_name?: string | null
          client_org_id?: string | null
          commission_cents: number
          created_at?: string
          id?: string
          markup_cents?: number
          payout_id: string
          refund_transaction_id?: string | null
          subscription_id: string
        }
        Update: {
          amount_cents?: number
          base_cost_cents?: number
          client_name?: string | null
          client_org_id?: string | null
          commission_cents?: number
          created_at?: string
          id?: string
          markup_cents?: number
          payout_id?: string
          refund_transaction_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_line_items_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_line_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "reseller_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_line_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_subscription_grants: {
        Row: {
          consumed_at: string | null
          consumed_org_id: string | null
          consumed_user_id: string | null
          created_at: string
          email: string
          feature_keys: string[]
          granted_by: string | null
          id: string
          is_reseller: boolean
          monthly_lead_quota: number
          notes: string | null
          plan: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_org_id?: string | null
          consumed_user_id?: string | null
          created_at?: string
          email: string
          feature_keys?: string[]
          granted_by?: string | null
          id?: string
          is_reseller?: boolean
          monthly_lead_quota?: number
          notes?: string | null
          plan?: string
        }
        Update: {
          consumed_at?: string | null
          consumed_org_id?: string | null
          consumed_user_id?: string | null
          created_at?: string
          email?: string
          feature_keys?: string[]
          granted_by?: string | null
          id?: string
          is_reseller?: boolean
          monthly_lead_quota?: number
          notes?: string | null
          plan?: string
        }
        Relationships: []
      }
      pending_welcome_emails: {
        Row: {
          attempts: number
          brand_name: string | null
          created_at: string
          failed_at: string | null
          full_name: string | null
          id: string
          last_error: string | null
          login_url: string
          organization_id: string
          recipient_email: string
          reseller_id: string
          send_after: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          brand_name?: string | null
          created_at?: string
          failed_at?: string | null
          full_name?: string | null
          id?: string
          last_error?: string | null
          login_url: string
          organization_id: string
          recipient_email: string
          reseller_id: string
          send_after?: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          brand_name?: string | null
          created_at?: string
          failed_at?: string | null
          full_name?: string | null
          id?: string
          last_error?: string | null
          login_url?: string
          organization_id?: string
          recipient_email?: string
          reseller_id?: string
          send_after?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_welcome_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_welcome_emails_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      replies: {
        Row: {
          channel: string
          content: string
          created_at: string
          id: string
          lead_id: string | null
          message_id: string | null
          organization_id: string
          sentiment: string | null
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          organization_id: string
          sentiment?: string | null
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          organization_id?: string
          sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_payouts: {
        Row: {
          active_client_count: number
          commission_cents: number
          commission_rate: number
          created_at: string
          currency: string
          gross_revenue_cents: number
          id: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          reseller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          active_client_count?: number
          commission_cents?: number
          commission_rate: number
          created_at?: string
          currency?: string
          gross_revenue_cents?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          reseller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          active_client_count?: number
          commission_cents?: number
          commission_rate?: number
          created_at?: string
          currency?: string
          gross_revenue_cents?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          reseller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_payouts_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_plans: {
        Row: {
          base_cost_cents: number
          base_price_id: string
          created_at: string
          currency: string
          description: string | null
          features: string[]
          id: string
          is_active: boolean
          markup_percent: number
          monthly_price_cents: number
          name: string
          reseller_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          base_cost_cents: number
          base_price_id: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          markup_percent?: number
          monthly_price_cents: number
          name: string
          reseller_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          base_cost_cents?: number
          base_price_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          markup_percent?: number
          monthly_price_cents?: number
          name?: string
          reseller_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_plans_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          channel: string
          created_at: string
          id: string
          lead_id: string | null
          organization_id: string
          rating: number | null
          responded_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          organization_id: string
          rating?: number | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          organization_id?: string
          rating?: number | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          external_url: string | null
          id: string
          lead_id: string | null
          organization_id: string
          posted_at: string
          rating: number
          replied: boolean
          replied_at: string | null
          reply_text: string | null
          reviewer_avatar: string | null
          reviewer_name: string | null
          source: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          posted_at?: string
          rating?: number
          replied?: boolean
          replied_at?: string | null
          reply_text?: string | null
          reviewer_avatar?: string | null
          reviewer_name?: string | null
          source?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          posted_at?: string
          rating?: number
          replied?: boolean
          replied_at?: string | null
          reply_text?: string | null
          reviewer_avatar?: string | null
          reviewer_name?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          attributed_reseller_id: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          reseller_plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attributed_reseller_id?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          reseller_plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attributed_reseller_id?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          reseller_plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_attributed_reseller_id_fkey"
            columns: ["attributed_reseller_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_reseller_plan_id_fkey"
            columns: ["reseller_plan_id"]
            isOneToOne: false
            referencedRelation: "reseller_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          component_stack: string | null
          created_at: string
          description: string
          error_message: string | null
          error_stack: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          status: string
          updated_at: string
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          created_at?: string
          description: string
          error_message?: string | null
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          created_at?: string
          description?: string
          error_message?: string | null
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          organization_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          attributed_reseller_id: string | null
          billed_at: string
          created_at: string
          currency: string
          environment: string
          id: string
          raw_payload: Json | null
          reseller_plan_id: string | null
          status: string
          stripe_transaction_id: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          attributed_reseller_id?: string | null
          billed_at?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          raw_payload?: Json | null
          reseller_plan_id?: string | null
          status?: string
          stripe_transaction_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          attributed_reseller_id?: string | null
          billed_at?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          raw_payload?: Json | null
          reseller_plan_id?: string | null
          status?: string
          stripe_transaction_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_attributed_reseller_id_fkey"
            columns: ["attributed_reseller_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reseller_plan_id_fkey"
            columns: ["reseller_plan_id"]
            isOneToOne: false
            referencedRelation: "reseller_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          custom_role_id: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          custom_role_id?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          custom_role_id?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          completed_count: number
          created_at: string
          created_by: string | null
          description: string | null
          edges: Json
          enrolled_count: number
          id: string
          last_run_at: string | null
          name: string
          nodes: Json
          organization_id: string
          status: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          completed_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          edges?: Json
          enrolled_count?: number
          id?: string
          last_run_at?: string | null
          name: string
          nodes?: Json
          organization_id: string
          status?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          completed_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          edges?: Json
          enrolled_count?: number
          id?: string
          last_run_at?: string | null
          name?: string
          nodes?: Json
          organization_id?: string
          status?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      add_custom_domain: {
        Args: { p_hostname: string; p_org_id: string }
        Returns: Json
      }
      assign_custom_role: {
        Args: { p_custom_role_id: string; p_user_id: string }
        Returns: Json
      }
      calculate_reseller_payouts: {
        Args: { p_period_end: string; p_period_start: string }
        Returns: Json
      }
      consume_platform_lead_quota: {
        Args: { p_count?: number; p_org_id: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_lead_usage: { Args: { p_org_id: string }; Returns: Json }
      get_org_by_domain: { Args: { p_hostname: string }; Returns: Json }
      get_reseller_branding: { Args: { p_slug: string }; Returns: Json }
      get_reseller_clients: {
        Args: { p_reseller_id: string }
        Returns: {
          brand_name: string
          created_at: string
          currency: string
          id: string
          last_activity: string
          lead_count: number
          markup_cents: number
          member_count: number
          monthly_price_cents: number
          name: string
          notes: string
          plan: string
          reseller_plan_name: string
          slug: string
          subscription_status: string
        }[]
      }
      get_reseller_plan_public: {
        Args: { p_plan_slug: string; p_reseller_slug: string }
        Returns: Json
      }
      get_user_org_id: { Args: { p_user_id: string }; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_feature: {
        Args: { p_feature_key: string; p_org_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          p_org_id?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      increment_ai_tokens: { Args: { p_org_id: string }; Returns: undefined }
      lead_quota_for_plan: { Args: { p_plan: string }; Returns: number }
      list_reseller_plans_public: {
        Args: { p_reseller_slug: string }
        Returns: {
          currency: string
          description: string
          features: string[]
          monthly_price_cents: number
          name: string
          plan_id: string
          slug: string
        }[]
      }
      log_custom_domain_event: {
        Args: {
          p_details: Json
          p_domain_id: string
          p_event_type: string
          p_hostname: string
          p_message: string
          p_org_id: string
          p_status: string
        }
        Returns: string
      }
      mark_custom_domain_verified: {
        Args: { p_domain_id: string }
        Returns: Json
      }
      mark_domain_verified: { Args: { p_org_id: string }; Returns: Json }
      mark_earning_paid: {
        Args: { p_earning_id: string; p_payment_reference?: string }
        Returns: Json
      }
      mark_payout_paid: {
        Args: { p_payment_reference?: string; p_payout_id: string }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_has_active_subscription: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      purge_advisor_audit_log: { Args: never; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      remove_custom_domain: { Args: { p_domain_id: string }; Returns: Json }
      remove_org_member: { Args: { p_user_id: string }; Returns: Json }
      set_primary_custom_domain: {
        Args: { p_domain_id: string }
        Returns: Json
      }
      signup_under_reseller: {
        Args: { p_company_name: string; p_reseller_slug: string }
        Returns: Json
      }
      update_member_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: Json
      }
      user_belongs_to_org: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { p_org_id: string; p_permission: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "sales_rep"
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
      app_role: ["owner", "manager", "sales_rep"],
    },
  },
} as const
