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
      amc_contracts: {
        Row: {
          asset_label: string;
          client_request_id: string;
          cost_paise: number;
          created_by: string;
          document_path: string | null;
          end_date: string;
          id: string;
          last_reminder_days: number | null;
          payment_terms: string;
          predecessor_id: string | null;
          society_id: string;
          start_date: string;
          updated_at: string;
          updated_by: string;
          vendor_contact: string;
          vendor_name: string;
          visit_frequency: string;
        };
        ComputedFields: never;
        Insert: {
          asset_label: string;
          client_request_id: string;
          cost_paise: number;
          created_by: string;
          document_path?: string | null;
          end_date: string;
          id?: string;
          last_reminder_days?: number | null;
          payment_terms: string;
          predecessor_id?: string | null;
          society_id: string;
          start_date: string;
          updated_at?: string;
          updated_by: string;
          vendor_contact: string;
          vendor_name: string;
          visit_frequency: string;
        };
        Update: {
          asset_label?: string;
          client_request_id?: string;
          cost_paise?: number;
          created_by?: string;
          document_path?: string | null;
          end_date?: string;
          id?: string;
          last_reminder_days?: number | null;
          payment_terms?: string;
          predecessor_id?: string | null;
          society_id?: string;
          start_date?: string;
          updated_at?: string;
          updated_by?: string;
          vendor_contact?: string;
          vendor_name?: string;
          visit_frequency?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'amc_contracts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amc_contracts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amc_contracts_society_id_predecessor_id_fkey';
            columns: ['society_id', 'predecessor_id'];
            isOneToOne: false;
            referencedRelation: 'amc_contracts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amc_contracts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      amc_request_links: {
        Row: {
          contract_id: string;
          request_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          contract_id: string;
          request_id: string;
          society_id: string;
        };
        Update: {
          contract_id?: string;
          request_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'amc_request_links_society_id_contract_id_fkey';
            columns: ['society_id', 'contract_id'];
            isOneToOne: false;
            referencedRelation: 'amc_contracts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amc_request_links_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amc_request_links_society_id_request_id_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      amc_visits: {
        Row: {
          client_request_id: string;
          contract_id: string;
          created_by: string;
          document_path: string | null;
          id: string;
          society_id: string;
          summary: string;
          technician: string;
          updated_at: string;
          updated_by: string;
          visit_date: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          contract_id: string;
          created_by: string;
          document_path?: string | null;
          id?: string;
          society_id: string;
          summary: string;
          technician: string;
          updated_at?: string;
          updated_by: string;
          visit_date: string;
        };
        Update: {
          client_request_id?: string;
          contract_id?: string;
          created_by?: string;
          document_path?: string | null;
          id?: string;
          society_id?: string;
          summary?: string;
          technician?: string;
          updated_at?: string;
          updated_by?: string;
          visit_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'amc_visits_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amc_visits_society_id_contract_id_fkey';
            columns: ['society_id', 'contract_id'];
            isOneToOne: false;
            referencedRelation: 'amc_contracts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amc_visits_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amc_visits_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      amenities: {
        Row: {
          active: boolean;
          capacity: number;
          client_request_id: string;
          created_by: string;
          fee_paise: number;
          id: string;
          name: string;
          rules: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          capacity: number;
          client_request_id: string;
          created_by: string;
          fee_paise?: number;
          id?: string;
          name: string;
          rules?: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          client_request_id?: string;
          created_by?: string;
          fee_paise?: number;
          id?: string;
          name?: string;
          rules?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'amenities_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenities_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenities_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      amenity_bookings: {
        Row: {
          amenity_id: string;
          amenity_name: string;
          booked_by: string;
          booking_span: unknown;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          capacity: number;
          charge_ledger_id: number | null;
          client_request_id: string;
          created_at: string;
          credit_ledger_id: number | null;
          ends_at: string;
          fee_paise: number;
          guest_count: number;
          id: string;
          rules_accepted: boolean;
          rules_snapshot: string;
          slot_id: string;
          society_id: string;
          starts_at: string;
          status: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          amenity_id: string;
          amenity_name: string;
          booked_by: string;
          booking_span?: never;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          capacity: number;
          charge_ledger_id?: number | null;
          client_request_id: string;
          created_at?: string;
          credit_ledger_id?: number | null;
          ends_at: string;
          fee_paise: number;
          guest_count: number;
          id?: string;
          rules_accepted: boolean;
          rules_snapshot: string;
          slot_id: string;
          society_id: string;
          starts_at: string;
          status?: string;
          unit_id: string;
        };
        Update: {
          amenity_id?: string;
          amenity_name?: string;
          booked_by?: string;
          booking_span?: never;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          capacity?: number;
          charge_ledger_id?: number | null;
          client_request_id?: string;
          created_at?: string;
          credit_ledger_id?: number | null;
          ends_at?: string;
          fee_paise?: number;
          guest_count?: number;
          id?: string;
          rules_accepted?: boolean;
          rules_snapshot?: string;
          slot_id?: string;
          society_id?: string;
          starts_at?: string;
          status?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'amenity_bookings_booked_by_fkey';
            columns: ['booked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenity_bookings_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenity_bookings_society_id_amenity_id_slot_id_fkey';
            columns: ['society_id', 'amenity_id', 'slot_id'];
            isOneToOne: false;
            referencedRelation: 'amenity_slots';
            referencedColumns: ['society_id', 'amenity_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_bookings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenity_bookings_society_id_unit_id_charge_ledger_id_fkey';
            columns: ['society_id', 'unit_id', 'charge_ledger_id'];
            isOneToOne: false;
            referencedRelation: 'billing_ledger_entries';
            referencedColumns: ['society_id', 'unit_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_bookings_society_id_unit_id_credit_ledger_id_fkey';
            columns: ['society_id', 'unit_id', 'credit_ledger_id'];
            isOneToOne: false;
            referencedRelation: 'billing_ledger_entries';
            referencedColumns: ['society_id', 'unit_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_bookings_society_id_unit_id_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      amenity_slots: {
        Row: {
          active: boolean;
          amenity_id: string;
          ends_local: string;
          id: string;
          society_id: string;
          starts_local: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          amenity_id: string;
          ends_local: string;
          id?: string;
          society_id: string;
          starts_local: string;
          weekday: number;
        };
        Update: {
          active?: boolean;
          amenity_id?: string;
          ends_local?: string;
          id?: string;
          society_id?: string;
          starts_local?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'amenity_slots_society_id_amenity_id_fkey';
            columns: ['society_id', 'amenity_id'];
            isOneToOne: false;
            referencedRelation: 'amenities';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_slots_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      asset_categories: {
        Row: {
          active: boolean;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'asset_categories_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'asset_categories_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'asset_categories_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      asset_maintenance_entries: {
        Row: {
          asset_id: string;
          client_request_id: string;
          cost_paise: number | null;
          created_at: string;
          created_by: string;
          description: string;
          done_by: string;
          id: string;
          performed_on: string;
          removed_at: string | null;
          removed_by: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          asset_id: string;
          client_request_id: string;
          cost_paise?: number | null;
          created_at?: string;
          created_by: string;
          description: string;
          done_by: string;
          id?: string;
          performed_on: string;
          removed_at?: string | null;
          removed_by?: string | null;
          society_id: string;
        };
        Update: {
          asset_id?: string;
          client_request_id?: string;
          cost_paise?: number | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          done_by?: string;
          id?: string;
          performed_on?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'asset_maintenance_entries_asset_same_society_fkey';
            columns: ['society_id', 'asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'asset_maintenance_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'asset_maintenance_entries_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'asset_maintenance_entries_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      assets: {
        Row: {
          amc_contract_id: string | null;
          category_id: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          location: string;
          make: string | null;
          model: string | null;
          name: string;
          notes: string | null;
          purchase_cost_paise: number | null;
          purchase_date: string | null;
          serial_number: string | null;
          society_id: string;
          status: string;
          supplier: string | null;
          updated_at: string;
          updated_by: string;
          version: number;
          warranty_end_date: string | null;
        };
        ComputedFields: never;
        Insert: {
          amc_contract_id?: string | null;
          category_id: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          location: string;
          make?: string | null;
          model?: string | null;
          name: string;
          notes?: string | null;
          purchase_cost_paise?: number | null;
          purchase_date?: string | null;
          serial_number?: string | null;
          society_id: string;
          status?: string;
          supplier?: string | null;
          updated_at?: string;
          updated_by: string;
          version?: number;
          warranty_end_date?: string | null;
        };
        Update: {
          amc_contract_id?: string | null;
          category_id?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          location?: string;
          make?: string | null;
          model?: string | null;
          name?: string;
          notes?: string | null;
          purchase_cost_paise?: number | null;
          purchase_date?: string | null;
          serial_number?: string | null;
          society_id?: string;
          status?: string;
          supplier?: string | null;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          warranty_end_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'assets_amc_contract_same_society_fkey';
            columns: ['society_id', 'amc_contract_id'];
            isOneToOne: false;
            referencedRelation: 'amc_contracts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'assets_category_same_society_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'asset_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'assets_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assets_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assets_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
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
      directory_emergency_contacts: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          full_name: string;
          id: string;
          membership_id: string;
          phone: string;
          purge_after: string | null;
          relationship: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          full_name: string;
          id?: string;
          membership_id: string;
          phone: string;
          purge_after?: string | null;
          relationship: string;
          society_id: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          full_name?: string;
          id?: string;
          membership_id?: string;
          phone?: string;
          purge_after?: string | null;
          relationship?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'directory_emergency_contacts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'directory_emergency_contacts_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'directory_emergency_contacts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'directory_emergency_contacts_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'directory_emergency_contacts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      directory_preferences: {
        Row: {
          membership_id: string;
          name_visible: boolean;
          phone_visible: boolean;
          purge_after: string | null;
          society_id: string;
          unit_visible: boolean;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          membership_id: string;
          name_visible?: boolean;
          phone_visible?: boolean;
          purge_after?: string | null;
          society_id: string;
          unit_visible?: boolean;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          membership_id?: string;
          name_visible?: boolean;
          phone_visible?: boolean;
          purge_after?: string | null;
          society_id?: string;
          unit_visible?: boolean;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'directory_preferences_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: true;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'directory_preferences_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'directory_preferences_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      directory_vehicles: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          membership_id: string;
          purge_after: string | null;
          registration_number: string;
          society_id: string;
          status: string;
          tag_number: string | null;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_type: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          membership_id: string;
          purge_after?: string | null;
          registration_number: string;
          society_id: string;
          status?: string;
          tag_number?: string | null;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_type: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          membership_id?: string;
          purge_after?: string | null;
          registration_number?: string;
          society_id?: string;
          status?: string;
          tag_number?: string | null;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_type?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'directory_vehicles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'directory_vehicles_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'directory_vehicles_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'directory_vehicles_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'directory_vehicles_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'directory_vehicles_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      document_folders: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          audience: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          society_id: string;
          sort_order: number;
          system_key: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          audience: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          society_id: string;
          sort_order?: number;
          system_key?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          audience?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          society_id?: string;
          sort_order?: number;
          system_key?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'document_folders_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_folders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_folders_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_folders_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      document_versions: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          content_type: string;
          created_at: string;
          created_by: string;
          document_id: string;
          file_name: string;
          id: string;
          note: string | null;
          path: string;
          size_bytes: number;
          society_id: string;
          version_number: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          content_type: string;
          created_at?: string;
          created_by: string;
          document_id: string;
          file_name: string;
          id?: string;
          note?: string | null;
          path: string;
          size_bytes: number;
          society_id: string;
          version_number: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          content_type?: string;
          created_at?: string;
          created_by?: string;
          document_id?: string;
          file_name?: string;
          id?: string;
          note?: string | null;
          path?: string;
          size_bytes?: number;
          society_id?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'document_versions_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_versions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_versions_document_fkey';
            columns: ['society_id', 'document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'document_versions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          folder_id: string | null;
          id: string;
          society_id: string;
          title: string;
          unit_audience: string | null;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          folder_id?: string | null;
          id?: string;
          society_id: string;
          title: string;
          unit_audience?: string | null;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          folder_id?: string | null;
          id?: string;
          society_id?: string;
          title?: string;
          unit_audience?: string | null;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_folder_fkey';
            columns: ['society_id', 'folder_id'];
            isOneToOne: false;
            referencedRelation: 'document_folders';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'documents_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'documents_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
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
      expense_accounts: {
        Row: {
          account_type: string;
          active: boolean;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          opening_balance_paise: number;
          opening_on: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_type: string;
          active?: boolean;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          opening_balance_paise?: number;
          opening_on: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_type?: string;
          active?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          opening_balance_paise?: number;
          opening_on?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_accounts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_accounts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_accounts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_book_entries: {
        Row: {
          account_id: string;
          amount_paise: number;
          billing_payment_id: string | null;
          category_id: string | null;
          client_request_id: string | null;
          counterparty: string;
          created_at: string;
          created_by: string;
          description: string | null;
          direction: string;
          entry_date: string;
          expense_id: string | null;
          id: string;
          income_kind: string | null;
          reference: string | null;
          reverses_entry_id: string | null;
          society_id: string;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          amount_paise: number;
          billing_payment_id?: string | null;
          category_id?: string | null;
          client_request_id?: string | null;
          counterparty: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          direction: string;
          entry_date: string;
          expense_id?: string | null;
          id?: string;
          income_kind?: string | null;
          reference?: string | null;
          reverses_entry_id?: string | null;
          society_id: string;
          source: string;
        };
        Update: {
          account_id?: string;
          amount_paise?: number;
          billing_payment_id?: string | null;
          category_id?: string | null;
          client_request_id?: string | null;
          counterparty?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          direction?: string;
          entry_date?: string;
          expense_id?: string | null;
          id?: string;
          income_kind?: string | null;
          reference?: string | null;
          reverses_entry_id?: string | null;
          society_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_book_entries_account_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_book_entries_billing_payment_fkey';
            columns: ['society_id', 'billing_payment_id'];
            isOneToOne: true;
            referencedRelation: 'billing_payments';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_book_entries_category_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_book_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_book_entries_expense_fkey';
            columns: ['society_id', 'expense_id'];
            isOneToOne: true;
            referencedRelation: 'expenses';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_book_entries_reverses_fkey';
            columns: ['society_id', 'reverses_entry_id'];
            isOneToOne: true;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_book_entries_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_categories: {
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
          created_by: string;
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
            foreignKeyName: 'expense_categories_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_categories_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_categories_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_month_locks: {
        Row: {
          locked_at: string;
          locked_by: string;
          month: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          locked_at?: string;
          locked_by: string;
          month: string;
          society_id: string;
        };
        Update: {
          locked_at?: string;
          locked_by?: string;
          month?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_month_locks_locked_by_fkey';
            columns: ['locked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_month_locks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          account_id: string;
          amount_paise: number;
          approval_required: boolean;
          category_id: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          description: string | null;
          id: string;
          payee: string;
          payment_mode: string;
          receipt_path: string | null;
          reference: string | null;
          society_id: string;
          spent_on: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          amount_paise: number;
          approval_required: boolean;
          category_id: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          description?: string | null;
          id?: string;
          payee: string;
          payment_mode: string;
          receipt_path?: string | null;
          reference?: string | null;
          society_id: string;
          spent_on: string;
          status: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_id?: string;
          amount_paise?: number;
          approval_required?: boolean;
          category_id?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          description?: string | null;
          id?: string;
          payee?: string;
          payment_mode?: string;
          receipt_path?: string | null;
          reference?: string | null;
          society_id?: string;
          spent_on?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_account_same_society_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expenses_category_same_society_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expenses_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_updated_by_fkey';
            columns: ['updated_by'];
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
      home_services_providers: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          area: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          notes: string | null;
          origin: string;
          phone: string;
          review_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          service_type: string;
          society_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          area?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          notes?: string | null;
          origin: string;
          phone: string;
          review_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          service_type: string;
          society_id: string;
          status: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          area?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          origin?: string;
          phone?: string;
          review_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          service_type?: string;
          society_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'home_services_providers_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'home_services_providers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'home_services_providers_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'home_services_providers_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'home_services_providers_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      home_services_ratings: {
        Row: {
          comment: string | null;
          comment_hidden_at: string | null;
          comment_hidden_by: string | null;
          created_at: string;
          id: string;
          provider_id: string;
          rated_by: string;
          society_id: string;
          stars: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          comment_hidden_at?: string | null;
          comment_hidden_by?: string | null;
          created_at?: string;
          id?: string;
          provider_id: string;
          rated_by: string;
          society_id: string;
          stars: number;
          updated_at?: string;
        };
        Update: {
          comment?: string | null;
          comment_hidden_at?: string | null;
          comment_hidden_by?: string | null;
          created_at?: string;
          id?: string;
          provider_id?: string;
          rated_by?: string;
          society_id?: string;
          stars?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'home_services_ratings_comment_hidden_by_fkey';
            columns: ['comment_hidden_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'home_services_ratings_provider_same_society_fkey';
            columns: ['society_id', 'provider_id'];
            isOneToOne: false;
            referencedRelation: 'home_services_providers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'home_services_ratings_rated_by_fkey';
            columns: ['rated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'home_services_ratings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
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
      metering_charges: {
        Row: {
          amount_paise: number | null;
          bill_id: string | null;
          billed_at: string | null;
          billed_by: string | null;
          billed_paise: number | null;
          consumption: number;
          created_at: string;
          id: string;
          meter_id: string;
          meter_type: string;
          rate_id: string | null;
          rate_paise: number | null;
          reading_date: string;
          reading_id: string;
          society_id: string;
          status: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise?: number | null;
          bill_id?: string | null;
          billed_at?: string | null;
          billed_by?: string | null;
          billed_paise?: number | null;
          consumption: number;
          created_at?: string;
          id?: string;
          meter_id: string;
          meter_type: string;
          rate_id?: string | null;
          rate_paise?: number | null;
          reading_date: string;
          reading_id: string;
          society_id: string;
          status?: string;
          unit_id: string;
        };
        Update: {
          amount_paise?: number | null;
          bill_id?: string | null;
          billed_at?: string | null;
          billed_by?: string | null;
          billed_paise?: number | null;
          consumption?: number;
          created_at?: string;
          id?: string;
          meter_id?: string;
          meter_type?: string;
          rate_id?: string | null;
          rate_paise?: number | null;
          reading_date?: string;
          reading_id?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'metering_charges_bill_same_society_fkey';
            columns: ['society_id', 'bill_id'];
            isOneToOne: false;
            referencedRelation: 'billing_bills';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'metering_charges_billed_by_fkey';
            columns: ['billed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_charges_meter_same_society_fkey';
            columns: ['society_id', 'meter_id'];
            isOneToOne: false;
            referencedRelation: 'metering_meters';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'metering_charges_rate_same_society_fkey';
            columns: ['society_id', 'rate_id'];
            isOneToOne: false;
            referencedRelation: 'metering_rates';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'metering_charges_reading_same_society_fkey';
            columns: ['society_id', 'reading_id'];
            isOneToOne: false;
            referencedRelation: 'metering_readings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'metering_charges_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_charges_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      metering_meters: {
        Row: {
          active: boolean;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          initial_reading: number;
          label: string;
          meter_type: string;
          scope: string;
          serial_number: string | null;
          society_id: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          initial_reading?: number;
          label: string;
          meter_type: string;
          scope: string;
          serial_number?: string | null;
          society_id: string;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          initial_reading?: number;
          label?: string;
          meter_type?: string;
          scope?: string;
          serial_number?: string | null;
          society_id?: string;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'metering_meters_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_meters_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_meters_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'metering_meters_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      metering_rates: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          meter_type: string;
          rate_paise: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          meter_type: string;
          rate_paise: number;
          society_id: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          meter_type?: string;
          rate_paise?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'metering_rates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_rates_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      metering_readings: {
        Row: {
          client_request_id: string;
          consumption: number | null;
          created_at: string;
          created_by: string;
          id: string;
          is_reset: boolean;
          lower_reason: string | null;
          meter_id: string;
          photo_content_type: string | null;
          photo_path: string | null;
          photo_size_bytes: number | null;
          previous_reading_id: string | null;
          previous_value: number | null;
          reading_date: string;
          reading_value: number;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          consumption?: number | null;
          created_at?: string;
          created_by: string;
          id?: string;
          is_reset?: boolean;
          lower_reason?: string | null;
          meter_id: string;
          photo_content_type?: string | null;
          photo_path?: string | null;
          photo_size_bytes?: number | null;
          previous_reading_id?: string | null;
          previous_value?: number | null;
          reading_date: string;
          reading_value: number;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          society_id: string;
          source: string;
          status?: string;
          unit_id?: string | null;
        };
        Update: {
          client_request_id?: string;
          consumption?: number | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_reset?: boolean;
          lower_reason?: string | null;
          meter_id?: string;
          photo_content_type?: string | null;
          photo_path?: string | null;
          photo_size_bytes?: number | null;
          previous_reading_id?: string | null;
          previous_value?: number | null;
          reading_date?: string;
          reading_value?: number;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          society_id?: string;
          source?: string;
          status?: string;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'metering_readings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_readings_meter_same_society_fkey';
            columns: ['society_id', 'meter_id'];
            isOneToOne: false;
            referencedRelation: 'metering_meters';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'metering_readings_previous_same_society_fkey';
            columns: ['society_id', 'previous_reading_id'];
            isOneToOne: false;
            referencedRelation: 'metering_readings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'metering_readings_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_readings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'metering_readings_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
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
      parking_allocations: {
        Row: {
          ended_at: string | null;
          ended_by: string | null;
          id: string;
          skip_reason: string | null;
          slot_id: string;
          society_id: string;
          started_at: string;
          started_by: string;
          unit_id: string;
          waitlist_request_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          ended_at?: string | null;
          ended_by?: string | null;
          id?: string;
          skip_reason?: string | null;
          slot_id: string;
          society_id: string;
          started_at?: string;
          started_by: string;
          unit_id: string;
          waitlist_request_id?: string | null;
        };
        Update: {
          ended_at?: string | null;
          ended_by?: string | null;
          id?: string;
          skip_reason?: string | null;
          slot_id?: string;
          society_id?: string;
          started_at?: string;
          started_by?: string;
          unit_id?: string;
          waitlist_request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'parking_allocations_ended_by_fkey';
            columns: ['ended_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_allocations_request_same_society_fkey';
            columns: ['society_id', 'waitlist_request_id'];
            isOneToOne: false;
            referencedRelation: 'parking_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'parking_allocations_slot_same_society_fkey';
            columns: ['society_id', 'slot_id'];
            isOneToOne: false;
            referencedRelation: 'parking_slots';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'parking_allocations_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_allocations_started_by_fkey';
            columns: ['started_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_allocations_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      parking_reports: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          matched_unit_id: string | null;
          note: string | null;
          photo_content_type: string | null;
          photo_deleted_at: string | null;
          photo_path: string | null;
          photo_size_bytes: number | null;
          reporter_role: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          slot_id: string | null;
          society_id: string;
          status: string;
          vehicle_number: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          matched_unit_id?: string | null;
          note?: string | null;
          photo_content_type?: string | null;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          photo_size_bytes?: number | null;
          reporter_role: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          slot_id?: string | null;
          society_id: string;
          status?: string;
          vehicle_number?: string | null;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          matched_unit_id?: string | null;
          note?: string | null;
          photo_content_type?: string | null;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          photo_size_bytes?: number | null;
          reporter_role?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          slot_id?: string | null;
          society_id?: string;
          status?: string;
          vehicle_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'parking_reports_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_reports_slot_same_society_fkey';
            columns: ['society_id', 'slot_id'];
            isOneToOne: false;
            referencedRelation: 'parking_slots';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'parking_reports_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_reports_unit_same_society_fkey';
            columns: ['society_id', 'matched_unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      parking_requests: {
        Row: {
          allocation_id: string | null;
          client_request_id: string;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string;
          id: string;
          note: string | null;
          queue_seq: number;
          slot_type: string;
          society_id: string;
          status: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          allocation_id?: string | null;
          client_request_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          note?: string | null;
          queue_seq?: never;
          slot_type: string;
          society_id: string;
          status?: string;
          unit_id: string;
        };
        Update: {
          allocation_id?: string | null;
          client_request_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string | null;
          queue_seq?: never;
          slot_type?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parking_requests_allocation_same_society_fkey';
            columns: ['society_id', 'allocation_id'];
            isOneToOne: false;
            referencedRelation: 'parking_allocations';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'parking_requests_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_requests_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_requests_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_requests_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      parking_slots: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          label: string;
          location_note: string | null;
          slot_type: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          label: string;
          location_note?: string | null;
          slot_type: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          label?: string;
          location_note?: string | null;
          slot_type?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'parking_slots_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_slots_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_slots_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_slots_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      parking_vehicle_links: {
        Row: {
          allocation_id: string;
          created_at: string;
          created_by: string;
          ended_at: string | null;
          ended_by: string | null;
          id: string;
          slot_type: string;
          society_id: string;
          vehicle_class: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          allocation_id: string;
          created_at?: string;
          created_by: string;
          ended_at?: string | null;
          ended_by?: string | null;
          id?: string;
          slot_type: string;
          society_id: string;
          vehicle_class: string;
          vehicle_id: string;
        };
        Update: {
          allocation_id?: string;
          created_at?: string;
          created_by?: string;
          ended_at?: string | null;
          ended_by?: string | null;
          id?: string;
          slot_type?: string;
          society_id?: string;
          vehicle_class?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parking_vehicle_links_allocation_same_society_fkey';
            columns: ['society_id', 'allocation_id'];
            isOneToOne: false;
            referencedRelation: 'parking_allocations';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'parking_vehicle_links_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_vehicle_links_ended_by_fkey';
            columns: ['ended_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_vehicle_links_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_vehicle_links_vehicle_same_society_fkey';
            columns: ['society_id', 'vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'directory_vehicles';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      parking_visitor_passes: {
        Row: {
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          ends_at: string;
          id: string;
          slot_id: string;
          society_id: string;
          starts_at: string;
          status: string;
          unit_id: string;
          vehicle_number: string | null;
          visitor_entry_id: string | null;
          visitor_name: string;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          ends_at: string;
          id?: string;
          slot_id: string;
          society_id: string;
          starts_at: string;
          status?: string;
          unit_id: string;
          vehicle_number?: string | null;
          visitor_entry_id?: string | null;
          visitor_name: string;
        };
        Update: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          ends_at?: string;
          id?: string;
          slot_id?: string;
          society_id?: string;
          starts_at?: string;
          status?: string;
          unit_id?: string;
          vehicle_number?: string | null;
          visitor_entry_id?: string | null;
          visitor_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parking_visitor_passes_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_visitor_passes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_visitor_passes_entry_same_society_fkey';
            columns: ['society_id', 'visitor_entry_id'];
            isOneToOne: false;
            referencedRelation: 'visitor_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'parking_visitor_passes_slot_same_society_fkey';
            columns: ['society_id', 'slot_id'];
            isOneToOne: false;
            referencedRelation: 'parking_slots';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'parking_visitor_passes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parking_visitor_passes_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      patrol_checkpoints: {
        Row: {
          active: boolean;
          client_request_id: string;
          code: string;
          created_at: string;
          created_by: string;
          id: string;
          location_note: string | null;
          name: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          client_request_id: string;
          code: string;
          created_at?: string;
          created_by: string;
          id?: string;
          location_note?: string | null;
          name: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          client_request_id?: string;
          code?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          location_note?: string | null;
          name?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_checkpoints_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_checkpoints_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_checkpoints_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      patrol_handover_notes: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          body: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          body: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          society_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          body?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_handover_notes_acknowledged_by_fkey';
            columns: ['acknowledged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_handover_notes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_handover_notes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      patrol_incident_notes: {
        Row: {
          body: string;
          created_at: string;
          created_by: string;
          id: string;
          incident_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          created_by: string;
          id?: string;
          incident_id: string;
          society_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          incident_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_incident_notes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_incident_notes_incident_fkey';
            columns: ['society_id', 'incident_id'];
            isOneToOne: false;
            referencedRelation: 'patrol_incidents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'patrol_incident_notes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      patrol_incident_photos: {
        Row: {
          content_type: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          incident_id: string;
          path: string;
          photo_order: number;
          size_bytes: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          content_type: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          incident_id: string;
          path: string;
          photo_order: number;
          size_bytes: number;
          society_id: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          incident_id?: string;
          path?: string;
          photo_order?: number;
          size_bytes?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_incident_photos_incident_fkey';
            columns: ['society_id', 'incident_id'];
            isOneToOne: false;
            referencedRelation: 'patrol_incidents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'patrol_incident_photos_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      patrol_incidents: {
        Row: {
          category: string;
          client_request_id: string;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          location: string | null;
          resolution: string | null;
          severity: string;
          society_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          client_request_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          id?: string;
          location?: string | null;
          resolution?: string | null;
          severity: string;
          society_id: string;
          status?: string;
        };
        Update: {
          category?: string;
          client_request_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          location?: string | null;
          resolution?: string | null;
          severity?: string;
          society_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_incidents_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_incidents_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_incidents_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      patrol_scans: {
        Row: {
          checkpoint_id: string;
          client_request_id: string;
          id: string;
          method: string;
          scanned_at: string;
          scanned_by: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          checkpoint_id: string;
          client_request_id: string;
          id?: string;
          method: string;
          scanned_at?: string;
          scanned_by: string;
          society_id: string;
        };
        Update: {
          checkpoint_id?: string;
          client_request_id?: string;
          id?: string;
          method?: string;
          scanned_at?: string;
          scanned_by?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_scans_checkpoint_fkey';
            columns: ['society_id', 'checkpoint_id'];
            isOneToOne: false;
            referencedRelation: 'patrol_checkpoints';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'patrol_scans_scanned_by_fkey';
            columns: ['scanned_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_scans_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      patrol_schedule_checkpoints: {
        Row: {
          checkpoint_id: string;
          created_at: string;
          created_by: string;
          schedule_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          checkpoint_id: string;
          created_at?: string;
          created_by: string;
          schedule_id: string;
          society_id: string;
        };
        Update: {
          checkpoint_id?: string;
          created_at?: string;
          created_by?: string;
          schedule_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_schedule_checkpoints_checkpoint_fkey';
            columns: ['society_id', 'checkpoint_id'];
            isOneToOne: false;
            referencedRelation: 'patrol_checkpoints';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'patrol_schedule_checkpoints_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_schedule_checkpoints_schedule_fkey';
            columns: ['society_id', 'schedule_id'];
            isOneToOne: false;
            referencedRelation: 'patrol_schedules';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'patrol_schedule_checkpoints_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      patrol_schedules: {
        Row: {
          active: boolean;
          client_request_id: string;
          created_at: string;
          created_by: string;
          effective_from: string;
          grace_minutes: number;
          id: string;
          interval_minutes: number;
          name: string;
          shift_end: string;
          shift_start: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          effective_from?: string;
          grace_minutes: number;
          id?: string;
          interval_minutes: number;
          name: string;
          shift_end: string;
          shift_start: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          effective_from?: string;
          grace_minutes?: number;
          id?: string;
          interval_minutes?: number;
          name?: string;
          shift_end?: string;
          shift_start?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'patrol_schedules_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_schedules_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patrol_schedules_updated_by_fkey';
            columns: ['updated_by'];
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
          committee_escalation_days: number;
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
          committee_escalation_days?: number;
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
          committee_escalation_days?: number;
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
      service_request_escalation_settings: {
        Row: {
          created_at: string;
          created_by: string | null;
          delivery: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          delivery?: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          delivery?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_escalation_settings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_escalation_settings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_escalation_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_escalations: {
        Row: {
          created_at: string;
          delivery: string;
          escalated_on: string;
          id: string;
          level: string;
          recipient_count: number;
          request_id: string;
          request_trace: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          delivery: string;
          escalated_on: string;
          id?: string;
          level: string;
          recipient_count: number;
          request_id: string;
          request_trace?: string | null;
          society_id: string;
        };
        Update: {
          created_at?: string;
          delivery?: string;
          escalated_on?: string;
          id?: string;
          level?: string;
          recipient_count?: number;
          request_id?: string;
          request_trace?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_escalations_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_escalations_society_id_fkey';
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
      sos_alert_events: {
        Row: {
          action: string;
          alert_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          note: string | null;
          request_id: string;
          society_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          alert_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          request_id: string;
          society_id: string;
          status: string;
        };
        Update: {
          action?: string;
          alert_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          request_id?: string;
          society_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sos_alert_events_alert_fkey';
            columns: ['society_id', 'alert_id'];
            isOneToOne: false;
            referencedRelation: 'sos_alerts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'sos_alert_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_alert_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      sos_alert_recipients: {
        Row: {
          acknowledged_at: string | null;
          alert_id: string;
          audience: string;
          notified_at: string;
          society_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string | null;
          alert_id: string;
          audience: string;
          notified_at?: string;
          society_id: string;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          alert_id?: string;
          audience?: string;
          notified_at?: string;
          society_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sos_alert_recipients_alert_fkey';
            columns: ['society_id', 'alert_id'];
            isOneToOne: false;
            referencedRelation: 'sos_alerts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'sos_alert_recipients_membership_fkey';
            columns: ['society_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'user_id'];
          },
          {
            foreignKeyName: 'sos_alert_recipients_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_alert_recipients_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      sos_alerts: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          category: string;
          client_request_id: string;
          close_note: string | null;
          close_reason: string | null;
          closed_at: string | null;
          closed_by: string | null;
          id: string;
          note: string | null;
          raised_at: string;
          raised_by: string;
          raised_role: string;
          society_id: string;
          status: string;
          unit_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          category: string;
          client_request_id: string;
          close_note?: string | null;
          close_reason?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          id?: string;
          note?: string | null;
          raised_at?: string;
          raised_by: string;
          raised_role: string;
          society_id: string;
          status?: string;
          unit_id?: string | null;
          updated_at?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          category?: string;
          client_request_id?: string;
          close_note?: string | null;
          close_reason?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          id?: string;
          note?: string | null;
          raised_at?: string;
          raised_by?: string;
          raised_role?: string;
          society_id?: string;
          status?: string;
          unit_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sos_alerts_acknowledged_by_fkey';
            columns: ['acknowledged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_alerts_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_alerts_raised_by_fkey';
            columns: ['raised_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_alerts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_alerts_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      sos_contacts: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          label: string;
          phone: string;
          society_id: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label: string;
          phone: string;
          society_id: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string;
          phone?: string;
          society_id?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sos_contacts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_contacts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sos_contacts_updated_by_fkey';
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
      tenancy_documents: {
        Row: {
          content_type: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          dues_checked_at: string | null;
          dues_status: string | null;
          id: string;
          kind: string;
          move_id: string;
          path: string;
          purge_after: string | null;
          size_bytes: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          content_type: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          dues_checked_at?: string | null;
          dues_status?: string | null;
          id?: string;
          kind: string;
          move_id: string;
          path: string;
          purge_after?: string | null;
          size_bytes: number;
          society_id: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          dues_checked_at?: string | null;
          dues_status?: string | null;
          id?: string;
          kind?: string;
          move_id?: string;
          path?: string;
          purge_after?: string | null;
          size_bytes?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_documents_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_documents_move_fkey';
            columns: ['society_id', 'move_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_moves';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_documents_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      tenancy_events: {
        Row: {
          action: string;
          created_at: string;
          created_by: string | null;
          id: string;
          move_id: string;
          reason: string | null;
          request_id: string;
          society_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          move_id: string;
          reason?: string | null;
          request_id: string;
          society_id: string;
          status: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          move_id?: string;
          reason?: string | null;
          request_id?: string;
          society_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_events_move_fkey';
            columns: ['society_id', 'move_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_moves';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      tenancy_moves: {
        Row: {
          agreement_expires_on: string | null;
          amenity_booking_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
          client_request_id: string;
          completed_at: string | null;
          completed_by: string | null;
          completion_in_progress: boolean;
          consented_at: string | null;
          consented_by: string | null;
          created_at: string;
          created_by: string;
          ends_at: string;
          id: string;
          kind: string;
          last_expiry_reminder_days: number | null;
          noc_artifact_verified_at: string | null;
          noc_prepared_at: string | null;
          noc_prepared_by: string | null;
          noc_prepared_path: string | null;
          noc_prepared_snapshot: Json | null;
          occupancy_id: string;
          owner_consent_occupancy_id: string | null;
          society_id: string;
          starts_at: string;
          status: string;
          tenant_membership_id: string;
          unit_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          agreement_expires_on?: string | null;
          amenity_booking_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          client_request_id: string;
          completed_at?: string | null;
          completed_by?: string | null;
          completion_in_progress?: boolean;
          consented_at?: string | null;
          consented_by?: string | null;
          created_at?: string;
          created_by: string;
          ends_at: string;
          id?: string;
          kind: string;
          last_expiry_reminder_days?: number | null;
          noc_artifact_verified_at?: string | null;
          noc_prepared_at?: string | null;
          noc_prepared_by?: string | null;
          noc_prepared_path?: string | null;
          noc_prepared_snapshot?: Json | null;
          occupancy_id: string;
          owner_consent_occupancy_id?: string | null;
          society_id: string;
          starts_at: string;
          status: string;
          tenant_membership_id: string;
          unit_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          agreement_expires_on?: string | null;
          amenity_booking_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          client_request_id?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          completion_in_progress?: boolean;
          consented_at?: string | null;
          consented_by?: string | null;
          created_at?: string;
          created_by?: string;
          ends_at?: string;
          id?: string;
          kind?: string;
          last_expiry_reminder_days?: number | null;
          noc_artifact_verified_at?: string | null;
          noc_prepared_at?: string | null;
          noc_prepared_by?: string | null;
          noc_prepared_path?: string | null;
          noc_prepared_snapshot?: Json | null;
          occupancy_id?: string;
          owner_consent_occupancy_id?: string | null;
          society_id?: string;
          starts_at?: string;
          status?: string;
          tenant_membership_id?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_moves_amenity_booking_fkey';
            columns: ['society_id', 'amenity_booking_id'];
            isOneToOne: false;
            referencedRelation: 'amenity_bookings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_moves_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_moves_completed_by_fkey';
            columns: ['completed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_moves_consented_by_fkey';
            columns: ['consented_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_moves_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_moves_noc_prepared_by_fkey';
            columns: ['noc_prepared_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_moves_occupancy_fkey';
            columns: ['society_id', 'occupancy_id'];
            isOneToOne: false;
            referencedRelation: 'unit_occupants';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_moves_owner_consent_fkey';
            columns: ['society_id', 'owner_consent_occupancy_id'];
            isOneToOne: false;
            referencedRelation: 'unit_occupants';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_moves_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_moves_tenant_fkey';
            columns: ['society_id', 'tenant_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_moves_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_moves_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
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
      vendor_approvals: {
        Row: {
          approver_id: string;
          approver_role: string;
          created_at: string;
          id: string;
          request_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          approver_id: string;
          approver_role: string;
          created_at?: string;
          id?: string;
          request_id: string;
          society_id: string;
        };
        Update: {
          approver_id?: string;
          approver_role?: string;
          created_at?: string;
          id?: string;
          request_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_approvals_approver_id_fkey';
            columns: ['approver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_approvals_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_purchase_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_approvals_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_documents: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          client_request_id: string;
          content_type: string;
          created_at: string;
          created_by: string;
          id: string;
          path: string;
          size_bytes: number;
          society_id: string;
          title: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id: string;
          content_type: string;
          created_at?: string;
          created_by: string;
          id?: string;
          path: string;
          size_bytes: number;
          society_id: string;
          title: string;
          vendor_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id?: string;
          content_type?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          path?: string;
          size_bytes?: number;
          society_id?: string;
          title?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_documents_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_documents_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_documents_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_documents_vendor_same_society_fkey';
            columns: ['society_id', 'vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      vendor_purchase_requests: {
        Row: {
          approvals_required: number | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          category: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          description: string | null;
          estimated_amount_paise: number;
          expense_draft_status: string | null;
          expense_id: string | null;
          id: string;
          quote_override_at: string | null;
          quote_override_by: string | null;
          quote_override_reason: string | null;
          quotes_required: number | null;
          rejection_reason: string | null;
          selected_quote_id: string | null;
          society_id: string;
          status: string;
          submitted_at: string | null;
          submitted_by: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          approvals_required?: number | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          category?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          decided_at?: string | null;
          decided_by?: string | null;
          description?: string | null;
          estimated_amount_paise: number;
          expense_draft_status?: string | null;
          expense_id?: string | null;
          id?: string;
          quote_override_at?: string | null;
          quote_override_by?: string | null;
          quote_override_reason?: string | null;
          quotes_required?: number | null;
          rejection_reason?: string | null;
          selected_quote_id?: string | null;
          society_id: string;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          approvals_required?: number | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          category?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          description?: string | null;
          estimated_amount_paise?: number;
          expense_draft_status?: string | null;
          expense_id?: string | null;
          id?: string;
          quote_override_at?: string | null;
          quote_override_by?: string | null;
          quote_override_reason?: string | null;
          quotes_required?: number | null;
          rejection_reason?: string | null;
          selected_quote_id?: string | null;
          society_id?: string;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_purchase_requests_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_expense_same_society_fkey';
            columns: ['society_id', 'expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_quote_override_by_fkey';
            columns: ['quote_override_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_selected_quote_fkey';
            columns: ['society_id', 'id', 'selected_quote_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_quotes';
            referencedColumns: ['society_id', 'request_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_submitted_by_fkey';
            columns: ['submitted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_purchase_requests_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_quotes: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          file_content_type: string | null;
          file_path: string | null;
          file_size_bytes: number | null;
          id: string;
          note: string | null;
          removed_at: string | null;
          removed_by: string | null;
          request_id: string;
          society_id: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          file_content_type?: string | null;
          file_path?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          note?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          request_id: string;
          society_id: string;
          vendor_id: string;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          file_content_type?: string | null;
          file_path?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          note?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          request_id?: string;
          society_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_quotes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_quotes_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_quotes_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_purchase_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_quotes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_quotes_vendor_same_society_fkey';
            columns: ['society_id', 'vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      vendor_ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          rater_id: string;
          society_id: string;
          stars: number;
          updated_at: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rater_id: string;
          society_id: string;
          stars: number;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rater_id?: string;
          society_id?: string;
          stars?: number;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_ratings_rater_id_fkey';
            columns: ['rater_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_ratings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_ratings_vendor_same_society_fkey';
            columns: ['society_id', 'vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      vendors: {
        Row: {
          active: boolean;
          category: string;
          client_request_id: string;
          contact_person: string | null;
          created_at: string;
          created_by: string;
          email: string | null;
          gstin: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          category: string;
          client_request_id: string;
          contact_person?: string | null;
          created_at?: string;
          created_by: string;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          category?: string;
          client_request_id?: string;
          contact_person?: string | null;
          created_at?: string;
          created_by?: string;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendors_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendors_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendors_updated_by_fkey';
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
      amc_contract_save: {
        Args: {
          p_asset_label: string;
          p_client_request_id: string;
          p_contract_id: string;
          p_cost_paise: number;
          p_document_path: string;
          p_end_date: string;
          p_expected_updated_at: string;
          p_payment_terms: string;
          p_predecessor_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_start_date: string;
          p_vendor_contact: string;
          p_vendor_name: string;
          p_visit_frequency: string;
        };
        Returns: string;
      };
      amc_reminders_run: {
        Args: { p_request_trace: string; p_society_id: string };
        Returns: number;
      };
      amc_request_label: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: string;
      };
      amc_request_link: {
        Args: {
          p_contract_id: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      amc_visit_save: {
        Args: {
          p_client_request_id: string;
          p_contract_id: string;
          p_document_path: string;
          p_expected_updated_at: string;
          p_request_trace: string;
          p_society_id: string;
          p_summary: string;
          p_technician: string;
          p_visit_date: string;
          p_visit_id: string;
        };
        Returns: string;
      };
      amc_workspace: { Args: { p_society_id: string }; Returns: Json };
      amenity_book: {
        Args: {
          p_amenity_id: string;
          p_client_request_id: string;
          p_date: string;
          p_expected_updated_at: string;
          p_guest_count: number;
          p_request_trace: string;
          p_rules_accepted: boolean;
          p_slot_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      amenity_cancel: {
        Args: {
          p_booking_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      amenity_save: {
        Args: {
          p_active: boolean;
          p_amenity_id: string;
          p_capacity: number;
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_fee_paise: number;
          p_name: string;
          p_request_trace: string;
          p_rules: string;
          p_slots: Json;
          p_society_id: string;
        };
        Returns: string;
      };
      amenity_workspace: {
        Args: { p_date: string; p_society_id: string };
        Returns: Json;
      };
      approve_society_registration: {
        Args: {
          p_membership_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      asset_category_save: {
        Args: {
          p_category_id: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      asset_category_set_active: {
        Args: {
          p_active: boolean;
          p_category_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      asset_form_options_get: { Args: { p_society_id: string }; Returns: Json };
      asset_get: {
        Args: { p_asset_id: string; p_society_id: string };
        Returns: Json;
      };
      asset_maintenance_add: {
        Args: {
          p_asset_id: string;
          p_client_request_id: string;
          p_cost_paise: number;
          p_description: string;
          p_done_by: string;
          p_performed_on: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      asset_maintenance_remove: {
        Args: {
          p_entry_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      asset_save: {
        Args: {
          p_amc_contract_id: string;
          p_asset_id: string;
          p_category_id: string;
          p_client_request_id: string;
          p_expected_amc_enabled: boolean;
          p_expected_version: number;
          p_location: string;
          p_make: string;
          p_model: string;
          p_name: string;
          p_notes: string;
          p_purchase_cost_paise: number;
          p_purchase_date: string;
          p_request_id: string;
          p_serial_number: string;
          p_society_id: string;
          p_status: string;
          p_supplier: string;
          p_warranty_end_date: string;
        };
        Returns: string;
      };
      asset_workspace_get: { Args: { p_society_id: string }; Returns: Json };
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
      directory_emergency_contact_deactivate: {
        Args: { p_contact_id: string; p_society_id: string };
        Returns: undefined;
      };
      directory_emergency_contact_save: {
        Args: {
          p_client_request_id: string;
          p_contact_id: string;
          p_full_name: string;
          p_membership_id: string;
          p_phone: string;
          p_relationship: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      directory_emergency_contacts_list: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      directory_guard_vehicle_lookup: {
        Args: { p_registration_number: string; p_society_id: string };
        Returns: {
          unit_number: string;
          vehicle_type: string;
        }[];
      };
      directory_my_households: {
        Args: { p_society_id: string };
        Returns: {
          membership_id: string;
          unit_id: string;
          unit_number: string;
        }[];
      };
      directory_my_preferences: {
        Args: { p_society_id: string };
        Returns: {
          name_visible: boolean;
          phone_visible: boolean;
          unit_visible: boolean;
        }[];
      };
      directory_resident_list: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_search?: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      directory_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      directory_set_visibility: {
        Args: {
          p_name_visible: boolean;
          p_phone_visible: boolean;
          p_society_id: string;
          p_unit_visible: boolean;
        };
        Returns: undefined;
      };
      directory_vehicle_deactivate: {
        Args: { p_society_id: string; p_vehicle_id: string };
        Returns: undefined;
      };
      directory_vehicle_list: {
        Args: { p_limit?: number; p_offset?: number; p_society_id: string };
        Returns: Json;
      };
      directory_vehicle_save: {
        Args: {
          p_client_request_id: string;
          p_membership_id: string;
          p_registration_number: string;
          p_society_id: string;
          p_tag_number: string;
          p_unit_id: string;
          p_vehicle_id: string;
          p_vehicle_type: string;
        };
        Returns: string;
      };
      directory_vehicle_verify: {
        Args: {
          p_is_verified: boolean;
          p_society_id: string;
          p_vehicle_id: string;
        };
        Returns: undefined;
      };
      disable_society_join_code: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: undefined;
      };
      document_create: {
        Args: {
          p_client_request_id: string;
          p_description: string;
          p_file_name: string;
          p_folder_id: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
          p_title: string;
          p_unit_audience: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      document_download_issue: {
        Args: {
          p_request_id: string;
          p_society_id: string;
          p_version_id: string;
        };
        Returns: Json;
      };
      document_folder_save: {
        Args: {
          p_audience: string;
          p_expected_version: number;
          p_folder_id: string;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_folder_set_archived: {
        Args: {
          p_archived: boolean;
          p_expected_version: number;
          p_folder_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_get: {
        Args: { p_document_id: string; p_society_id: string };
        Returns: Json;
      };
      document_list: {
        Args: {
          p_folder_id: string;
          p_include_archived: boolean;
          p_limit?: number;
          p_offset?: number;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      document_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      document_set_archived: {
        Args: {
          p_archived: boolean;
          p_document_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_update: {
        Args: {
          p_description: string;
          p_document_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
          p_title: string;
          p_unit_audience: string;
        };
        Returns: Json;
      };
      document_version_add: {
        Args: {
          p_document_id: string;
          p_expected_version: number;
          p_file_name: string;
          p_note: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_version_set_archived: {
        Args: {
          p_archived: boolean;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
          p_version_id: string;
        };
        Returns: Json;
      };
      document_workspace_get: { Args: { p_society_id: string }; Returns: Json };
      end_unit_occupancy: {
        Args: {
          p_ended_at: string;
          p_occupant_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      expense_account_save: {
        Args: {
          p_account_id: string;
          p_account_type: string;
          p_active: boolean;
          p_expected_updated_at: string;
          p_name: string;
          p_opening_balance_paise: number;
          p_opening_on: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_category_save: {
        Args: {
          p_active: boolean;
          p_category_id: string;
          p_expected_updated_at: string;
          p_name: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_decide: {
        Args: {
          p_approve: boolean;
          p_expense_id: string;
          p_note: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      expense_entries_page: {
        Args: {
          p_account_id: string;
          p_from: string;
          p_limit: number;
          p_offset: number;
          p_society_id: string;
          p_to: string;
        };
        Returns: Json;
      };
      expense_entry_reverse: {
        Args: {
          p_client_request_id: string;
          p_entry_id: string;
          p_reason: string;
          p_request_trace: string;
          p_reverse_on: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_expenses_page: {
        Args: {
          p_limit: number;
          p_offset: number;
          p_society_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      expense_income_record: {
        Args: {
          p_account_id: string;
          p_amount_paise: number;
          p_client_request_id: string;
          p_description: string;
          p_income_kind: string;
          p_payer: string;
          p_received_on: string;
          p_reference: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_month_close: {
        Args: {
          p_month: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      expense_month_reopen: {
        Args: {
          p_month: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      expense_record: {
        Args: {
          p_account_id: string;
          p_amount_paise: number;
          p_category_id: string;
          p_client_request_id: string;
          p_description: string;
          p_payee: string;
          p_payment_mode: string;
          p_receipt_path: string;
          p_reference: string;
          p_request_trace: string;
          p_society_id: string;
          p_spent_on: string;
        };
        Returns: Json;
      };
      expense_report: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      expense_settings_update: {
        Args: {
          p_approval_threshold_paise: number;
          p_billing_income_account_id: string;
          p_expected_updated_at: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      expense_workspace: { Args: { p_society_id: string }; Returns: Json };
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
      home_services_admin_workspace: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      home_services_comment_visibility_set: {
        Args: {
          p_hidden: boolean;
          p_rating_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      home_services_directory: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      home_services_provider_archive: {
        Args: {
          p_expected_version: number;
          p_provider_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      home_services_provider_detail: {
        Args: { p_provider_id: string; p_society_id: string };
        Returns: Json;
      };
      home_services_provider_save: {
        Args: {
          p_area: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_name: string;
          p_notes: string;
          p_phone: string;
          p_provider_id: string;
          p_request_id: string;
          p_service_type: string;
          p_society_id: string;
        };
        Returns: string;
      };
      home_services_provider_suggest: {
        Args: {
          p_area: string;
          p_client_request_id: string;
          p_name: string;
          p_notes: string;
          p_phone: string;
          p_request_id: string;
          p_service_type: string;
          p_society_id: string;
        };
        Returns: string;
      };
      home_services_rating_save: {
        Args: {
          p_comment: string;
          p_provider_id: string;
          p_request_id: string;
          p_society_id: string;
          p_stars: number;
        };
        Returns: string;
      };
      home_services_suggestion_review: {
        Args: {
          p_approve: boolean;
          p_expected_version: number;
          p_provider_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
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
      metering_admin_workspace: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      metering_billing_run: {
        Args: {
          p_bill_date: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      metering_guard_board: {
        Args: { p_query: string; p_society_id: string };
        Returns: Json;
      };
      metering_meter_save: {
        Args: {
          p_active: boolean;
          p_client_request_id: string;
          p_expected_version: number;
          p_initial_reading: number;
          p_label: string;
          p_meter_id: string;
          p_meter_type: string;
          p_request_id: string;
          p_scope: string;
          p_serial_number: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      metering_photo_access: {
        Args: { p_path: string; p_society_id: string };
        Returns: boolean;
      };
      metering_photo_upload_path: {
        Args: {
          p_content_type: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      metering_rate_set: {
        Args: {
          p_client_request_id: string;
          p_meter_type: string;
          p_rate_paise: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      metering_reading_record: {
        Args: {
          p_client_request_id: string;
          p_lower_reason: string;
          p_meter_id: string;
          p_photo_path: string;
          p_reading_date: string;
          p_reading_value: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      metering_reading_review: {
        Args: {
          p_decision: string;
          p_reading_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      metering_reading_submit: {
        Args: {
          p_client_request_id: string;
          p_lower_reason: string;
          p_meter_id: string;
          p_photo_path: string;
          p_reading_date: string;
          p_reading_value: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      metering_resident_workspace: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      metering_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
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
      parking_admin_workspace: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      parking_allocate: {
        Args: {
          p_request_id: string;
          p_skip_reason: string;
          p_slot_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      parking_allocation_end: {
        Args: {
          p_allocation_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      parking_guard_board: {
        Args: { p_query: string; p_society_id: string };
        Returns: Json;
      };
      parking_pass_cancel: {
        Args: { p_pass_id: string; p_request_id: string; p_society_id: string };
        Returns: undefined;
      };
      parking_pass_create: {
        Args: {
          p_client_request_id: string;
          p_ends_at: string;
          p_request_id: string;
          p_slot_id: string;
          p_society_id: string;
          p_starts_at: string;
          p_unit_id: string;
          p_vehicle_number: string;
          p_visitor_entry_id: string;
          p_visitor_name: string;
        };
        Returns: string;
      };
      parking_photo_access: {
        Args: { p_path: string; p_society_id: string };
        Returns: boolean;
      };
      parking_photo_upload_path: {
        Args: {
          p_content_type: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      parking_report_create: {
        Args: {
          p_client_request_id: string;
          p_note: string;
          p_photo_path: string;
          p_request_id: string;
          p_slot_id: string;
          p_society_id: string;
          p_vehicle_number: string;
        };
        Returns: string;
      };
      parking_report_resolve: {
        Args: {
          p_report_id: string;
          p_request_id: string;
          p_resolution_note: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      parking_request_cancel: {
        Args: {
          p_request_id: string;
          p_society_id: string;
          p_waitlist_request_id: string;
        };
        Returns: undefined;
      };
      parking_request_create: {
        Args: {
          p_client_request_id: string;
          p_note: string;
          p_request_id: string;
          p_slot_type: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      parking_resident_workspace: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      parking_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      parking_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      parking_settings_update: {
        Args: {
          p_photo_retention_days: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      parking_slot_archive: {
        Args: {
          p_expected_version: number;
          p_request_id: string;
          p_slot_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      parking_slot_save: {
        Args: {
          p_client_request_id: string;
          p_expected_version: number;
          p_label: string;
          p_location_note: string;
          p_request_id: string;
          p_slot_id: string;
          p_slot_type: string;
          p_society_id: string;
        };
        Returns: string;
      };
      parking_vehicle_link_set: {
        Args: {
          p_allocation_id: string;
          p_linked: boolean;
          p_request_id: string;
          p_society_id: string;
          p_vehicle_id: string;
        };
        Returns: undefined;
      };
      patrol_admin_workspace: { Args: { p_society_id: string }; Returns: Json };
      patrol_checkpoint_save: {
        Args: {
          p_checkpoint_id: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_location_note: string;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      patrol_checkpoint_set_active: {
        Args: {
          p_active: boolean;
          p_checkpoint_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      patrol_guard_workspace: { Args: { p_society_id: string }; Returns: Json };
      patrol_handover_acknowledge: {
        Args: { p_note_id: string; p_request_id: string; p_society_id: string };
        Returns: undefined;
      };
      patrol_handover_create: {
        Args: {
          p_body: string;
          p_client_request_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      patrol_incident_close: {
        Args: {
          p_incident_id: string;
          p_request_id: string;
          p_resolution: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      patrol_incident_create: {
        Args: {
          p_category: string;
          p_client_request_id: string;
          p_description: string;
          p_location: string;
          p_photo_paths: string[];
          p_request_id: string;
          p_severity: string;
          p_society_id: string;
        };
        Returns: string;
      };
      patrol_incident_note_add: {
        Args: {
          p_body: string;
          p_incident_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      patrol_photo_access: {
        Args: { p_path: string; p_society_id: string };
        Returns: boolean;
      };
      patrol_photo_upload_path: {
        Args: {
          p_content_type: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      patrol_print_sheet: { Args: { p_society_id: string }; Returns: Json };
      patrol_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      patrol_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      patrol_scan: {
        Args: {
          p_client_request_id: string;
          p_code: string;
          p_method: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      patrol_schedule_save: {
        Args: {
          p_checkpoint_ids: string[];
          p_client_request_id: string;
          p_expected_version: number;
          p_grace_minutes: number;
          p_interval_minutes: number;
          p_name: string;
          p_request_id: string;
          p_schedule_id: string;
          p_shift_end: string;
          p_shift_start: string;
          p_society_id: string;
        };
        Returns: string;
      };
      patrol_schedule_set_active: {
        Args: {
          p_active: boolean;
          p_expected_version: number;
          p_request_id: string;
          p_schedule_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      patrol_settings_update: {
        Args: {
          p_photo_retention_days: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
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
          committee_escalation_days: number;
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
          p_committee_escalation_days?: number;
          p_expected_updated_at: string;
          p_name: string;
          p_request_id: string;
          p_sla_hours: number;
          p_society_id: string;
          p_sort_order: number;
        };
        Returns: {
          active: boolean;
          committee_escalation_days: number;
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
      request_escalation_run: {
        Args: {
          p_request_trace: string;
          p_society_id: string;
          p_today: string;
        };
        Returns: Json;
      };
      request_escalation_settings_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      request_escalation_settings_save: {
        Args: {
          p_delivery: string;
          p_expected_updated_at: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
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
      sos_acknowledge: {
        Args: {
          p_alert_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      sos_add_update: {
        Args: {
          p_alert_id: string;
          p_note: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      sos_alert_dismiss: {
        Args: { p_alert_id: string; p_request_id: string };
        Returns: undefined;
      };
      sos_cancel: {
        Args: {
          p_alert_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      sos_close: {
        Args: {
          p_alert_id: string;
          p_note: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      sos_contact_save: {
        Args: {
          p_contact_id: string;
          p_label: string;
          p_phone: string;
          p_request_id: string;
          p_society_id: string;
          p_sort_order: number;
        };
        Returns: string;
      };
      sos_contact_set_archived: {
        Args: {
          p_archived: boolean;
          p_contact_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      sos_my_alerts: { Args: Record<PropertyKey, never>; Returns: Json };
      sos_raise: {
        Args: {
          p_category: string;
          p_client_request_id: string;
          p_note: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      sos_settings_update: {
        Args: {
          p_notify_admins: boolean;
          p_notify_committee: boolean;
          p_notify_guards: boolean;
          p_request_id: string;
          p_resident_scope: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      sos_workspace: {
        Args: { p_limit?: number; p_offset?: number; p_society_id: string };
        Returns: Json;
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
      tenancy_document_attach: {
        Args: {
          p_expected_version: number;
          p_kind: string;
          p_move_id: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_move_complete: {
        Args: {
          p_expected_version: number;
          p_move_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_move_consent: {
        Args: {
          p_expected_version: number;
          p_move_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_move_create: {
        Args: {
          p_agreement_expires_on: string;
          p_amenity_booking_id: string;
          p_client_request_id: string;
          p_ends_at: string;
          p_kind: string;
          p_request_id: string;
          p_society_id: string;
          p_starts_at: string;
          p_tenant_membership_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      tenancy_move_decide: {
        Args: {
          p_decision: string;
          p_expected_version: number;
          p_move_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_move_get: {
        Args: { p_move_id: string; p_society_id: string };
        Returns: Json;
      };
      tenancy_moves_page: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_society_id: string;
          p_status?: string;
        };
        Returns: Json;
      };
      tenancy_noc_attest: {
        Args: {
          p_expected_version: number;
          p_issuer_id: string;
          p_move_id: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_noc_issue: {
        Args: {
          p_expected_version: number;
          p_move_id: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_noc_prepare: {
        Args: {
          p_expected_version: number;
          p_move_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      tenancy_proof_upload_path: {
        Args: {
          p_content_type: string;
          p_kind: string;
          p_move_id: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_reminders_run: {
        Args: { p_request_trace: string; p_society_id: string };
        Returns: number;
      };
      tenancy_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      tenancy_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      tenancy_settings_update: {
        Args: {
          p_police_verification_required: boolean;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_workspace_get: {
        Args: { p_include_targets?: boolean; p_society_id: string };
        Returns: Json;
      };
      user_erasure_complete: {
        Args: { p_actor_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      user_erasure_prepare: {
        Args: { p_actor_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      vendor_document_add: {
        Args: {
          p_client_request_id: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
          p_title: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      vendor_document_archive: {
        Args: {
          p_document_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_expense_draft_retry: {
        Args: {
          p_purchase_request_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      vendor_file_issue: {
        Args: { p_path: string; p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      vendor_get: {
        Args: { p_society_id: string; p_vendor_id: string };
        Returns: Json;
      };
      vendor_quote_add: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_file_path: string;
          p_note: string;
          p_purchase_request_id: string;
          p_request_id: string;
          p_society_id: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      vendor_quote_override: {
        Args: {
          p_expected_version: number;
          p_purchase_request_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_quote_remove: {
        Args: {
          p_quote_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_quote_select: {
        Args: {
          p_expected_version: number;
          p_purchase_request_id: string;
          p_quote_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_rating_save: {
        Args: {
          p_comment: string;
          p_request_id: string;
          p_society_id: string;
          p_stars: number;
          p_vendor_id: string;
        };
        Returns: undefined;
      };
      vendor_request_approve: {
        Args: {
          p_purchase_request_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      vendor_request_cancel: {
        Args: {
          p_purchase_request_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_request_get: {
        Args: { p_purchase_request_id: string; p_society_id: string };
        Returns: Json;
      };
      vendor_request_reject: {
        Args: {
          p_purchase_request_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_request_save: {
        Args: {
          p_category: string;
          p_client_request_id: string;
          p_description: string;
          p_estimated_amount_paise: number;
          p_expected_version: number;
          p_purchase_request_id: string;
          p_request_id: string;
          p_society_id: string;
          p_title: string;
        };
        Returns: string;
      };
      vendor_request_submit: {
        Args: {
          p_expected_version: number;
          p_purchase_request_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      vendor_save: {
        Args: {
          p_category: string;
          p_client_request_id: string;
          p_contact_person: string;
          p_email: string;
          p_expected_version: number;
          p_gstin: string;
          p_name: string;
          p_notes: string;
          p_phone: string;
          p_request_id: string;
          p_society_id: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      vendor_set_active: {
        Args: {
          p_active: boolean;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
          p_vendor_id: string;
        };
        Returns: undefined;
      };
      vendor_settings_update: {
        Args: {
          p_approvals_required: number;
          p_quote_threshold_paise: number;
          p_quotes_above_threshold: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_workspace_get: { Args: { p_society_id: string }; Returns: Json };
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
