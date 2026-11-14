// Generated database types from `npm run db:types`; do not edit by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          reason: string | null;
          request_id: string | null;
          society_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          reason?: string | null;
          request_id?: string | null;
          society_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          reason?: string | null;
          request_id?: string | null;
          society_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      auth_code_challenges: {
        Row: {
          challenge_id: string;
          consumed_at: string | null;
          created_at: string;
          email_key: string;
          expires_at: string;
          failed_attempts: number;
          in_flight_attempts: number;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          consumed_at?: string | null;
          created_at?: string;
          email_key: string;
          expires_at: string;
          failed_attempts?: number;
          in_flight_attempts?: number;
        };
        Update: {
          challenge_id?: string;
          consumed_at?: string | null;
          created_at?: string;
          email_key?: string;
          expires_at?: string;
          failed_attempts?: number;
          in_flight_attempts?: number;
        };
        Relationships: [];
      };
      billing_bill_lines: {
        Row: {
          amount_paise: number;
          bill_id: string;
          charge_type_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          period_start: string;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          bill_id: string;
          charge_type_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          period_start: string;
          society_id: string;
          unit_id: string;
        };
        Update: {
          amount_paise?: number;
          bill_id?: string;
          charge_type_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          period_start?: string;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_bill_lines_bill_unit_period_fkey';
            columns: ['bill_id', 'unit_id', 'period_start'];
            isOneToOne: false;
            referencedRelation: 'billing_bills';
            referencedColumns: ['id', 'unit_id', 'period_start'];
          },
          {
            foreignKeyName: 'billing_bill_lines_charge_same_society_fkey';
            columns: ['society_id', 'charge_type_id'];
            isOneToOne: false;
            referencedRelation: 'billing_charge_types';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'billing_bill_lines_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_bill_lines_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_bills: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string;
          id: string;
          kind: string;
          paid_paise: number;
          period_start: string;
          related_bill_id: string | null;
          society_id: string;
          status: string | null;
          title: string;
          total_paise: number;
          unit_id: string;
          waived_paise: number;
        };
        ComputedFields: never;
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date: string;
          id?: string;
          kind?: string;
          paid_paise?: number;
          period_start: string;
          related_bill_id?: string | null;
          society_id: string;
          status?: never;
          title: string;
          total_paise: number;
          unit_id: string;
          waived_paise?: number;
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string;
          id?: string;
          kind?: string;
          paid_paise?: number;
          period_start?: string;
          related_bill_id?: string | null;
          society_id?: string;
          status?: never;
          title?: string;
          total_paise?: number;
          unit_id?: string;
          waived_paise?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_bills_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_bills_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_bills_related_same_society_fkey';
            columns: ['society_id', 'related_bill_id'];
            isOneToOne: false;
            referencedRelation: 'billing_bills';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'billing_bills_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_bills_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      billing_charge_types: {
        Row: {
          active: boolean;
          amount_paise: number | null;
          created_at: string;
          created_by: string;
          id: string;
          method: string;
          name: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          amount_paise?: number | null;
          created_at?: string;
          created_by: string;
          id?: string;
          method: string;
          name: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          active?: boolean;
          amount_paise?: number | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          method?: string;
          name?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_charge_types_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_charge_types_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_charge_types_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_ledger_entries: {
        Row: {
          amount_paise: number;
          bill_id: string | null;
          created_at: string;
          created_by: string | null;
          direction: string;
          id: number;
          kind: string;
          payment_id: string | null;
          reason: string | null;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          bill_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          direction: string;
          id?: never;
          kind: string;
          payment_id?: string | null;
          reason?: string | null;
          society_id: string;
          unit_id: string;
        };
        Update: {
          amount_paise?: number;
          bill_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          direction?: string;
          id?: never;
          kind?: string;
          payment_id?: string | null;
          reason?: string | null;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_ledger_entries_bill_same_society_fkey';
            columns: ['society_id', 'bill_id'];
            isOneToOne: false;
            referencedRelation: 'billing_bills';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'billing_ledger_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_ledger_entries_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_ledger_entries_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      billing_payment_allocations: {
        Row: {
          amount_paise: number;
          bill_id: string;
          created_at: string;
          payment_id: string;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          bill_id: string;
          created_at?: string;
          payment_id: string;
          society_id: string;
          unit_id: string;
        };
        Update: {
          amount_paise?: number;
          bill_id?: string;
          created_at?: string;
          payment_id?: string;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_payment_allocations_bill_same_unit_fkey';
            columns: ['society_id', 'bill_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'billing_bills';
            referencedColumns: ['society_id', 'id', 'unit_id'];
          },
          {
            foreignKeyName: 'billing_payment_allocations_payment_same_unit_fkey';
            columns: ['society_id', 'payment_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'billing_payments';
            referencedColumns: ['society_id', 'id', 'unit_id'];
          },
        ];
      };
      billing_payment_details: {
        Row: {
          payee_name: string;
          qr_path: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string;
          upi_id: string;
        };
        ComputedFields: never;
        Insert: {
          payee_name: string;
          qr_path?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          upi_id: string;
        };
        Update: {
          payee_name?: string;
          qr_path?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          upi_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_payment_details_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payment_details_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_payments: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string;
          id: string;
          mode: string;
          paid_on: string;
          proof_path: string | null;
          receipt_no: string | null;
          reference: string | null;
          reject_reason: string | null;
          rejected_at: string | null;
          society_id: string;
          source: string;
          status: string;
          submitted_by: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          mode: string;
          paid_on: string;
          proof_path?: string | null;
          receipt_no?: string | null;
          reference?: string | null;
          reject_reason?: string | null;
          rejected_at?: string | null;
          society_id: string;
          source: string;
          status: string;
          submitted_by: string;
          unit_id: string;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          mode?: string;
          paid_on?: string;
          proof_path?: string | null;
          receipt_no?: string | null;
          reference?: string | null;
          reject_reason?: string | null;
          rejected_at?: string | null;
          society_id?: string;
          source?: string;
          status?: string;
          submitted_by?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_payments_confirmed_by_fkey';
            columns: ['confirmed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payments_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payments_submitted_by_fkey';
            columns: ['submitted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payments_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      billing_receipt_counters: {
        Row: {
          last_no: number;
          society_id: string;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          last_no?: number;
          society_id: string;
          year: number;
        };
        Update: {
          last_no?: number;
          society_id?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_receipt_counters_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          name: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      delivery_entries: {
        Row: {
          client_request_id: string;
          collected_at: string | null;
          collected_by: string | null;
          company: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          delivery_person: string | null;
          delivery_type: string;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          photo_path: string | null;
          received_at: string | null;
          respond_by: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          collected_at?: string | null;
          collected_by?: string | null;
          company: string;
          created_at?: string;
          created_by: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_source?: string | null;
          delivery_person?: string | null;
          delivery_type: string;
          handled_by_guard_id: string;
          id?: string;
          override_reason?: string | null;
          photo_path?: string | null;
          received_at?: string | null;
          respond_by?: string | null;
          society_id: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          client_request_id?: string;
          collected_at?: string | null;
          collected_by?: string | null;
          company?: string;
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_source?: string | null;
          delivery_person?: string | null;
          delivery_type?: string;
          handled_by_guard_id?: string;
          id?: string;
          override_reason?: string | null;
          photo_path?: string | null;
          received_at?: string | null;
          respond_by?: string | null;
          society_id?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_entries_collected_by_fkey';
            columns: ['collected_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_entries_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_entries_guard_same_society_fkey';
            columns: ['society_id', 'handled_by_guard_id'];
            isOneToOne: false;
            referencedRelation: 'guard_roster';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'delivery_entries_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_entries_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'delivery_entries_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      delivery_pre_announcements: {
        Row: {
          cancelled_at: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          expected_from: string;
          expected_to: string;
          id: string;
          platform: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by?: string;
          expected_from: string;
          expected_to: string;
          id?: string;
          platform: string;
          society_id: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cancelled_at?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          expected_from?: string;
          expected_to?: string;
          id?: string;
          platform?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_pre_announcements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_pre_announcements_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_pre_announcements_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'delivery_pre_announcements_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      delivery_preferences: {
        Row: {
          rule: string;
          society_id: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          rule?: string;
          society_id: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          rule?: string;
          society_id?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_preferences_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_preferences_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: true;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'delivery_preferences_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      developers: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'developers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      error_logs: {
        Row: {
          app_version: string | null;
          created_at: string;
          device: Json | null;
          id: string;
          message: string;
          module_key: string | null;
          reference_id: string;
          request_id: string | null;
          resolve_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          role: string | null;
          route: string | null;
          severity: string;
          society_id: string | null;
          source: string;
          stack: string | null;
          status: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          app_version?: string | null;
          created_at?: string;
          device?: Json | null;
          id?: string;
          message: string;
          module_key?: string | null;
          reference_id: string;
          request_id?: string | null;
          resolve_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          role?: string | null;
          route?: string | null;
          severity: string;
          society_id?: string | null;
          source: string;
          stack?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          device?: Json | null;
          id?: string;
          message?: string;
          module_key?: string | null;
          reference_id?: string;
          request_id?: string | null;
          resolve_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          role?: string | null;
          route?: string | null;
          severity?: string;
          society_id?: string | null;
          source?: string;
          stack?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'error_logs_module_key_fkey';
            columns: ['module_key'];
            isOneToOne: false;
            referencedRelation: 'modules';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'error_logs_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'error_logs_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'error_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      guard_roster: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          id: string;
          membership_id: string | null;
          name: string;
          pin_hash: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          membership_id?: string | null;
          name: string;
          pin_hash?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          membership_id?: string | null;
          name?: string;
          pin_hash?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'guard_roster_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guard_roster_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'guard_roster_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guard_roster_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      housekeeping_items: {
        Row: {
          active: boolean;
          category: string;
          created_by: string;
          id: string;
          last_low_alert_date: string | null;
          minimum_stock: number;
          name: string;
          society_id: string;
          unit_of_measure: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          category: string;
          created_by: string;
          id?: string;
          last_low_alert_date?: string | null;
          minimum_stock?: number;
          name: string;
          society_id: string;
          unit_of_measure: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          active?: boolean;
          category?: string;
          created_by?: string;
          id?: string;
          last_low_alert_date?: string | null;
          minimum_stock?: number;
          name?: string;
          society_id?: string;
          unit_of_measure?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'housekeeping_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'housekeeping_items_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'housekeeping_items_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      housekeeping_transactions: {
        Row: {
          client_request_id: string;
          cost_paise: number | null;
          created_at: string;
          created_by: string;
          effective_date: string;
          id: string;
          item_id: string;
          kind: string;
          purpose: string | null;
          quantity: number;
          sequence: number;
          society_id: string;
          vendor: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          cost_paise?: number | null;
          created_at?: string;
          created_by: string;
          effective_date: string;
          id?: string;
          item_id: string;
          kind: string;
          purpose?: string | null;
          quantity: number;
          sequence?: never;
          society_id: string;
          vendor?: string | null;
        };
        Update: {
          client_request_id?: string;
          cost_paise?: number | null;
          created_at?: string;
          created_by?: string;
          effective_date?: string;
          id?: string;
          item_id?: string;
          kind?: string;
          purpose?: string | null;
          quantity?: number;
          sequence?: never;
          society_id?: string;
          vendor?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'housekeeping_transactions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'housekeeping_transactions_item_same_society_fkey';
            columns: ['society_id', 'item_id'];
            isOneToOne: false;
            referencedRelation: 'housekeeping_items';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'housekeeping_transactions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      job_run_keys: {
        Row: {
          completed_at: string | null;
          job_name: string;
          period_key: string;
          ran_at: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          job_name: string;
          period_key: string;
          ran_at?: string;
          society_id: string;
        };
        Update: {
          completed_at?: string | null;
          job_name?: string;
          period_key?: string;
          ran_at?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_run_keys_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          created_at: string;
          created_by: string | null;
          finished_at: string | null;
          id: string;
          progress: number;
          society_id: string;
          status: string;
          summary: Json | null;
          type: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          finished_at?: string | null;
          id?: string;
          progress?: number;
          society_id: string;
          status?: string;
          summary?: Json | null;
          type: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          finished_at?: string | null;
          id?: string;
          progress?: number;
          society_id?: string;
          status?: string;
          summary?: Json | null;
          type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      memberships: {
        Row: {
          approved_by: string | null;
          created_at: string;
          id: string;
          invited_by: string | null;
          invited_email: string | null;
          joined_at: string | null;
          left_at: string | null;
          roles: string[];
          society_id: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          invited_email?: string | null;
          joined_at?: string | null;
          left_at?: string | null;
          roles: string[];
          society_id: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          invited_email?: string | null;
          joined_at?: string | null;
          left_at?: string | null;
          roles?: string[];
          society_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      module_configs: {
        Row: {
          enabled: boolean;
          module_key: string;
          settings: NonNullable<Json>;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          module_key: string;
          settings?: NonNullable<Json>;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          module_key?: string;
          settings?: NonNullable<Json>;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'module_configs_module_key_fkey';
            columns: ['module_key'];
            isOneToOne: false;
            referencedRelation: 'modules';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'module_configs_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'module_configs_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      modules: {
        Row: {
          is_core: boolean;
          key: string;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          is_core?: boolean;
          key: string;
          name: string;
          sort_order: number;
        };
        Update: {
          is_core?: boolean;
          key?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      notice_blocks: {
        Row: {
          block_id: string;
          notice_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          block_id: string;
          notice_id: string;
          society_id: string;
        };
        Update: {
          block_id?: string;
          notice_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notice_blocks_block_same_society_fkey';
            columns: ['society_id', 'block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'notice_blocks_notice_same_society_fkey';
            columns: ['society_id', 'notice_id'];
            isOneToOne: false;
            referencedRelation: 'notices';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'notice_blocks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      notice_reads: {
        Row: {
          notice_id: string;
          read_at: string;
          society_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          notice_id: string;
          read_at?: string;
          society_id: string;
          user_id: string;
        };
        Update: {
          notice_id?: string;
          read_at?: string;
          society_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notice_reads_notice_same_society_fkey';
            columns: ['society_id', 'notice_id'];
            isOneToOne: false;
            referencedRelation: 'notices';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'notice_reads_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notice_reads_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notices: {
        Row: {
          attachment_content_type: string | null;
          attachment_path: string | null;
          attachment_size_bytes: number | null;
          audience: string;
          body: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          edited_at: string | null;
          expires_at: string | null;
          id: string;
          pinned: boolean;
          society_id: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          withdrawn_at: string | null;
          withdrawn_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          attachment_content_type?: string | null;
          attachment_path?: string | null;
          attachment_size_bytes?: number | null;
          audience?: string;
          body: string;
          client_request_id: string;
          created_at?: string;
          created_by?: string;
          edited_at?: string | null;
          expires_at?: string | null;
          id?: string;
          pinned?: boolean;
          society_id: string;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          withdrawn_at?: string | null;
          withdrawn_by?: string | null;
        };
        Update: {
          attachment_content_type?: string | null;
          attachment_path?: string | null;
          attachment_size_bytes?: number | null;
          audience?: string;
          body?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          edited_at?: string | null;
          expires_at?: string | null;
          id?: string;
          pinned?: boolean;
          society_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          withdrawn_at?: string | null;
          withdrawn_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notices_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notices_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notices_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notices_withdrawn_by_fkey';
            columns: ['withdrawn_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          read_at: string | null;
          request_id: string | null;
          society_id: string;
          title: string;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          read_at?: string | null;
          request_id?: string | null;
          society_id: string;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          read_at?: string | null;
          request_id?: string | null;
          society_id?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_society_user_membership_fkey';
            columns: ['society_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'user_id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          font_preference: string;
          full_name: string;
          id: string;
          phone: string | null;
          photo_path: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          font_preference?: string;
          full_name: string;
          id: string;
          phone?: string | null;
          photo_path?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          font_preference?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          photo_path?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth_secret: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_success_at: string | null;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth_secret: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_success_at?: string | null;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth_secret?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_success_at?: string | null;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      service_request_attachments: {
        Row: {
          comment_id: string | null;
          content_type: string;
          created_at: string;
          created_by: string;
          id: string;
          request_id: string;
          size_bytes: number;
          society_id: string;
          storage_path: string;
        };
        ComputedFields: never;
        Insert: {
          comment_id?: string | null;
          content_type: string;
          created_at?: string;
          created_by: string;
          id?: string;
          request_id: string;
          size_bytes: number;
          society_id: string;
          storage_path: string;
        };
        Update: {
          comment_id?: string | null;
          content_type?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          request_id?: string;
          size_bytes?: number;
          society_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_attachments_comment_same_request_fkey';
            columns: ['request_id', 'comment_id'];
            isOneToOne: false;
            referencedRelation: 'service_request_comments';
            referencedColumns: ['request_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_attachments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_attachments_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_attachments_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_categories: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          sla_hours: number | null;
          society_id: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          sla_hours?: number | null;
          society_id: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          sla_hours?: number | null;
          society_id?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_categories_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_categories_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_categories_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_comments: {
        Row: {
          body: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          request_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          request_id: string;
          society_id: string;
        };
        Update: {
          body?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          request_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_comments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_comments_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_comments_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_events: {
        Row: {
          created_at: string;
          created_by: string | null;
          event_type: string;
          from_status: string | null;
          id: number;
          note: string | null;
          request_id: string;
          society_id: string;
          to_status: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          event_type: string;
          from_status?: string | null;
          id?: never;
          note?: string | null;
          request_id: string;
          society_id: string;
          to_status?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          event_type?: string;
          from_status?: string | null;
          id?: never;
          note?: string | null;
          request_id?: string;
          society_id?: string;
          to_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_events_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_upvotes: {
        Row: {
          created_at: string;
          request_id: string;
          society_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          request_id: string;
          society_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          request_id?: string;
          society_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_upvotes_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_upvotes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_upvotes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_requests: {
        Row: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          assigned_membership_id?: string | null;
          assigned_vendor_name?: string | null;
          assigned_vendor_phone?: string | null;
          category_id: string;
          client_request_id: string;
          closed_at?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          id?: string;
          location_type: string;
          priority?: string;
          rating?: number | null;
          rating_comment?: string | null;
          reject_reason?: string | null;
          resolved_at?: string | null;
          sla_due_at?: string | null;
          society_id: string;
          status?: string;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assigned_membership_id?: string | null;
          assigned_vendor_name?: string | null;
          assigned_vendor_phone?: string | null;
          category_id?: string;
          client_request_id?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          location_type?: string;
          priority?: string;
          rating?: number | null;
          rating_comment?: string | null;
          reject_reason?: string | null;
          resolved_at?: string | null;
          sla_due_at?: string | null;
          society_id?: string;
          status?: string;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_requests_assignee_same_society_fkey';
            columns: ['society_id', 'assigned_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_requests_category_same_society_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'service_request_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_requests_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_requests_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_requests_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_requests_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      societies: {
        Row: {
          address: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          gate_login_mode: string;
          guard_identification: string;
          id: string;
          join_code: string | null;
          logo_path: string | null;
          name: string;
          plan: string | null;
          slug: string | null;
          status: string;
          timezone: string;
          unit_label: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by: string;
          currency?: string;
          gate_login_mode?: string;
          guard_identification?: string;
          id?: string;
          join_code?: string | null;
          logo_path?: string | null;
          name: string;
          plan?: string | null;
          slug?: string | null;
          status?: string;
          timezone?: string;
          unit_label?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          gate_login_mode?: string;
          guard_identification?: string;
          id?: string;
          join_code?: string | null;
          logo_path?: string | null;
          name?: string;
          plan?: string | null;
          slug?: string | null;
          status?: string;
          timezone?: string;
          unit_label?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'societies_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'societies_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_attendance: {
        Row: {
          check_in_guard_id: string;
          check_out_guard_id: string | null;
          checked_in_at: string;
          checked_in_by: string;
          checked_out_at: string | null;
          checked_out_by: string | null;
          id: string;
          society_id: string;
          staff_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          check_in_guard_id: string;
          check_out_guard_id?: string | null;
          checked_in_at?: string;
          checked_in_by: string;
          checked_out_at?: string | null;
          checked_out_by?: string | null;
          id?: string;
          society_id: string;
          staff_id: string;
          unit_id: string;
        };
        Update: {
          check_in_guard_id?: string;
          check_out_guard_id?: string | null;
          checked_in_at?: string;
          checked_in_by?: string;
          checked_out_at?: string | null;
          checked_out_by?: string | null;
          id?: string;
          society_id?: string;
          staff_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_attendance_checked_in_by_fkey';
            columns: ['checked_in_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_attendance_checked_out_by_fkey';
            columns: ['checked_out_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_attendance_checkin_guard_same_society_fkey';
            columns: ['society_id', 'check_in_guard_id'];
            isOneToOne: false;
            referencedRelation: 'guard_roster';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'staff_attendance_checkout_guard_same_society_fkey';
            columns: ['society_id', 'check_out_guard_id'];
            isOneToOne: false;
            referencedRelation: 'guard_roster';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'staff_attendance_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_attendance_staff_same_society_fkey';
            columns: ['society_id', 'staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_members';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'staff_attendance_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      staff_day_blocks: {
        Row: {
          block_date: string;
          created_at: string;
          created_by: string;
          society_id: string;
          staff_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          block_date: string;
          created_at?: string;
          created_by?: string;
          society_id: string;
          staff_id: string;
          unit_id: string;
        };
        Update: {
          block_date?: string;
          created_at?: string;
          created_by?: string;
          society_id?: string;
          staff_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_day_blocks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_day_blocks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_day_blocks_staff_same_society_fkey';
            columns: ['society_id', 'staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_members';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'staff_day_blocks_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      staff_members: {
        Row: {
          created_at: string;
          created_by: string;
          full_name: string;
          id: string;
          id_last_four: string | null;
          id_type: string | null;
          job_role: string;
          phone: string;
          photo_path: string | null;
          police_verified: boolean;
          society_id: string;
          staff_code: string;
          staff_type: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          full_name: string;
          id?: string;
          id_last_four?: string | null;
          id_type?: string | null;
          job_role: string;
          phone: string;
          photo_path?: string | null;
          police_verified?: boolean;
          society_id: string;
          staff_code?: string;
          staff_type: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          full_name?: string;
          id?: string;
          id_last_four?: string | null;
          id_type?: string | null;
          job_role?: string;
          phone?: string;
          photo_path?: string | null;
          police_verified?: boolean;
          society_id?: string;
          staff_code?: string;
          staff_type?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_members_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_members_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_members_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_shift_attendance: {
        Row: {
          attendance_date: string;
          marked_by: string;
          society_id: string;
          staff_id: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attendance_date: string;
          marked_by?: string;
          society_id: string;
          staff_id: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          attendance_date?: string;
          marked_by?: string;
          society_id?: string;
          staff_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_shift_attendance_marked_by_fkey';
            columns: ['marked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_shift_attendance_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_shift_attendance_staff_same_society_fkey';
            columns: ['society_id', 'staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_members';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      staff_unit_links: {
        Row: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          request_id: string | null;
          society_id: string;
          staff_id: string;
          status: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          request_id?: string | null;
          society_id: string;
          staff_id: string;
          status?: string;
          unit_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          request_id?: string | null;
          society_id?: string;
          staff_id?: string;
          status?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_unit_links_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_unit_links_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_unit_links_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_unit_links_staff_same_society_fkey';
            columns: ['society_id', 'staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_members';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'staff_unit_links_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_occupants: {
        Row: {
          created_at: string;
          created_by: string;
          ended_at: string | null;
          id: string;
          is_approver: boolean;
          is_primary: boolean;
          membership_id: string;
          relationship: string;
          society_id: string;
          started_at: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          ended_at?: string | null;
          id?: string;
          is_approver?: boolean;
          is_primary?: boolean;
          membership_id: string;
          relationship: string;
          society_id: string;
          started_at?: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          ended_at?: string | null;
          id?: string;
          is_approver?: boolean;
          is_primary?: boolean;
          membership_id?: string;
          relationship?: string;
          society_id?: string;
          started_at?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_occupants_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_occupants_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_occupants_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_occupants_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_occupants_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      units: {
        Row: {
          active: boolean;
          area_sqft: number | null;
          block_id: string | null;
          created_at: string;
          created_by: string;
          floor: number | null;
          id: string;
          number: string;
          society_id: string;
          unit_type: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          area_sqft?: number | null;
          block_id?: string | null;
          created_at?: string;
          created_by?: string;
          floor?: number | null;
          id?: string;
          number: string;
          society_id: string;
          unit_type?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          area_sqft?: number | null;
          block_id?: string | null;
          created_at?: string;
          created_by?: string;
          floor?: number | null;
          id?: string;
          number?: string;
          society_id?: string;
          unit_type?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'units_block_same_society_fkey';
            columns: ['society_id', 'block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'units_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'units_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'units_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      visitor_blacklist: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          id: string;
          name: string | null;
          phone: string;
          reason: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string | null;
          phone: string;
          reason?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string | null;
          phone?: string;
          reason?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'visitor_blacklist_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_blacklist_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_blacklist_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      visitor_entries: {
        Row: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          checked_out_by_guard_id: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          people_count: number;
          photo_path: string | null;
          pre_approval_id: string | null;
          purpose: string;
          respond_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
          visitor_phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          checked_out_by_guard_id?: string | null;
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_source?: string | null;
          handled_by_guard_id: string;
          id?: string;
          override_reason?: string | null;
          people_count?: number;
          photo_path?: string | null;
          pre_approval_id?: string | null;
          purpose: string;
          respond_by?: string | null;
          society_id: string;
          source?: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_no?: string | null;
          visitor_name: string;
          visitor_phone?: string | null;
        };
        Update: {
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          checked_out_by_guard_id?: string | null;
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_source?: string | null;
          handled_by_guard_id?: string;
          id?: string;
          override_reason?: string | null;
          people_count?: number;
          photo_path?: string | null;
          pre_approval_id?: string | null;
          purpose?: string;
          respond_by?: string | null;
          society_id?: string;
          source?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_no?: string | null;
          visitor_name?: string;
          visitor_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'visitor_entries_checkout_guard_same_society_fkey';
            columns: ['society_id', 'checked_out_by_guard_id'];
            isOneToOne: false;
            referencedRelation: 'guard_roster';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'visitor_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_entries_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_entries_guard_same_society_fkey';
            columns: ['society_id', 'handled_by_guard_id'];
            isOneToOne: false;
            referencedRelation: 'guard_roster';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'visitor_entries_pre_approval_same_society_fkey';
            columns: ['society_id', 'pre_approval_id'];
            isOneToOne: false;
            referencedRelation: 'visitor_pre_approvals';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'visitor_entries_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_entries_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'visitor_entries_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      visitor_frequent_visitors: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          last_used_at: string | null;
          society_id: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          id?: string;
          last_used_at?: string | null;
          society_id: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_no?: string | null;
          visitor_name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          last_used_at?: string | null;
          society_id?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_no?: string | null;
          visitor_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visitor_frequent_visitors_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_frequent_visitors_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_frequent_visitors_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'visitor_frequent_visitors_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      visitor_pre_approvals: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          id: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          used_at: string | null;
          valid_from: string;
          valid_to: string;
          vehicle_no: string | null;
          visitor_name: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          society_id: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
          used_at?: string | null;
          valid_from: string;
          valid_to: string;
          vehicle_no?: string | null;
          visitor_name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          used_at?: string | null;
          valid_from?: string;
          valid_to?: string;
          vehicle_no?: string | null;
          visitor_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visitor_pre_approvals_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_pre_approvals_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_pre_approvals_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'visitor_pre_approvals_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_add_guard: {
        Args: {
          p_membership_id: string;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      admin_set_guard_pin: {
        Args: {
          p_guard_id: string;
          p_pin: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      admin_update_gate_settings: {
        Args: {
          p_gate_login_mode: string;
          p_guard_identification: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      admin_update_guard: {
        Args: {
          p_active: boolean;
          p_guard_id: string;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      approve_society_registration: {
        Args: {
          p_membership_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      assign_unit_occupant: {
        Args: {
          p_is_approver: boolean;
          p_is_primary: boolean;
          p_membership_id: string;
          p_relationship: string;
          p_request_id: string;
          p_society_id: string;
          p_started_at: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      billing_bill_get: {
        Args: { p_bill_id: string; p_society_id: string };
        Returns: Json;
      };
      billing_bill_waive: {
        Args: {
          p_amount_paise: number;
          p_bill_id: string;
          p_cancel: boolean;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      billing_bills_generate: {
        Args: {
          p_charge_type_ids: string[];
          p_custom_amounts: Json;
          p_period_start: string;
          p_preview_hash: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_ids: string[];
        };
        Returns: Json;
      };
      billing_bills_list: {
        Args: { p_limit: number; p_offset: number; p_society_id: string };
        Returns: Json;
      };
      billing_bills_preview: {
        Args: {
          p_charge_type_ids: string[];
          p_custom_amounts: Json;
          p_period_start: string;
          p_society_id: string;
          p_unit_ids: string[];
        };
        Returns: Json;
      };
      billing_charge_save: {
        Args: {
          p_active: boolean;
          p_amount_paise: number;
          p_expected_updated_at: string;
          p_id: string;
          p_method: string;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: {
          active: boolean;
          amount_paise: number | null;
          created_at: string;
          created_by: string;
          id: string;
          method: string;
          name: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
        };
        SetofOptions: {
          from: '*';
          to: 'billing_charge_types';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      billing_charges_list: {
        Args: { p_society_id: string };
        Returns: {
          active: boolean;
          amount_paise: number | null;
          created_at: string;
          created_by: string;
          id: string;
          method: string;
          name: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'billing_charge_types';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      billing_dashboard: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      billing_fine_add: {
        Args: {
          p_amount_paise: number;
          p_fine_date: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      billing_late_fees_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      billing_ledger_get: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: Json;
      };
      billing_payment_confirm: {
        Args: {
          p_corrected_amount: number;
          p_payment_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      billing_payment_details_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      billing_payment_details_update: {
        Args: {
          p_expected_updated_at: string;
          p_payee_name: string;
          p_qr_path: string;
          p_request_id: string;
          p_society_id: string;
          p_upi_id: string;
        };
        Returns: Json;
      };
      billing_payment_get: {
        Args: { p_payment_id: string; p_society_id: string };
        Returns: Json;
      };
      billing_payment_record: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_mode: string;
          p_paid_on: string;
          p_reference: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      billing_payment_reject: {
        Args: {
          p_payment_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      billing_payment_submit: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_paid_on: string;
          p_proof_path: string;
          p_reference: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      billing_payments_list: {
        Args: {
          p_limit: number;
          p_offset: number;
          p_society_id: string;
          p_status?: string;
        };
        Returns: Json;
      };
      billing_receipt_email_recipients: {
        Args: { p_payment_id: string; p_society_id: string };
        Returns: Json;
      };
      billing_receipt_get: {
        Args: { p_payment_id: string; p_society_id: string };
        Returns: Json;
      };
      billing_reminders_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      billing_report_export: {
        Args: {
          p_from: string;
          p_report: string;
          p_request_id: string;
          p_society_id: string;
          p_to: string;
        };
        Returns: Json;
      };
      billing_settings_update: {
        Args: {
          p_due_day: string;
          p_expected_updated_at: string;
          p_request_id: string;
          p_rounding: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      billing_stale_payments_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      change_member_roles: {
        Args: {
          p_membership_id: string;
          p_request_id: string;
          p_roles: string[];
          p_society_id: string;
        };
        Returns: undefined;
      };
      claim_memberships: { Args: Record<PropertyKey, never>; Returns: number };
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: {
          allowed: boolean;
          count: number;
          retry_after_seconds: number;
        }[];
      };
      create_member_invitation: {
        Args: {
          p_email: string;
          p_is_approver: boolean;
          p_is_primary: boolean;
          p_relationship: string;
          p_request_id: string;
          p_roles: string[];
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      create_resident_import_job: {
        Args: { p_request_id: string; p_rows: Json; p_society_id: string };
        Returns: string;
      };
      create_units_import_job: {
        Args: { p_request_id: string; p_rows: Json; p_society_id: string };
        Returns: string;
      };
      daily_job_health_summary: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      daily_job_societies: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
        }[];
      };
      deactivate_member: {
        Args: {
          p_membership_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      delete_push_subscription: {
        Args: { p_endpoint: string };
        Returns: undefined;
      };
      delivery_create_entry: {
        Args: {
          p_actor_id: string;
          p_client_request_id: string;
          p_company: string;
          p_delivery_person: string;
          p_delivery_type: string;
          p_guard_id: string;
          p_photo_path: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: {
          client_request_id: string;
          collected_at: string | null;
          collected_by: string | null;
          company: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          delivery_person: string | null;
          delivery_type: string;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          photo_path: string | null;
          received_at: string | null;
          respond_by: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_list_entries: {
        Args: { p_scope: string; p_society_id: string; p_unit_id: string };
        Returns: {
          collected_at: string;
          collected_by: string;
          company: string;
          created_at: string;
          decided_at: string;
          decision_source: string;
          delivery_person: string;
          delivery_type: string;
          handled_by_guard_id: string;
          id: string;
          is_response_overdue: boolean;
          is_uncollected_overdue: boolean;
          photo_path: string;
          received_at: string;
          respond_by: string;
          status: string;
          unit_id: string;
        }[];
      };
      delivery_mark_collected_guard: {
        Args: {
          p_actor_id: string;
          p_entry_id: string;
          p_guard_id: string;
          p_request_id: string;
        };
        Returns: {
          client_request_id: string;
          collected_at: string | null;
          collected_by: string | null;
          company: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          delivery_person: string | null;
          delivery_type: string;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          photo_path: string | null;
          received_at: string | null;
          respond_by: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_mark_collected_resident: {
        Args: { p_entry_id: string; p_request_id: string };
        Returns: {
          client_request_id: string;
          collected_at: string | null;
          collected_by: string | null;
          company: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          delivery_person: string | null;
          delivery_type: string;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          photo_path: string | null;
          received_at: string | null;
          respond_by: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_override: {
        Args: {
          p_actor_id: string;
          p_decision: string;
          p_entry_id: string;
          p_guard_id: string;
          p_reason: string;
          p_request_id: string;
        };
        Returns: {
          client_request_id: string;
          collected_at: string | null;
          collected_by: string | null;
          company: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          delivery_person: string | null;
          delivery_type: string;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          photo_path: string | null;
          received_at: string | null;
          respond_by: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_pre_announce_cancel: {
        Args: {
          p_announcement_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: {
          cancelled_at: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          expected_from: string;
          expected_to: string;
          id: string;
          platform: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_pre_announcements';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_pre_announce_create: {
        Args: {
          p_client_request_id: string;
          p_expected_from: string;
          p_expected_to: string;
          p_platform: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: {
          cancelled_at: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          expected_from: string;
          expected_to: string;
          id: string;
          platform: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_pre_announcements';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_pre_announce_list: {
        Args: { p_society_id: string; p_unit_id?: string };
        Returns: {
          created_at: string;
          expected_from: string;
          expected_to: string;
          id: string;
          platform: string;
          status: string;
          unit_id: string;
        }[];
      };
      delivery_preference_get: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: {
          rule: string;
          society_id: string;
          unit_id: string;
          updated_at: string;
        }[];
      };
      delivery_preference_set: {
        Args: { p_request_id: string; p_rule: string; p_unit_id: string };
        Returns: {
          rule: string;
          society_id: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_preferences';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_respond: {
        Args: { p_decision: string; p_entry_id: string; p_request_id: string };
        Returns: {
          client_request_id: string;
          collected_at: string | null;
          collected_by: string | null;
          company: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          delivery_person: string | null;
          delivery_type: string;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          photo_path: string | null;
          received_at: string | null;
          respond_by: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'delivery_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delivery_settings_get: { Args: { p_society_id: string }; Returns: Json };
      delivery_settings_update: {
        Args: { p_request_id: string; p_settings: Json; p_society_id: string };
        Returns: Json;
      };
      developer_create_first_admin: {
        Args: { p_email: string; p_request_id: string; p_society_id: string };
        Returns: {
          approved_by: string | null;
          created_at: string;
          id: string;
          invited_by: string | null;
          invited_email: string | null;
          joined_at: string | null;
          left_at: string | null;
          roles: string[];
          society_id: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'memberships';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      developer_create_society: {
        Args: {
          p_address: string;
          p_city: string;
          p_contact_email: string;
          p_contact_phone: string;
          p_currency: string;
          p_name: string;
          p_plan: string;
          p_request_id: string;
          p_timezone: string;
          p_unit_label: string;
        };
        Returns: string;
      };
      developer_create_society_with_slug: {
        Args: {
          p_address: string;
          p_city: string;
          p_contact_email: string;
          p_contact_phone: string;
          p_currency: string;
          p_name: string;
          p_plan: string;
          p_request_id: string;
          p_slug: string;
          p_timezone: string;
          p_unit_label: string;
        };
        Returns: string;
      };
      developer_health_summary: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      developer_set_error_status: {
        Args: {
          p_error_id: string;
          p_note: string;
          p_request_id: string;
          p_status: string;
        };
        Returns: {
          app_version: string | null;
          created_at: string;
          device: Json | null;
          id: string;
          message: string;
          module_key: string | null;
          reference_id: string;
          request_id: string | null;
          resolve_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          role: string | null;
          route: string | null;
          severity: string;
          society_id: string | null;
          source: string;
          stack: string | null;
          status: string;
          user_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'error_logs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      developer_set_society_slug: {
        Args: { p_request_id: string; p_slug: string; p_society_id: string };
        Returns: {
          address: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          gate_login_mode: string;
          guard_identification: string;
          id: string;
          join_code: string | null;
          logo_path: string | null;
          name: string;
          plan: string | null;
          slug: string | null;
          status: string;
          timezone: string;
          unit_label: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'societies';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      developer_set_society_status: {
        Args: { p_request_id: string; p_society_id: string; p_status: string };
        Returns: {
          address: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          gate_login_mode: string;
          guard_identification: string;
          id: string;
          join_code: string | null;
          logo_path: string | null;
          name: string;
          plan: string | null;
          slug: string | null;
          status: string;
          timezone: string;
          unit_label: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'societies';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      developer_society_onboarding_status: {
        Args: { p_name: string; p_slug: string };
        Returns: Json;
      };
      developer_toggle_module: {
        Args: {
          p_enabled: boolean;
          p_module_key: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: {
          enabled: boolean;
          module_key: string;
          settings: NonNullable<Json>;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'module_configs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      developer_update_module_settings: {
        Args: {
          p_module_key: string;
          p_request_id: string;
          p_settings: Json;
          p_society_id: string;
        };
        Returns: {
          enabled: boolean;
          module_key: string;
          settings: NonNullable<Json>;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'module_configs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      developer_update_society: {
        Args: {
          p_address: string;
          p_city: string;
          p_contact_email: string;
          p_contact_phone: string;
          p_currency: string;
          p_name: string;
          p_plan: string;
          p_request_id: string;
          p_society_id: string;
          p_timezone: string;
          p_unit_label: string;
        };
        Returns: {
          address: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          gate_login_mode: string;
          guard_identification: string;
          id: string;
          join_code: string | null;
          logo_path: string | null;
          name: string;
          plan: string | null;
          slug: string | null;
          status: string;
          timezone: string;
          unit_label: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'societies';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      developer_update_society_logo: {
        Args: {
          p_logo_path: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: {
          address: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          gate_login_mode: string;
          guard_identification: string;
          id: string;
          join_code: string | null;
          logo_path: string | null;
          name: string;
          plan: string | null;
          slug: string | null;
          status: string;
          timezone: string;
          unit_label: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'societies';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      disable_society_join_code: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: undefined;
      };
      end_unit_occupancy: {
        Args: {
          p_ended_at: string;
          p_occupant_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      export_job_get: { Args: { p_job_id: string }; Returns: Json };
      finish_auth_code_attempt: {
        Args: {
          p_challenge_id: string;
          p_failed: boolean;
          p_succeeded: boolean;
        };
        Returns: boolean;
      };
      get_society_join_code: {
        Args: { p_society_id: string };
        Returns: string;
      };
      guard_identify: {
        Args: { p_guard_id?: string; p_pin?: string; p_society_id: string };
        Returns: {
          guard_id: string;
          guard_name: string;
          locked: boolean;
          retry_after_seconds: number;
        }[];
      };
      guard_unit_contacts: {
        Args: { p_unit_id: string };
        Returns: {
          full_name: string;
          phone: string;
        }[];
      };
      has_signin_access: { Args: { p_email: string }; Returns: boolean };
      housekeeping_item_save: {
        Args: {
          p_active: boolean;
          p_category: string;
          p_expected_updated_at: string;
          p_item_id: string;
          p_minimum_stock: number;
          p_name: string;
          p_request_trace: string;
          p_society_id: string;
          p_unit_of_measure: string;
        };
        Returns: string;
      };
      housekeeping_items_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      housekeeping_low_stock_run: {
        Args: { p_request_trace: string; p_society_id: string };
        Returns: number;
      };
      housekeeping_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      housekeeping_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      housekeeping_stock_record: {
        Args: {
          p_client_request_id: string;
          p_cost_paise: number;
          p_effective_date: string;
          p_item_id: string;
          p_kind: string;
          p_purpose: string;
          p_quantity: number;
          p_request_trace: string;
          p_society_id: string;
          p_vendor: string;
        };
        Returns: string;
      };
      housekeeping_transactions_list: {
        Args: {
          p_from: string;
          p_item_id: string;
          p_society_id: string;
          p_to: string;
        };
        Returns: Json;
      };
      list_household_members: {
        Args: { p_unit_id: string };
        Returns: {
          full_name: string;
          is_approver: boolean;
          is_primary: boolean;
          occupant_id: string;
          relationship: string;
        }[];
      };
      list_society_members: {
        Args: { p_society_id: string };
        Returns: {
          block_name: string;
          email: string;
          full_name: string;
          is_approver: boolean;
          is_primary: boolean;
          membership_id: string;
          occupant_id: string;
          occupant_status: string;
          phone_masked: string;
          relationship: string;
          roles: string[];
          status: string;
          unit_id: string;
          unit_number: string;
          user_id: string;
        }[];
      };
      lookup_registration_society: {
        Args: { p_join_code: string };
        Returns: Json;
      };
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      move_unit_occupant: {
        Args: {
          p_occupant_id: string;
          p_request_id: string;
          p_society_id: string;
          p_target_unit_id: string;
        };
        Returns: string;
      };
      notice_create: {
        Args: {
          p_attachment: Json;
          p_audience: string;
          p_block_ids: string[];
          p_body: string;
          p_client_request_id: string;
          p_expires_at: string;
          p_pinned: boolean;
          p_request_trace: string;
          p_society_id: string;
          p_title: string;
        };
        Returns: Json;
      };
      notice_get: {
        Args: { p_notice_id: string; p_society_id: string };
        Returns: Json;
      };
      notice_list: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_society_id: string;
          p_view?: string;
        };
        Returns: Json;
      };
      notice_mark_read: {
        Args: { p_notice_id: string; p_society_id: string };
        Returns: undefined;
      };
      notice_set_pinned: {
        Args: {
          p_notice_id: string;
          p_pinned: boolean;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      notice_update: {
        Args: {
          p_attachment: Json;
          p_audience: string;
          p_block_ids: string[];
          p_body: string;
          p_expected_updated_at: string;
          p_expires_at: string;
          p_notice_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_title: string;
        };
        Returns: Json;
      };
      notice_withdraw: {
        Args: {
          p_notice_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      record_developer_mfa: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      record_email_send: {
        Args: { p_daily_limit: number };
        Returns: {
          allowed: boolean;
          sent_count: number;
          should_alert: boolean;
        }[];
      };
      register_push_subscription: {
        Args: {
          p_auth_secret: string;
          p_endpoint: string;
          p_p256dh: string;
          p_user_agent?: string;
        };
        Returns: undefined;
      };
      reject_society_registration: {
        Args: {
          p_membership_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      request_add_comment: {
        Args: {
          p_body: string;
          p_client_request_id: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          body: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          request_id: string;
          society_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'service_request_comments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_assign: {
        Args: {
          p_membership_id: string;
          p_note: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_vendor_name: string;
          p_vendor_phone: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_assignees_list: { Args: { p_society_id: string }; Returns: Json };
      request_auto_close_run: {
        Args: {
          p_request_trace: string;
          p_society_id: string;
          p_today: string;
        };
        Returns: number;
      };
      request_categories_list: {
        Args: { p_include_inactive?: boolean; p_society_id: string };
        Returns: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          sla_hours: number | null;
          society_id: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'service_request_categories';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      request_category_save: {
        Args: {
          p_active: boolean;
          p_category_id: string;
          p_expected_updated_at: string;
          p_name: string;
          p_request_id: string;
          p_sla_hours: number;
          p_society_id: string;
          p_sort_order: number;
        };
        Returns: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          sla_hours: number | null;
          society_id: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_request_categories';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_confirm_close: {
        Args: {
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_create: {
        Args: {
          p_attachments: Json;
          p_category_id: string;
          p_client_request_id: string;
          p_description: string;
          p_location_type: string;
          p_priority: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_dashboard: { Args: { p_society_id: string }; Returns: Json };
      request_get: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      request_list: {
        Args: {
          p_assignee_id?: string;
          p_category_id?: string;
          p_from?: string;
          p_limit?: number;
          p_offset?: number;
          p_society_id: string;
          p_sort?: string;
          p_status?: string;
          p_to?: string;
          p_unit_id?: string;
        };
        Returns: Json;
      };
      request_rate: {
        Args: {
          p_comment: string;
          p_rating: number;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_reject: {
        Args: {
          p_reason: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_reopen: {
        Args: {
          p_reason: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_update_status: {
        Args: {
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_status: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location_type: string;
          priority: string;
          rating: number | null;
          rating_comment: string | null;
          reject_reason: string | null;
          resolved_at: string | null;
          sla_due_at: string | null;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'service_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_upvote_set: {
        Args: {
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_upvoted: boolean;
        };
        Returns: Json;
      };
      reserve_auth_code_attempt: {
        Args: { p_email_key: string };
        Returns: {
          challenge_id: string;
          retry_after_seconds: number;
          status: string;
        }[];
      };
      rotate_society_join_code: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: string;
      };
      session_developer_access: {
        Args: Record<PropertyKey, never>;
        Returns: {
          is_developer_account: boolean;
          mfa_verified: boolean;
        }[];
      };
      session_memberships: {
        Args: Record<PropertyKey, never>;
        Returns: {
          membership_status: string;
          roles: string[];
          society_id: string;
          society_name: string;
          society_status: string;
        }[];
      };
      set_household_approver: {
        Args: {
          p_is_approver: boolean;
          p_occupant_id: string;
          p_request_id: string;
        };
        Returns: undefined;
      };
      society_host_lookup: {
        Args: { p_slug: string };
        Returns: {
          id: string;
          name: string;
          status: string;
        }[];
      };
      staff_admin_save: {
        Args: {
          p_full_name: string;
          p_id_last_four: string;
          p_id_type: string;
          p_job_role: string;
          p_phone: string;
          p_photo_path: string;
          p_police_verified: boolean;
          p_request_id: string;
          p_society_id: string;
          p_staff_id: string;
          p_staff_type: string;
          p_status: string;
          p_unit_ids: string[];
        };
        Returns: string;
      };
      staff_attendance_list: {
        Args: { p_month: string; p_society_id: string; p_staff_id: string };
        Returns: Json;
      };
      staff_check_in: {
        Args: {
          p_guard_id: string;
          p_request_id: string;
          p_society_id: string;
          p_staff_code: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      staff_check_out: {
        Args: {
          p_attendance_id: string;
          p_guard_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      staff_gate_list: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: Json;
      };
      staff_list: { Args: { p_society_id: string }; Returns: Json };
      staff_resident_day_block: {
        Args: {
          p_request_id: string;
          p_society_id: string;
          p_staff_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      staff_resident_register: {
        Args: {
          p_full_name: string;
          p_id_last_four: string;
          p_id_type: string;
          p_job_role: string;
          p_phone: string;
          p_photo_path: string;
          p_police_verified: boolean;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      staff_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      staff_review_link: {
        Args: {
          p_decision: string;
          p_link_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      staff_settings_update: {
        Args: {
          p_request_id: string;
          p_resident_approval_required: boolean;
          p_society_id: string;
        };
        Returns: undefined;
      };
      staff_shift_list: {
        Args: { p_month: string; p_society_id: string };
        Returns: Json;
      };
      staff_shift_mark: {
        Args: {
          p_attendance_date: string;
          p_request_id: string;
          p_society_id: string;
          p_staff_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      staff_units_list: { Args: { p_society_id: string }; Returns: Json };
      start_auth_code_challenge: {
        Args: { p_email_key: string };
        Returns: string;
      };
      submit_society_registration: {
        Args: {
          p_full_name: string;
          p_join_code: string;
          p_relationship: string;
          p_request_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      user_erasure_complete: {
        Args: { p_actor_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      user_erasure_prepare: {
        Args: { p_actor_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      visitor_blacklist_add: {
        Args: {
          p_name: string;
          p_phone: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      visitor_blacklist_match: {
        Args: { p_phone: string; p_society_id: string };
        Returns: boolean;
      };
      visitor_blacklist_remove: {
        Args: {
          p_blacklist_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      visitor_check_in: {
        Args: {
          p_actor_id: string;
          p_entry_id: string;
          p_guard_id: string;
          p_request_id: string;
        };
        Returns: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          checked_out_by_guard_id: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          people_count: number;
          photo_path: string | null;
          pre_approval_id: string | null;
          purpose: string;
          respond_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
          visitor_phone: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_check_out: {
        Args: {
          p_actor_id: string;
          p_entry_id: string;
          p_guard_id: string;
          p_request_id: string;
        };
        Returns: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          checked_out_by_guard_id: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          people_count: number;
          photo_path: string | null;
          pre_approval_id: string | null;
          purpose: string;
          respond_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
          visitor_phone: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_create_entry: {
        Args: {
          p_actor_id: string;
          p_client_request_id: string;
          p_guard_id: string;
          p_people_count: number;
          p_photo_path: string;
          p_purpose: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
          p_vehicle_no: string;
          p_visitor_name: string;
          p_visitor_phone: string;
        };
        Returns: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          checked_out_by_guard_id: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          people_count: number;
          photo_path: string | null;
          pre_approval_id: string | null;
          purpose: string;
          respond_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
          visitor_phone: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_decide: {
        Args: { p_approve: boolean; p_entry_id: string; p_request_id: string };
        Returns: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          checked_out_by_guard_id: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          people_count: number;
          photo_path: string | null;
          pre_approval_id: string | null;
          purpose: string;
          respond_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
          visitor_phone: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_expire_run: {
        Args: { p_request_trace: string; p_society_id: string };
        Returns: number;
      };
      visitor_frequent_list: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          last_used_at: string | null;
          society_id: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'visitor_frequent_visitors';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      visitor_frequent_pre_approve: {
        Args: {
          p_frequent_visitor_id: string;
          p_request_id: string;
          p_society_id: string;
          p_valid_from: string;
          p_valid_to: string;
        };
        Returns: {
          code: string;
          created_at: string;
          created_by: string;
          id: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          used_at: string | null;
          valid_from: string;
          valid_to: string;
          vehicle_no: string | null;
          visitor_name: string;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_pre_approvals';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_frequent_remove: {
        Args: {
          p_frequent_visitor_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      visitor_frequent_save: {
        Args: {
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
          p_vehicle_no: string;
          p_visitor_name: string;
        };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          last_used_at: string | null;
          society_id: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_frequent_visitors';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_list_blacklist: {
        Args: { p_society_id: string };
        Returns: {
          active: boolean;
          id: string;
          name: string;
          phone: string;
          reason: string;
        }[];
      };
      visitor_list_entries: {
        Args: { p_scope: string; p_society_id: string; p_unit_id: string };
        Returns: {
          checked_in_at: string;
          checked_out_at: string;
          created_at: string;
          handled_by_guard_id: string;
          id: string;
          is_blacklisted: boolean;
          is_overstay: boolean;
          people_count: number;
          purpose: string;
          respond_by: string;
          source: string;
          status: string;
          unit_id: string;
          vehicle_no: string;
          visitor_name: string;
          visitor_phone: string;
        }[];
      };
      visitor_list_pre_approvals: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: {
          code: string;
          created_at: string;
          created_by: string;
          id: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          used_at: string | null;
          valid_from: string;
          valid_to: string;
          vehicle_no: string | null;
          visitor_name: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'visitor_pre_approvals';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      visitor_override: {
        Args: {
          p_actor_id: string;
          p_entry_id: string;
          p_guard_id: string;
          p_reason: string;
          p_request_id: string;
        };
        Returns: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          checked_out_by_guard_id: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          people_count: number;
          photo_path: string | null;
          pre_approval_id: string | null;
          purpose: string;
          respond_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
          visitor_phone: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_pre_approval_cancel: {
        Args: { p_approval_id: string; p_request_id: string };
        Returns: undefined;
      };
      visitor_pre_approval_check_in: {
        Args: {
          p_actor_id: string;
          p_code: string;
          p_guard_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          checked_out_by_guard_id: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_source: string | null;
          handled_by_guard_id: string;
          id: string;
          override_reason: string | null;
          people_count: number;
          photo_path: string | null;
          pre_approval_id: string | null;
          purpose: string;
          respond_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_no: string | null;
          visitor_name: string;
          visitor_phone: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_pre_approval_create: {
        Args: {
          p_request_id: string;
          p_unit_id: string;
          p_valid_from: string;
          p_valid_to: string;
          p_vehicle_no: string;
          p_visitor_name: string;
        };
        Returns: {
          code: string;
          created_at: string;
          created_by: string;
          id: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          used_at: string | null;
          valid_from: string;
          valid_to: string;
          vehicle_no: string | null;
          visitor_name: string;
        };
        SetofOptions: {
          from: '*';
          to: 'visitor_pre_approvals';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      visitor_pre_approval_validate: {
        Args: {
          p_actor_id: string;
          p_code: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: {
          approval_id: string;
          reason: string;
          unit_id: string;
          valid_from: string;
          valid_to: string;
          vehicle_no: string;
          visitor_name: string;
        }[];
      };
      visitor_update_settings: {
        Args: { p_request_id: string; p_settings: Json; p_society_id: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
