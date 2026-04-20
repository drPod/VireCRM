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
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
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
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
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
          company?: string | null
          created_at?: string
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
          company?: string | null
          created_at?: string
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
      organizations: {
        Row: {
          ai_tokens_limit: number
          ai_tokens_used: number
          brand_name: string | null
          commission_rate: number
          created_at: string
          custom_domain: string | null
          domain_verification_token: string
          domain_verified_at: string | null
          id: string
          is_reseller: boolean
          logo_url: string | null
          name: string
          notes: string | null
          parent_organization_id: string | null
          plan: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          ai_tokens_limit?: number
          ai_tokens_used?: number
          brand_name?: string | null
          commission_rate?: number
          created_at?: string
          custom_domain?: string | null
          domain_verification_token?: string
          domain_verified_at?: string | null
          id?: string
          is_reseller?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
          parent_organization_id?: string | null
          plan?: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          ai_tokens_limit?: number
          ai_tokens_used?: number
          brand_name?: string | null
          commission_rate?: number
          created_at?: string
          custom_domain?: string | null
          domain_verification_token?: string
          domain_verified_at?: string | null
          id?: string
          is_reseller?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
          parent_organization_id?: string | null
          plan?: string
          primary_color?: string | null
          slug?: string
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
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
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
      calculate_reseller_payouts: {
        Args: { p_period_end: string; p_period_start: string }
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
      has_role: {
        Args: {
          p_org_id?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      increment_ai_tokens: { Args: { p_org_id: string }; Returns: undefined }
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
      mark_domain_verified: { Args: { p_org_id: string }; Returns: Json }
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      remove_org_member: { Args: { p_user_id: string }; Returns: Json }
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
