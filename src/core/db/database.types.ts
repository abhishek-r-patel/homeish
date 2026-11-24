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
          amc_type: string | null;
          asset_category_id: string | null;
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
          services_per_year: number | null;
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
          amc_type?: string | null;
          asset_category_id?: string | null;
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
          services_per_year?: number | null;
          society_id: string;
          start_date: string;
          updated_at?: string;
          updated_by: string;
          vendor_contact: string;
          vendor_name: string;
          visit_frequency: string;
        };
        Update: {
          amc_type?: string | null;
          asset_category_id?: string | null;
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
          services_per_year?: number | null;
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
            foreignKeyName: 'amc_contracts_asset_category_same_society_fkey';
            columns: ['society_id', 'asset_category_id'];
            isOneToOne: false;
            referencedRelation: 'asset_categories';
            referencedColumns: ['society_id', 'id'];
          },
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
          deposit_paise: number | null;
          deposit_required_before_confirmation: boolean;
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
          deposit_paise?: number | null;
          deposit_required_before_confirmation?: boolean;
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
          deposit_paise?: number | null;
          deposit_required_before_confirmation?: boolean;
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
      amenity_activity_records: {
        Row: {
          activity_kind: string;
          amc_visit_id: string | null;
          amenity_booking_id: string | null;
          asset_id: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          event_at: string;
          id: string;
          note: string | null;
          service_request_id: string | null;
          society_id: string;
          source_kind: string;
        };
        ComputedFields: never;
        Insert: {
          activity_kind: string;
          amc_visit_id?: string | null;
          amenity_booking_id?: string | null;
          asset_id?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          event_at: string;
          id?: string;
          note?: string | null;
          service_request_id?: string | null;
          society_id: string;
          source_kind: string;
        };
        Update: {
          activity_kind?: string;
          amc_visit_id?: string | null;
          amenity_booking_id?: string | null;
          asset_id?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          event_at?: string;
          id?: string;
          note?: string | null;
          service_request_id?: string | null;
          society_id?: string;
          source_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'amenity_activity_amc_visit_fkey';
            columns: ['society_id', 'amc_visit_id'];
            isOneToOne: false;
            referencedRelation: 'amc_visits';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_activity_asset_fkey';
            columns: ['society_id', 'asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_activity_booking_fkey';
            columns: ['society_id', 'amenity_booking_id'];
            isOneToOne: false;
            referencedRelation: 'amenity_bookings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_activity_records_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenity_activity_records_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenity_activity_service_request_fkey';
            columns: ['society_id', 'service_request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      amenity_booking_deposit_events: {
        Row: {
          account_id: string | null;
          amount_paise: number | null;
          book_entry_id: string | null;
          booking_id: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          event_date: string | null;
          evidence_path: string | null;
          id: string;
          kind: string;
          reason: string | null;
          reference: string | null;
          society_id: string;
          voids_event_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          amount_paise?: number | null;
          book_entry_id?: string | null;
          booking_id: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          event_date?: string | null;
          evidence_path?: string | null;
          id?: string;
          kind: string;
          reason?: string | null;
          reference?: string | null;
          society_id: string;
          voids_event_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          amount_paise?: number | null;
          book_entry_id?: string | null;
          booking_id?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          event_date?: string | null;
          evidence_path?: string | null;
          id?: string;
          kind?: string;
          reason?: string | null;
          reference?: string | null;
          society_id?: string;
          voids_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'amenity_booking_deposit_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenity_booking_deposit_events_society_id_account_id_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_booking_deposit_events_society_id_book_entry_id_fkey';
            columns: ['society_id', 'book_entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_booking_deposit_events_society_id_booking_id_fkey';
            columns: ['society_id', 'booking_id'];
            isOneToOne: false;
            referencedRelation: 'amenity_booking_deposits';
            referencedColumns: ['society_id', 'booking_id'];
          },
          {
            foreignKeyName: 'amenity_booking_deposit_events_society_id_voids_event_id_fkey';
            columns: ['society_id', 'voids_event_id'];
            isOneToOne: false;
            referencedRelation: 'amenity_booking_deposit_events';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      amenity_booking_deposits: {
        Row: {
          booking_id: string;
          created_at: string;
          created_by: string;
          current_amount_paise: number;
          original_amount_paise: number;
          required_before_confirmation: boolean;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          created_at?: string;
          created_by: string;
          current_amount_paise: number;
          original_amount_paise: number;
          required_before_confirmation: boolean;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          created_by?: string;
          current_amount_paise?: number;
          original_amount_paise?: number;
          required_before_confirmation?: boolean;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'amenity_booking_deposits_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'amenity_booking_deposits_society_id_booking_id_fkey';
            columns: ['society_id', 'booking_id'];
            isOneToOne: false;
            referencedRelation: 'amenity_bookings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'amenity_booking_deposits_updated_by_fkey';
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
      analytics_preferences: {
        Row: {
          metric_keys: string[];
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          metric_keys: string[];
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          metric_keys?: string[];
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_preferences_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'analytics_preferences_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
          base_charge_type_id: string | null;
          created_at: string;
          created_by: string;
          eligibility: string;
          id: string;
          method: string;
          name: string;
          percent_basis_points: number | null;
          society_id: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          amount_paise?: number | null;
          base_charge_type_id?: string | null;
          created_at?: string;
          created_by: string;
          eligibility?: string;
          id?: string;
          method: string;
          name: string;
          percent_basis_points?: number | null;
          society_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          active?: boolean;
          amount_paise?: number | null;
          base_charge_type_id?: string | null;
          created_at?: string;
          created_by?: string;
          eligibility?: string;
          id?: string;
          method?: string;
          name?: string;
          percent_basis_points?: number | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_charge_types_base_same_society_fkey';
            columns: ['society_id', 'base_charge_type_id'];
            isOneToOne: false;
            referencedRelation: 'billing_charge_types';
            referencedColumns: ['society_id', 'id'];
          },
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
      billing_interest_acknowledgements: {
        Row: {
          acknowledged_at: string;
          acknowledged_by: string;
          society_id: string;
          statement: string;
          statement_version: number;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string;
          acknowledged_by: string;
          society_id: string;
          statement: string;
          statement_version?: number;
        };
        Update: {
          acknowledged_at?: string;
          acknowledged_by?: string;
          society_id?: string;
          statement?: string;
          statement_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_interest_acknowledgements_acknowledged_by_fkey';
            columns: ['acknowledged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_interest_acknowledgements_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_interest_rates: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          effective_on: string;
          id: string;
          mode: string;
          rate_basis_points: number | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          effective_on: string;
          id?: string;
          mode: string;
          rate_basis_points?: number | null;
          society_id: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          effective_on?: string;
          id?: string;
          mode?: string;
          rate_basis_points?: number | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_interest_rates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_interest_rates_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
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
      billing_payment_plan_bills: {
        Row: {
          bill_id: string;
          created_at: string;
          plan_id: string;
          released_at: string | null;
          snapshot_remaining_paise: number;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          bill_id: string;
          created_at?: string;
          plan_id: string;
          released_at?: string | null;
          snapshot_remaining_paise: number;
          society_id: string;
          unit_id: string;
        };
        Update: {
          bill_id?: string;
          created_at?: string;
          plan_id?: string;
          released_at?: string | null;
          snapshot_remaining_paise?: number;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_payment_plan_bills_bill_same_unit_fkey';
            columns: ['society_id', 'bill_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'billing_bills';
            referencedColumns: ['society_id', 'id', 'unit_id'];
          },
          {
            foreignKeyName: 'billing_payment_plan_bills_plan_same_unit_fkey';
            columns: ['society_id', 'plan_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'billing_payment_plans';
            referencedColumns: ['society_id', 'id', 'unit_id'];
          },
        ];
      };
      billing_payment_plans: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          created_by: string;
          down_payment_paise: number;
          first_due_date: string;
          id: string;
          installment_count: number;
          plan_date: string;
          remarks: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by: string;
          down_payment_paise: number;
          first_due_date: string;
          id?: string;
          installment_count: number;
          plan_date: string;
          remarks?: string | null;
          society_id: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string;
          down_payment_paise?: number;
          first_due_date?: string;
          id?: string;
          installment_count?: number;
          plan_date?: string;
          remarks?: string | null;
          society_id?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_payment_plans_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payment_plans_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payment_plans_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_payment_plans_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'billing_payment_plans_updated_by_fkey';
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
      billing_recovery_actions: {
        Row: {
          action_date: string;
          action_type: string;
          assigned_admin_user_id: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          next_action_date: string;
          outcome: string;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          action_date: string;
          action_type: string;
          assigned_admin_user_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          next_action_date: string;
          outcome: string;
          society_id: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          action_date?: string;
          action_type?: string;
          assigned_admin_user_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          next_action_date?: string;
          outcome?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_recovery_actions_assignee_membership_fkey';
            columns: ['society_id', 'assigned_admin_user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'user_id'];
          },
          {
            foreignKeyName: 'billing_recovery_actions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_recovery_actions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_recovery_actions_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'billing_recovery_actions_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
      building_floors: {
        Row: {
          block_id: string;
          id: string;
          label: string | null;
          level: number;
          society_id: string;
          whole: boolean;
        };
        ComputedFields: never;
        Insert: {
          block_id: string;
          id?: string;
          label?: string | null;
          level: number;
          society_id: string;
          whole?: boolean;
        };
        Update: {
          block_id?: string;
          id?: string;
          label?: string | null;
          level?: number;
          society_id?: string;
          whole?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'building_floors_society_id_block_id_fkey';
            columns: ['society_id', 'block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      building_spaces: {
        Row: {
          duplex: boolean;
          floor_id: string;
          id: string;
          kind: string;
          name: string | null;
          position: number;
          society_id: string;
          unit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          duplex?: boolean;
          floor_id: string;
          id?: string;
          kind: string;
          name?: string | null;
          position: number;
          society_id: string;
          unit_id?: string | null;
        };
        Update: {
          duplex?: boolean;
          floor_id?: string;
          id?: string;
          kind?: string;
          name?: string | null;
          position?: number;
          society_id?: string;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'building_spaces_society_id_floor_id_fkey';
            columns: ['society_id', 'floor_id'];
            isOneToOne: false;
            referencedRelation: 'building_floors';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'building_spaces_society_id_unit_id_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: true;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      committee_action_plan_tasks: {
        Row: {
          category: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          end_day: number;
          evidence_url: string | null;
          id: string;
          meeting_action_item_id: string | null;
          notes: string | null;
          owner_membership_id: string | null;
          plan_id: string;
          priority: string;
          progress: number;
          society_id: string;
          start_day: number;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          end_day: number;
          evidence_url?: string | null;
          id?: string;
          meeting_action_item_id?: string | null;
          notes?: string | null;
          owner_membership_id?: string | null;
          plan_id: string;
          priority: string;
          progress?: number;
          society_id: string;
          start_day: number;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          category?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          end_day?: number;
          evidence_url?: string | null;
          id?: string;
          meeting_action_item_id?: string | null;
          notes?: string | null;
          owner_membership_id?: string | null;
          plan_id?: string;
          priority?: string;
          progress?: number;
          society_id?: string;
          start_day?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'committee_action_plan_tasks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'committee_action_plan_tasks_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'committee_action_plan_tasks_meeting_action_same_society_fkey';
            columns: ['society_id', 'meeting_action_item_id'];
            isOneToOne: true;
            referencedRelation: 'meeting_action_items';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'committee_action_plan_tasks_owner_same_society_fkey';
            columns: ['society_id', 'owner_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'committee_action_plan_tasks_plan_same_society_fkey';
            columns: ['society_id', 'plan_id'];
            isOneToOne: false;
            referencedRelation: 'committee_action_plans';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'committee_action_plan_tasks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'committee_action_plan_tasks_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      committee_action_plans: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          notes: string | null;
          society_id: string;
          start_on: string;
          updated_at: string;
          updated_by: string;
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
          name: string;
          notes?: string | null;
          society_id: string;
          start_on: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          society_id?: string;
          start_on?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'committee_action_plans_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'committee_action_plans_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'committee_action_plans_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'committee_action_plans_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      community_group_members: {
        Row: {
          group_id: string;
          joined_at: string;
          membership_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          joined_at?: string;
          membership_id: string;
          society_id: string;
        };
        Update: {
          group_id?: string;
          joined_at?: string;
          membership_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_group_members_group_fkey';
            columns: ['society_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'community_groups';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_group_members_membership_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_group_members_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      community_groups: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          society_id: string;
          status: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
          society_id: string;
          status?: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          society_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'community_groups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_groups_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_groups_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      community_listings: {
        Row: {
          approved_at: string | null;
          author_membership_id: string;
          author_name: string;
          author_unit_label: string | null;
          author_user_id: string;
          client_request_id: string;
          closed_at: string | null;
          contact_phone: string | null;
          created_at: string;
          description: string | null;
          expires_at: string | null;
          id: string;
          listing_type: string;
          moderated_at: string | null;
          moderated_by: string | null;
          moderation_reason: string | null;
          price_paise: number | null;
          society_id: string;
          status: string;
          status_changed_at: string;
          title: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          author_membership_id: string;
          author_name: string;
          author_unit_label?: string | null;
          author_user_id: string;
          client_request_id: string;
          closed_at?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          listing_type: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          price_paise?: number | null;
          society_id: string;
          status?: string;
          status_changed_at?: string;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          approved_at?: string | null;
          author_membership_id?: string;
          author_name?: string;
          author_unit_label?: string | null;
          author_user_id?: string;
          client_request_id?: string;
          closed_at?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          listing_type?: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          price_paise?: number | null;
          society_id?: string;
          status?: string;
          status_changed_at?: string;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'community_listings_author_membership_fkey';
            columns: ['society_id', 'author_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_listings_author_user_id_fkey';
            columns: ['author_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_listings_moderated_by_fkey';
            columns: ['moderated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_listings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      community_mutes: {
        Row: {
          created_at: string;
          created_by: string;
          duration: string;
          id: string;
          lifted_at: string | null;
          lifted_by: string | null;
          membership_id: string;
          muted_until: string | null;
          reason: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          duration: string;
          id?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          membership_id: string;
          muted_until?: string | null;
          reason: string;
          society_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          duration?: string;
          id?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          membership_id?: string;
          muted_until?: string | null;
          reason?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_mutes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_mutes_lifted_by_fkey';
            columns: ['lifted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_mutes_membership_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_mutes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      community_photos: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          listing_id: string | null;
          position: number;
          post_id: string | null;
          society_id: string;
          storage_path: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          listing_id?: string | null;
          position: number;
          post_id?: string | null;
          society_id: string;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          listing_id?: string | null;
          position?: number;
          post_id?: string | null;
          society_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_photos_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_photos_listing_fkey';
            columns: ['society_id', 'listing_id'];
            isOneToOne: false;
            referencedRelation: 'community_listings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_photos_post_fkey';
            columns: ['society_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'community_posts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_photos_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      community_posts: {
        Row: {
          author_membership_id: string;
          author_name: string;
          author_unit_label: string | null;
          author_user_id: string;
          body: string;
          client_request_id: string;
          created_at: string;
          group_id: string;
          id: string;
          moderated_at: string | null;
          moderated_by: string | null;
          moderation_reason: string | null;
          society_id: string;
          status: string;
          status_changed_at: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          author_membership_id: string;
          author_name: string;
          author_unit_label?: string | null;
          author_user_id: string;
          body: string;
          client_request_id: string;
          created_at?: string;
          group_id: string;
          id?: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          society_id: string;
          status?: string;
          status_changed_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          author_membership_id?: string;
          author_name?: string;
          author_unit_label?: string | null;
          author_user_id?: string;
          body?: string;
          client_request_id?: string;
          created_at?: string;
          group_id?: string;
          id?: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          society_id?: string;
          status?: string;
          status_changed_at?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'community_posts_author_membership_fkey';
            columns: ['society_id', 'author_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_posts_author_user_id_fkey';
            columns: ['author_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_posts_group_fkey';
            columns: ['society_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'community_groups';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_posts_moderated_by_fkey';
            columns: ['moderated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_posts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      community_preferences: {
        Row: {
          membership_id: string;
          new_listing_alerts: boolean;
          society_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          membership_id: string;
          new_listing_alerts?: boolean;
          society_id: string;
          updated_at?: string;
        };
        Update: {
          membership_id?: string;
          new_listing_alerts?: boolean;
          society_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_preferences_membership_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: true;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_preferences_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      community_replies: {
        Row: {
          author_membership_id: string;
          author_name: string;
          author_unit_label: string | null;
          author_user_id: string;
          body: string;
          client_request_id: string;
          created_at: string;
          id: string;
          listing_id: string | null;
          moderated_at: string | null;
          moderated_by: string | null;
          moderation_reason: string | null;
          post_id: string | null;
          society_id: string;
          status: string;
          status_changed_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_membership_id: string;
          author_name: string;
          author_unit_label?: string | null;
          author_user_id: string;
          body: string;
          client_request_id: string;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          moderated_at?: string | null;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          post_id?: string | null;
          society_id: string;
          status?: string;
          status_changed_at?: string;
        };
        Update: {
          author_membership_id?: string;
          author_name?: string;
          author_unit_label?: string | null;
          author_user_id?: string;
          body?: string;
          client_request_id?: string;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          moderated_at?: string | null;
          moderated_by?: string | null;
          moderation_reason?: string | null;
          post_id?: string | null;
          society_id?: string;
          status?: string;
          status_changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_replies_author_membership_fkey';
            columns: ['society_id', 'author_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_replies_author_user_id_fkey';
            columns: ['author_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_replies_listing_fkey';
            columns: ['society_id', 'listing_id'];
            isOneToOne: false;
            referencedRelation: 'community_listings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_replies_moderated_by_fkey';
            columns: ['moderated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_replies_post_fkey';
            columns: ['society_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'community_posts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_replies_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      community_reports: {
        Row: {
          created_at: string;
          id: string;
          listing_id: string | null;
          note: string | null;
          post_id: string | null;
          reason: string;
          reply_id: string | null;
          reporter_unit_id: string;
          reporter_user_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          society_id: string;
          status: string;
          target_id: string | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          note?: string | null;
          post_id?: string | null;
          reason: string;
          reply_id?: string | null;
          reporter_unit_id: string;
          reporter_user_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          society_id: string;
          status?: string;
          target_id?: never;
          target_type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          note?: string | null;
          post_id?: string | null;
          reason?: string;
          reply_id?: string | null;
          reporter_unit_id?: string;
          reporter_user_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          society_id?: string;
          status?: string;
          target_id?: never;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_reports_listing_fkey';
            columns: ['society_id', 'listing_id'];
            isOneToOne: false;
            referencedRelation: 'community_listings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_reports_post_fkey';
            columns: ['society_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'community_posts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_reports_reply_fkey';
            columns: ['society_id', 'reply_id'];
            isOneToOne: false;
            referencedRelation: 'community_replies';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_reports_reporter_unit_fkey';
            columns: ['society_id', 'reporter_unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'community_reports_reporter_user_id_fkey';
            columns: ['reporter_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_reports_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      compliance_acknowledgements: {
        Row: {
          acknowledged_at: string;
          acknowledged_by: string;
          society_id: string;
          statement: string;
          statement_version: number;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string;
          acknowledged_by: string;
          society_id: string;
          statement: string;
          statement_version?: number;
        };
        Update: {
          acknowledged_at?: string;
          acknowledged_by?: string;
          society_id?: string;
          statement?: string;
          statement_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'compliance_acknowledgements_acknowledged_by_fkey';
            columns: ['acknowledged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_acknowledgements_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      compliance_entries: {
        Row: {
          authority: string;
          client_request_id: string;
          completed_on: string | null;
          created_at: string;
          created_by: string;
          due_date: string;
          evidence_version_id: string | null;
          id: string;
          note: string;
          recurrence: string;
          reminder_30_sent_on: string | null;
          reminder_7_sent_on: string | null;
          responsible_membership_id: string;
          society_id: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          authority: string;
          client_request_id: string;
          completed_on?: string | null;
          created_at?: string;
          created_by: string;
          due_date: string;
          evidence_version_id?: string | null;
          id?: string;
          note?: string;
          recurrence: string;
          reminder_30_sent_on?: string | null;
          reminder_7_sent_on?: string | null;
          responsible_membership_id: string;
          society_id: string;
          status: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          authority?: string;
          client_request_id?: string;
          completed_on?: string | null;
          created_at?: string;
          created_by?: string;
          due_date?: string;
          evidence_version_id?: string | null;
          id?: string;
          note?: string;
          recurrence?: string;
          reminder_30_sent_on?: string | null;
          reminder_7_sent_on?: string | null;
          responsible_membership_id?: string;
          society_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'compliance_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_entries_society_id_evidence_version_id_fkey';
            columns: ['society_id', 'evidence_version_id'];
            isOneToOne: false;
            referencedRelation: 'document_versions';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'compliance_entries_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_entries_society_id_responsible_membership_id_fkey';
            columns: ['society_id', 'responsible_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'compliance_entries_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      compliance_revisions: {
        Row: {
          after: NonNullable<Json>;
          before: NonNullable<Json>;
          created_at: string;
          created_by: string;
          entry_id: string;
          id: string;
          reason: string;
          request_id: string;
          revision: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          after: NonNullable<Json>;
          before: NonNullable<Json>;
          created_at?: string;
          created_by: string;
          entry_id: string;
          id?: string;
          reason: string;
          request_id: string;
          revision: number;
          society_id: string;
        };
        Update: {
          after?: NonNullable<Json>;
          before?: NonNullable<Json>;
          created_at?: string;
          created_by?: string;
          entry_id?: string;
          id?: string;
          reason?: string;
          request_id?: string;
          revision?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'compliance_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_revisions_society_id_entry_id_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'compliance_entries';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      compliance_settings: {
        Row: {
          reminders_enabled: boolean;
          society_id: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          reminders_enabled?: boolean;
          society_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          reminders_enabled?: boolean;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'compliance_settings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'compliance_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      data_cleanup_rules: {
        Row: {
          enabled: boolean;
          older_than_years: number;
          record_kind: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          older_than_years?: number;
          record_kind: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          enabled?: boolean;
          older_than_years?: number;
          record_kind?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'data_cleanup_rules_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'data_cleanup_rules_updated_by_fkey';
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
      document_amendment_milestones: {
        Row: {
          historical_evidence: boolean;
          milestone_date: string | null;
          milestone_type: string;
          note: string | null;
          record_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          historical_evidence?: boolean;
          milestone_date?: string | null;
          milestone_type: string;
          note?: string | null;
          record_id: string;
          society_id: string;
        };
        Update: {
          historical_evidence?: boolean;
          milestone_date?: string | null;
          milestone_type?: string;
          note?: string | null;
          record_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_amendments_record_fkey';
            columns: ['society_id', 'record_id'];
            isOneToOne: true;
            referencedRelation: 'document_governance_records';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      document_folders: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          audience: string;
          case_evidence_eligible: boolean;
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
          case_evidence_eligible?: boolean;
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
          case_evidence_eligible?: boolean;
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
      document_governance_records: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          kind: string;
          society_id: string;
          source_document_version_id: string | null;
          source_kind: string | null;
          source_outcome: string | null;
          source_resolution_id: string | null;
          source_snapshot: NonNullable<Json>;
          source_tenancy_document_id: string | null;
          source_unavailable_at: string | null;
          source_version: number | null;
          state: string;
          title: string;
          updated_at: string;
          updated_by: string;
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
          kind: string;
          society_id: string;
          source_document_version_id?: string | null;
          source_kind?: string | null;
          source_outcome?: string | null;
          source_resolution_id?: string | null;
          source_snapshot?: NonNullable<Json>;
          source_tenancy_document_id?: string | null;
          source_unavailable_at?: string | null;
          source_version?: number | null;
          state?: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: string;
          society_id?: string;
          source_document_version_id?: string | null;
          source_kind?: string | null;
          source_outcome?: string | null;
          source_resolution_id?: string | null;
          source_snapshot?: NonNullable<Json>;
          source_tenancy_document_id?: string | null;
          source_unavailable_at?: string | null;
          source_version?: number | null;
          state?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'document_governance_document_fkey';
            columns: ['society_id', 'source_document_version_id'];
            isOneToOne: false;
            referencedRelation: 'document_versions';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'document_governance_noc_fkey';
            columns: ['society_id', 'source_tenancy_document_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'document_governance_records_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_governance_records_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_governance_records_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_governance_records_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_governance_resolution_fkey';
            columns: ['society_id', 'source_resolution_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_resolutions';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      document_governance_revisions: {
        Row: {
          action: string;
          changed_fields: string[];
          created_at: string;
          created_by: string;
          id: string;
          previous_values: NonNullable<Json>;
          reason: string | null;
          record_id: string;
          request_id: string;
          society_id: string;
          source_kinds_after: string[];
          source_kinds_before: string[];
        };
        ComputedFields: never;
        Insert: {
          action: string;
          changed_fields?: string[];
          created_at?: string;
          created_by: string;
          id?: string;
          previous_values: NonNullable<Json>;
          reason?: string | null;
          record_id: string;
          request_id: string;
          society_id: string;
          source_kinds_after?: string[];
          source_kinds_before?: string[];
        };
        Update: {
          action?: string;
          changed_fields?: string[];
          created_at?: string;
          created_by?: string;
          id?: string;
          previous_values?: NonNullable<Json>;
          reason?: string | null;
          record_id?: string;
          request_id?: string;
          society_id?: string;
          source_kinds_after?: string[];
          source_kinds_before?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'document_governance_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_governance_revisions_record_fkey';
            columns: ['society_id', 'record_id'];
            isOneToOne: false;
            referencedRelation: 'document_governance_records';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      document_house_rules: {
        Row: {
          approval_date: string | null;
          approving_resolution_id: string | null;
          approving_resolution_outcome: string | null;
          approving_resolution_snapshot: NonNullable<Json>;
          approving_resolution_unavailable_at: string | null;
          approving_resolution_version: number | null;
          effective_date: string | null;
          gate_locked: boolean;
          publication_state: string;
          published_at: string | null;
          published_by: string | null;
          record_id: string;
          rule_text: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          approval_date?: string | null;
          approving_resolution_id?: string | null;
          approving_resolution_outcome?: string | null;
          approving_resolution_snapshot?: NonNullable<Json>;
          approving_resolution_unavailable_at?: string | null;
          approving_resolution_version?: number | null;
          effective_date?: string | null;
          gate_locked?: boolean;
          publication_state?: string;
          published_at?: string | null;
          published_by?: string | null;
          record_id: string;
          rule_text?: string | null;
          society_id: string;
        };
        Update: {
          approval_date?: string | null;
          approving_resolution_id?: string | null;
          approving_resolution_outcome?: string | null;
          approving_resolution_snapshot?: NonNullable<Json>;
          approving_resolution_unavailable_at?: string | null;
          approving_resolution_version?: number | null;
          effective_date?: string | null;
          gate_locked?: boolean;
          publication_state?: string;
          published_at?: string | null;
          published_by?: string | null;
          record_id?: string;
          rule_text?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_house_rules_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_house_rules_record_fkey';
            columns: ['society_id', 'record_id'];
            isOneToOne: true;
            referencedRelation: 'document_governance_records';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'document_house_rules_resolution_fkey';
            columns: ['society_id', 'approving_resolution_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_resolutions';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      document_official_case_evidence: {
        Row: {
          case_id: string;
          created_at: string;
          created_by: string;
          id: string;
          request_id: string;
          society_id: string;
          version_id: string;
        };
        ComputedFields: never;
        Insert: {
          case_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          request_id: string;
          society_id: string;
          version_id: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          request_id?: string;
          society_id?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_official_case_evidence_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_official_case_evidence_society_id_case_id_fkey';
            columns: ['society_id', 'case_id'];
            isOneToOne: false;
            referencedRelation: 'document_official_cases';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'document_official_case_evidence_society_id_version_id_fkey';
            columns: ['society_id', 'version_id'];
            isOneToOne: false;
            referencedRelation: 'document_versions';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      document_official_case_revisions: {
        Row: {
          after: NonNullable<Json>;
          before: Json | null;
          case_id: string;
          created_at: string;
          created_by: string;
          id: string;
          reason: string;
          request_id: string;
          revision: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          after: NonNullable<Json>;
          before?: Json | null;
          case_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          reason: string;
          request_id: string;
          revision: number;
          society_id: string;
        };
        Update: {
          after?: NonNullable<Json>;
          before?: Json | null;
          case_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          reason?: string;
          request_id?: string;
          revision?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_official_case_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_official_case_revisions_society_id_case_id_fkey';
            columns: ['society_id', 'case_id'];
            isOneToOne: false;
            referencedRelation: 'document_official_cases';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      document_official_case_settings: {
        Row: {
          reminders_enabled: boolean;
          society_id: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          reminders_enabled?: boolean;
          society_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          reminders_enabled?: boolean;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_official_case_settings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_official_case_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      document_official_cases: {
        Row: {
          authority: string;
          client_request_id: string;
          closed_on: string | null;
          compliance_entry_id: string | null;
          created_at: string;
          created_by: string;
          filed_on: string | null;
          filing_acknowledgement: string | null;
          filing_mode: string | null;
          hearing_on: string | null;
          id: string;
          note: string;
          received_on: string | null;
          reference: string;
          relevant_period: string;
          reminder_30_sent_on: string | null;
          reminder_7_sent_on: string | null;
          reply_due_on: string | null;
          response_on: string | null;
          reviewer_membership_id: string | null;
          society_id: string;
          status: string;
          subject: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          authority: string;
          client_request_id: string;
          closed_on?: string | null;
          compliance_entry_id?: string | null;
          created_at?: string;
          created_by: string;
          filed_on?: string | null;
          filing_acknowledgement?: string | null;
          filing_mode?: string | null;
          hearing_on?: string | null;
          id?: string;
          note?: string;
          received_on?: string | null;
          reference: string;
          relevant_period?: string;
          reminder_30_sent_on?: string | null;
          reminder_7_sent_on?: string | null;
          reply_due_on?: string | null;
          response_on?: string | null;
          reviewer_membership_id?: string | null;
          society_id: string;
          status?: string;
          subject: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          authority?: string;
          client_request_id?: string;
          closed_on?: string | null;
          compliance_entry_id?: string | null;
          created_at?: string;
          created_by?: string;
          filed_on?: string | null;
          filing_acknowledgement?: string | null;
          filing_mode?: string | null;
          hearing_on?: string | null;
          id?: string;
          note?: string;
          received_on?: string | null;
          reference?: string;
          relevant_period?: string;
          reminder_30_sent_on?: string | null;
          reminder_7_sent_on?: string | null;
          reply_due_on?: string | null;
          response_on?: string | null;
          reviewer_membership_id?: string | null;
          society_id?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'document_official_cases_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_official_cases_society_id_compliance_entry_id_fkey';
            columns: ['society_id', 'compliance_entry_id'];
            isOneToOne: false;
            referencedRelation: 'compliance_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'document_official_cases_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_official_cases_society_id_reviewer_membership_id_fkey';
            columns: ['society_id', 'reviewer_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'document_official_cases_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      document_register_indexes: {
        Row: {
          applicability_basis: string | null;
          clause_or_page: string | null;
          custodian: string | null;
          format: string | null;
          maintenance_state: string | null;
          physical_location: string | null;
          record_id: string;
          register_name: string | null;
          register_type: string | null;
          review_date: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          applicability_basis?: string | null;
          clause_or_page?: string | null;
          custodian?: string | null;
          format?: string | null;
          maintenance_state?: string | null;
          physical_location?: string | null;
          record_id: string;
          register_name?: string | null;
          register_type?: string | null;
          review_date?: string | null;
          society_id: string;
        };
        Update: {
          applicability_basis?: string | null;
          clause_or_page?: string | null;
          custodian?: string | null;
          format?: string | null;
          maintenance_state?: string | null;
          physical_location?: string | null;
          record_id?: string;
          register_name?: string | null;
          register_type?: string | null;
          review_date?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_register_indexes_record_fkey';
            columns: ['society_id', 'record_id'];
            isOneToOne: true;
            referencedRelation: 'document_governance_records';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      document_validities: {
        Row: {
          expiry_date: string | null;
          expiry_kind: string;
          issue_date: string | null;
          issuing_authority: string | null;
          record_id: string;
          reference: string | null;
          reminder_cycle_date: string | null;
          reminder_last_milestone: number | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          expiry_date?: string | null;
          expiry_kind: string;
          issue_date?: string | null;
          issuing_authority?: string | null;
          record_id: string;
          reference?: string | null;
          reminder_cycle_date?: string | null;
          reminder_last_milestone?: number | null;
          society_id: string;
        };
        Update: {
          expiry_date?: string | null;
          expiry_kind?: string;
          issue_date?: string | null;
          issuing_authority?: string | null;
          record_id?: string;
          reference?: string | null;
          reminder_cycle_date?: string | null;
          reminder_last_milestone?: number | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_validities_record_fkey';
            columns: ['society_id', 'record_id'];
            isOneToOne: true;
            referencedRelation: 'document_governance_records';
            referencedColumns: ['society_id', 'id'];
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
      event_audience_blocks: {
        Row: {
          block_id: string;
          event_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          block_id: string;
          event_id: string;
          society_id: string;
        };
        Update: {
          block_id?: string;
          event_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_audience_blocks_block_same_society_fkey';
            columns: ['society_id', 'block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'event_audience_blocks_event_same_society_fkey';
            columns: ['society_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'event_audience_blocks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      event_rsvp_charges: {
        Row: {
          amount_paise: number;
          created_at: string;
          created_by: string | null;
          direction: string;
          event_id: string;
          id: number;
          ledger_entry_id: number;
          reason: string;
          rsvp_id: string;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          created_at?: string;
          created_by?: string | null;
          direction: string;
          event_id: string;
          id?: never;
          ledger_entry_id: number;
          reason: string;
          rsvp_id: string;
          society_id: string;
          unit_id: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          created_by?: string | null;
          direction?: string;
          event_id?: string;
          id?: never;
          ledger_entry_id?: number;
          reason?: string;
          rsvp_id?: string;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_rsvp_charges_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_rsvp_charges_ledger_fkey';
            columns: ['society_id', 'unit_id', 'ledger_entry_id'];
            isOneToOne: false;
            referencedRelation: 'billing_ledger_entries';
            referencedColumns: ['society_id', 'unit_id', 'id'];
          },
          {
            foreignKeyName: 'event_rsvp_charges_rsvp_fkey';
            columns: ['society_id', 'event_id', 'unit_id', 'rsvp_id'];
            isOneToOne: false;
            referencedRelation: 'event_rsvps';
            referencedColumns: ['society_id', 'event_id', 'unit_id', 'id'];
          },
          {
            foreignKeyName: 'event_rsvp_charges_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      event_rsvps: {
        Row: {
          created_at: string;
          event_id: string;
          headcount: number;
          id: string;
          responded_at: string;
          responded_by: string;
          society_id: string;
          status: string;
          unit_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          headcount: number;
          id?: string;
          responded_at?: string;
          responded_by: string;
          society_id: string;
          status: string;
          unit_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          headcount?: number;
          id?: string;
          responded_at?: string;
          responded_by?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'event_rsvps_event_same_society_fkey';
            columns: ['society_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'event_rsvps_responded_by_fkey';
            columns: ['responded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_rsvps_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_rsvps_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      events: {
        Row: {
          audience_scope: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          capacity: number | null;
          client_request_id: string;
          contribution_paise: number;
          contribution_type: string;
          created_at: string;
          created_by: string;
          description: string | null;
          ends_at: string;
          id: string;
          max_per_unit: number | null;
          published_at: string | null;
          published_by: string | null;
          reminder_sent_at: string | null;
          rsvp_deadline: string | null;
          society_id: string;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string;
          venue: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          audience_scope?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          capacity?: number | null;
          client_request_id: string;
          contribution_paise?: number;
          contribution_type?: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          max_per_unit?: number | null;
          published_at?: string | null;
          published_by?: string | null;
          reminder_sent_at?: string | null;
          rsvp_deadline?: string | null;
          society_id: string;
          starts_at: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by: string;
          venue?: string | null;
          version?: number;
        };
        Update: {
          audience_scope?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          capacity?: number | null;
          client_request_id?: string;
          contribution_paise?: number;
          contribution_type?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          max_per_unit?: number | null;
          published_at?: string | null;
          published_by?: string | null;
          reminder_sent_at?: string | null;
          rsvp_deadline?: string | null;
          society_id?: string;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          venue?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'events_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_updated_by_fkey';
            columns: ['updated_by'];
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
          is_petty_cash: boolean;
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
          is_petty_cash?: boolean;
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
          is_petty_cash?: boolean;
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
      expense_agm_drafts: {
        Row: {
          created_at: string;
          created_by: string;
          financial_year_start: string;
          id: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
          written_sections: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          financial_year_start: string;
          id?: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
          written_sections?: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          financial_year_start?: string;
          id?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          written_sections?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_agm_drafts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_agm_drafts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_agm_drafts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_audit_acknowledgements: {
        Row: {
          acknowledged_at: string;
          acknowledged_by: string;
          client_request_id: string;
          society_id: string;
          warning_acknowledged_text: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string;
          acknowledged_by: string;
          client_request_id: string;
          society_id: string;
          warning_acknowledged_text: string;
        };
        Update: {
          acknowledged_at?: string;
          acknowledged_by?: string;
          client_request_id?: string;
          society_id?: string;
          warning_acknowledged_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_audit_acknowledgements_acknowledged_by_fkey';
            columns: ['acknowledged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_acknowledgements_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_audit_objections: {
        Row: {
          audit_year_id: string;
          corrected_on: string | null;
          correction_note: string | null;
          created_at: string;
          created_by: string;
          description: string;
          due_date: string;
          evidence_document_id: string | null;
          id: string;
          owner_user_id: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          audit_year_id: string;
          corrected_on?: string | null;
          correction_note?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          due_date: string;
          evidence_document_id?: string | null;
          id?: string;
          owner_user_id: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          audit_year_id?: string;
          corrected_on?: string | null;
          correction_note?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          due_date?: string;
          evidence_document_id?: string | null;
          id?: string;
          owner_user_id?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_audit_objections_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_objections_document_fkey';
            columns: ['society_id', 'evidence_document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_audit_objections_owner_fkey';
            columns: ['society_id', 'owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'user_id'];
          },
          {
            foreignKeyName: 'expense_audit_objections_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_objections_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_objections_year_fkey';
            columns: ['society_id', 'audit_year_id'];
            isOneToOne: false;
            referencedRelation: 'expense_audit_years';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_audit_queries: {
        Row: {
          area: string;
          assignee_user_id: string;
          audit_year_id: string;
          created_at: string;
          created_by: string;
          due_date: string;
          id: string;
          query_date: string;
          query_number: number;
          question: string;
          response: string | null;
          response_date: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          area: string;
          assignee_user_id: string;
          audit_year_id: string;
          created_at?: string;
          created_by: string;
          due_date: string;
          id?: string;
          query_date: string;
          query_number: number;
          question: string;
          response?: string | null;
          response_date?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          area?: string;
          assignee_user_id?: string;
          audit_year_id?: string;
          created_at?: string;
          created_by?: string;
          due_date?: string;
          id?: string;
          query_date?: string;
          query_number?: number;
          question?: string;
          response?: string | null;
          response_date?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_audit_queries_assignee_fkey';
            columns: ['society_id', 'assignee_user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'user_id'];
          },
          {
            foreignKeyName: 'expense_audit_queries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_queries_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_queries_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_queries_year_fkey';
            columns: ['society_id', 'audit_year_id'];
            isOneToOne: false;
            referencedRelation: 'expense_audit_years';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_audit_revisions: {
        Row: {
          after_data: NonNullable<Json>;
          before_data: Json | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          entity_id: string;
          entity_type: string;
          id: string;
          revision_number: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          after_data: NonNullable<Json>;
          before_data?: Json | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          revision_number: number;
          society_id: string;
        };
        Update: {
          after_data?: NonNullable<Json>;
          before_data?: Json | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          revision_number?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_audit_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_revisions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_audit_years: {
        Row: {
          appointed_on: string;
          appointment_document_id: string | null;
          appointment_reference: string | null;
          auditor_firm: string;
          auditor_name: string;
          created_at: string;
          created_by: string;
          filed_on: string | null;
          financial_year_start: string;
          id: string;
          opinion: string | null;
          opinion_text: string | null;
          placed_before_agm_on: string | null;
          report_received_on: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          appointed_on: string;
          appointment_document_id?: string | null;
          appointment_reference?: string | null;
          auditor_firm: string;
          auditor_name: string;
          created_at?: string;
          created_by: string;
          filed_on?: string | null;
          financial_year_start: string;
          id?: string;
          opinion?: string | null;
          opinion_text?: string | null;
          placed_before_agm_on?: string | null;
          report_received_on?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          appointed_on?: string;
          appointment_document_id?: string | null;
          appointment_reference?: string | null;
          auditor_firm?: string;
          auditor_name?: string;
          created_at?: string;
          created_by?: string;
          filed_on?: string | null;
          financial_year_start?: string;
          id?: string;
          opinion?: string | null;
          opinion_text?: string | null;
          placed_before_agm_on?: string | null;
          report_received_on?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_audit_years_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_years_document_fkey';
            columns: ['society_id', 'appointment_document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_audit_years_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_audit_years_updated_by_fkey';
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
          transfer_pair_id: string | null;
          transfer_request_id: string | null;
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
          transfer_pair_id?: string | null;
          transfer_request_id?: string | null;
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
          transfer_pair_id?: string | null;
          transfer_request_id?: string | null;
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
      expense_budget_changes: {
        Row: {
          amount_paise: number;
          approval_document_id: string | null;
          approval_meeting_id: string | null;
          approval_note: string | null;
          approved_at: string;
          approved_body: string;
          approved_by: string;
          approved_on: string;
          budget_id: string;
          category_id: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          direction: string;
          effective_month: number;
          id: string;
          income_type: string | null;
          month_paise: number[];
          pair_id: string | null;
          reason: string;
          society_id: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          approval_document_id?: string | null;
          approval_meeting_id?: string | null;
          approval_note?: string | null;
          approved_at?: string;
          approved_body: string;
          approved_by: string;
          approved_on: string;
          budget_id: string;
          category_id?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          direction: string;
          effective_month: number;
          id?: string;
          income_type?: string | null;
          month_paise: number[];
          pair_id?: string | null;
          reason: string;
          society_id: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_paise?: number;
          approval_document_id?: string | null;
          approval_meeting_id?: string | null;
          approval_note?: string | null;
          approved_at?: string;
          approved_body?: string;
          approved_by?: string;
          approved_on?: string;
          budget_id?: string;
          category_id?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          direction?: string;
          effective_month?: number;
          id?: string;
          income_type?: string | null;
          month_paise?: number[];
          pair_id?: string | null;
          reason?: string;
          society_id?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_budget_changes_approval_document_fkey';
            columns: ['society_id', 'approval_document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budget_changes_approval_meeting_fkey';
            columns: ['society_id', 'approval_meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_resolutions';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budget_changes_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_budget_changes_budget_fkey';
            columns: ['society_id', 'budget_id'];
            isOneToOne: false;
            referencedRelation: 'expense_budgets';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budget_changes_category_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budget_changes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_budget_changes_voided_by_fkey';
            columns: ['voided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_budget_lines: {
        Row: {
          annual_paise: number;
          budget_id: string;
          category_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          income_type: string | null;
          month_paise: number[];
          phasing: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          annual_paise: number;
          budget_id: string;
          category_id?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          income_type?: string | null;
          month_paise: number[];
          phasing: string;
          society_id: string;
        };
        Update: {
          annual_paise?: number;
          budget_id?: string;
          category_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          income_type?: string | null;
          month_paise?: number[];
          phasing?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_budget_lines_budget_fkey';
            columns: ['society_id', 'budget_id'];
            isOneToOne: false;
            referencedRelation: 'expense_budgets';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budget_lines_category_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budget_lines_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_budgets: {
        Row: {
          approval_document_id: string | null;
          approval_meeting_id: string | null;
          approval_note: string | null;
          approved_at: string | null;
          approved_body: string | null;
          approved_by: string | null;
          approved_on: string | null;
          client_request_id: string;
          copy_percent_bp: number | null;
          copy_source_year: number | null;
          created_at: string;
          created_by: string;
          discard_reason: string | null;
          discarded_at: string | null;
          discarded_by: string | null;
          financial_year: number;
          id: string;
          society_id: string;
          status: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          approval_document_id?: string | null;
          approval_meeting_id?: string | null;
          approval_note?: string | null;
          approved_at?: string | null;
          approved_body?: string | null;
          approved_by?: string | null;
          approved_on?: string | null;
          client_request_id: string;
          copy_percent_bp?: number | null;
          copy_source_year?: number | null;
          created_at?: string;
          created_by: string;
          discard_reason?: string | null;
          discarded_at?: string | null;
          discarded_by?: string | null;
          financial_year: number;
          id?: string;
          society_id: string;
          status?: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          approval_document_id?: string | null;
          approval_meeting_id?: string | null;
          approval_note?: string | null;
          approved_at?: string | null;
          approved_body?: string | null;
          approved_by?: string | null;
          approved_on?: string | null;
          client_request_id?: string;
          copy_percent_bp?: number | null;
          copy_source_year?: number | null;
          created_at?: string;
          created_by?: string;
          discard_reason?: string | null;
          discarded_at?: string | null;
          discarded_by?: string | null;
          financial_year?: number;
          id?: string;
          society_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_budgets_approval_document_fkey';
            columns: ['society_id', 'approval_document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budgets_approval_meeting_fkey';
            columns: ['society_id', 'approval_meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_resolutions';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_budgets_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_budgets_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_budgets_discarded_by_fkey';
            columns: ['discarded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_budgets_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_budgets_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_cash_counts: {
        Row: {
          account_id: string;
          book_paise: number;
          client_request_id: string;
          count_date: string;
          counted_by: string;
          counted_paise: number;
          created_at: string;
          id: string;
          kind: string;
          note: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          book_paise: number;
          client_request_id: string;
          count_date: string;
          counted_by: string;
          counted_paise: number;
          created_at?: string;
          id?: string;
          kind: string;
          note?: string | null;
          society_id: string;
        };
        Update: {
          account_id?: string;
          book_paise?: number;
          client_request_id?: string;
          count_date?: string;
          counted_by?: string;
          counted_paise?: number;
          created_at?: string;
          id?: string;
          kind?: string;
          note?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_cash_counts_account_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_cash_counts_counted_by_fkey';
            columns: ['counted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_cash_counts_society_id_fkey';
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
          cost_nature: string | null;
          created_at: string;
          created_by: string;
          detail_description: string | null;
          detail_group: string | null;
          detail_version: number;
          id: string;
          name: string;
          owner_user_id: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          cost_nature?: string | null;
          created_at?: string;
          created_by: string;
          detail_description?: string | null;
          detail_group?: string | null;
          detail_version?: number;
          id?: string;
          name: string;
          owner_user_id?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          cost_nature?: string | null;
          created_at?: string;
          created_by?: string;
          detail_description?: string | null;
          detail_group?: string | null;
          detail_version?: number;
          id?: string;
          name?: string;
          owner_user_id?: string | null;
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
            foreignKeyName: 'expense_categories_owner_same_society_fkey';
            columns: ['society_id', 'owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'user_id'];
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
      expense_category_detail_revisions: {
        Row: {
          category_id: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          previous_cost_nature: string | null;
          previous_description: string | null;
          previous_group: string | null;
          previous_owner_user_id: string | null;
          revision_number: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          previous_cost_nature?: string | null;
          previous_description?: string | null;
          previous_group?: string | null;
          previous_owner_user_id?: string | null;
          revision_number: number;
          society_id: string;
        };
        Update: {
          category_id?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          previous_cost_nature?: string | null;
          previous_description?: string | null;
          previous_group?: string | null;
          previous_owner_user_id?: string | null;
          revision_number?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_category_detail_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_category_detail_revisions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_category_revisions_category_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_control_requests: {
        Row: {
          actor_id: string;
          client_request_id: string;
          created_at: string;
          operation: string;
          payload: NonNullable<Json>;
          result_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          client_request_id: string;
          created_at?: string;
          operation: string;
          payload: NonNullable<Json>;
          result_id: string;
          society_id: string;
        };
        Update: {
          actor_id?: string;
          client_request_id?: string;
          created_at?: string;
          operation?: string;
          payload?: NonNullable<Json>;
          result_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_control_requests_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_control_requests_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fixed_deposits: {
        Row: {
          account_id: string | null;
          bank_name: string;
          created_at: string;
          created_by: string;
          deposit_on: string;
          fund_id: string;
          id: string;
          maturity_on: string;
          maturity_value_paise: number | null;
          predecessor_id: string | null;
          principal_paise: number | null;
          quoted_rate: number | null;
          reference: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          bank_name: string;
          created_at?: string;
          created_by: string;
          deposit_on: string;
          fund_id: string;
          id?: string;
          maturity_on: string;
          maturity_value_paise?: number | null;
          predecessor_id?: string | null;
          principal_paise?: number | null;
          quoted_rate?: number | null;
          reference?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_id?: string | null;
          bank_name?: string;
          created_at?: string;
          created_by?: string;
          deposit_on?: string;
          fund_id?: string;
          id?: string;
          maturity_on?: string;
          maturity_value_paise?: number | null;
          predecessor_id?: string | null;
          principal_paise?: number | null;
          quoted_rate?: number | null;
          reference?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fixed_deposits_account_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fixed_deposits_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fixed_deposits_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fixed_deposits_predecessor_fkey';
            columns: ['society_id', 'predecessor_id'];
            isOneToOne: true;
            referencedRelation: 'expense_fixed_deposits';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fixed_deposits_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fixed_deposits_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fund_corpus_records: {
        Row: {
          concession_paise: number;
          concession_reason: string | null;
          created_at: string;
          created_by: string;
          decision_reference: string;
          event_description: string;
          event_on: string;
          fund_id: string;
          id: string;
          reported_amount_paise: number;
          society_id: string;
          unit_id: string;
          unit_label_snapshot: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          concession_paise?: number;
          concession_reason?: string | null;
          created_at?: string;
          created_by: string;
          decision_reference: string;
          event_description: string;
          event_on: string;
          fund_id: string;
          id?: string;
          reported_amount_paise: number;
          society_id: string;
          unit_id: string;
          unit_label_snapshot: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          concession_paise?: number;
          concession_reason?: string | null;
          created_at?: string;
          created_by?: string;
          decision_reference?: string;
          event_description?: string;
          event_on?: string;
          fund_id?: string;
          id?: string;
          reported_amount_paise?: number;
          society_id?: string;
          unit_id?: string;
          unit_label_snapshot?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_corpus_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_corpus_records_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_corpus_records_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_corpus_records_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_corpus_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_fund_entry_allocations: {
        Row: {
          allocation_version_id: string;
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          entry_id: string;
          fund_id: string | null;
          id: string;
          reason: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          allocation_version_id: string;
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          entry_id: string;
          fund_id?: string | null;
          id?: string;
          reason?: string | null;
          society_id: string;
        };
        Update: {
          allocation_version_id?: string;
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          entry_id?: string;
          fund_id?: string | null;
          id?: string;
          reason?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_entry_allocations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_entry_allocations_entry_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_entry_allocations_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_entry_allocations_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fund_interest_records: {
        Row: {
          actual_credit_paise: number | null;
          average_balance_paise: number | null;
          created_at: string;
          created_by: string;
          fixed_deposit_id: string | null;
          fund_id: string;
          gross_interest_paise: number | null;
          id: string;
          income_entry_id: string | null;
          note: string | null;
          period_from: string;
          period_to: string;
          society_id: string;
          source_label: string;
          tax_withheld_paise: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          actual_credit_paise?: number | null;
          average_balance_paise?: number | null;
          created_at?: string;
          created_by: string;
          fixed_deposit_id?: string | null;
          fund_id: string;
          gross_interest_paise?: number | null;
          id?: string;
          income_entry_id?: string | null;
          note?: string | null;
          period_from: string;
          period_to: string;
          society_id: string;
          source_label: string;
          tax_withheld_paise?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          actual_credit_paise?: number | null;
          average_balance_paise?: number | null;
          created_at?: string;
          created_by?: string;
          fixed_deposit_id?: string | null;
          fund_id?: string;
          gross_interest_paise?: number | null;
          id?: string;
          income_entry_id?: string | null;
          note?: string | null;
          period_from?: string;
          period_to?: string;
          society_id?: string;
          source_label?: string;
          tax_withheld_paise?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_interest_deposit_fkey';
            columns: ['society_id', 'fixed_deposit_id'];
            isOneToOne: false;
            referencedRelation: 'expense_fixed_deposits';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_interest_entry_fkey';
            columns: ['society_id', 'income_entry_id'];
            isOneToOne: true;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_interest_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_interest_records_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_interest_records_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_interest_records_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fund_mappings: {
        Row: {
          billing_charge_type_id: string | null;
          created_at: string;
          created_by: string;
          expense_category_id: string | null;
          fund_id: string;
          id: string;
          income_kind: string | null;
          society_id: string;
          source_kind: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          billing_charge_type_id?: string | null;
          created_at?: string;
          created_by: string;
          expense_category_id?: string | null;
          fund_id: string;
          id?: string;
          income_kind?: string | null;
          society_id: string;
          source_kind: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          billing_charge_type_id?: string | null;
          created_at?: string;
          created_by?: string;
          expense_category_id?: string | null;
          fund_id?: string;
          id?: string;
          income_kind?: string | null;
          society_id?: string;
          source_kind?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_mappings_billing_charge_fkey';
            columns: ['society_id', 'billing_charge_type_id'];
            isOneToOne: false;
            referencedRelation: 'billing_charge_types';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_mappings_category_fkey';
            columns: ['society_id', 'expense_category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_mappings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_mappings_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_mappings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_mappings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fund_opening_allocations: {
        Row: {
          accounts_total_paise: number;
          allocation_version_id: string;
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          fund_id: string;
          id: string;
          opening_id: string;
          reason: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          accounts_total_paise: number;
          allocation_version_id?: string;
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          fund_id: string;
          id?: string;
          opening_id: string;
          reason?: string | null;
          society_id: string;
        };
        Update: {
          accounts_total_paise?: number;
          allocation_version_id?: string;
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          fund_id?: string;
          id?: string;
          opening_id?: string;
          reason?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_opening_allocations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_opening_allocations_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_opening_allocations_opening_fkey';
            columns: ['society_id', 'opening_id'];
            isOneToOne: false;
            referencedRelation: 'expense_fund_openings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_opening_allocations_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fund_openings: {
        Row: {
          accounts_total_paise: number;
          activated_at: string;
          activated_by: string;
          allocated_total_paise: number;
          client_request_id: string;
          cutover_on: string;
          id: string;
          society_id: string;
          warning_acknowledged_text: string;
        };
        ComputedFields: never;
        Insert: {
          accounts_total_paise: number;
          activated_at?: string;
          activated_by: string;
          allocated_total_paise: number;
          client_request_id: string;
          cutover_on: string;
          id?: string;
          society_id: string;
          warning_acknowledged_text: string;
        };
        Update: {
          accounts_total_paise?: number;
          activated_at?: string;
          activated_by?: string;
          allocated_total_paise?: number;
          client_request_id?: string;
          cutover_on?: string;
          id?: string;
          society_id?: string;
          warning_acknowledged_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_openings_activated_by_fkey';
            columns: ['activated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_openings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fund_receipt_links: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          corpus_record_id: string;
          created_at: string;
          created_by: string;
          entry_id: string;
          id: string;
          reason: string | null;
          reverses_link_id: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          corpus_record_id: string;
          created_at?: string;
          created_by: string;
          entry_id: string;
          id?: string;
          reason?: string | null;
          reverses_link_id?: string | null;
          society_id: string;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          corpus_record_id?: string;
          created_at?: string;
          created_by?: string;
          entry_id?: string;
          id?: string;
          reason?: string | null;
          reverses_link_id?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_receipt_corpus_fkey';
            columns: ['society_id', 'corpus_record_id'];
            isOneToOne: false;
            referencedRelation: 'expense_fund_corpus_records';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_receipt_entry_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_receipt_links_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_receipt_links_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_receipt_reverses_fkey';
            columns: ['society_id', 'reverses_link_id'];
            isOneToOne: true;
            referencedRelation: 'expense_fund_receipt_links';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_fund_transfer_rules: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          from_fund_id: string;
          id: string;
          society_id: string;
          to_fund_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by: string;
          from_fund_id: string;
          id?: string;
          society_id: string;
          to_fund_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          from_fund_id?: string;
          id?: string;
          society_id?: string;
          to_fund_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_transfer_rules_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_transfer_rules_from_fkey';
            columns: ['society_id', 'from_fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_transfer_rules_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_transfer_rules_to_fkey';
            columns: ['society_id', 'to_fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_transfer_rules_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_fund_transfers: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          decision_reference: string;
          from_fund_id: string;
          id: string;
          reason: string;
          reverses_transfer_id: string | null;
          society_id: string;
          to_fund_id: string;
          transfer_on: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          decision_reference: string;
          from_fund_id: string;
          id?: string;
          reason: string;
          reverses_transfer_id?: string | null;
          society_id: string;
          to_fund_id: string;
          transfer_on: string;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          decision_reference?: string;
          from_fund_id?: string;
          id?: string;
          reason?: string;
          reverses_transfer_id?: string | null;
          society_id?: string;
          to_fund_id?: string;
          transfer_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_transfers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_transfers_from_fkey';
            columns: ['society_id', 'from_fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_transfers_reverses_fkey';
            columns: ['society_id', 'reverses_transfer_id'];
            isOneToOne: true;
            referencedRelation: 'expense_fund_transfers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_transfers_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_transfers_to_fkey';
            columns: ['society_id', 'to_fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_fund_work_links: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          entry_id: string;
          id: string;
          society_id: string;
          work_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          entry_id: string;
          id?: string;
          society_id: string;
          work_id: string;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          entry_id?: string;
          id?: string;
          society_id?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_work_links_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_work_links_entry_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_work_links_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_work_links_work_fkey';
            columns: ['society_id', 'work_id'];
            isOneToOne: false;
            referencedRelation: 'expense_fund_works';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_fund_works: {
        Row: {
          created_at: string;
          created_by: string;
          external_reference: string | null;
          fund_id: string;
          id: string;
          meeting_resolution_id: string | null;
          resolution_outcome_snapshot: string | null;
          resolution_title_snapshot: string | null;
          resolution_version_snapshot: number | null;
          sanctioned_amount_paise: number;
          sanctioned_on: string;
          society_id: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          valid_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          external_reference?: string | null;
          fund_id: string;
          id?: string;
          meeting_resolution_id?: string | null;
          resolution_outcome_snapshot?: string | null;
          resolution_title_snapshot?: string | null;
          resolution_version_snapshot?: number | null;
          sanctioned_amount_paise: number;
          sanctioned_on: string;
          society_id: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          external_reference?: string | null;
          fund_id?: string;
          id?: string;
          meeting_resolution_id?: string | null;
          resolution_outcome_snapshot?: string | null;
          resolution_title_snapshot?: string | null;
          resolution_version_snapshot?: number | null;
          sanctioned_amount_paise?: number;
          sanctioned_on?: string;
          society_id?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_fund_works_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_works_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_fund_works_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_fund_works_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_funds: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          society_id: string;
          target_date: string | null;
          target_paise: number | null;
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
          target_date?: string | null;
          target_paise?: number | null;
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
          target_date?: string | null;
          target_paise?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_funds_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_funds_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_funds_updated_by_fkey';
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
      expense_payee_vendor_mappings: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          payee_key: string;
          removal_reason: string | null;
          removed_at: string | null;
          removed_by: string | null;
          society_id: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          payee_key: string;
          removal_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          society_id: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          payee_key?: string;
          removal_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          society_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_payee_mappings_vendor_fkey';
            columns: ['society_id', 'vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_payee_vendor_mappings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_payee_vendor_mappings_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_payee_vendor_mappings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_petty_cash_custodians: {
        Row: {
          account_id: string;
          count_id: string | null;
          custodian_user_id: string;
          ended_at: string | null;
          id: string;
          society_id: string;
          started_at: string;
          started_by: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          count_id?: string | null;
          custodian_user_id: string;
          ended_at?: string | null;
          id?: string;
          society_id: string;
          started_at?: string;
          started_by: string;
        };
        Update: {
          account_id?: string;
          count_id?: string | null;
          custodian_user_id?: string;
          ended_at?: string | null;
          id?: string;
          society_id?: string;
          started_at?: string;
          started_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_petty_cash_custodians_account_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_petty_cash_custodians_count_fkey';
            columns: ['society_id', 'count_id'];
            isOneToOne: false;
            referencedRelation: 'expense_cash_counts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_petty_cash_custodians_custodian_user_id_fkey';
            columns: ['custodian_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_petty_cash_custodians_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_petty_cash_custodians_started_by_fkey';
            columns: ['started_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_repair_forecast_item_revisions: {
        Row: {
          action: string;
          after_values: NonNullable<Json>;
          changed_at: string;
          changed_by: string;
          client_request_id: string;
          id: string;
          item_id: string;
          previous_values: Json | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          after_values: NonNullable<Json>;
          changed_at?: string;
          changed_by: string;
          client_request_id: string;
          id?: string;
          item_id: string;
          previous_values?: Json | null;
          society_id: string;
        };
        Update: {
          action?: string;
          after_values?: NonNullable<Json>;
          changed_at?: string;
          changed_by?: string;
          client_request_id?: string;
          id?: string;
          item_id?: string;
          previous_values?: Json | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_repair_forecast_item_revisions_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_repair_forecast_item_revisions_item_fkey';
            columns: ['society_id', 'item_id'];
            isOneToOne: false;
            referencedRelation: 'expense_repair_forecast_items';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_repair_forecast_items: {
        Row: {
          archive_reason: string | null;
          archived_at: string | null;
          archived_by: string | null;
          category: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          current_cost_paise: number;
          cycle_years: number;
          id: string;
          inflation_bp: number;
          last_done_year: number | null;
          manual_next_due_year: number | null;
          name: string;
          notes: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          category: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          current_cost_paise: number;
          cycle_years: number;
          id?: string;
          inflation_bp?: number;
          last_done_year?: number | null;
          manual_next_due_year?: number | null;
          name: string;
          notes?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          category?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          current_cost_paise?: number;
          cycle_years?: number;
          id?: string;
          inflation_bp?: number;
          last_done_year?: number | null;
          manual_next_due_year?: number | null;
          name?: string;
          notes?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_repair_forecast_items_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_repair_forecast_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_repair_forecast_items_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_repair_forecast_items_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_repair_forecast_settings: {
        Row: {
          client_request_id: string | null;
          gap_fund_id: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          client_request_id?: string | null;
          gap_fund_id?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          client_request_id?: string | null;
          gap_fund_id?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_repair_forecast_settings_fund_fkey';
            columns: ['society_id', 'gap_fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_repair_forecast_settings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_repair_forecast_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_savings_evidence: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          entry_id: string | null;
          evidenced_on: string;
          file_path: string | null;
          id: string;
          initiative_id: string;
          note: string;
          society_id: string;
          vendor_bill_id: string | null;
          vendor_contract_id: string | null;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          entry_id?: string | null;
          evidenced_on: string;
          file_path?: string | null;
          id?: string;
          initiative_id: string;
          note: string;
          society_id: string;
          vendor_bill_id?: string | null;
          vendor_contract_id?: string | null;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          entry_id?: string | null;
          evidenced_on?: string;
          file_path?: string | null;
          id?: string;
          initiative_id?: string;
          note?: string;
          society_id?: string;
          vendor_bill_id?: string | null;
          vendor_contract_id?: string | null;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_savings_evidence_bill_fkey';
            columns: ['society_id', 'vendor_bill_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_bills';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_savings_evidence_contract_fkey';
            columns: ['society_id', 'vendor_contract_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_contracts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_savings_evidence_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_savings_evidence_entry_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_savings_evidence_initiative_fkey';
            columns: ['society_id', 'initiative_id'];
            isOneToOne: false;
            referencedRelation: 'expense_savings_initiatives';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_savings_evidence_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_savings_evidence_voided_by_fkey';
            columns: ['voided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_savings_initiatives: {
        Row: {
          baseline_annual_paise: number;
          category_id: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          description: string;
          expected_annual_paise: number;
          id: string;
          kind: string;
          owner_user_id: string | null;
          society_id: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string;
          vendor_id: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          baseline_annual_paise: number;
          category_id?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          description: string;
          expected_annual_paise: number;
          id?: string;
          kind: string;
          owner_user_id?: string | null;
          society_id: string;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          vendor_id?: string | null;
          version?: number;
        };
        Update: {
          baseline_annual_paise?: number;
          category_id?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string;
          expected_annual_paise?: number;
          id?: string;
          kind?: string;
          owner_user_id?: string | null;
          society_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          vendor_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_savings_category_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'expense_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_savings_initiatives_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_savings_initiatives_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_savings_initiatives_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_savings_owner_fkey';
            columns: ['society_id', 'owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'user_id'];
          },
          {
            foreignKeyName: 'expense_savings_vendor_fkey';
            columns: ['society_id', 'vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_savings_status_events: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          from_status: string;
          id: string;
          initiative_id: string;
          reason: string | null;
          society_id: string;
          to_status: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          from_status: string;
          id?: string;
          initiative_id: string;
          reason?: string | null;
          society_id: string;
          to_status: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          from_status?: string;
          id?: string;
          initiative_id?: string;
          reason?: string | null;
          society_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_savings_status_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_savings_status_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_savings_status_initiative_fkey';
            columns: ['society_id', 'initiative_id'];
            isOneToOne: false;
            referencedRelation: 'expense_savings_initiatives';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      expense_statement_balance_revisions: {
        Row: {
          changed_at: string;
          changed_by: string;
          id: string;
          previous_closing_paise: number;
          previous_note: string | null;
          previous_version: number;
          reason: string;
          society_id: string;
          statement_balance_id: string;
        };
        ComputedFields: never;
        Insert: {
          changed_at?: string;
          changed_by: string;
          id?: string;
          previous_closing_paise: number;
          previous_note?: string | null;
          previous_version: number;
          reason: string;
          society_id: string;
          statement_balance_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string;
          id?: string;
          previous_closing_paise?: number;
          previous_note?: string | null;
          previous_version?: number;
          reason?: string;
          society_id?: string;
          statement_balance_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_statement_balance_revisions_balance_fkey';
            columns: ['society_id', 'statement_balance_id'];
            isOneToOne: false;
            referencedRelation: 'expense_statement_balances';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_statement_balance_revisions_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_statement_balance_revisions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_statement_balances: {
        Row: {
          account_id: string;
          closing_paise: number;
          created_at: string;
          created_by: string;
          id: string;
          month: string;
          note: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          closing_paise: number;
          created_at?: string;
          created_by: string;
          id?: string;
          month: string;
          note?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          account_id?: string;
          closing_paise?: number;
          created_at?: string;
          created_by?: string;
          id?: string;
          month?: string;
          note?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_statement_balances_account_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_statement_balances_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_statement_balances_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_statement_balances_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_statement_items: {
        Row: {
          account_id: string;
          amount_paise: number;
          cancel_reason: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          direction: string;
          id: string;
          matched_entry_id: string | null;
          party: string | null;
          reference: string | null;
          society_id: string;
          statement_date: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          amount_paise: number;
          cancel_reason?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          decided_at?: string | null;
          decided_by?: string | null;
          direction: string;
          id?: string;
          matched_entry_id?: string | null;
          party?: string | null;
          reference?: string | null;
          society_id: string;
          statement_date: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_id?: string;
          amount_paise?: number;
          cancel_reason?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          direction?: string;
          id?: string;
          matched_entry_id?: string | null;
          party?: string | null;
          reference?: string | null;
          society_id?: string;
          statement_date?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_statement_items_account_fkey';
            columns: ['society_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'expense_accounts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_statement_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_statement_items_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_statement_items_entry_fkey';
            columns: ['society_id', 'account_id', 'matched_entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'account_id', 'id'];
          },
          {
            foreignKeyName: 'expense_statement_items_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_statement_items_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_vouchers: {
        Row: {
          created_at: string;
          entry_id: string;
          financial_year: number;
          sequence: number;
          society_id: string;
          voucher_type: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          entry_id: string;
          financial_year: number;
          sequence: number;
          society_id: string;
          voucher_type: string;
        };
        Update: {
          created_at?: string;
          entry_id?: string;
          financial_year?: number;
          sequence?: number;
          society_id?: string;
          voucher_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_vouchers_entry_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'expense_vouchers_society_id_fkey';
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
      letter_generation_logs: {
        Row: {
          generated_at: string;
          generated_by: string;
          id: string;
          letter_type: string;
          request_id: string | null;
          society_id: string;
          source_id: string | null;
          source_type: string | null;
        };
        ComputedFields: never;
        Insert: {
          generated_at?: string;
          generated_by: string;
          id?: string;
          letter_type: string;
          request_id?: string | null;
          society_id: string;
          source_id?: string | null;
          source_type?: string | null;
        };
        Update: {
          generated_at?: string;
          generated_by?: string;
          id?: string;
          letter_type?: string;
          request_id?: string | null;
          society_id?: string;
          source_id?: string | null;
          source_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'letter_generation_logs_generated_by_fkey';
            columns: ['generated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'letter_generation_logs_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_audit_events: {
        Row: {
          action: string;
          actor_id: string;
          after_values: NonNullable<Json>;
          audit_id: string;
          client_request_id: string;
          created_at: string;
          id: string;
          previous_values: Json | null;
          project_ids: NonNullable<Json>;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id: string;
          after_values: NonNullable<Json>;
          audit_id: string;
          client_request_id: string;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          project_ids?: NonNullable<Json>;
          society_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          after_values?: NonNullable<Json>;
          audit_id?: string;
          client_request_id?: string;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          project_ids?: NonNullable<Json>;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_audit_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_audit_events_audit_fkey';
            columns: ['society_id', 'audit_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_audits';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_audit_projects: {
        Row: {
          audit_id: string;
          project_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          audit_id: string;
          project_id: string;
          society_id: string;
        };
        Update: {
          audit_id?: string;
          project_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_audit_projects_audit_fkey';
            columns: ['society_id', 'audit_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_audits';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_audit_projects_project_fkey';
            columns: ['society_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_projects';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_audits: {
        Row: {
          audit_on: string;
          auditor_name: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          findings: string;
          id: string;
          next_due_on: string;
          rating: string;
          reminder_due_sent_at: string | null;
          reminder_overdue_sent_at: string | null;
          repair_status: string;
          report_path: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          audit_on: string;
          auditor_name: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          findings: string;
          id?: string;
          next_due_on: string;
          rating: string;
          reminder_due_sent_at?: string | null;
          reminder_overdue_sent_at?: string | null;
          repair_status: string;
          report_path?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          audit_on?: string;
          auditor_name?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          findings?: string;
          id?: string;
          next_due_on?: string;
          rating?: string;
          reminder_due_sent_at?: string | null;
          reminder_overdue_sent_at?: string | null;
          repair_status?: string;
          report_path?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_audits_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_audits_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_audits_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_audits_voided_by_fkey';
            columns: ['voided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_consent_confirmations: {
        Row: {
          client_request_id: string;
          confirmation_text_version: number;
          confirmed_at: string;
          confirmed_by: string;
          id: string;
          method: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          confirmation_text_version: number;
          confirmed_at?: string;
          confirmed_by: string;
          id?: string;
          method: string;
          society_id: string;
        };
        Update: {
          client_request_id?: string;
          confirmation_text_version?: number;
          confirmed_at?: string;
          confirmed_by?: string;
          id?: string;
          method?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_consent_confirmations_confirmed_by_fkey';
            columns: ['confirmed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_consent_confirmations_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_consent_events: {
        Row: {
          actor_id: string | null;
          after_values: NonNullable<Json>;
          client_request_id: string | null;
          created_at: string;
          id: string;
          previous_values: Json | null;
          proposal_id: string;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          after_values: NonNullable<Json>;
          client_request_id?: string | null;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          proposal_id: string;
          society_id: string;
          unit_id: string;
        };
        Update: {
          actor_id?: string | null;
          after_values?: NonNullable<Json>;
          client_request_id?: string | null;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          proposal_id?: string;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_consent_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_consent_events_consent_fkey';
            columns: ['society_id', 'proposal_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_consents';
            referencedColumns: ['society_id', 'proposal_id', 'unit_id'];
          },
        ];
      };
      major_works_consent_polls: {
        Row: {
          applied_at: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          poll_id: string;
          proposal_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          applied_at?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          poll_id: string;
          proposal_id: string;
          society_id: string;
        };
        Update: {
          applied_at?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          poll_id?: string;
          proposal_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_consent_polls_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_consent_polls_poll_fkey';
            columns: ['society_id', 'poll_id'];
            isOneToOne: true;
            referencedRelation: 'poll_votes';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_consent_polls_proposal_fkey';
            columns: ['society_id', 'proposal_id'];
            isOneToOne: true;
            referencedRelation: 'major_works_proposals';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_consents: {
        Row: {
          method: string | null;
          proposal_id: string;
          recorded_by: string | null;
          recorded_on: string | null;
          signed_form_path: string | null;
          society_id: string;
          source_poll_id: string | null;
          status: string;
          unit_id: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          method?: string | null;
          proposal_id: string;
          recorded_by?: string | null;
          recorded_on?: string | null;
          signed_form_path?: string | null;
          society_id: string;
          source_poll_id?: string | null;
          status?: string;
          unit_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          method?: string | null;
          proposal_id?: string;
          recorded_by?: string | null;
          recorded_on?: string | null;
          signed_form_path?: string | null;
          society_id?: string;
          source_poll_id?: string | null;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_consents_poll_fkey';
            columns: ['society_id', 'source_poll_id'];
            isOneToOne: false;
            referencedRelation: 'poll_votes';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_consents_proposal_fkey';
            columns: ['society_id', 'proposal_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_proposals';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_consents_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_consents_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_criteria: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          position: number;
          project_id: string;
          society_id: string;
          weight: number;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          position: number;
          project_id: string;
          society_id: string;
          weight: number;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          position?: number;
          project_id?: string;
          society_id?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_criteria_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_criteria_project_fkey';
            columns: ['society_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_projects';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_milestones: {
        Row: {
          actual_on: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          note: string | null;
          planned_on: string | null;
          position: number;
          proposal_id: string;
          society_id: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          actual_on?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          note?: string | null;
          planned_on?: string | null;
          position: number;
          proposal_id: string;
          society_id: string;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          actual_on?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string | null;
          planned_on?: string | null;
          position?: number;
          proposal_id?: string;
          society_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_milestones_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_milestones_proposal_fkey';
            columns: ['society_id', 'proposal_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_proposals';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_milestones_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_project_events: {
        Row: {
          action: string;
          actor_id: string;
          after_values: NonNullable<Json>;
          client_request_id: string;
          created_at: string;
          id: string;
          previous_values: Json | null;
          project_id: string;
          reason: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id: string;
          after_values: NonNullable<Json>;
          client_request_id: string;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          project_id: string;
          reason?: string | null;
          society_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          after_values?: NonNullable<Json>;
          client_request_id?: string;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          project_id?: string;
          reason?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_project_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_project_events_project_fkey';
            columns: ['society_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_projects';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_projects: {
        Row: {
          actual_end_on: string | null;
          actual_start_on: string | null;
          approval_body: string | null;
          approval_date: string | null;
          approval_meeting_resolution_id: string | null;
          approval_resolution_title_snapshot: string | null;
          approval_resolution_version_snapshot: number | null;
          budget_source: string;
          category: string;
          chosen_quote_id: string | null;
          chosen_quote_reason: string | null;
          chosen_quote_resolution_id: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          estimate_paise: number;
          forecast_item_id: string | null;
          fund_work_id: string | null;
          id: string;
          linked_budget_paise: number | null;
          location: string;
          not_scored_reason: string | null;
          notes: string | null;
          planned_end_on: string | null;
          planned_start_on: string | null;
          priority: string;
          progress_percent: number;
          resume_status: string | null;
          scoring_closed_at: string | null;
          scoring_closed_by: string | null;
          scoring_opened_at: string | null;
          scoring_opened_by: string | null;
          scoring_state: string;
          society_id: string;
          status: string;
          status_reason: string | null;
          title: string;
          typed_budget_paise: number;
          updated_at: string;
          updated_by: string | null;
          vendor_purchase_request_id: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          actual_end_on?: string | null;
          actual_start_on?: string | null;
          approval_body?: string | null;
          approval_date?: string | null;
          approval_meeting_resolution_id?: string | null;
          approval_resolution_title_snapshot?: string | null;
          approval_resolution_version_snapshot?: number | null;
          budget_source?: string;
          category: string;
          chosen_quote_id?: string | null;
          chosen_quote_reason?: string | null;
          chosen_quote_resolution_id?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          estimate_paise: number;
          forecast_item_id?: string | null;
          fund_work_id?: string | null;
          id?: string;
          linked_budget_paise?: number | null;
          location: string;
          not_scored_reason?: string | null;
          notes?: string | null;
          planned_end_on?: string | null;
          planned_start_on?: string | null;
          priority: string;
          progress_percent?: number;
          resume_status?: string | null;
          scoring_closed_at?: string | null;
          scoring_closed_by?: string | null;
          scoring_opened_at?: string | null;
          scoring_opened_by?: string | null;
          scoring_state?: string;
          society_id: string;
          status?: string;
          status_reason?: string | null;
          title: string;
          typed_budget_paise?: number;
          updated_at?: string;
          updated_by?: string | null;
          vendor_purchase_request_id?: string | null;
          version?: number;
        };
        Update: {
          actual_end_on?: string | null;
          actual_start_on?: string | null;
          approval_body?: string | null;
          approval_date?: string | null;
          approval_meeting_resolution_id?: string | null;
          approval_resolution_title_snapshot?: string | null;
          approval_resolution_version_snapshot?: number | null;
          budget_source?: string;
          category?: string;
          chosen_quote_id?: string | null;
          chosen_quote_reason?: string | null;
          chosen_quote_resolution_id?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          estimate_paise?: number;
          forecast_item_id?: string | null;
          fund_work_id?: string | null;
          id?: string;
          linked_budget_paise?: number | null;
          location?: string;
          not_scored_reason?: string | null;
          notes?: string | null;
          planned_end_on?: string | null;
          planned_start_on?: string | null;
          priority?: string;
          progress_percent?: number;
          resume_status?: string | null;
          scoring_closed_at?: string | null;
          scoring_closed_by?: string | null;
          scoring_opened_at?: string | null;
          scoring_opened_by?: string | null;
          scoring_state?: string;
          society_id?: string;
          status?: string;
          status_reason?: string | null;
          title?: string;
          typed_budget_paise?: number;
          updated_at?: string;
          updated_by?: string | null;
          vendor_purchase_request_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_projects_chosen_quote_fkey';
            columns: ['society_id', 'chosen_quote_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_quotes';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_projects_chosen_resolution_fkey';
            columns: ['society_id', 'chosen_quote_resolution_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_resolutions';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_projects_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_projects_forecast_fkey';
            columns: ['society_id', 'forecast_item_id'];
            isOneToOne: false;
            referencedRelation: 'expense_repair_forecast_items';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_projects_fund_work_fkey';
            columns: ['society_id', 'fund_work_id'];
            isOneToOne: false;
            referencedRelation: 'expense_fund_works';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_projects_purchase_request_fkey';
            columns: ['society_id', 'vendor_purchase_request_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_purchase_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_projects_resolution_fkey';
            columns: ['society_id', 'approval_meeting_resolution_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_resolutions';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_projects_scoring_closed_by_fkey';
            columns: ['scoring_closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_projects_scoring_opened_by_fkey';
            columns: ['scoring_opened_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_projects_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_projects_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_proposal_events: {
        Row: {
          action: string;
          actor_id: string;
          after_values: NonNullable<Json>;
          client_request_id: string;
          created_at: string;
          id: string;
          previous_values: Json | null;
          proposal_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id: string;
          after_values: NonNullable<Json>;
          client_request_id: string;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          proposal_id: string;
          society_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          after_values?: NonNullable<Json>;
          client_request_id?: string;
          created_at?: string;
          id?: string;
          previous_values?: Json | null;
          proposal_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_proposal_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_proposal_events_proposal_fkey';
            columns: ['society_id', 'proposal_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_proposals';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_proposal_files: {
        Row: {
          client_request_id: string;
          content_type: string;
          created_at: string;
          id: string;
          path: string;
          proposal_id: string;
          size_bytes: number;
          society_id: string;
          uploaded_by: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          content_type: string;
          created_at?: string;
          id?: string;
          path: string;
          proposal_id: string;
          size_bytes: number;
          society_id: string;
          uploaded_by: string;
        };
        Update: {
          client_request_id?: string;
          content_type?: string;
          created_at?: string;
          id?: string;
          path?: string;
          proposal_id?: string;
          size_bytes?: number;
          society_id?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_proposal_files_proposal_fkey';
            columns: ['society_id', 'proposal_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_proposals';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_proposal_files_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_proposals: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          bank_guarantee_paise: number | null;
          client_request_id: string;
          corpus_paise: number | null;
          created_at: string;
          created_by: string;
          decision_due_on: string | null;
          developer_name: string;
          extra_area_bp: number | null;
          id: string;
          monthly_rent_paise: number | null;
          other_terms: string | null;
          purge_at: string | null;
          purged_at: string | null;
          received_on: string;
          society_id: string;
          stage: string;
          stage_reason: string | null;
          timeline_months: number | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          bank_guarantee_paise?: number | null;
          client_request_id: string;
          corpus_paise?: number | null;
          created_at?: string;
          created_by: string;
          decision_due_on?: string | null;
          developer_name: string;
          extra_area_bp?: number | null;
          id?: string;
          monthly_rent_paise?: number | null;
          other_terms?: string | null;
          purge_at?: string | null;
          purged_at?: string | null;
          received_on: string;
          society_id: string;
          stage?: string;
          stage_reason?: string | null;
          timeline_months?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          bank_guarantee_paise?: number | null;
          client_request_id?: string;
          corpus_paise?: number | null;
          created_at?: string;
          created_by?: string;
          decision_due_on?: string | null;
          developer_name?: string;
          extra_area_bp?: number | null;
          id?: string;
          monthly_rent_paise?: number | null;
          other_terms?: string | null;
          purge_at?: string | null;
          purged_at?: string | null;
          received_on?: string;
          society_id?: string;
          stage?: string;
          stage_reason?: string | null;
          timeline_months?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_proposals_archived_by_fkey';
            columns: ['archived_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_proposals_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_proposals_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_proposals_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_quotes: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          excluded_at: string | null;
          excluded_by: string | null;
          exclusion_reason: string | null;
          file_path: string | null;
          id: string;
          like_for_like: boolean;
          project_id: string;
          removal_reason: string | null;
          removed_at: string | null;
          removed_by: string | null;
          scope_note: string;
          society_id: string;
          source: string;
          vendor_name: string;
          vendor_quote_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          excluded_at?: string | null;
          excluded_by?: string | null;
          exclusion_reason?: string | null;
          file_path?: string | null;
          id?: string;
          like_for_like?: boolean;
          project_id: string;
          removal_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          scope_note: string;
          society_id: string;
          source: string;
          vendor_name: string;
          vendor_quote_id?: string | null;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          excluded_at?: string | null;
          excluded_by?: string | null;
          exclusion_reason?: string | null;
          file_path?: string | null;
          id?: string;
          like_for_like?: boolean;
          project_id?: string;
          removal_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          scope_note?: string;
          society_id?: string;
          source?: string;
          vendor_name?: string;
          vendor_quote_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_quotes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_quotes_excluded_by_fkey';
            columns: ['excluded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_quotes_project_fkey';
            columns: ['society_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_projects';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_quotes_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_quotes_vendor_quote_fkey';
            columns: ['society_id', 'vendor_quote_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_quotes';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      major_works_scenarios: {
        Row: {
          amount_basis: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          deduction_paise: number | null;
          deduction_type: string;
          fund_id: string | null;
          id: string;
          name: string;
          project_id: string;
          society_id: string;
          split: string;
          typed_amount_paise: number | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          amount_basis: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          deduction_paise?: number | null;
          deduction_type: string;
          fund_id?: string | null;
          id?: string;
          name: string;
          project_id: string;
          society_id: string;
          split: string;
          typed_amount_paise?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          amount_basis?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          deduction_paise?: number | null;
          deduction_type?: string;
          fund_id?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          society_id?: string;
          split?: string;
          typed_amount_paise?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_scenarios_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_scenarios_fund_fkey';
            columns: ['society_id', 'fund_id'];
            isOneToOne: false;
            referencedRelation: 'expense_funds';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_scenarios_project_fkey';
            columns: ['society_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_projects';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_scenarios_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_scores: {
        Row: {
          criterion_id: string;
          project_id: string;
          quote_id: string;
          score: number;
          scorer_id: string;
          society_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          criterion_id: string;
          project_id: string;
          quote_id: string;
          score: number;
          scorer_id: string;
          society_id: string;
          updated_at?: string;
        };
        Update: {
          criterion_id?: string;
          project_id?: string;
          quote_id?: string;
          score?: number;
          scorer_id?: string;
          society_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_scores_criterion_fkey';
            columns: ['society_id', 'criterion_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_criteria';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_scores_project_fkey';
            columns: ['society_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_projects';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_scores_quote_fkey';
            columns: ['society_id', 'quote_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_quotes';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_scores_scorer_id_fkey';
            columns: ['scorer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      major_works_spend_tags: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          entry_id: string;
          id: string;
          project_id: string;
          removal_client_request_id: string | null;
          removal_reason: string | null;
          removed_at: string | null;
          removed_by: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          entry_id: string;
          id?: string;
          project_id: string;
          removal_client_request_id?: string | null;
          removal_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          society_id: string;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          entry_id?: string;
          id?: string;
          project_id?: string;
          removal_client_request_id?: string | null;
          removal_reason?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'major_works_spend_tags_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'major_works_spend_tags_entry_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_spend_tags_project_fkey';
            columns: ['society_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'major_works_projects';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'major_works_spend_tags_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_action_items: {
        Row: {
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          created_by: string;
          due_on: string;
          id: string;
          last_overdue_notified_on: string | null;
          meeting_id: string;
          note: string | null;
          owner_membership_id: string;
          owner_name: string;
          resolution_id: string | null;
          society_id: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by: string;
          due_on: string;
          id?: string;
          last_overdue_notified_on?: string | null;
          meeting_id: string;
          note?: string | null;
          owner_membership_id: string;
          owner_name: string;
          resolution_id?: string | null;
          society_id: string;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by?: string;
          due_on?: string;
          id?: string;
          last_overdue_notified_on?: string | null;
          meeting_id?: string;
          note?: string | null;
          owner_membership_id?: string;
          owner_name?: string;
          resolution_id?: string | null;
          society_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_action_items_completed_by_fkey';
            columns: ['completed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_action_items_owner_same_society_fkey';
            columns: ['society_id', 'owner_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_action_items_resolution_fkey';
            columns: ['society_id', 'meeting_id', 'resolution_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_resolutions';
            referencedColumns: ['society_id', 'meeting_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_action_items_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_action_items_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_agenda_items: {
        Row: {
          description: string | null;
          duration_minutes: number | null;
          id: string;
          meeting_id: string;
          position: number;
          society_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          meeting_id: string;
          position: number;
          society_id: string;
          title: string;
        };
        Update: {
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          meeting_id?: string;
          position?: number;
          society_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_agenda_items_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_agenda_items_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_agenda_template_items: {
        Row: {
          description: string | null;
          id: string;
          position: number;
          society_id: string;
          suggested_duration_minutes: number | null;
          template_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          id?: string;
          position: number;
          society_id: string;
          suggested_duration_minutes?: number | null;
          template_id: string;
          title: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          position?: number;
          society_id?: string;
          suggested_duration_minutes?: number | null;
          template_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_agenda_template_items_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_agenda_template_items_template_fkey';
            columns: ['society_id', 'template_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_agenda_templates';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      meeting_agenda_templates: {
        Row: {
          archived_at: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          meeting_types: string[];
          name: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          meeting_types: string[];
          name: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          meeting_types?: string[];
          name?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_agenda_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_agenda_templates_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_agenda_templates_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_attendance: {
        Row: {
          checked_in_by: string | null;
          id: string;
          meeting_id: string;
          membership_id: string | null;
          mode: string;
          proxy_name: string | null;
          recorded_at: string;
          recorded_by: string;
          society_id: string;
          unit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          checked_in_by?: string | null;
          id?: string;
          meeting_id: string;
          membership_id?: string | null;
          mode: string;
          proxy_name?: string | null;
          recorded_at?: string;
          recorded_by: string;
          society_id: string;
          unit_id?: string | null;
        };
        Update: {
          checked_in_by?: string | null;
          id?: string;
          meeting_id?: string;
          membership_id?: string | null;
          mode?: string;
          proxy_name?: string | null;
          recorded_at?: string;
          recorded_by?: string;
          society_id?: string;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_attendance_checked_in_by_fkey';
            columns: ['checked_in_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_attendance_invited_member_fkey';
            columns: ['society_id', 'meeting_id', 'membership_id'];
            isOneToOne: true;
            referencedRelation: 'meeting_invited_members';
            referencedColumns: ['society_id', 'meeting_id', 'membership_id'];
          },
          {
            foreignKeyName: 'meeting_attendance_invited_unit_fkey';
            columns: ['society_id', 'meeting_id', 'unit_id'];
            isOneToOne: true;
            referencedRelation: 'meeting_invited_units';
            referencedColumns: ['society_id', 'meeting_id', 'unit_id'];
          },
          {
            foreignKeyName: 'meeting_attendance_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_attendance_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_attendance_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_invited_members: {
        Row: {
          meeting_id: string;
          member_name: string;
          membership_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          meeting_id: string;
          member_name: string;
          membership_id: string;
          society_id: string;
        };
        Update: {
          meeting_id?: string;
          member_name?: string;
          membership_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_invited_members_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_invited_members_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_invited_members_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_invited_units: {
        Row: {
          meeting_id: string;
          society_id: string;
          unit_id: string;
          unit_label: string;
        };
        ComputedFields: never;
        Insert: {
          meeting_id: string;
          society_id: string;
          unit_id: string;
          unit_label: string;
        };
        Update: {
          meeting_id?: string;
          society_id?: string;
          unit_id?: string;
          unit_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_invited_units_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_invited_units_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_invited_units_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      meeting_invitee_selections: {
        Row: {
          id: string;
          meeting_id: string;
          membership_id: string | null;
          society_id: string;
          unit_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          meeting_id: string;
          membership_id?: string | null;
          society_id: string;
          unit_id?: string | null;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          membership_id?: string | null;
          society_id?: string;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_invitee_selections_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_invitee_selections_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_invitee_selections_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_invitee_selections_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      meeting_minutes: {
        Row: {
          body: string;
          created_at: string;
          document_id: string | null;
          drafted_by: string;
          meeting_id: string;
          published_at: string | null;
          published_by: string | null;
          society_id: string;
          status: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          document_id?: string | null;
          drafted_by: string;
          meeting_id: string;
          published_at?: string | null;
          published_by?: string | null;
          society_id: string;
          status?: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          body?: string;
          created_at?: string;
          document_id?: string | null;
          drafted_by?: string;
          meeting_id?: string;
          published_at?: string | null;
          published_by?: string | null;
          society_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_minutes_document_same_society_fkey';
            columns: ['society_id', 'document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_minutes_drafted_by_fkey';
            columns: ['drafted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_minutes_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: true;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_minutes_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_minutes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_minutes_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_resolutions: {
        Row: {
          agenda_item_id: string | null;
          body: string | null;
          created_at: string;
          created_by: string;
          id: string;
          meeting_id: string;
          outcome: string;
          poll_vote_id: string | null;
          position: number;
          society_id: string;
          title: string;
          updated_at: string;
          updated_by: string;
          version: number;
          votes_abstain: number | null;
          votes_against: number | null;
          votes_for: number | null;
        };
        ComputedFields: never;
        Insert: {
          agenda_item_id?: string | null;
          body?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          meeting_id: string;
          outcome?: string;
          poll_vote_id?: string | null;
          position: number;
          society_id: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
          votes_abstain?: number | null;
          votes_against?: number | null;
          votes_for?: number | null;
        };
        Update: {
          agenda_item_id?: string | null;
          body?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          meeting_id?: string;
          outcome?: string;
          poll_vote_id?: string | null;
          position?: number;
          society_id?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          votes_abstain?: number | null;
          votes_against?: number | null;
          votes_for?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_resolutions_agenda_item_fkey';
            columns: ['society_id', 'meeting_id', 'agenda_item_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_agenda_items';
            referencedColumns: ['society_id', 'meeting_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_resolutions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_resolutions_meeting_same_society_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_resolutions_poll_vote_fkey';
            columns: ['society_id', 'poll_vote_id'];
            isOneToOne: false;
            referencedRelation: 'poll_votes';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'meeting_resolutions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_resolutions_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meetings: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          checkin_closed_at: string | null;
          checkin_open: boolean;
          checkin_opened_at: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          ends_at: string | null;
          held_at: string | null;
          held_by: string | null;
          id: string;
          invitee_scope: string;
          meeting_type: string;
          notice_given_days: number | null;
          notice_required_days: number | null;
          online_url: string | null;
          quorum_percent: number | null;
          rescheduled_at: string | null;
          scheduled_at: string | null;
          society_id: string;
          starts_at: string | null;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          venue: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          checkin_closed_at?: string | null;
          checkin_open?: boolean;
          checkin_opened_at?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          ends_at?: string | null;
          held_at?: string | null;
          held_by?: string | null;
          id?: string;
          invitee_scope?: string;
          meeting_type: string;
          notice_given_days?: number | null;
          notice_required_days?: number | null;
          online_url?: string | null;
          quorum_percent?: number | null;
          rescheduled_at?: string | null;
          scheduled_at?: string | null;
          society_id: string;
          starts_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue?: string | null;
          version?: number;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          checkin_closed_at?: string | null;
          checkin_open?: boolean;
          checkin_opened_at?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          ends_at?: string | null;
          held_at?: string | null;
          held_by?: string | null;
          id?: string;
          invitee_scope?: string;
          meeting_type?: string;
          notice_given_days?: number | null;
          notice_required_days?: number | null;
          online_url?: string | null;
          quorum_percent?: number | null;
          rescheduled_at?: string | null;
          scheduled_at?: string | null;
          society_id?: string;
          starts_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'meetings_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meetings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meetings_held_by_fkey';
            columns: ['held_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meetings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meetings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      member_contact_logs: {
        Row: {
          channel: string;
          client_request_id: string;
          closed_at: string | null;
          contact_on: string;
          contact_type: string;
          created_at: string;
          created_by: string;
          direction: string;
          follow_up_on: string | null;
          handled_by: string;
          id: string;
          service_request_id: string | null;
          society_id: string;
          status: string;
          summary: string;
          unit_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          channel: string;
          client_request_id: string;
          closed_at?: string | null;
          contact_on: string;
          contact_type: string;
          created_at?: string;
          created_by: string;
          direction: string;
          follow_up_on?: string | null;
          handled_by: string;
          id?: string;
          service_request_id?: string | null;
          society_id: string;
          status?: string;
          summary: string;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          channel?: string;
          client_request_id?: string;
          closed_at?: string | null;
          contact_on?: string;
          contact_type?: string;
          created_at?: string;
          created_by?: string;
          direction?: string;
          follow_up_on?: string | null;
          handled_by?: string;
          id?: string;
          service_request_id?: string | null;
          society_id?: string;
          status?: string;
          summary?: string;
          unit_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'member_contact_logs_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_contact_logs_handled_by_fkey';
            columns: ['handled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_contact_logs_request_same_society_fkey';
            columns: ['society_id', 'service_request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'member_contact_logs_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_contact_logs_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'member_contact_logs_updated_by_fkey';
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
      module_setting_access: {
        Row: {
          admin_can_edit: boolean;
          module_key: string;
          setting_key: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          admin_can_edit: boolean;
          module_key: string;
          setting_key: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          admin_can_edit?: boolean;
          module_key?: string;
          setting_key?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'module_setting_access_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'module_setting_access_updated_by_fkey';
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
      notice_plan_proposals: {
        Row: {
          base_plan_updated_at: string | null;
          client_request_id: string;
          created_at: string;
          display_location: string | null;
          id: string;
          next_action: string | null;
          next_action_on: string | null;
          notice_id: string;
          prepared_by: string | null;
          priority: string | null;
          proposed_by: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          society_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          base_plan_updated_at?: string | null;
          client_request_id: string;
          created_at?: string;
          display_location?: string | null;
          id?: string;
          next_action?: string | null;
          next_action_on?: string | null;
          notice_id: string;
          prepared_by?: string | null;
          priority?: string | null;
          proposed_by: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          society_id: string;
          status?: string;
        };
        Update: {
          base_plan_updated_at?: string | null;
          client_request_id?: string;
          created_at?: string;
          display_location?: string | null;
          id?: string;
          next_action?: string | null;
          next_action_on?: string | null;
          notice_id?: string;
          prepared_by?: string | null;
          priority?: string | null;
          proposed_by?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          society_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notice_plan_proposals_proposed_by_fkey';
            columns: ['proposed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notice_plan_proposals_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notice_plan_proposals_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notice_plan_proposals_society_id_notice_id_fkey';
            columns: ['society_id', 'notice_id'];
            isOneToOne: false;
            referencedRelation: 'notices';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      notice_plans: {
        Row: {
          display_location: string | null;
          next_action: string | null;
          next_action_on: string | null;
          notice_id: string;
          prepared_by: string | null;
          priority: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          display_location?: string | null;
          next_action?: string | null;
          next_action_on?: string | null;
          notice_id: string;
          prepared_by?: string | null;
          priority?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          display_location?: string | null;
          next_action?: string | null;
          next_action_on?: string | null;
          notice_id?: string;
          prepared_by?: string | null;
          priority?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notice_plans_notice_same_society_fkey';
            columns: ['society_id', 'notice_id'];
            isOneToOne: true;
            referencedRelation: 'notices';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'notice_plans_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notice_plans_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
          published_at: string | null;
          scheduled_for: string | null;
          scheduled_notified_at: string | null;
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
          published_at?: string | null;
          scheduled_for?: string | null;
          scheduled_notified_at?: string | null;
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
          published_at?: string | null;
          scheduled_for?: string | null;
          scheduled_notified_at?: string | null;
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
          condition_status: string;
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
          condition_status?: string;
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
          condition_status?: string;
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
      person_workspace_preferences: {
        Row: {
          quick_action_pins: string[] | null;
          resident_all_flats: boolean;
          resident_graph_mode: string;
          resident_unit_id: string | null;
          society_id: string;
          starting_place: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          quick_action_pins?: string[] | null;
          resident_all_flats?: boolean;
          resident_graph_mode?: string;
          resident_unit_id?: string | null;
          society_id: string;
          starting_place?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          quick_action_pins?: string[] | null;
          resident_all_flats?: boolean;
          resident_graph_mode?: string;
          resident_unit_id?: string | null;
          society_id?: string;
          starting_place?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'person_workspace_preferences_resident_unit_id_fkey';
            columns: ['resident_unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'person_workspace_preferences_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'person_workspace_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_website_settings: {
        Row: {
          contact_email: string | null;
          enquiry_hourly_limit: number;
          id: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          contact_email?: string | null;
          enquiry_hourly_limit?: number;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          contact_email?: string | null;
          enquiry_hourly_limit?: number;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_website_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_candidates: {
        Row: {
          id: string;
          name: string;
          office_id: string;
          position: number;
          society_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          office_id: string;
          position: number;
          society_id: string;
          vote_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          office_id?: string;
          position?: number;
          society_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_candidates_office_same_society_fkey';
            columns: ['society_id', 'vote_id', 'office_id'];
            isOneToOne: false;
            referencedRelation: 'poll_offices';
            referencedColumns: ['society_id', 'vote_id', 'id'];
          },
          {
            foreignKeyName: 'poll_candidates_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_activities: {
        Row: {
          actual_on: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          election_id: string;
          id: string;
          note: string | null;
          owner_name: string | null;
          planned_on: string | null;
          position: number;
          society_id: string;
          status: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          actual_on?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          election_id: string;
          id?: string;
          note?: string | null;
          owner_name?: string | null;
          planned_on?: string | null;
          position: number;
          society_id: string;
          status: string;
          title: string;
        };
        Update: {
          actual_on?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          election_id?: string;
          id?: string;
          note?: string | null;
          owner_name?: string | null;
          planned_on?: string | null;
          position?: number;
          society_id?: string;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_activities_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_activities_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_activities_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_declarations: {
        Row: {
          candidate_user_id: string | null;
          declared_at: string;
          declared_by: string;
          election_id: string;
          id: string;
          post_id: string;
          society_id: string;
          tie_resolved: boolean;
          unopposed: boolean;
        };
        ComputedFields: never;
        Insert: {
          candidate_user_id?: string | null;
          declared_at?: string;
          declared_by: string;
          election_id: string;
          id?: string;
          post_id: string;
          society_id: string;
          tie_resolved?: boolean;
          unopposed?: boolean;
        };
        Update: {
          candidate_user_id?: string | null;
          declared_at?: string;
          declared_by?: string;
          election_id?: string;
          id?: string;
          post_id?: string;
          society_id?: string;
          tie_resolved?: boolean;
          unopposed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_declarations_declared_by_fkey';
            columns: ['declared_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_declarations_election_post_fkey';
            columns: ['society_id', 'election_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_posts';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_declarations_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_dispute_events: {
        Row: {
          created_at: string;
          created_by: string;
          dispute_id: string;
          election_id: string;
          from_status: string;
          id: string;
          note: string | null;
          society_id: string;
          to_status: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          dispute_id: string;
          election_id: string;
          from_status: string;
          id?: string;
          note?: string | null;
          society_id: string;
          to_status: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          dispute_id?: string;
          election_id?: string;
          from_status?: string;
          id?: string;
          note?: string | null;
          society_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_dispute_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_dispute_events_fkey';
            columns: ['society_id', 'election_id', 'dispute_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_disputes';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_dispute_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_disputes: {
        Row: {
          client_request_id: string;
          created_at: string;
          election_id: string;
          file_path: string | null;
          id: string;
          raised_by: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          society_id: string;
          status: string;
          text: string;
          unit_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          election_id: string;
          file_path?: string | null;
          id?: string;
          raised_by: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          society_id: string;
          status?: string;
          text: string;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          election_id?: string;
          file_path?: string | null;
          id?: string;
          raised_by?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          society_id?: string;
          status?: string;
          text?: string;
          unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_disputes_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_disputes_raised_by_fkey';
            columns: ['raised_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_disputes_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_disputes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_disputes_voter_fkey';
            columns: ['society_id', 'election_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_voters';
            referencedColumns: ['society_id', 'election_id', 'unit_id'];
          },
        ];
      };
      poll_election_expense_links: {
        Row: {
          created_at: string;
          created_by: string;
          election_id: string;
          expense_id: string;
          id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          election_id: string;
          expense_id: string;
          id?: string;
          society_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          election_id?: string;
          expense_id?: string;
          id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_expense_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_expense_entry_fkey';
            columns: ['society_id', 'expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_expense_links_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_expense_links_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_external_results: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          document_id: string;
          election_id: string;
          id: string;
          post_id: string;
          society_id: string;
          votes_count: number | null;
          winner_name: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          document_id: string;
          election_id: string;
          id?: string;
          post_id: string;
          society_id: string;
          votes_count?: number | null;
          winner_name: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          document_id?: string;
          election_id?: string;
          id?: string;
          post_id?: string;
          society_id?: string;
          votes_count?: number | null;
          winner_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_external_document_fkey';
            columns: ['society_id', 'document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_external_election_post_fkey';
            columns: ['society_id', 'election_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_posts';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_external_results_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_external_results_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_helpers: {
        Row: {
          created_at: string;
          created_by: string;
          election_id: string;
          id: string;
          name: string;
          role_name: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          election_id: string;
          id?: string;
          name: string;
          role_name: string;
          society_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          election_id?: string;
          id?: string;
          name?: string;
          role_name?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_helpers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_helpers_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_helpers_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_links: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          document_id: string | null;
          election_id: string;
          id: string;
          meeting_id: string | null;
          notice_id: string | null;
          society_id: string;
          source_type: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          document_id?: string | null;
          election_id: string;
          id?: string;
          meeting_id?: string | null;
          notice_id?: string | null;
          society_id: string;
          source_type: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          document_id?: string | null;
          election_id?: string;
          id?: string;
          meeting_id?: string | null;
          notice_id?: string | null;
          society_id?: string;
          source_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_links_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_links_document_fkey';
            columns: ['society_id', 'document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_links_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_links_meeting_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_links_notice_fkey';
            columns: ['society_id', 'notice_id'];
            isOneToOne: false;
            referencedRelation: 'notices';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_links_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_nominations: {
        Row: {
          candidate_user_id: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          election_id: string;
          id: string;
          post_id: string;
          society_id: string;
          status: string;
          unit_id: string;
          withdrawn_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          candidate_user_id: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          election_id: string;
          id?: string;
          post_id: string;
          society_id: string;
          status?: string;
          unit_id: string;
          withdrawn_at?: string | null;
        };
        Update: {
          candidate_user_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          election_id?: string;
          id?: string;
          post_id?: string;
          society_id?: string;
          status?: string;
          unit_id?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_nominations_candidate_user_id_fkey';
            columns: ['candidate_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_nominations_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_nominations_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_nominations_post_fkey';
            columns: ['society_id', 'election_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_posts';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_nominations_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_nominations_voter_fkey';
            columns: ['society_id', 'election_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_voters';
            referencedColumns: ['society_id', 'election_id', 'unit_id'];
          },
        ];
      };
      poll_election_officers: {
        Row: {
          accepted_at: string | null;
          access_ends_at: string | null;
          client_request_id: string;
          conflict_confirmed_at: string | null;
          created_at: string;
          created_by: string;
          election_id: string;
          id: string;
          invited_email: string | null;
          invited_user_id: string | null;
          profile_id: string | null;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          access_ends_at?: string | null;
          client_request_id: string;
          conflict_confirmed_at?: string | null;
          created_at?: string;
          created_by: string;
          election_id: string;
          id?: string;
          invited_email?: string | null;
          invited_user_id?: string | null;
          profile_id?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          society_id: string;
        };
        Update: {
          accepted_at?: string | null;
          access_ends_at?: string | null;
          client_request_id?: string;
          conflict_confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          election_id?: string;
          id?: string;
          invited_email?: string | null;
          invited_user_id?: string | null;
          profile_id?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_officers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_officers_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_officers_invited_user_id_fkey';
            columns: ['invited_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_officers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_officers_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_officers_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_participation: {
        Row: {
          accepted_at: string;
          election_id: string;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          election_id: string;
          society_id: string;
          unit_id: string;
        };
        Update: {
          accepted_at?: string;
          election_id?: string;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_participation_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_participation_voter_fkey';
            columns: ['society_id', 'election_id', 'unit_id'];
            isOneToOne: true;
            referencedRelation: 'poll_election_voters';
            referencedColumns: ['society_id', 'election_id', 'unit_id'];
          },
        ];
      };
      poll_election_post_choices: {
        Row: {
          candidate_user_id: string;
          chosen_post_id: string;
          created_at: string;
          deadline_at: string;
          decided_by: string;
          election_id: string;
          id: string;
          method: string;
          reason: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          candidate_user_id: string;
          chosen_post_id: string;
          created_at?: string;
          deadline_at: string;
          decided_by: string;
          election_id: string;
          id?: string;
          method: string;
          reason?: string | null;
          society_id: string;
        };
        Update: {
          candidate_user_id?: string;
          chosen_post_id?: string;
          created_at?: string;
          deadline_at?: string;
          decided_by?: string;
          election_id?: string;
          id?: string;
          method?: string;
          reason?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_post_choices_candidate_user_id_fkey';
            columns: ['candidate_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_post_choices_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_post_choices_post_fkey';
            columns: ['society_id', 'election_id', 'chosen_post_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_posts';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_post_choices_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_posts: {
        Row: {
          balloted: boolean;
          election_id: string;
          id: string;
          name: string;
          position: number;
          seats: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          balloted?: boolean;
          election_id: string;
          id?: string;
          name: string;
          position: number;
          seats: number;
          society_id: string;
        };
        Update: {
          balloted?: boolean;
          election_id?: string;
          id?: string;
          name?: string;
          position?: number;
          seats?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_posts_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_posts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_scrutiny_events: {
        Row: {
          created_at: string;
          created_by: string;
          decision: string;
          election_id: string;
          id: string;
          nomination_id: string;
          reason: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          decision: string;
          election_id: string;
          id?: string;
          nomination_id: string;
          reason?: string | null;
          society_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          decision?: string;
          election_id?: string;
          id?: string;
          nomination_id?: string;
          reason?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_scrutiny_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_scrutiny_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_scrutiny_nomination_fkey';
            columns: ['society_id', 'election_id', 'nomination_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_nominations';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
        ];
      };
      poll_election_supporters: {
        Row: {
          election_id: string;
          id: string;
          kind: string;
          nomination_id: string;
          responded_at: string | null;
          society_id: string;
          status: string;
          supporter_user_id: string;
        };
        ComputedFields: never;
        Insert: {
          election_id: string;
          id?: string;
          kind: string;
          nomination_id: string;
          responded_at?: string | null;
          society_id: string;
          status?: string;
          supporter_user_id: string;
        };
        Update: {
          election_id?: string;
          id?: string;
          kind?: string;
          nomination_id?: string;
          responded_at?: string | null;
          society_id?: string;
          status?: string;
          supporter_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_supporters_nomination_fkey';
            columns: ['society_id', 'election_id', 'nomination_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_nominations';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_supporters_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_supporters_supporter_user_id_fkey';
            columns: ['supporter_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_tallies: {
        Row: {
          candidate_user_id: string | null;
          election_id: string;
          id: string;
          post_id: string;
          society_id: string;
          tally: number;
        };
        ComputedFields: never;
        Insert: {
          candidate_user_id?: string | null;
          election_id: string;
          id?: string;
          post_id: string;
          society_id: string;
          tally?: number;
        };
        Update: {
          candidate_user_id?: string | null;
          election_id?: string;
          id?: string;
          post_id?: string;
          society_id?: string;
          tally?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_tallies_post_fkey';
            columns: ['society_id', 'election_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_posts';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_tallies_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_tie_resolutions: {
        Row: {
          candidate_user_id: string;
          created_at: string;
          created_by: string;
          election_id: string;
          id: string;
          method: string;
          post_id: string;
          reason: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          candidate_user_id: string;
          created_at?: string;
          created_by: string;
          election_id: string;
          id?: string;
          method: string;
          post_id: string;
          reason: string;
          society_id: string;
        };
        Update: {
          candidate_user_id?: string;
          created_at?: string;
          created_by?: string;
          election_id?: string;
          id?: string;
          method?: string;
          post_id?: string;
          reason?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_tie_election_post_fkey';
            columns: ['society_id', 'election_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_posts';
            referencedColumns: ['society_id', 'election_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_tie_resolutions_candidate_user_id_fkey';
            columns: ['candidate_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_tie_resolutions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_tie_resolutions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_election_voter_events: {
        Row: {
          action: string;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          created_by: string;
          election_id: string;
          id: string;
          reason: string | null;
          society_id: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          created_by: string;
          election_id: string;
          id?: string;
          reason?: string | null;
          society_id: string;
          unit_id: string;
        };
        Update: {
          action?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          created_by?: string;
          election_id?: string;
          id?: string;
          reason?: string | null;
          society_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_voter_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_voter_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_voter_events_voter_fkey';
            columns: ['society_id', 'election_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'poll_election_voters';
            referencedColumns: ['society_id', 'election_id', 'unit_id'];
          },
        ];
      };
      poll_election_voters: {
        Row: {
          created_at: string;
          created_by: string;
          election_id: string;
          membership_id: string;
          occupancy_id: string;
          removal_reason: string | null;
          removed_at: string | null;
          revision: number;
          society_id: string;
          source: string;
          unit_id: string;
          unit_label: string;
          user_id: string;
          voter_name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          election_id: string;
          membership_id: string;
          occupancy_id: string;
          removal_reason?: string | null;
          removed_at?: string | null;
          revision?: number;
          society_id: string;
          source: string;
          unit_id: string;
          unit_label: string;
          user_id: string;
          voter_name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          election_id?: string;
          membership_id?: string;
          occupancy_id?: string;
          removal_reason?: string | null;
          removed_at?: string | null;
          revision?: number;
          society_id?: string;
          source?: string;
          unit_id?: string;
          unit_label?: string;
          user_id?: string;
          voter_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_election_voters_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_voters_election_fkey';
            columns: ['society_id', 'election_id'];
            isOneToOne: false;
            referencedRelation: 'poll_elections';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_voters_membership_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_voters_occupancy_fkey';
            columns: ['society_id', 'occupancy_id'];
            isOneToOne: false;
            referencedRelation: 'unit_occupants';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_voters_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_election_voters_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_election_voters_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_elections: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          client_request_id: string;
          closed_at: string | null;
          counted_at: string | null;
          created_at: string;
          created_by: string;
          declared_at: string | null;
          dispute_window_days: number;
          id: string;
          legal_type: string;
          multi_post_win_rule: string;
          nomination_supporters_enabled: boolean;
          nominations_close_at: string | null;
          nominations_open_at: string | null;
          outside_held_on: string | null;
          revision: number;
          society_id: string;
          source: string;
          stage: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          voting_closes_at: string | null;
          voting_opens_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          client_request_id: string;
          closed_at?: string | null;
          counted_at?: string | null;
          created_at?: string;
          created_by: string;
          declared_at?: string | null;
          dispute_window_days: number;
          id?: string;
          legal_type: string;
          multi_post_win_rule: string;
          nomination_supporters_enabled?: boolean;
          nominations_close_at?: string | null;
          nominations_open_at?: string | null;
          outside_held_on?: string | null;
          revision?: number;
          society_id: string;
          source?: string;
          stage?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          voting_closes_at?: string | null;
          voting_opens_at?: string | null;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          client_request_id?: string;
          closed_at?: string | null;
          counted_at?: string | null;
          created_at?: string;
          created_by?: string;
          declared_at?: string | null;
          dispute_window_days?: number;
          id?: string;
          legal_type?: string;
          multi_post_win_rule?: string;
          nomination_supporters_enabled?: boolean;
          nominations_close_at?: string | null;
          nominations_open_at?: string | null;
          outside_held_on?: string | null;
          revision?: number;
          society_id?: string;
          source?: string;
          stage?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          voting_closes_at?: string | null;
          voting_opens_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_elections_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_elections_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_elections_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_electorate: {
        Row: {
          block_id: string | null;
          membership_id: string;
          representative_name: string;
          society_id: string;
          unit_id: string;
          unit_label: string;
          user_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          block_id?: string | null;
          membership_id: string;
          representative_name: string;
          society_id: string;
          unit_id: string;
          unit_label: string;
          user_id: string;
          vote_id: string;
        };
        Update: {
          block_id?: string | null;
          membership_id?: string;
          representative_name?: string;
          society_id?: string;
          unit_id?: string;
          unit_label?: string;
          user_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_electorate_block_same_society_fkey';
            columns: ['society_id', 'block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_electorate_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_electorate_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_electorate_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_electorate_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_electorate_vote_same_society_fkey';
            columns: ['society_id', 'vote_id'];
            isOneToOne: false;
            referencedRelation: 'poll_votes';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      poll_offices: {
        Row: {
          id: string;
          name: string;
          position: number;
          society_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          position: number;
          society_id: string;
          vote_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          position?: number;
          society_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_offices_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_offices_vote_same_society_fkey';
            columns: ['society_id', 'vote_id'];
            isOneToOne: false;
            referencedRelation: 'poll_votes';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      poll_official_settings_events: {
        Row: {
          client_request_id: string;
          confirmation_text: string | null;
          created_at: string;
          created_by: string;
          enabled: boolean;
          id: string;
          legal_type: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          confirmation_text?: string | null;
          created_at?: string;
          created_by: string;
          enabled: boolean;
          id?: string;
          legal_type?: string | null;
          society_id: string;
        };
        Update: {
          client_request_id?: string;
          confirmation_text?: string | null;
          created_at?: string;
          created_by?: string;
          enabled?: boolean;
          id?: string;
          legal_type?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_official_settings_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_official_settings_events_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_options: {
        Row: {
          final_count: number | null;
          id: string;
          label: string;
          position: number;
          society_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          final_count?: number | null;
          id?: string;
          label: string;
          position: number;
          society_id: string;
          vote_id: string;
        };
        Update: {
          final_count?: number | null;
          id?: string;
          label?: string;
          position?: number;
          society_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_options_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_options_vote_same_society_fkey';
            columns: ['society_id', 'vote_id'];
            isOneToOne: false;
            referencedRelation: 'poll_votes';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      poll_participation: {
        Row: {
          accepted_at: string;
          society_id: string;
          unit_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          society_id: string;
          unit_id: string;
          vote_id: string;
        };
        Update: {
          accepted_at?: string;
          society_id?: string;
          unit_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_participation_electorate_same_society_fkey';
            columns: ['society_id', 'vote_id', 'unit_id'];
            isOneToOne: true;
            referencedRelation: 'poll_electorate';
            referencedColumns: ['society_id', 'vote_id', 'unit_id'];
          },
          {
            foreignKeyName: 'poll_participation_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_private_tallies: {
        Row: {
          accepted_count: number;
          candidate_id: string | null;
          id: string;
          office_id: string;
          society_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_count?: number;
          candidate_id?: string | null;
          id?: string;
          office_id: string;
          society_id: string;
          vote_id: string;
        };
        Update: {
          accepted_count?: number;
          candidate_id?: string | null;
          id?: string;
          office_id?: string;
          society_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_private_tallies_candidate_same_society_fkey';
            columns: ['society_id', 'vote_id', 'office_id', 'candidate_id'];
            isOneToOne: false;
            referencedRelation: 'poll_candidates';
            referencedColumns: ['society_id', 'vote_id', 'office_id', 'id'];
          },
          {
            foreignKeyName: 'poll_private_tallies_office_same_society_fkey';
            columns: ['society_id', 'vote_id', 'office_id'];
            isOneToOne: false;
            referencedRelation: 'poll_offices';
            referencedColumns: ['society_id', 'vote_id', 'id'];
          },
          {
            foreignKeyName: 'poll_private_tallies_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_public_responses: {
        Row: {
          option_id: string;
          society_id: string;
          unit_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          option_id: string;
          society_id: string;
          unit_id: string;
          vote_id: string;
        };
        Update: {
          option_id?: string;
          society_id?: string;
          unit_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_public_responses_option_same_society_fkey';
            columns: ['society_id', 'vote_id', 'option_id'];
            isOneToOne: false;
            referencedRelation: 'poll_options';
            referencedColumns: ['society_id', 'vote_id', 'id'];
          },
          {
            foreignKeyName: 'poll_public_responses_participation_same_society_fkey';
            columns: ['society_id', 'vote_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'poll_participation';
            referencedColumns: ['society_id', 'vote_id', 'unit_id'];
          },
          {
            foreignKeyName: 'poll_public_responses_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_unit_representatives: {
        Row: {
          membership_id: string | null;
          society_id: string;
          unit_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          membership_id?: string | null;
          society_id: string;
          unit_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          membership_id?: string | null;
          society_id?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_unit_representatives_membership_same_society_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_unit_representatives_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_unit_representatives_unit_same_society_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: true;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_unit_representatives_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      poll_vote_blocks: {
        Row: {
          block_id: string;
          society_id: string;
          vote_id: string;
        };
        ComputedFields: never;
        Insert: {
          block_id: string;
          society_id: string;
          vote_id: string;
        };
        Update: {
          block_id?: string;
          society_id?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_vote_blocks_block_same_society_fkey';
            columns: ['society_id', 'block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'poll_vote_blocks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_vote_blocks_vote_same_society_fkey';
            columns: ['society_id', 'vote_id'];
            isOneToOne: false;
            referencedRelation: 'poll_votes';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      poll_votes: {
        Row: {
          activated_at: string | null;
          cancel_notified_at: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          client_request_id: string;
          closes_at: string | null;
          completed_at: string | null;
          completion_mode: string | null;
          completion_reason: string | null;
          created_at: string;
          created_by: string;
          final_eligible_count: number | null;
          final_submitted_count: number | null;
          id: string;
          instructions: string | null;
          opened_notified_at: string | null;
          opens_at: string | null;
          personal_data_purged_at: string | null;
          results_notified_at: string | null;
          revision: number;
          scheduled_at: string | null;
          selection_limit: number | null;
          selection_mode: string;
          society_id: string;
          status: string;
          tenant_voting: boolean | null;
          tenant_voting_override: boolean | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
          voting_type: string;
          withdrawal_reason: string | null;
          withdrawn_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          activated_at?: string | null;
          cancel_notified_at?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          client_request_id: string;
          closes_at?: string | null;
          completed_at?: string | null;
          completion_mode?: string | null;
          completion_reason?: string | null;
          created_at?: string;
          created_by: string;
          final_eligible_count?: number | null;
          final_submitted_count?: number | null;
          id?: string;
          instructions?: string | null;
          opened_notified_at?: string | null;
          opens_at?: string | null;
          personal_data_purged_at?: string | null;
          results_notified_at?: string | null;
          revision?: number;
          scheduled_at?: string | null;
          selection_limit?: number | null;
          selection_mode?: string;
          society_id: string;
          status?: string;
          tenant_voting?: boolean | null;
          tenant_voting_override?: boolean | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          voting_type: string;
          withdrawal_reason?: string | null;
          withdrawn_at?: string | null;
        };
        Update: {
          activated_at?: string | null;
          cancel_notified_at?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          client_request_id?: string;
          closes_at?: string | null;
          completed_at?: string | null;
          completion_mode?: string | null;
          completion_reason?: string | null;
          created_at?: string;
          created_by?: string;
          final_eligible_count?: number | null;
          final_submitted_count?: number | null;
          id?: string;
          instructions?: string | null;
          opened_notified_at?: string | null;
          opens_at?: string | null;
          personal_data_purged_at?: string | null;
          results_notified_at?: string | null;
          revision?: number;
          scheduled_at?: string | null;
          selection_limit?: number | null;
          selection_mode?: string;
          society_id?: string;
          status?: string;
          tenant_voting?: boolean | null;
          tenant_voting_override?: boolean | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          voting_type?: string;
          withdrawal_reason?: string | null;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_votes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_votes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'poll_votes_updated_by_fkey';
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
          language_preference: string;
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
          language_preference?: string;
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
          language_preference?: string;
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
      service_request_committee_waits: {
        Row: {
          created_at: string;
          created_by: string | null;
          priority: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          wait_days: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          priority: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          wait_days?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          priority?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          wait_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_committee_waits_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_committee_waits_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_committee_waits_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_escalation_settings: {
        Row: {
          committee_wait_mode: string;
          created_at: string;
          created_by: string | null;
          delivery: string;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          committee_wait_mode?: string;
          created_at?: string;
          created_by?: string | null;
          delivery?: string;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          committee_wait_mode?: string;
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
          responded_at: string | null;
          responded_by: string | null;
          response_note: string | null;
          response_status: string;
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
          responded_at?: string | null;
          responded_by?: string | null;
          response_note?: string | null;
          response_status?: string;
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
          responded_at?: string | null;
          responded_by?: string | null;
          response_note?: string | null;
          response_status?: string;
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
            foreignKeyName: 'service_request_escalations_responded_by_fkey';
            columns: ['responded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
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
      service_request_inspection_points: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          location_note: string | null;
          name: string;
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
          location_note?: string | null;
          name: string;
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
          location_note?: string | null;
          name?: string;
          society_id?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_inspection_points_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_inspection_points_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_inspection_points_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_priority_targets: {
        Row: {
          category_id: string;
          created_at: string;
          created_by: string | null;
          priority: string;
          society_id: string;
          target_days: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          priority: string;
          society_id: string;
          target_days: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          priority?: string;
          society_id?: string;
          target_days?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_priority_targets_category_same_society_fkey';
            columns: ['society_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'service_request_categories';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_priority_targets_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_priority_targets_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_priority_targets_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_request_round_checks: {
        Row: {
          check_date: string;
          checked_by: string;
          client_request_id: string;
          created_at: string;
          id: string;
          note: string | null;
          point_id: string;
          request_id: string | null;
          result: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          check_date: string;
          checked_by: string;
          client_request_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          point_id: string;
          request_id?: string | null;
          result: string;
          society_id: string;
        };
        Update: {
          check_date?: string;
          checked_by?: string;
          client_request_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          point_id?: string;
          request_id?: string | null;
          result?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_request_round_checks_checked_by_fkey';
            columns: ['checked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_request_round_checks_point_same_society_fkey';
            columns: ['society_id', 'point_id'];
            isOneToOne: false;
            referencedRelation: 'service_request_inspection_points';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_round_checks_request_same_society_fkey';
            columns: ['society_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'service_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'service_request_round_checks_society_id_fkey';
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
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
          assigned_vendor_id?: string | null;
          assigned_vendor_name?: string | null;
          assigned_vendor_phone?: string | null;
          category_id: string;
          client_request_id: string;
          closed_at?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          feedback_follow_up?: string | null;
          held_seconds?: number;
          id?: string;
          intake_source?: string;
          location_type: string;
          on_hold_reason?: string | null;
          on_hold_since?: string | null;
          priority?: string;
          rating?: number | null;
          rating_behaviour?: number | null;
          rating_comment?: string | null;
          rating_quality?: number | null;
          rating_speed?: number | null;
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
          assigned_vendor_id?: string | null;
          assigned_vendor_name?: string | null;
          assigned_vendor_phone?: string | null;
          category_id?: string;
          client_request_id?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          feedback_follow_up?: string | null;
          held_seconds?: number;
          id?: string;
          intake_source?: string;
          location_type?: string;
          on_hold_reason?: string | null;
          on_hold_since?: string | null;
          priority?: string;
          rating?: number | null;
          rating_behaviour?: number | null;
          rating_comment?: string | null;
          rating_quality?: number | null;
          rating_speed?: number | null;
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
          {
            foreignKeyName: 'service_requests_vendor_same_society_fkey';
            columns: ['society_id', 'assigned_vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
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
          hindi_available: boolean;
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
          hindi_available?: boolean;
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
          hindi_available?: boolean;
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
      society_capability_adoptions: {
        Row: {
          created_at: string;
          created_by: string;
          module_key: string;
          notes: string | null;
          owner_membership_id: string | null;
          priority: string;
          review_on: string | null;
          society_id: string;
          status: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          module_key: string;
          notes?: string | null;
          owner_membership_id?: string | null;
          priority?: string;
          review_on?: string | null;
          society_id: string;
          status?: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          module_key?: string;
          notes?: string | null;
          owner_membership_id?: string | null;
          priority?: string;
          review_on?: string | null;
          society_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'society_capability_adoptions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_capability_adoptions_module_key_fkey';
            columns: ['module_key'];
            isOneToOne: false;
            referencedRelation: 'modules';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'society_capability_adoptions_owner_same_society_fkey';
            columns: ['society_id', 'owner_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'society_capability_adoptions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_capability_adoptions_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      society_feature_requests: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          module_key: string;
          note: string | null;
          society_id: string;
          status: string;
          status_updated_at: string;
          status_updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          module_key: string;
          note?: string | null;
          society_id: string;
          status?: string;
          status_updated_at?: string;
          status_updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          module_key?: string;
          note?: string | null;
          society_id?: string;
          status?: string;
          status_updated_at?: string;
          status_updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'society_feature_requests_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_feature_requests_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_feature_requests_status_updated_by_fkey';
            columns: ['status_updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      society_import_runs: {
        Row: {
          actor_id: string;
          actor_role: string;
          created_at: string;
          id: string;
          kind: string;
          request_id: string;
          row_count: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          actor_role: string;
          created_at?: string;
          id?: string;
          kind: string;
          request_id: string;
          row_count: number;
          society_id: string;
        };
        Update: {
          actor_id?: string;
          actor_role?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          request_id?: string;
          row_count?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'society_import_runs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_import_runs_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      society_onboarding_records: {
        Row: {
          agreed_modules: string[];
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          go_live_on: string | null;
          notes: string | null;
          society_id: string;
          stage: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          agreed_modules?: string[];
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          go_live_on?: string | null;
          notes?: string | null;
          society_id: string;
          stage?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          agreed_modules?: string[];
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          go_live_on?: string | null;
          notes?: string | null;
          society_id?: string;
          stage?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'society_onboarding_records_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_onboarding_records_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      society_opening_dues_imports: {
        Row: {
          import_run_id: string;
          imported_at: string;
          imported_by: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          import_run_id: string;
          imported_at?: string;
          imported_by: string;
          society_id: string;
        };
        Update: {
          import_run_id?: string;
          imported_at?: string;
          imported_by?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'society_opening_dues_import_run_fkey';
            columns: ['society_id', 'import_run_id'];
            isOneToOne: false;
            referencedRelation: 'society_import_runs';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'society_opening_dues_imports_imported_by_fkey';
            columns: ['imported_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_opening_dues_imports_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      society_reference_profiles: {
        Row: {
          arrears_interest_reference: string | null;
          auditor_category: string | null;
          auditor_name: string | null;
          bank_account_last4: string | null;
          bank_name: string | null;
          built_up_area_sq_ft: number | null;
          bye_laws_adopted_on: string | null;
          chairman_mobile: string | null;
          chairman_name: string | null;
          committee_size: number | null;
          committee_term_months: number | null;
          construction_year: number | null;
          created_at: string;
          created_by: string;
          financial_year_start_month: number | null;
          grace_period_reference: string | null;
          ifsc: string | null;
          last_agm_on: string | null;
          last_election_on: string | null;
          maintenance_rate_reference: string | null;
          managing_body_name: string | null;
          pan: string | null;
          parking_count: number | null;
          pin_code: string | null;
          registration_authority: string | null;
          registration_date: string | null;
          registration_number: string | null;
          secretary_mobile: string | null;
          secretary_name: string | null;
          sinking_fund_rate_reference: string | null;
          society_id: string;
          society_type: string | null;
          state: string | null;
          statutory_members_count: number | null;
          treasurer_mobile: string | null;
          treasurer_name: string | null;
          updated_at: string;
          updated_by: string;
          version: number;
          wings_count: number | null;
        };
        ComputedFields: never;
        Insert: {
          arrears_interest_reference?: string | null;
          auditor_category?: string | null;
          auditor_name?: string | null;
          bank_account_last4?: string | null;
          bank_name?: string | null;
          built_up_area_sq_ft?: number | null;
          bye_laws_adopted_on?: string | null;
          chairman_mobile?: string | null;
          chairman_name?: string | null;
          committee_size?: number | null;
          committee_term_months?: number | null;
          construction_year?: number | null;
          created_at?: string;
          created_by: string;
          financial_year_start_month?: number | null;
          grace_period_reference?: string | null;
          ifsc?: string | null;
          last_agm_on?: string | null;
          last_election_on?: string | null;
          maintenance_rate_reference?: string | null;
          managing_body_name?: string | null;
          pan?: string | null;
          parking_count?: number | null;
          pin_code?: string | null;
          registration_authority?: string | null;
          registration_date?: string | null;
          registration_number?: string | null;
          secretary_mobile?: string | null;
          secretary_name?: string | null;
          sinking_fund_rate_reference?: string | null;
          society_id: string;
          society_type?: string | null;
          state?: string | null;
          statutory_members_count?: number | null;
          treasurer_mobile?: string | null;
          treasurer_name?: string | null;
          updated_at?: string;
          updated_by: string;
          version?: number;
          wings_count?: number | null;
        };
        Update: {
          arrears_interest_reference?: string | null;
          auditor_category?: string | null;
          auditor_name?: string | null;
          bank_account_last4?: string | null;
          bank_name?: string | null;
          built_up_area_sq_ft?: number | null;
          bye_laws_adopted_on?: string | null;
          chairman_mobile?: string | null;
          chairman_name?: string | null;
          committee_size?: number | null;
          committee_term_months?: number | null;
          construction_year?: number | null;
          created_at?: string;
          created_by?: string;
          financial_year_start_month?: number | null;
          grace_period_reference?: string | null;
          ifsc?: string | null;
          last_agm_on?: string | null;
          last_election_on?: string | null;
          maintenance_rate_reference?: string | null;
          managing_body_name?: string | null;
          pan?: string | null;
          parking_count?: number | null;
          pin_code?: string | null;
          registration_authority?: string | null;
          registration_date?: string | null;
          registration_number?: string | null;
          secretary_mobile?: string | null;
          secretary_name?: string | null;
          sinking_fund_rate_reference?: string | null;
          society_id?: string;
          society_type?: string | null;
          state?: string | null;
          statutory_members_count?: number | null;
          treasurer_mobile?: string | null;
          treasurer_name?: string | null;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          wings_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'society_reference_profiles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_reference_profiles_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_reference_profiles_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      society_workspace_settings: {
        Row: {
          getting_started_dismissed_at: string | null;
          getting_started_dismissed_by: string | null;
          residents_joined_percent: number;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          getting_started_dismissed_at?: string | null;
          getting_started_dismissed_by?: string | null;
          residents_joined_percent?: number;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          getting_started_dismissed_at?: string | null;
          getting_started_dismissed_by?: string | null;
          residents_joined_percent?: number;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'society_workspace_settings_getting_started_dismissed_by_fkey';
            columns: ['getting_started_dismissed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_workspace_settings_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'society_workspace_settings_updated_by_fkey';
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
          department: string | null;
          designation: string | null;
          employment_status: string;
          employment_type: string | null;
          exit_date: string | null;
          full_name: string;
          id: string;
          id_last_four: string | null;
          id_type: string | null;
          job_role: string;
          joining_date: string | null;
          phone: string;
          photo_path: string | null;
          police_verified: boolean;
          society_id: string;
          staff_code: string;
          staff_type: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          weekly_off: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          department?: string | null;
          designation?: string | null;
          employment_status?: string;
          employment_type?: string | null;
          exit_date?: string | null;
          full_name: string;
          id?: string;
          id_last_four?: string | null;
          id_type?: string | null;
          job_role: string;
          joining_date?: string | null;
          phone: string;
          photo_path?: string | null;
          police_verified?: boolean;
          society_id: string;
          staff_code?: string;
          staff_type: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          weekly_off?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          department?: string | null;
          designation?: string | null;
          employment_status?: string;
          employment_type?: string | null;
          exit_date?: string | null;
          full_name?: string;
          id?: string;
          id_last_four?: string | null;
          id_type?: string | null;
          job_role?: string;
          joining_date?: string | null;
          phone?: string;
          photo_path?: string | null;
          police_verified?: boolean;
          society_id?: string;
          staff_code?: string;
          staff_type?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          weekly_off?: string | null;
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
      staff_performance_notes: {
        Row: {
          action: string | null;
          category: string;
          created_at: string;
          created_by: string;
          follow_up_date: string | null;
          id: string;
          note: string;
          note_date: string;
          rating: number | null;
          society_id: string;
          staff_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          action?: string | null;
          category: string;
          created_at?: string;
          created_by?: string;
          follow_up_date?: string | null;
          id?: string;
          note: string;
          note_date: string;
          rating?: number | null;
          society_id: string;
          staff_id: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          action?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string;
          follow_up_date?: string | null;
          id?: string;
          note?: string;
          note_date?: string;
          rating?: number | null;
          society_id?: string;
          staff_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_performance_notes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_performance_notes_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_performance_notes_staff_fkey';
            columns: ['society_id', 'staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_members';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'staff_performance_notes_updated_by_fkey';
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
      tenancy_certificate_counters: {
        Row: {
          financial_year: string;
          last_sequence: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          financial_year: string;
          last_sequence?: number;
          society_id: string;
        };
        Update: {
          financial_year?: string;
          last_sequence?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_certificate_counters_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      tenancy_certificates: {
        Row: {
          byte_hash: string;
          case_id: string | null;
          client_request_id: string;
          dues_snapshot: NonNullable<Json>;
          financial_year: string;
          handover_id: string | null;
          id: string;
          issued_at: string;
          issued_by: string;
          kind: string;
          move_id: string | null;
          number: string;
          parties_snapshot: NonNullable<Json>;
          path: string;
          purpose: string;
          sequence_number: number;
          signatory_designation: string;
          signatory_name: string;
          size_bytes: number;
          society_id: string;
          source_version: number;
          supersede_reason: string | null;
          superseded_by: string | null;
          unit_snapshot: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          byte_hash: string;
          case_id?: string | null;
          client_request_id: string;
          dues_snapshot: NonNullable<Json>;
          financial_year: string;
          handover_id?: string | null;
          id?: string;
          issued_at?: string;
          issued_by: string;
          kind: string;
          move_id?: string | null;
          number: string;
          parties_snapshot: NonNullable<Json>;
          path: string;
          purpose: string;
          sequence_number: number;
          signatory_designation: string;
          signatory_name: string;
          size_bytes: number;
          society_id: string;
          source_version: number;
          supersede_reason?: string | null;
          superseded_by?: string | null;
          unit_snapshot: NonNullable<Json>;
        };
        Update: {
          byte_hash?: string;
          case_id?: string | null;
          client_request_id?: string;
          dues_snapshot?: NonNullable<Json>;
          financial_year?: string;
          handover_id?: string | null;
          id?: string;
          issued_at?: string;
          issued_by?: string;
          kind?: string;
          move_id?: string | null;
          number?: string;
          parties_snapshot?: NonNullable<Json>;
          path?: string;
          purpose?: string;
          sequence_number?: number;
          signatory_designation?: string;
          signatory_name?: string;
          size_bytes?: number;
          society_id?: string;
          source_version?: number;
          supersede_reason?: string | null;
          superseded_by?: string | null;
          unit_snapshot?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_certificates_case_fkey';
            columns: ['society_id', 'case_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_cases';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_certificates_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_clearance_handovers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_certificates_issued_by_fkey';
            columns: ['issued_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_certificates_move_fkey';
            columns: ['society_id', 'move_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_moves';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_certificates_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_certificates_superseded_fkey';
            columns: ['society_id', 'superseded_by'];
            isOneToOne: false;
            referencedRelation: 'tenancy_certificates';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      tenancy_clearance_acknowledgements: {
        Row: {
          acknowledged_at: string;
          acknowledged_by: string;
          client_request_id: string;
          society_id: string;
          warning_text: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string;
          acknowledged_by: string;
          client_request_id: string;
          society_id: string;
          warning_text: string;
        };
        Update: {
          acknowledged_at?: string;
          acknowledged_by?: string;
          client_request_id?: string;
          society_id?: string;
          warning_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_clearance_acknowledgements_acknowledged_by_fkey';
            columns: ['acknowledged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_acknowledgements_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      tenancy_clearance_consents: {
        Row: {
          consented_at: string;
          consented_by: string;
          expected_version: number;
          handover_id: string;
          id: string;
          membership_id: string;
          role: string;
          society_id: string;
          transfer_party_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          consented_at?: string;
          consented_by: string;
          expected_version: number;
          handover_id: string;
          id?: string;
          membership_id: string;
          role: string;
          society_id: string;
          transfer_party_id?: string | null;
        };
        Update: {
          consented_at?: string;
          consented_by?: string;
          expected_version?: number;
          handover_id?: string;
          id?: string;
          membership_id?: string;
          role?: string;
          society_id?: string;
          transfer_party_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_clearance_consents_consented_by_fkey';
            columns: ['consented_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_consents_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_clearance_handovers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_consents_member_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_consents_party_fkey';
            columns: ['society_id', 'transfer_party_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_parties';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      tenancy_clearance_files: {
        Row: {
          content_type: string;
          created_at: string;
          created_by: string;
          handover_id: string;
          id: string;
          membership_id: string | null;
          path: string;
          size_bytes: number;
          society_id: string;
          transfer_party_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          content_type: string;
          created_at?: string;
          created_by: string;
          handover_id: string;
          id?: string;
          membership_id?: string | null;
          path: string;
          size_bytes: number;
          society_id: string;
          transfer_party_id?: string | null;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          created_by?: string;
          handover_id?: string;
          id?: string;
          membership_id?: string | null;
          path?: string;
          size_bytes?: number;
          society_id?: string;
          transfer_party_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_clearance_files_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_files_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_clearance_handovers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_files_member_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_files_party_fkey';
            columns: ['society_id', 'transfer_party_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_parties';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      tenancy_clearance_handovers: {
        Row: {
          admin_note: string | null;
          approval_reference: string | null;
          approved_at: string | null;
          approved_by: string | null;
          basis: string;
          case_id: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          dues_snapshot: NonNullable<Json>;
          evidence_mode: string;
          id: string;
          move_id: string | null;
          responsible_membership_id: string | null;
          responsible_role: string;
          responsible_transfer_party_id: string | null;
          society_id: string;
          status: string;
          unit_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          admin_note?: string | null;
          approval_reference?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          basis: string;
          case_id?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          dues_snapshot: NonNullable<Json>;
          evidence_mode: string;
          id?: string;
          move_id?: string | null;
          responsible_membership_id?: string | null;
          responsible_role: string;
          responsible_transfer_party_id?: string | null;
          society_id: string;
          status?: string;
          unit_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          admin_note?: string | null;
          approval_reference?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          basis?: string;
          case_id?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          dues_snapshot?: NonNullable<Json>;
          evidence_mode?: string;
          id?: string;
          move_id?: string | null;
          responsible_membership_id?: string | null;
          responsible_role?: string;
          responsible_transfer_party_id?: string | null;
          society_id?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_clearance_handovers_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_case_fkey';
            columns: ['society_id', 'case_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_cases';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_move_fkey';
            columns: ['society_id', 'move_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_moves';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_responsible_member_fkey';
            columns: ['society_id', 'responsible_membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_responsible_party_fkey';
            columns: ['society_id', 'case_id', 'responsible_transfer_party_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_parties';
            referencedColumns: ['society_id', 'case_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_clearance_handovers_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
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
          agreement_starts_on: string | null;
          agreement_type: string | null;
          amenity_booking_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
          certificate_preparation: Json | null;
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
          verification_checked_on: string | null;
          verification_reference: string | null;
          verification_status: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          agreement_expires_on?: string | null;
          agreement_starts_on?: string | null;
          agreement_type?: string | null;
          amenity_booking_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          certificate_preparation?: Json | null;
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
          verification_checked_on?: string | null;
          verification_reference?: string | null;
          verification_status?: string | null;
          version?: number;
        };
        Update: {
          agreement_expires_on?: string | null;
          agreement_starts_on?: string | null;
          agreement_type?: string | null;
          amenity_booking_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          certificate_preparation?: Json | null;
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
          verification_checked_on?: string | null;
          verification_reference?: string | null;
          verification_status?: string | null;
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
      tenancy_transfer_cases: {
        Row: {
          certificate_preparation: Json | null;
          client_request_id: string;
          closing_reason: string | null;
          committee_decision_on: string | null;
          completed_on: string | null;
          created_at: string;
          created_by: string;
          documents_checked_on: string | null;
          dues_settled_on: string | null;
          id: string;
          received_on: string;
          rejected_on: string | null;
          society_id: string;
          stage: string;
          unit_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
          withdrawn_on: string | null;
        };
        ComputedFields: never;
        Insert: {
          certificate_preparation?: Json | null;
          client_request_id: string;
          closing_reason?: string | null;
          committee_decision_on?: string | null;
          completed_on?: string | null;
          created_at?: string;
          created_by: string;
          documents_checked_on?: string | null;
          dues_settled_on?: string | null;
          id?: string;
          received_on: string;
          rejected_on?: string | null;
          society_id: string;
          stage: string;
          unit_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
          withdrawn_on?: string | null;
        };
        Update: {
          certificate_preparation?: Json | null;
          client_request_id?: string;
          closing_reason?: string | null;
          committee_decision_on?: string | null;
          completed_on?: string | null;
          created_at?: string;
          created_by?: string;
          documents_checked_on?: string | null;
          dues_settled_on?: string | null;
          id?: string;
          received_on?: string;
          rejected_on?: string | null;
          society_id?: string;
          stage?: string;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          withdrawn_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_transfer_cases_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_cases_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_cases_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_cases_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tenancy_transfer_decisions: {
        Row: {
          case_id: string;
          client_request_id: string;
          conditions: NonNullable<Json>;
          created_at: string;
          created_by: string;
          decision: string;
          id: string;
          meeting_id: string | null;
          resolution_date: string;
          resolution_reference: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          case_id: string;
          client_request_id: string;
          conditions?: NonNullable<Json>;
          created_at?: string;
          created_by: string;
          decision: string;
          id?: string;
          meeting_id?: string | null;
          resolution_date: string;
          resolution_reference: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          case_id?: string;
          client_request_id?: string;
          conditions?: NonNullable<Json>;
          created_at?: string;
          created_by?: string;
          decision?: string;
          id?: string;
          meeting_id?: string | null;
          resolution_date?: string;
          resolution_reference?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_transfer_decisions_case_fkey';
            columns: ['society_id', 'case_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_cases';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_decisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_decisions_meeting_fkey';
            columns: ['society_id', 'meeting_id'];
            isOneToOne: false;
            referencedRelation: 'meetings';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_decisions_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tenancy_transfer_parties: {
        Row: {
          active: boolean;
          case_id: string;
          created_at: string;
          created_by: string;
          email: string | null;
          id: string;
          membership_id: string | null;
          name: string;
          phone: string | null;
          role: string;
          society_id: string;
          superseded_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          case_id: string;
          created_at?: string;
          created_by: string;
          email?: string | null;
          id?: string;
          membership_id?: string | null;
          name: string;
          phone?: string | null;
          role: string;
          society_id: string;
          superseded_at?: string | null;
        };
        Update: {
          active?: boolean;
          case_id?: string;
          created_at?: string;
          created_by?: string;
          email?: string | null;
          id?: string;
          membership_id?: string | null;
          name?: string;
          phone?: string | null;
          role?: string;
          society_id?: string;
          superseded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_transfer_parties_case_fkey';
            columns: ['society_id', 'case_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_cases';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_parties_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_parties_membership_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      tenancy_transfer_revisions: {
        Row: {
          action: string;
          changed_fields: string[];
          created_at: string;
          created_by: string;
          entity_id: string;
          entity_type: string;
          id: string;
          previous_values: NonNullable<Json>;
          reason: string | null;
          request_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          changed_fields?: string[];
          created_at?: string;
          created_by: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          previous_values: NonNullable<Json>;
          reason?: string | null;
          request_id: string;
          society_id: string;
        };
        Update: {
          action?: string;
          changed_fields?: string[];
          created_at?: string;
          created_by?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          previous_values?: NonNullable<Json>;
          reason?: string | null;
          request_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenancy_transfer_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenancy_transfer_revisions_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
        ];
      };
      unit_area_history: {
        Row: {
          built_up_sqft: number | null;
          carpet_sqft: number | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          outdoor_sqft: number | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          built_up_sqft?: number | null;
          carpet_sqft?: number | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          outdoor_sqft?: number | null;
          society_id: string;
          source: string;
          status: string;
          unit_id: string;
          version: number;
        };
        Update: {
          built_up_sqft?: number | null;
          carpet_sqft?: number | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          outdoor_sqft?: number | null;
          society_id?: string;
          source?: string;
          status?: string;
          unit_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_area_history_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_area_history_society_id_unit_id_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_handover_acknowledgements: {
        Row: {
          acknowledged_at: string;
          handover_id: string;
          id: string;
          membership_id: string;
          note: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string;
          handover_id: string;
          id?: string;
          membership_id: string;
          note?: string | null;
          society_id: string;
        };
        Update: {
          acknowledged_at?: string;
          handover_id?: string;
          id?: string;
          membership_id?: string;
          note?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handover_acknowledgements_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'unit_handovers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_handover_acknowledgements_membership_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_handover_items: {
        Row: {
          handover_id: string;
          id: string;
          item_key: string;
          label: string;
          note: string | null;
          position: number;
          response: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          handover_id: string;
          id?: string;
          item_key: string;
          label: string;
          note?: string | null;
          position: number;
          response?: string | null;
          society_id: string;
        };
        Update: {
          handover_id?: string;
          id?: string;
          item_key?: string;
          label?: string;
          note?: string | null;
          position?: number;
          response?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handover_items_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'unit_handovers';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_handover_parties: {
        Row: {
          handover_id: string;
          id: string;
          membership_id: string;
          party_name: string;
          role_snapshot: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          handover_id: string;
          id?: string;
          membership_id: string;
          party_name: string;
          role_snapshot: string;
          society_id: string;
        };
        Update: {
          handover_id?: string;
          id?: string;
          membership_id?: string;
          party_name?: string;
          role_snapshot?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handover_parties_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'unit_handovers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_handover_parties_membership_fkey';
            columns: ['society_id', 'membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_handover_photos: {
        Row: {
          added_at: string;
          added_by: string;
          client_request_id: string;
          content_type: string;
          handover_id: string;
          id: string;
          path: string;
          size_bytes: number;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          added_by: string;
          client_request_id: string;
          content_type: string;
          handover_id: string;
          id?: string;
          path: string;
          size_bytes: number;
          society_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          client_request_id?: string;
          content_type?: string;
          handover_id?: string;
          id?: string;
          path?: string;
          size_bytes?: number;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handover_photos_added_by_fkey';
            columns: ['added_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handover_photos_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'unit_handovers';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_handover_readings: {
        Row: {
          added_at: string;
          added_by: string;
          client_request_id: string;
          handover_id: string;
          id: string;
          reading_id: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          added_by: string;
          client_request_id: string;
          handover_id: string;
          id?: string;
          reading_id: string;
          society_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          client_request_id?: string;
          handover_id?: string;
          id?: string;
          reading_id?: string;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handover_readings_added_by_fkey';
            columns: ['added_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handover_readings_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'unit_handovers';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_handover_readings_reading_fkey';
            columns: ['society_id', 'reading_id'];
            isOneToOne: false;
            referencedRelation: 'metering_readings';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_handover_revisions: {
        Row: {
          action: string;
          after: NonNullable<Json>;
          before: Json | null;
          changed_at: string;
          changed_by: string;
          handover_id: string;
          id: string;
          reason: string | null;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          after: NonNullable<Json>;
          before?: Json | null;
          changed_at?: string;
          changed_by: string;
          handover_id: string;
          id?: string;
          reason?: string | null;
          society_id: string;
        };
        Update: {
          action?: string;
          after?: NonNullable<Json>;
          before?: Json | null;
          changed_at?: string;
          changed_by?: string;
          handover_id?: string;
          id?: string;
          reason?: string | null;
          society_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handover_revisions_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handover_revisions_handover_fkey';
            columns: ['society_id', 'handover_id'];
            isOneToOne: false;
            referencedRelation: 'unit_handovers';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      unit_handover_templates: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string;
          id: string;
          items: NonNullable<Json>;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          items: NonNullable<Json>;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          items?: NonNullable<Json>;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handover_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handover_templates_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: true;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handover_templates_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      unit_handovers: {
        Row: {
          client_request_id: string;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string;
          event_type: string;
          handover_on: string;
          id: string;
          move_id: string | null;
          note: string | null;
          society_id: string;
          status: string;
          transfer_case_id: string | null;
          unit_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by: string;
          event_type: string;
          handover_on: string;
          id?: string;
          move_id?: string | null;
          note?: string | null;
          society_id: string;
          status: string;
          transfer_case_id?: string | null;
          unit_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          client_request_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string;
          event_type?: string;
          handover_on?: string;
          id?: string;
          move_id?: string | null;
          note?: string | null;
          society_id?: string;
          status?: string;
          transfer_case_id?: string | null;
          unit_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_handovers_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handovers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handovers_move_fkey';
            columns: ['society_id', 'move_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_moves';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_handovers_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_handovers_transfer_case_fkey';
            columns: ['society_id', 'transfer_case_id'];
            isOneToOne: false;
            referencedRelation: 'tenancy_transfer_cases';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_handovers_unit_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_handovers_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      unit_occupants: {
        Row: {
          billing_confirmed_move_in_on: string | null;
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
          billing_confirmed_move_in_on?: string | null;
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
          billing_confirmed_move_in_on?: string | null;
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
      unit_vacancy_followups: {
        Row: {
          assigned_to: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          follow_up_on: string;
          id: string;
          inspection_on: string | null;
          kind: string;
          society_id: string;
          starts_on: string;
          unit_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          assigned_to: string;
          client_request_id: string;
          closed_at?: string | null;
          created_at?: string;
          created_by: string;
          follow_up_on: string;
          id?: string;
          inspection_on?: string | null;
          kind: string;
          society_id: string;
          starts_on: string;
          unit_id: string;
          version?: number;
        };
        Update: {
          assigned_to?: string;
          client_request_id?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string;
          follow_up_on?: string;
          id?: string;
          inspection_on?: string | null;
          kind?: string;
          society_id?: string;
          starts_on?: string;
          unit_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'unit_vacancy_followups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'unit_vacancy_followups_society_id_assigned_to_fkey';
            columns: ['society_id', 'assigned_to'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'unit_vacancy_followups_society_id_unit_id_fkey';
            columns: ['society_id', 'unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['society_id', 'id'];
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
      vendor_bill_payments: {
        Row: {
          amount_paise: number;
          bill_id: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          entry_id: string;
          id: string;
          society_id: string;
          unlink_reason: string | null;
          unlinked_at: string | null;
          unlinked_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          bill_id: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          entry_id: string;
          id?: string;
          society_id: string;
          unlink_reason?: string | null;
          unlinked_at?: string | null;
          unlinked_by?: string | null;
        };
        Update: {
          amount_paise?: number;
          bill_id?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          entry_id?: string;
          id?: string;
          society_id?: string;
          unlink_reason?: string | null;
          unlinked_at?: string | null;
          unlinked_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_bill_payments_bill_same_society_fkey';
            columns: ['society_id', 'bill_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_bills';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_bill_payments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_bill_payments_entry_same_society_fkey';
            columns: ['society_id', 'entry_id'];
            isOneToOne: false;
            referencedRelation: 'expense_book_entries';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_bill_payments_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_bill_payments_unlinked_by_fkey';
            columns: ['unlinked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_bills: {
        Row: {
          amount_paise: number;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string;
          created_at: string;
          created_by: string;
          due_date: string;
          effective_terms_days: number;
          id: string;
          invoice_date: string;
          invoice_number: string;
          society_id: string;
          updated_at: string;
          updated_by: string;
          vendor_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          due_date: string;
          effective_terms_days: number;
          id?: string;
          invoice_date: string;
          invoice_number: string;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          vendor_id: string;
          version?: number;
        };
        Update: {
          amount_paise?: number;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          due_date?: string;
          effective_terms_days?: number;
          id?: string;
          invoice_date?: string;
          invoice_number?: string;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          vendor_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_bills_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_bills_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_bills_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_bills_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_bills_vendor_same_society_fkey';
            columns: ['society_id', 'vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
          },
        ];
      };
      vendor_contracts: {
        Row: {
          annual_value_paise: number;
          auto_renew: boolean;
          client_request_id: string;
          created_at: string;
          created_by: string;
          deduction_per_day_paise: number | null;
          default_sanctioned_days: number | null;
          document_content_type: string | null;
          document_path: string | null;
          document_size_bytes: number | null;
          end_date: string;
          id: string;
          last_reminder_days: number | null;
          notice_days: number | null;
          payment_frequency: string;
          predecessor_id: string | null;
          scope: string;
          society_id: string;
          start_date: string;
          terminated_at: string | null;
          terminated_by: string | null;
          terminated_on: string | null;
          termination_reason: string | null;
          updated_at: string;
          updated_by: string;
          vendor_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          annual_value_paise: number;
          auto_renew?: boolean;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          deduction_per_day_paise?: number | null;
          default_sanctioned_days?: number | null;
          document_content_type?: string | null;
          document_path?: string | null;
          document_size_bytes?: number | null;
          end_date: string;
          id?: string;
          last_reminder_days?: number | null;
          notice_days?: number | null;
          payment_frequency: string;
          predecessor_id?: string | null;
          scope: string;
          society_id: string;
          start_date: string;
          terminated_at?: string | null;
          terminated_by?: string | null;
          terminated_on?: string | null;
          termination_reason?: string | null;
          updated_at?: string;
          updated_by: string;
          vendor_id: string;
          version?: number;
        };
        Update: {
          annual_value_paise?: number;
          auto_renew?: boolean;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          deduction_per_day_paise?: number | null;
          default_sanctioned_days?: number | null;
          document_content_type?: string | null;
          document_path?: string | null;
          document_size_bytes?: number | null;
          end_date?: string;
          id?: string;
          last_reminder_days?: number | null;
          notice_days?: number | null;
          payment_frequency?: string;
          predecessor_id?: string | null;
          scope?: string;
          society_id?: string;
          start_date?: string;
          terminated_at?: string | null;
          terminated_by?: string | null;
          terminated_on?: string | null;
          termination_reason?: string | null;
          updated_at?: string;
          updated_by?: string;
          vendor_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_contracts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_contracts_predecessor_same_society_fkey';
            columns: ['society_id', 'predecessor_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_contracts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_contracts_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_contracts_terminated_by_fkey';
            columns: ['terminated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_contracts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_contracts_vendor_same_society_fkey';
            columns: ['society_id', 'vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['society_id', 'id'];
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
      vendor_staff_day_checks: {
        Row: {
          actual_days: number;
          bill_raised_paise: number | null;
          client_request_id: string;
          contract_id: string;
          contracted_amount_paise: number;
          created_at: string;
          created_by: string;
          id: string;
          manual_deduction_paise: number | null;
          manual_deduction_reason: string | null;
          month: string;
          rate_paise: number | null;
          sanctioned_days: number;
          society_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          actual_days: number;
          bill_raised_paise?: number | null;
          client_request_id: string;
          contract_id: string;
          contracted_amount_paise: number;
          created_at?: string;
          created_by: string;
          id?: string;
          manual_deduction_paise?: number | null;
          manual_deduction_reason?: string | null;
          month: string;
          rate_paise?: number | null;
          sanctioned_days: number;
          society_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          actual_days?: number;
          bill_raised_paise?: number | null;
          client_request_id?: string;
          contract_id?: string;
          contracted_amount_paise?: number;
          created_at?: string;
          created_by?: string;
          id?: string;
          manual_deduction_paise?: number | null;
          manual_deduction_reason?: string | null;
          month?: string;
          rate_paise?: number | null;
          sanctioned_days?: number;
          society_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_staff_day_checks_contract_same_society_fkey';
            columns: ['society_id', 'contract_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_contracts';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_staff_day_checks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_staff_day_checks_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_staff_day_checks_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_work_orders: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string;
          completed_on: string | null;
          created_at: string;
          created_by: string;
          description: string;
          due_on: string | null;
          id: string;
          issued_on: string;
          number: string;
          order_year: number;
          purchase_request_id: string;
          sequence: number;
          society_id: string;
          status: string;
          updated_at: string;
          updated_by: string;
          value_paise: number;
          vendor_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id: string;
          completed_on?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          due_on?: string | null;
          id?: string;
          issued_on: string;
          number: string;
          order_year: number;
          purchase_request_id: string;
          sequence: number;
          society_id: string;
          status?: string;
          updated_at?: string;
          updated_by: string;
          value_paise: number;
          vendor_id: string;
          version?: number;
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string;
          completed_on?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          due_on?: string | null;
          id?: string;
          issued_on?: string;
          number?: string;
          order_year?: number;
          purchase_request_id?: string;
          sequence?: number;
          society_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string;
          value_paise?: number;
          vendor_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_work_orders_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_work_orders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_work_orders_request_same_society_fkey';
            columns: ['society_id', 'purchase_request_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_purchase_requests';
            referencedColumns: ['society_id', 'id'];
          },
          {
            foreignKeyName: 'vendor_work_orders_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_work_orders_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_work_orders_vendor_same_society_fkey';
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
          blacklist_reason: string | null;
          blacklisted: boolean;
          blacklisted_at: string | null;
          blacklisted_by: string | null;
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
          onboarded_date: string | null;
          pan: string | null;
          payment_terms_days: number | null;
          phone: string | null;
          society_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          blacklist_reason?: string | null;
          blacklisted?: boolean;
          blacklisted_at?: string | null;
          blacklisted_by?: string | null;
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
          onboarded_date?: string | null;
          pan?: string | null;
          payment_terms_days?: number | null;
          phone?: string | null;
          society_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          blacklist_reason?: string | null;
          blacklisted?: boolean;
          blacklisted_at?: string | null;
          blacklisted_by?: string | null;
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
          onboarded_date?: string | null;
          pan?: string | null;
          payment_terms_days?: number | null;
          phone?: string | null;
          society_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendors_blacklisted_by_fkey';
            columns: ['blacklisted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
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
      website_enquiries: {
        Row: {
          city: string | null;
          email: string | null;
          flat_count: number | null;
          full_name: string;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          message: string | null;
          phone: string | null;
          request_id: string;
          society_name: string | null;
          status: string;
          submitted_at: string;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          email?: string | null;
          flat_count?: number | null;
          full_name: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          message?: string | null;
          phone?: string | null;
          request_id: string;
          society_name?: string | null;
          status?: string;
          submitted_at?: string;
        };
        Update: {
          city?: string | null;
          email?: string | null;
          flat_count?: number | null;
          full_name?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          message?: string | null;
          phone?: string | null;
          request_id?: string;
          society_name?: string | null;
          status?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_enquiries_handled_by_fkey';
            columns: ['handled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_quick_action_defaults: {
        Row: {
          action_keys: string[];
          role: string;
          scope_key: string | null;
          society_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          action_keys: string[];
          role: string;
          scope_key?: never;
          society_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          action_keys?: string[];
          role?: string;
          scope_key?: never;
          society_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_quick_action_defaults_society_id_fkey';
            columns: ['society_id'];
            isOneToOne: false;
            referencedRelation: 'societies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_quick_action_defaults_updated_by_fkey';
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
      admin_home_admin_actions: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      admin_home_get: { Args: { p_society_id: string }; Returns: Json };
      admin_set_guard_pin: {
        Args: {
          p_guard_id: string;
          p_pin: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      admin_set_hindi_availability: {
        Args: {
          p_expected_updated_at: string;
          p_hindi_available: boolean;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
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
      amc_schedule_save: {
        Args: {
          p_amc_type: string;
          p_asset_category_id: string;
          p_contract_id: string;
          p_expected_updated_at: string;
          p_request_trace: string;
          p_services_per_year: number;
          p_society_id: string;
        };
        Returns: undefined;
      };
      amc_settings_update: {
        Args: {
          p_due_soon_days: number;
          p_request_trace: string;
          p_society_id: string;
          p_urgent_days: number;
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
      amenity_activity_record: {
        Args: {
          p_activity_kind: string;
          p_client_request_id: string;
          p_note: string;
          p_occurred_at_local: string;
          p_request_id: string;
          p_society_id: string;
          p_source_id: string;
          p_source_kind: string;
        };
        Returns: string;
      };
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
      amenity_calendar_month: {
        Args: { p_limit?: number; p_month: string; p_society_id: string };
        Returns: Json;
      };
      amenity_calendar_settings_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      amenity_calendar_visibility_save: {
        Args: {
          p_request_id: string;
          p_resident_calendar_identity: string;
          p_society_id: string;
        };
        Returns: undefined;
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
      amenity_deposit_event_record: {
        Args: {
          p_account_id: string;
          p_amount_paise: number;
          p_booking_id: string;
          p_client_request_id: string;
          p_event_date: string;
          p_evidence_path: string;
          p_kind: string;
          p_reason: string;
          p_reference: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      amenity_deposit_event_void: {
        Args: {
          p_client_request_id: string;
          p_event_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      amenity_deposit_file_access: {
        Args: { p_booking_id: string; p_society_id: string; p_upload: boolean };
        Returns: boolean;
      };
      amenity_deposit_file_path_access: {
        Args: { p_path: string };
        Returns: boolean;
      };
      amenity_deposit_override: {
        Args: {
          p_amount_paise: number;
          p_booking_id: string;
          p_client_request_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      amenity_deposit_policy_save: {
        Args: { p_policy: string; p_request_id: string; p_society_id: string };
        Returns: undefined;
      };
      amenity_facilities_report: {
        Args: { p_limit?: number; p_offset?: number; p_society_id: string };
        Returns: Json;
      };
      amenity_save:
        | {
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
          }
        | {
            Args: {
              p_active: boolean;
              p_amenity_id: string;
              p_capacity: number;
              p_client_request_id: string;
              p_deposit_paise: number;
              p_deposit_required_before_confirmation: boolean;
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
      analytics_dashboard: {
        Args: { p_money_range: string; p_months: number; p_society_id: string };
        Returns: Json;
      };
      analytics_export_record: {
        Args: {
          p_format: string;
          p_money_range: string;
          p_months: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      analytics_settings_get: { Args: { p_society_id: string }; Returns: Json };
      analytics_settings_update: {
        Args: {
          p_expected_version: number;
          p_metric_keys: string[];
          p_request_id: string;
          p_society_id: string;
        };
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
      billing_bill_email_payload: {
        Args: { p_bill_id: string; p_society_id: string };
        Returns: Json;
      };
      billing_bill_get: {
        Args: { p_bill_id: string; p_society_id: string };
        Returns: Json;
      };
      billing_bill_share_start: {
        Args: {
          p_bill_id: string;
          p_channel: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
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
          p_base_charge_type_id?: string;
          p_eligibility?: string;
          p_expected_updated_at: string;
          p_id: string;
          p_method: string;
          p_name: string;
          p_percent_basis_points?: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: {
          active: boolean;
          amount_paise: number | null;
          base_charge_type_id: string | null;
          created_at: string;
          created_by: string;
          eligibility: string;
          id: string;
          method: string;
          name: string;
          percent_basis_points: number | null;
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
          base_charge_type_id: string | null;
          created_at: string;
          created_by: string;
          eligibility: string;
          id: string;
          method: string;
          name: string;
          percent_basis_points: number | null;
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
      billing_collection_efficiency: {
        Args: { p_as_of_date: string; p_society_id: string };
        Returns: Json;
      };
      billing_confirm_tenant_move_in: {
        Args: {
          p_move_in_on: string;
          p_occupant_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      billing_dashboard: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      billing_dues_follow_up: {
        Args: { p_purpose: string; p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      billing_estimate: {
        Args: {
          p_area_sqft: number;
          p_custom_amounts: Json;
          p_occupancy: string;
          p_society_id: string;
        };
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
      billing_interest_acknowledge: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: string;
      };
      billing_interest_rate_save: {
        Args: {
          p_client_request_id: string;
          p_effective_on: string;
          p_mode: string;
          p_rate_basis_points: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      billing_interest_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      billing_interest_settings_get: {
        Args: { p_society_id: string };
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
      billing_monthly_collection: {
        Args: {
          p_from_month: string;
          p_society_id: string;
          p_to_month: string;
        };
        Returns: Json;
      };
      billing_monthly_collection_export_record: {
        Args: {
          p_from_month: string;
          p_request_id: string;
          p_society_id: string;
          p_to_month: string;
        };
        Returns: undefined;
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
      billing_payment_plan_cancel: {
        Args: {
          p_plan_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      billing_payment_plan_open_bills: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      billing_payment_plan_save: {
        Args: {
          p_bill_ids: string[];
          p_down_payment_paise: number;
          p_first_due_date: string;
          p_installment_count: number;
          p_plan_id: string;
          p_remarks: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      billing_payment_plans_list: {
        Args: { p_society_id: string };
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
      billing_recovery_action_save: {
        Args: {
          p_action_date: string;
          p_action_id: string;
          p_action_type: string;
          p_assigned_admin_user_id: string;
          p_next_action_date: string;
          p_outcome: string;
          p_request_id: string;
          p_society_id: string;
          p_status: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      billing_recovery_actions_list: {
        Args: { p_society_id: string };
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
      billing_report_summary: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      billing_resident_lists: { Args: { p_society_id: string }; Returns: Json };
      billing_resident_outstanding: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      billing_settings_update:
        | {
            Args: {
              p_bill_email_on_publish: boolean;
              p_due_day: string;
              p_expected_updated_at: string;
              p_request_id: string;
              p_rounding: string;
              p_society_id: string;
            };
            Returns: Json;
          }
        | {
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
      billing_unconfirmed_tenant_moves: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: Json;
      };
      building_layout_get: {
        Args: { p_block_id: string; p_society_id: string };
        Returns: Json;
      };
      building_layout_save: {
        Args: {
          p_block_id: string;
          p_client_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_values: Json;
        };
        Returns: string;
      };
      building_unit_place: {
        Args: {
          p_block_id: string;
          p_client_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_space_id: string;
          p_unit_id: string;
          p_version: string;
        };
        Returns: boolean;
      };
      bulk_import_context_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      bulk_import_save: {
        Args: {
          p_kind: string;
          p_request_id: string;
          p_rows: Json;
          p_society_id: string;
        };
        Returns: string;
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
      committee_action_plan_create_sample: {
        Args: {
          p_client_request_id: string;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
          p_start_on: string;
        };
        Returns: string;
      };
      committee_action_plan_save: {
        Args: {
          p_client_request_id: string;
          p_expected_version: number;
          p_name: string;
          p_notes: string;
          p_plan_id: string;
          p_request_id: string;
          p_society_id: string;
          p_start_on: string;
        };
        Returns: string;
      };
      committee_action_plan_set_archived: {
        Args: {
          p_archived: boolean;
          p_expected_version: number;
          p_plan_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      committee_action_plan_task_delete: {
        Args: {
          p_expected_version: number;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
          p_task_id: string;
        };
        Returns: undefined;
      };
      committee_action_plan_task_save: {
        Args: {
          p_category: string;
          p_client_request_id: string;
          p_end_day: number;
          p_evidence_url: string;
          p_expected_version: number;
          p_meeting_action_item_id: string;
          p_notes: string;
          p_owner_membership_id: string;
          p_plan_id: string;
          p_priority: string;
          p_progress: number;
          p_request_id: string;
          p_society_id: string;
          p_start_day: number;
          p_status: string;
          p_task_id: string;
          p_title: string;
        };
        Returns: string;
      };
      committee_action_plans_get: {
        Args: { p_include_archived?: boolean; p_society_id: string };
        Returns: Json;
      };
      communication_dashboard_get: {
        Args: { p_month: string; p_society_id: string };
        Returns: Json;
      };
      communication_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      community_admin_groups: { Args: { p_society_id: string }; Returns: Json };
      community_admin_item_get: {
        Args: {
          p_society_id: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: Json;
      };
      community_admin_mutes: { Args: { p_society_id: string }; Returns: Json };
      community_admin_queue: {
        Args: {
          p_limit: number;
          p_offset: number;
          p_queue: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_group_archive: {
        Args: {
          p_archived: boolean;
          p_expected_version: number;
          p_group_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_group_feed: {
        Args: {
          p_group_id: string;
          p_limit: number;
          p_offset: number;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_group_join: {
        Args: {
          p_group_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_group_leave: {
        Args: {
          p_group_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_group_save: {
        Args: {
          p_description: string;
          p_expected_version: number;
          p_group_id: string;
          p_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_home: { Args: { p_society_id: string }; Returns: Json };
      community_listing_close: {
        Args: {
          p_listing_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_listing_create: {
        Args: {
          p_client_request_id: string;
          p_listing: Json;
          p_photo_paths: string[];
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_listing_get: {
        Args: { p_listing_id: string; p_society_id: string };
        Returns: Json;
      };
      community_listing_renew: {
        Args: {
          p_listing_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_listing_update: {
        Args: {
          p_expected_version: number;
          p_listing: Json;
          p_listing_id: string;
          p_photo_paths: string[];
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_listing_withdraw: {
        Args: {
          p_listing_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_marketplace: {
        Args: {
          p_limit: number;
          p_offset: number;
          p_search: string;
          p_society_id: string;
          p_type: string;
        };
        Returns: Json;
      };
      community_member_options: {
        Args: { p_limit: number; p_search: string; p_society_id: string };
        Returns: Json;
      };
      community_moderate: {
        Args: {
          p_action: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: Json;
      };
      community_mute: {
        Args: {
          p_duration: string;
          p_membership_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_my_items: { Args: { p_society_id: string }; Returns: Json };
      community_photo_access: {
        Args: { p_path: string; p_society_id: string };
        Returns: boolean;
      };
      community_photo_upload_path: {
        Args: {
          p_content_type: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      community_post_create: {
        Args: {
          p_body: string;
          p_client_request_id: string;
          p_group_id: string;
          p_photo_paths: string[];
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_post_get: {
        Args: { p_post_id: string; p_society_id: string };
        Returns: Json;
      };
      community_post_update: {
        Args: {
          p_body: string;
          p_expected_version: number;
          p_photo_paths: string[];
          p_post_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_post_withdraw: {
        Args: { p_post_id: string; p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      community_preferences_set: {
        Args: {
          p_new_listing_alerts: boolean;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_reply_create: {
        Args: {
          p_body: string;
          p_client_request_id: string;
          p_request_id: string;
          p_society_id: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: Json;
      };
      community_reply_delete: {
        Args: {
          p_reply_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_report: {
        Args: {
          p_note: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: Json;
      };
      community_retention_files_list: {
        Args: { p_today: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      community_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: Json;
      };
      community_settings_get: { Args: { p_society_id: string }; Returns: Json };
      community_settings_update: {
        Args: {
          p_expected_updated_at: string;
          p_request_id: string;
          p_settings: Json;
          p_society_id: string;
        };
        Returns: Json;
      };
      community_unmute: {
        Args: {
          p_membership_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      compliance_acknowledge: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: string;
      };
      compliance_data_cleanup_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      compliance_entry_save: {
        Args: {
          p_authority: string;
          p_client_request_id: string;
          p_completed_on: string;
          p_due_date: string;
          p_evidence_version_id: string;
          p_expected_version: number;
          p_id: string;
          p_note: string;
          p_reason: string;
          p_recurrence: string;
          p_request_id: string;
          p_responsible_membership_id: string;
          p_society_id: string;
          p_status: string;
          p_title: string;
        };
        Returns: string;
      };
      compliance_reminders_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      compliance_reminders_save: {
        Args: {
          p_enabled: boolean;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      compliance_workspace: { Args: { p_society_id: string }; Returns: Json };
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
      data_cleanup_rule_save: {
        Args: {
          p_enabled: boolean;
          p_expected_version: number;
          p_older_than_years: number;
          p_record_kind: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      data_cleanup_rules_get: { Args: { p_society_id: string }; Returns: Json };
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
      developer_feature_request_status_set: {
        Args: { p_request_id: string; p_status: string };
        Returns: undefined;
      };
      developer_feature_requests_get: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          id: string;
          module_key: string;
          note: string;
          requested_by: string;
          society_id: string;
          society_name: string;
          status: string;
        }[];
      };
      developer_health_summary: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      developer_onboarding_record_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      developer_onboarding_record_save: {
        Args: {
          p_agreed_modules: string[];
          p_contact_email: string;
          p_contact_name: string;
          p_contact_phone: string;
          p_go_live_on: string;
          p_notes: string;
          p_society_id: string;
          p_stage: string;
        };
        Returns: undefined;
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
          hindi_available: boolean;
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
          hindi_available: boolean;
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
          hindi_available: boolean;
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
          hindi_available: boolean;
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
      developer_website_enquiries_get: {
        Args: Record<PropertyKey, never>;
        Returns: {
          city: string;
          email: string;
          flat_count: number;
          full_name: string;
          handled_at: string;
          id: string;
          message: string;
          phone: string;
          society_name: string;
          status: string;
          submitted_at: string;
        }[];
      };
      developer_website_enquiry_delete: {
        Args: { p_enquiry_id: string };
        Returns: undefined;
      };
      developer_website_enquiry_handle: {
        Args: { p_enquiry_id: string };
        Returns: undefined;
      };
      developer_website_settings_get: {
        Args: Record<PropertyKey, never>;
        Returns: {
          contact_email: string;
          enquiry_hourly_limit: number;
          updated_at: string;
          updated_by: string;
        }[];
      };
      developer_website_settings_save: {
        Args: { p_contact_email: string; p_enquiry_hourly_limit: number };
        Returns: undefined;
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
      document_expiry_reminders_run: {
        Args: { p_request_trace: string; p_society_id: string };
        Returns: number;
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
      document_governance_get: {
        Args: { p_record_id: string; p_society_id: string };
        Returns: Json;
      };
      document_governance_history: {
        Args: {
          p_limit: number;
          p_offset: number;
          p_record_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_governance_list: {
        Args: {
          p_include_archived: boolean;
          p_kind: string;
          p_limit: number;
          p_offset: number;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_governance_save: {
        Args: {
          p_approving_resolution_id: string;
          p_client_request_id: string;
          p_details: Json;
          p_document_version_id: string;
          p_expected_version: number;
          p_kind: string;
          p_reason: string;
          p_record_id: string;
          p_request_id: string;
          p_resolution_id: string;
          p_society_id: string;
          p_state: string;
          p_tenancy_document_id: string;
          p_title: string;
        };
        Returns: Json;
      };
      document_governance_set_archived: {
        Args: {
          p_archived: boolean;
          p_expected_version: number;
          p_reason: string;
          p_record_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_governance_sources_list: {
        Args: {
          p_kind: string;
          p_limit: number;
          p_offset: number;
          p_society_id: string;
          p_source_type: string;
        };
        Returns: Json;
      };
      document_house_rule_publish: {
        Args: {
          p_expected_version: number;
          p_record_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_house_rules_published_list: {
        Args: { p_society_id: string };
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
      document_official_case_cleanup_candidates: {
        Args: { p_society_id: string; p_today: string };
        Returns: Json;
      };
      document_official_case_cleanup_finalize: {
        Args: {
          p_case_ids: string[];
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      document_official_case_evidence_link: {
        Args: {
          p_case_id: string;
          p_request_id: string;
          p_society_id: string;
          p_version_id: string;
        };
        Returns: string;
      };
      document_official_case_reminders_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      document_official_case_reminders_save: {
        Args: {
          p_enabled: boolean;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      document_official_case_save: {
        Args: {
          p_authority: string;
          p_client_request_id: string;
          p_closed_on: string;
          p_compliance_entry_id: string;
          p_expected_version: number;
          p_filed_on: string;
          p_filing_acknowledgement: string;
          p_filing_mode: string;
          p_hearing_on: string;
          p_id: string;
          p_note: string;
          p_reason: string;
          p_received_on: string;
          p_reference: string;
          p_relevant_period: string;
          p_reply_due_on: string;
          p_request_id: string;
          p_response_on: string;
          p_reviewer_membership_id: string;
          p_society_id: string;
          p_status: string;
          p_subject: string;
        };
        Returns: string;
      };
      document_official_case_workspace: {
        Args: { p_society_id: string };
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
      document_settings_update: {
        Args: {
          p_expiry_reminders_enabled: boolean;
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
      event_admin_get: {
        Args: { p_event_id: string; p_society_id: string };
        Returns: Json;
      };
      event_admin_list: {
        Args: {
          p_filter: string;
          p_limit: number;
          p_offset: number;
          p_society_id: string;
        };
        Returns: Json;
      };
      event_block_options: { Args: { p_society_id: string }; Returns: Json };
      event_cancel: {
        Args: {
          p_event_id: string;
          p_expected_version: number;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      event_create: {
        Args: {
          p_client_request_id: string;
          p_event: Json;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      event_draft_delete: {
        Args: {
          p_event_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      event_member_get: {
        Args: { p_event_id: string; p_society_id: string };
        Returns: Json;
      };
      event_member_list: {
        Args: { p_filter: string; p_society_id: string };
        Returns: Json;
      };
      event_publish: {
        Args: {
          p_event_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      event_reminders_run: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      event_rsvp_set: {
        Args: {
          p_event_id: string;
          p_expected_version: number;
          p_headcount: number;
          p_request_id: string;
          p_society_id: string;
          p_status: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      event_update: {
        Args: {
          p_event: Json;
          p_event_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
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
      expense_agm_draft: {
        Args: { p_financial_year_start: string; p_society_id: string };
        Returns: Json;
      };
      expense_agm_draft_save: {
        Args: {
          p_client_request_id: string;
          p_draft_id: string;
          p_expected_version: number;
          p_financial_year_start: string;
          p_request_trace: string;
          p_society_id: string;
          p_written_sections: Json;
        };
        Returns: string;
      };
      expense_agm_settings_save: {
        Args: {
          p_expected_updated_at: string;
          p_request_trace: string;
          p_sections: Json;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_audit_get: {
        Args: { p_financial_year_start: string; p_society_id: string };
        Returns: Json;
      };
      expense_audit_objection_save: {
        Args: {
          p_audit_year_id: string;
          p_client_request_id: string;
          p_corrected_on: string;
          p_correction_note: string;
          p_description: string;
          p_due_date: string;
          p_evidence_document_id: string;
          p_expected_version: number;
          p_objection_id: string;
          p_owner_user_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_audit_query_save: {
        Args: {
          p_area: string;
          p_assignee_user_id: string;
          p_audit_year_id: string;
          p_client_request_id: string;
          p_due_date: string;
          p_expected_version: number;
          p_query_date: string;
          p_query_id: string;
          p_query_number: number;
          p_question: string;
          p_request_trace: string;
          p_response: string;
          p_response_date: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_audit_warning_acknowledge: {
        Args: {
          p_acknowledged: boolean;
          p_client_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_audit_year_save: {
        Args: {
          p_appointed_on: string;
          p_appointment_document_id: string;
          p_appointment_reference: string;
          p_auditor_firm: string;
          p_auditor_name: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_filed_on: string;
          p_financial_year_start: string;
          p_opinion: string;
          p_opinion_text: string;
          p_placed_before_agm_on: string;
          p_report_received_on: string;
          p_request_trace: string;
          p_society_id: string;
          p_year_id: string;
        };
        Returns: string;
      };
      expense_billing_collection_suggestions: {
        Args: { p_limit: number; p_society_id: string };
        Returns: Json;
      };
      expense_billing_estimate_breakdown: {
        Args: { p_lines: Json; p_months: number; p_society_id: string };
        Returns: Json;
      };
      expense_budget_approve: {
        Args: {
          p_approval_document_id: string;
          p_approval_meeting_id: string;
          p_approval_note: string;
          p_approved_body: string;
          p_approved_on: string;
          p_budget_id: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_budget_change_record: {
        Args: {
          p_amount_paise: number;
          p_approval_document_id: string;
          p_approval_meeting_id: string;
          p_approval_note: string;
          p_approved_body: string;
          p_approved_on: string;
          p_budget_id: string;
          p_category_id: string;
          p_change_kind: string;
          p_client_request_id: string;
          p_effective_month: number;
          p_expected_version: number;
          p_income_type: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
          p_to_category_id: string;
          p_to_income_type: string;
        };
        Returns: string;
      };
      expense_budget_change_void: {
        Args: {
          p_change_id: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_budget_copy_preview: {
        Args: {
          p_financial_year: number;
          p_percent_bp: number;
          p_society_id: string;
        };
        Returns: Json;
      };
      expense_budget_discard: {
        Args: {
          p_budget_id: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_budget_get: {
        Args: { p_financial_year: number; p_society_id: string };
        Returns: Json;
      };
      expense_budget_report: {
        Args: {
          p_as_of: string;
          p_financial_year: number;
          p_society_id: string;
        };
        Returns: Json;
      };
      expense_budget_resident_summary: {
        Args: { p_financial_year: number; p_society_id: string };
        Returns: Json;
      };
      expense_budget_save_draft: {
        Args: {
          p_client_request_id: string;
          p_copy_percent_bp: number;
          p_copy_source_year: number;
          p_expected_version: number;
          p_financial_year: number;
          p_lines: Json;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_budget_settings_update: {
        Args: {
          p_expected_updated_at: string;
          p_forecast_method: string;
          p_request_trace: string;
          p_resident_summary: boolean;
          p_society_id: string;
          p_watch_percent: number;
        };
        Returns: Json;
      };
      expense_cash_count_record: {
        Args: {
          p_client_request_id: string;
          p_count_date: string;
          p_counted_paise: number;
          p_note: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_category_details_save: {
        Args: {
          p_category_id: string;
          p_client_request_id: string;
          p_cost_nature: string;
          p_detail_description: string;
          p_detail_group: string;
          p_expected_version: number;
          p_owner_user_id: string;
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
      expense_financial_position: {
        Args: { p_as_of: string; p_society_id: string };
        Returns: Json;
      };
      expense_fixed_deposit_save: {
        Args: {
          p_account_id: string;
          p_bank_name: string;
          p_deposit_id: string;
          p_deposit_on: string;
          p_expected_updated_at: string;
          p_fund_id: string;
          p_maturity_on: string;
          p_maturity_value_paise: number;
          p_predecessor_id: string;
          p_principal_paise: number;
          p_quoted_rate: number;
          p_reference: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_fixed_deposits_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      expense_fund_allocation_correct: {
        Args: {
          p_allocations: Json;
          p_client_request_id: string;
          p_entry_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_fund_allocations_confirm: {
        Args: {
          p_client_request_id: string;
          p_items: Json;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      expense_fund_billing_mappings_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      expense_fund_corpus_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      expense_fund_corpus_save: {
        Args: {
          p_concession_paise: number;
          p_concession_reason: string;
          p_decision_reference: string;
          p_event_description: string;
          p_event_on: string;
          p_expected_updated_at: string;
          p_fund_id: string;
          p_record_id: string;
          p_reported_amount_paise: number;
          p_request_trace: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      expense_fund_interest_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      expense_fund_interest_save: {
        Args: {
          p_actual_credit_paise: number;
          p_average_balance_paise: number;
          p_expected_updated_at: string;
          p_fixed_deposit_id: string;
          p_fund_id: string;
          p_gross_interest_paise: number;
          p_income_entry_id: string;
          p_note: string;
          p_period_from: string;
          p_period_to: string;
          p_record_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_source_label: string;
          p_tax_withheld_paise: number;
        };
        Returns: string;
      };
      expense_fund_mapping_save: {
        Args: {
          p_expected_updated_at: string;
          p_fund_id: string;
          p_income_kind: string;
          p_request_trace: string;
          p_society_id: string;
          p_source_id: string;
          p_source_kind: string;
        };
        Returns: string;
      };
      expense_fund_opening_correct: {
        Args: {
          p_allocations: Json;
          p_client_request_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_fund_receipt_link: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_corpus_record_id: string;
          p_entry_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_fund_reconciliation: {
        Args: { p_month: string; p_society_id: string };
        Returns: Json;
      };
      expense_fund_reconciliation_export_record: {
        Args: {
          p_month: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      expense_fund_report: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      expense_fund_save: {
        Args: {
          p_active: boolean;
          p_expected_updated_at: string;
          p_fund_id: string;
          p_name: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_fund_target_save: {
        Args: {
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_fund_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_target_date: string;
          p_target_paise: number;
        };
        Returns: string;
      };
      expense_fund_transfer_record: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_decision_reference: string;
          p_from_fund_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
          p_to_fund_id: string;
          p_transfer_on: string;
        };
        Returns: string;
      };
      expense_fund_transfer_reverse: {
        Args: {
          p_client_request_id: string;
          p_reason: string;
          p_request_trace: string;
          p_reverse_on: string;
          p_society_id: string;
          p_transfer_id: string;
        };
        Returns: string;
      };
      expense_fund_transfer_rule_save: {
        Args: {
          p_active: boolean;
          p_expected_updated_at: string;
          p_from_fund_id: string;
          p_request_trace: string;
          p_rule_id: string;
          p_society_id: string;
          p_to_fund_id: string;
        };
        Returns: string;
      };
      expense_fund_transfers_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      expense_fund_work_link: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_entry_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_work_id: string;
        };
        Returns: string;
      };
      expense_fund_work_save: {
        Args: {
          p_expected_updated_at: string;
          p_external_reference: string;
          p_fund_id: string;
          p_meeting_resolution_id: string;
          p_request_trace: string;
          p_sanctioned_amount_paise: number;
          p_sanctioned_on: string;
          p_society_id: string;
          p_title: string;
          p_valid_until: string;
          p_work_id: string;
        };
        Returns: string;
      };
      expense_fund_works_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      expense_funds_activate: {
        Args: {
          p_acknowledged: boolean;
          p_allocations: Json;
          p_client_request_id: string;
          p_cutover_on: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_funds_activity: {
        Args: { p_limit: number; p_offset: number; p_society_id: string };
        Returns: Json;
      };
      expense_funds_activity_transfers: {
        Args: { p_limit: number; p_offset: number; p_society_id: string };
        Returns: Json;
      };
      expense_funds_workspace: {
        Args: { p_cutover_on: string; p_society_id: string };
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
      expense_multi_year: { Args: { p_society_id: string }; Returns: Json };
      expense_payee_mapping_remove: {
        Args: {
          p_client_request_id: string;
          p_mapping_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_payee_mapping_save: {
        Args: {
          p_client_request_id: string;
          p_payee: string;
          p_request_trace: string;
          p_society_id: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      expense_petty_cash_assign: {
        Args: {
          p_account_id: string;
          p_client_request_id: string;
          p_custodian_user_id: string;
          p_handover_count_paise: number;
          p_handover_note: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_petty_cash_custodian_check: {
        Args: { p_society_id: string };
        Returns: boolean;
      };
      expense_petty_cash_view: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      expense_reconciliation_page: {
        Args: {
          p_account_id: string;
          p_limit: number;
          p_offset: number;
          p_society_id: string;
        };
        Returns: Json;
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
      expense_repair_forecast_fund_set: {
        Args: {
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_gap_fund_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_repair_forecast_get: {
        Args: { p_include_archived: boolean; p_society_id: string };
        Returns: Json;
      };
      expense_repair_forecast_item_archive: {
        Args: {
          p_archive: boolean;
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_item_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_repair_forecast_item_save: {
        Args: {
          p_category: string;
          p_client_request_id: string;
          p_current_cost_paise: number;
          p_cycle_years: number;
          p_expected_updated_at: string;
          p_inflation_bp: number;
          p_item_id: string;
          p_last_done_year: number;
          p_manual_next_due_year: number;
          p_name: string;
          p_notes: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_report: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      expense_savings_evidence_add: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_entry_id: string;
          p_evidenced_on: string;
          p_file_path: string;
          p_initiative_id: string;
          p_note: string;
          p_request_trace: string;
          p_society_id: string;
          p_vendor_bill_id: string;
          p_vendor_contract_id: string;
        };
        Returns: string;
      };
      expense_savings_evidence_void: {
        Args: {
          p_client_request_id: string;
          p_evidence_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_savings_get: {
        Args: { p_initiative_id: string; p_society_id: string };
        Returns: Json;
      };
      expense_savings_list: { Args: { p_society_id: string }; Returns: Json };
      expense_savings_save: {
        Args: {
          p_baseline_annual_paise: number;
          p_category_id: string;
          p_client_request_id: string;
          p_description: string;
          p_expected_annual_paise: number;
          p_expected_version: number;
          p_initiative_id: string;
          p_kind: string;
          p_owner_user_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_title: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      expense_savings_status_change: {
        Args: {
          p_client_request_id: string;
          p_expected_version: number;
          p_initiative_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
          p_to_status: string;
        };
        Returns: string;
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
      expense_statement_balance_save: {
        Args: {
          p_account_id: string;
          p_client_request_id: string;
          p_closing_paise: number;
          p_expected_updated_at: string;
          p_month: string;
          p_note: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      expense_statement_item_cancel: {
        Args: {
          p_item_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      expense_statement_item_match: {
        Args: {
          p_entry_id: string;
          p_item_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      expense_statement_item_record: {
        Args: {
          p_account_id: string;
          p_amount_paise: number;
          p_client_request_id: string;
          p_direction: string;
          p_party: string;
          p_reference: string;
          p_request_trace: string;
          p_society_id: string;
          p_statement_date: string;
        };
        Returns: string;
      };
      expense_statements: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      expense_transfer_record: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_from_account_id: string;
          p_note: string;
          p_reference: string;
          p_request_trace: string;
          p_society_id: string;
          p_to_account_id: string;
          p_transfer_on: string;
        };
        Returns: string;
      };
      expense_transfer_reverse: {
        Args: {
          p_client_request_id: string;
          p_reason: string;
          p_request_trace: string;
          p_reverse_on: string;
          p_society_id: string;
          p_transfer_pair_id: string;
        };
        Returns: string;
      };
      expense_vendor_spend_report: {
        Args: {
          p_category_id: string;
          p_cost_nature: string;
          p_from: string;
          p_group: string;
          p_society_id: string;
          p_to: string;
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
      letter_generation_logs_get: {
        Args: { p_limit?: number; p_society_id: string };
        Returns: Json;
      };
      letter_generation_record: {
        Args: {
          p_letter_type: string;
          p_request_id: string;
          p_society_id: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: string;
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
      major_works_audit_reminders_run: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      major_works_audit_save: {
        Args: {
          p_audit_id: string;
          p_audit_on: string;
          p_auditor_name: string;
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_findings: string;
          p_next_due_on: string;
          p_project_ids: string[];
          p_rating: string;
          p_repair_status: string;
          p_report_path: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_audit_void: {
        Args: {
          p_audit_id: string;
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_audits_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      major_works_chosen_quote_set: {
        Args: {
          p_expected_updated_at: string;
          p_project_id: string;
          p_quote_id: string;
          p_reason: string;
          p_request_trace: string;
          p_resolution_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_consent_method_set: {
        Args: {
          p_client_request_id: string;
          p_confirmed: boolean;
          p_method: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      major_works_consent_poll_create: {
        Args: {
          p_client_request_id: string;
          p_confirmed: boolean;
          p_proposal_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_consent_record: {
        Args: {
          p_client_request_id: string;
          p_expected_version: number;
          p_proposal_id: string;
          p_request_trace: string;
          p_signed_form_path: string;
          p_society_id: string;
          p_status: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      major_works_consents_get: {
        Args: { p_proposal_id: string; p_society_id: string };
        Returns: Json;
      };
      major_works_criteria_set: {
        Args: {
          p_client_request_id: string;
          p_items: Json;
          p_project_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_milestone_save: {
        Args: {
          p_actual_on: string;
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_milestone_id: string;
          p_note: string;
          p_planned_on: string;
          p_position: number;
          p_proposal_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_status: string;
          p_title: string;
        };
        Returns: string;
      };
      major_works_milestones_list: {
        Args: { p_proposal_id: string; p_society_id: string };
        Returns: Json;
      };
      major_works_my_consents_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      major_works_project_budget_set: {
        Args: {
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_fund_work_id: string;
          p_project_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_source: string;
          p_typed_budget_paise: number;
        };
        Returns: string;
      };
      major_works_project_save: {
        Args: {
          p_actual_end_on: string;
          p_actual_start_on: string;
          p_category: string;
          p_client_request_id: string;
          p_estimate_paise: number;
          p_expected_updated_at: string;
          p_forecast_item_id: string;
          p_location: string;
          p_notes: string;
          p_planned_end_on: string;
          p_planned_start_on: string;
          p_priority: string;
          p_progress_percent: number;
          p_project_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_title: string;
        };
        Returns: string;
      };
      major_works_project_status_set: {
        Args: {
          p_approval_body: string;
          p_approval_date: string;
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_meeting_resolution_id: string;
          p_project_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
          p_status: string;
        };
        Returns: string;
      };
      major_works_projects_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      major_works_proposal_archive: {
        Args: {
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_proposal_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_proposal_file_add: {
        Args: {
          p_client_request_id: string;
          p_content_type: string;
          p_path: string;
          p_proposal_id: string;
          p_request_trace: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_proposal_save: {
        Args: {
          p_bank_guarantee_paise: number;
          p_client_request_id: string;
          p_corpus_paise: number;
          p_decision_due_on: string;
          p_developer_name: string;
          p_expected_updated_at: string;
          p_extra_area_bp: number;
          p_monthly_rent_paise: number;
          p_other_terms: string;
          p_proposal_id: string;
          p_received_on: string;
          p_request_trace: string;
          p_society_id: string;
          p_timeline_months: number;
        };
        Returns: string;
      };
      major_works_proposal_stage_set: {
        Args: {
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_proposal_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
          p_stage: string;
        };
        Returns: string;
      };
      major_works_proposals_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      major_works_quote_add: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_file_path: string;
          p_like_for_like: boolean;
          p_project_id: string;
          p_request_trace: string;
          p_scope_note: string;
          p_society_id: string;
          p_vendor_name: string;
          p_vendor_quote_id: string;
        };
        Returns: string;
      };
      major_works_quote_remove: {
        Args: {
          p_client_request_id: string;
          p_exclude: boolean;
          p_quote_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_resident_projects_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      major_works_retention_files: {
        Args: { p_society_id: string; p_today: string };
        Returns: Json;
      };
      major_works_retention_run: {
        Args: { p_request_id: string; p_society_id: string; p_today: string };
        Returns: Json;
      };
      major_works_scenario_save: {
        Args: {
          p_amount_basis: string;
          p_client_request_id: string;
          p_deduction_paise: number;
          p_deduction_type: string;
          p_expected_updated_at: string;
          p_fund_id: string;
          p_name: string;
          p_project_id: string;
          p_request_trace: string;
          p_scenario_id: string;
          p_society_id: string;
          p_split: string;
          p_typed_amount_paise: number;
        };
        Returns: string;
      };
      major_works_scenarios_list: {
        Args: { p_project_id: string; p_society_id: string };
        Returns: Json;
      };
      major_works_scores_save: {
        Args: {
          p_items: Json;
          p_project_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: number;
      };
      major_works_scoring_get: {
        Args: { p_project_id: string; p_society_id: string };
        Returns: Json;
      };
      major_works_scoring_transition: {
        Args: {
          p_action: string;
          p_expected_updated_at: string;
          p_project_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_spend_tag_remove: {
        Args: {
          p_client_request_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
          p_tag_id: string;
        };
        Returns: string;
      };
      major_works_spend_tag_save: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_entry_id: string;
          p_project_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      major_works_summary_get: {
        Args: { p_society_id: string };
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
      meeting_action_reminders_run: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      meeting_action_save: {
        Args: {
          p_action: Json;
          p_action_id: string;
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_action_status_set: {
        Args: {
          p_action_id: string;
          p_expected_version: number;
          p_note: string;
          p_request_id: string;
          p_society_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      meeting_admin_get: {
        Args: { p_meeting_id: string; p_society_id: string };
        Returns: Json;
      };
      meeting_admin_list: {
        Args: {
          p_limit: number;
          p_offset: number;
          p_society_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      meeting_agenda_durations_get: {
        Args: { p_meeting_id: string; p_society_id: string };
        Returns: Json;
      };
      meeting_agenda_template_archive: {
        Args: {
          p_archived: boolean;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
          p_template_id: string;
        };
        Returns: Json;
      };
      meeting_agenda_template_save: {
        Args: {
          p_client_request_id: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
          p_template: Json;
          p_template_id: string;
        };
        Returns: Json;
      };
      meeting_agenda_templates_get: {
        Args: { p_meeting_type: string; p_society_id: string };
        Returns: Json;
      };
      meeting_attendance_remove: {
        Args: {
          p_attendee_id: string;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_attendance_set: {
        Args: {
          p_attendee_id: string;
          p_meeting_id: string;
          p_mode: string;
          p_proxy_name: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_cancel: {
        Args: {
          p_expected_version: number;
          p_meeting_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_checkin_set: {
        Args: {
          p_meeting_id: string;
          p_open: boolean;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_create: {
        Args: {
          p_client_request_id: string;
          p_meeting: Json;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_draft_delete: {
        Args: {
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_governance_summary: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: Json;
      };
      meeting_invitee_options: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      meeting_mark_held: {
        Args: {
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_member_get: {
        Args: { p_meeting_id: string; p_society_id: string };
        Returns: Json;
      };
      meeting_member_list: { Args: { p_society_id: string }; Returns: Json };
      meeting_minutes_document_link: {
        Args: {
          p_document_id: string;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_minutes_publish: {
        Args: {
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_minutes_save: {
        Args: {
          p_body: string;
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_my_actions: { Args: { p_society_id: string }; Returns: Json };
      meeting_owner_options: {
        Args: { p_limit: number; p_search: string; p_society_id: string };
        Returns: Json;
      };
      meeting_resolution_delete: {
        Args: {
          p_expected_version: number;
          p_request_id: string;
          p_resolution_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_resolution_outcome_set: {
        Args: {
          p_expected_version: number;
          p_outcome: string;
          p_request_id: string;
          p_resolution_id: string;
          p_society_id: string;
          p_votes_abstain: number;
          p_votes_against: number;
          p_votes_for: number;
        };
        Returns: Json;
      };
      meeting_resolution_poll_link: {
        Args: {
          p_expected_version: number;
          p_poll_vote_id: string;
          p_request_id: string;
          p_resolution_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_resolution_save: {
        Args: {
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_resolution: Json;
          p_resolution_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_schedule: {
        Args: {
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      meeting_self_checkin: {
        Args: {
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      meeting_settings_get: { Args: { p_society_id: string }; Returns: Json };
      meeting_settings_update: {
        Args: { p_request_id: string; p_settings: Json; p_society_id: string };
        Returns: Json;
      };
      meeting_update: {
        Args: {
          p_expected_version: number;
          p_meeting: Json;
          p_meeting_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      member_contact_log_save: {
        Args: {
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_log_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_values: Json;
        };
        Returns: Json;
      };
      member_contact_logs_get: {
        Args: { p_society_id: string; p_status?: string };
        Returns: Json;
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
      module_setting_access_list: {
        Args: { p_society_id: string };
        Returns: {
          admin_can_edit: boolean;
          module_key: string;
          setting_key: string;
        }[];
      };
      module_setting_access_set: {
        Args: {
          p_admin_can_edit: boolean;
          p_module_key: string;
          p_setting_key: string;
          p_society_id: string;
        };
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
      notice_draft_publish: {
        Args: {
          p_expected_updated_at: string;
          p_notice_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      notice_draft_save: {
        Args: {
          p_attachment: Json;
          p_audience: string;
          p_block_ids: string[];
          p_body: string;
          p_client_request_id: string;
          p_expected_updated_at: string;
          p_expires_at: string;
          p_notice_id: string;
          p_pinned: boolean;
          p_post_mode: string;
          p_request_trace: string;
          p_scheduled_for: string;
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
      notice_plan_proposal_review: {
        Args: {
          p_accept: boolean;
          p_proposal_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      notice_plan_proposal_save: {
        Args: {
          p_client_request_id: string;
          p_notice_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_values: Json;
        };
        Returns: Json;
      };
      notice_plan_proposals_get: {
        Args: { p_notice_id: string; p_society_id: string };
        Returns: Json;
      };
      notice_plan_save: {
        Args: {
          p_display_location: string;
          p_next_action: string;
          p_next_action_on: string;
          p_notice_id: string;
          p_prepared_by: string;
          p_priority: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      notice_scheduled_publish_run: {
        Args: {
          p_request_trace: string;
          p_society_id: string;
          p_today: string;
        };
        Returns: number;
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
      parking_condition_set: {
        Args: {
          p_condition_status: string;
          p_expected_version: number;
          p_request_id: string;
          p_slot_id: string;
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
      parking_summary: { Args: { p_society_id: string }; Returns: Json };
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
      person_workspace_preferences_get: {
        Args: { p_society_id: string };
        Returns: {
          resident_graph_mode: string;
          starting_place: string;
        }[];
      };
      person_workspace_preferences_save: {
        Args: {
          p_resident_graph_mode?: string;
          p_society_id: string;
          p_starting_place: string;
        };
        Returns: undefined;
      };
      poll_activate: {
        Args: {
          p_expected_revision: number;
          p_society_id: string;
          p_vote_id: string;
        };
        Returns: Json;
      };
      poll_admin_get: {
        Args: { p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_admin_list: { Args: { p_society_id: string }; Returns: Json };
      poll_ballot_submit: {
        Args: {
          p_society_id: string;
          p_submission: Json;
          p_unit_id: string;
          p_vote_id: string;
        };
        Returns: Json;
      };
      poll_cancel: {
        Args: { p_reason: string; p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_complete_early: {
        Args: { p_reason: string; p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_deadline_extend: {
        Args: {
          p_closes_at: string;
          p_reason: string;
          p_society_id: string;
          p_vote_id: string;
        };
        Returns: Json;
      };
      poll_draft_create: {
        Args: {
          p_client_request_id: string;
          p_society_id: string;
          p_voting_type: string;
        };
        Returns: Json;
      };
      poll_draft_delete: {
        Args: {
          p_expected_revision: number;
          p_society_id: string;
          p_vote_id: string;
        };
        Returns: Json;
      };
      poll_draft_save: {
        Args: {
          p_draft: Json;
          p_expected_revision: number;
          p_society_id: string;
          p_vote_id: string;
        };
        Returns: Json;
      };
      poll_election_activities_save: {
        Args: {
          p_activities: Json;
          p_client_request_id: string;
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: number;
      };
      poll_election_ballot_submit: {
        Args: {
          p_choices: Json;
          p_election_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      poll_election_cancel: {
        Args: {
          p_election_id: string;
          p_expected_revision: number;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      poll_election_count: {
        Args: {
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      poll_election_declare: {
        Args: {
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      poll_election_dispute_raise: {
        Args: {
          p_client_request_id: string;
          p_election_id: string;
          p_file_path: string;
          p_request_trace: string;
          p_society_id: string;
          p_text: string;
        };
        Returns: string;
      };
      poll_election_dispute_update: {
        Args: {
          p_dispute_id: string;
          p_request_trace: string;
          p_resolution_note: string;
          p_society_id: string;
          p_status: string;
        };
        Returns: string;
      };
      poll_election_expense_link: {
        Args: {
          p_election_id: string;
          p_expense_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_expense_unlink: {
        Args: {
          p_link_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_external_result: {
        Args: {
          p_client_request_id: string;
          p_document_id: string;
          p_election_id: string;
          p_post_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_votes_count: number;
          p_winner_name: string;
        };
        Returns: string;
      };
      poll_election_external_save: {
        Args: {
          p_client_request_id: string;
          p_held_on: string;
          p_posts: Json;
          p_request_trace: string;
          p_society_id: string;
          p_title: string;
        };
        Returns: string;
      };
      poll_election_get: {
        Args: { p_election_id: string; p_society_id: string };
        Returns: Json;
      };
      poll_election_helpers_save: {
        Args: {
          p_election_id: string;
          p_helpers: Json;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: number;
      };
      poll_election_link_remove: {
        Args: {
          p_link_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_link_source: {
        Args: {
          p_client_request_id: string;
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: string;
      };
      poll_election_list: { Args: { p_society_id: string }; Returns: Json };
      poll_election_nomination_decide: {
        Args: {
          p_accept: boolean;
          p_nomination_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_nomination_submit: {
        Args: {
          p_client_request_id: string;
          p_election_id: string;
          p_post_ids: string[];
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: number;
      };
      poll_election_nomination_withdraw: {
        Args: {
          p_nomination_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_officer_assign: {
        Args: {
          p_client_request_id: string;
          p_election_id: string;
          p_invited_email: string;
          p_profile_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_officer_assignments: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      poll_election_officer_confirm: {
        Args: {
          p_confirmation: string;
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_officer_get: {
        Args: { p_election_id: string; p_society_id: string };
        Returns: Json;
      };
      poll_election_officer_revoke: {
        Args: {
          p_officer_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_post_choose: {
        Args: {
          p_candidate_user_id: string;
          p_chosen_post_id: string;
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_post_decide: {
        Args: {
          p_candidate_user_id: string;
          p_chosen_post_id: string;
          p_election_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_reconcile_due: {
        Args: { p_society_id: string };
        Returns: number;
      };
      poll_election_save: {
        Args: {
          p_client_request_id: string;
          p_election_id: string;
          p_expected_revision: number;
          p_nominations_close_at: string;
          p_nominations_open_at: string;
          p_posts: Json;
          p_request_trace: string;
          p_society_id: string;
          p_title: string;
          p_voting_closes_at: string;
          p_voting_opens_at: string;
        };
        Returns: string;
      };
      poll_election_settings_update: {
        Args: {
          p_dispute_window_days: number;
          p_expected_updated_at: string;
          p_multi_post_win_rule: string;
          p_nomination_supporters_enabled: boolean;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_stage_advance: {
        Args: {
          p_election_id: string;
          p_expected_revision: number;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      poll_election_supporter_respond: {
        Args: {
          p_confirm: boolean;
          p_society_id: string;
          p_supporter_id: string;
        };
        Returns: string;
      };
      poll_election_supporters_add: {
        Args: {
          p_nomination_id: string;
          p_proposer_user_id: string;
          p_request_trace: string;
          p_seconder_user_id: string;
          p_society_id: string;
        };
        Returns: number;
      };
      poll_election_tie_resolve: {
        Args: {
          p_candidate_user_id: string;
          p_election_id: string;
          p_method: string;
          p_post_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_election_voter_remove: {
        Args: {
          p_election_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      poll_election_voter_restore: {
        Args: {
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      poll_election_voter_set: {
        Args: {
          p_election_id: string;
          p_expected_revision: number;
          p_membership_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: number;
      };
      poll_election_voters_init: {
        Args: {
          p_election_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: number;
      };
      poll_election_voting_extend: {
        Args: {
          p_closes_at: string;
          p_election_id: string;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      poll_export_get: {
        Args: { p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_member_get: {
        Args: { p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_member_list: { Args: { p_society_id: string }; Returns: Json };
      poll_official_voting_set: {
        Args: {
          p_client_request_id: string;
          p_confirmation: string;
          p_enabled: boolean;
          p_legal_type: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      poll_participation_get: {
        Args: { p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_reconcile_due: { Args: { p_society_id: string }; Returns: Json };
      poll_representative_set: {
        Args: {
          p_expected_version: number;
          p_membership_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      poll_representatives_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      poll_results_get: {
        Args: { p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_retention_run: { Args: Record<PropertyKey, never>; Returns: Json };
      poll_schedule: {
        Args: {
          p_expected_revision: number;
          p_opens_at: string;
          p_society_id: string;
          p_vote_id: string;
        };
        Returns: Json;
      };
      poll_schedule_withdraw: {
        Args: { p_reason: string; p_society_id: string; p_vote_id: string };
        Returns: Json;
      };
      poll_settings_update: {
        Args: { p_settings: Json; p_society_id: string };
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
          p_vendor_id?: string;
          p_vendor_name: string;
          p_vendor_phone: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_category_targets_list: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      request_category_targets_save: {
        Args: {
          p_category_id: string;
          p_critical: number;
          p_high: number;
          p_low: number;
          p_medium: number;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      request_confirm_close: {
        Args: {
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_create_for_unit: {
        Args: {
          p_attachments: Json;
          p_category_id: string;
          p_client_request_id: string;
          p_description: string;
          p_intake_source: string;
          p_location_type: string;
          p_priority: string;
          p_request_id: string;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_escalation_respond: {
        Args: {
          p_level: string;
          p_note: string;
          p_request_id: string;
          p_request_trace: string;
          p_response_status: string;
          p_society_id: string;
        };
        Returns: Json;
      };
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
          p_committee_wait_mode?: string;
          p_committee_waits?: Json;
          p_delivery: string;
          p_expected_updated_at: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      request_feedback_follow_up_set: {
        Args: {
          p_follow_up: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_get: {
        Args: { p_request_id: string; p_society_id: string };
        Returns: Json;
      };
      request_hold: {
        Args: {
          p_reason: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_inspection_point_save: {
        Args: {
          p_active: boolean;
          p_location_note: string;
          p_name: string;
          p_point_id: string;
          p_request_id: string;
          p_society_id: string;
          p_sort_order: number;
        };
        Returns: Json;
      };
      request_intake_options: { Args: { p_society_id: string }; Returns: Json };
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
      request_priority_change: {
        Args: {
          p_priority: string;
          p_reason: string;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_rate: {
        Args: {
          p_behaviour?: number;
          p_comment: string;
          p_quality?: number;
          p_rating: number;
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_speed?: number;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_release: {
        Args: {
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      request_report: { Args: { p_society_id: string }; Returns: Json };
      request_round_check_record: {
        Args: {
          p_action: string;
          p_category_id: string;
          p_client_request_id: string;
          p_link_request_id: string;
          p_note: string;
          p_point_id: string;
          p_priority: string;
          p_request_trace: string;
          p_result: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      request_rounds_report: {
        Args: { p_days?: number; p_society_id: string };
        Returns: Json;
      };
      request_rounds_today: { Args: { p_society_id: string }; Returns: Json };
      request_update_status: {
        Args: {
          p_request_id: string;
          p_request_trace: string;
          p_society_id: string;
          p_status: string;
        };
        Returns: {
          assigned_membership_id: string | null;
          assigned_vendor_id: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          category_id: string;
          client_request_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          feedback_follow_up: string | null;
          held_seconds: number;
          id: string;
          intake_source: string;
          location_type: string;
          on_hold_reason: string | null;
          on_hold_since: string | null;
          priority: string;
          rating: number | null;
          rating_behaviour: number | null;
          rating_comment: string | null;
          rating_quality: number | null;
          rating_speed: number | null;
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
      resident_dashboard_graph_get: {
        Args: { p_mode: string; p_society_id: string };
        Returns: {
          amount: number;
          has_data: boolean;
          month_start: string;
        }[];
      };
      resident_flat_options_get: {
        Args: { p_society_id: string };
        Returns: {
          all_flats: boolean;
          label: string;
          selected: boolean;
          unit_id: string;
        }[];
      };
      resident_flat_selection_save: {
        Args: { p_all_flats: boolean; p_society_id: string; p_unit_id: string };
        Returns: undefined;
      };
      resident_home_get: { Args: { p_society_id: string }; Returns: Json };
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
      society_capability_adoption_save: {
        Args: {
          p_expected_version: number;
          p_module_key: string;
          p_notes: string;
          p_owner_membership_id: string;
          p_priority: string;
          p_request_id: string;
          p_review_on: string;
          p_society_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      society_capability_adoptions_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      society_feature_request_create: {
        Args: { p_module_key: string; p_note: string; p_society_id: string };
        Returns: string;
      };
      society_feature_requests_get: {
        Args: { p_society_id: string };
        Returns: {
          created_at: string;
          id: string;
          module_key: string;
          note: string;
          status: string;
        }[];
      };
      society_getting_started_dismiss: {
        Args: { p_dismissed: boolean; p_society_id: string };
        Returns: undefined;
      };
      society_getting_started_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      society_host_lookup: {
        Args: { p_slug: string };
        Returns: {
          id: string;
          name: string;
          status: string;
        }[];
      };
      society_managing_body_name_get: {
        Args: { p_society_id: string };
        Returns: string;
      };
      society_managing_body_name_save: {
        Args: { p_name: string; p_society_id: string };
        Returns: undefined;
      };
      society_reference_profile_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      society_reference_profile_save: {
        Args: {
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
          p_values: Json;
        };
        Returns: Json;
      };
      society_residents_joined_percent_set: {
        Args: { p_percent: number; p_society_id: string };
        Returns: undefined;
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
          p_department?: string;
          p_designation?: string;
          p_employment_status?: string;
          p_employment_type?: string;
          p_exit_date?: string;
          p_full_name: string;
          p_id_last_four: string;
          p_id_type: string;
          p_job_role: string;
          p_joining_date?: string;
          p_phone: string;
          p_photo_path: string;
          p_police_verified: boolean;
          p_request_id: string;
          p_society_id: string;
          p_staff_id: string;
          p_staff_type: string;
          p_status: string;
          p_unit_ids: string[];
          p_weekly_off?: string;
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
      staff_note_delete: {
        Args: { p_note_id: string; p_request_id: string; p_society_id: string };
        Returns: undefined;
      };
      staff_note_list: {
        Args: { p_society_id: string; p_staff_id: string };
        Returns: Json;
      };
      staff_note_save: {
        Args: {
          p_action: string;
          p_category: string;
          p_expected_updated_at: string;
          p_follow_up_date: string;
          p_note: string;
          p_note_date: string;
          p_note_id: string;
          p_rating: number;
          p_request_id: string;
          p_society_id: string;
          p_staff_id: string;
          p_status: string;
        };
        Returns: string;
      };
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
      tenancy_agreement_metadata_save: {
        Args: {
          p_agreement_expires_on: string;
          p_agreement_starts_on: string;
          p_agreement_type: string;
          p_expected_version: number;
          p_move_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_certificate_attest: {
        Args: {
          p_byte_hash: string;
          p_case_id: string;
          p_issuer_id: string;
          p_move_id: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_certificate_issue: {
        Args: {
          p_case_id: string;
          p_expected_version: number;
          p_move_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_certificate_prepare: {
        Args: {
          p_case_id: string;
          p_client_request_id: string;
          p_move_id: string;
          p_purpose: string;
          p_request_id: string;
          p_signatory_designation: string;
          p_society_id: string;
        };
        Returns: Json;
      };
      tenancy_certificate_supersede: {
        Args: {
          p_certificate_id: string;
          p_reason: string;
          p_replacement_certificate_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_certificates_page: {
        Args: { p_limit?: number; p_offset?: number; p_society_id: string };
        Returns: Json;
      };
      tenancy_clearance_acknowledge: {
        Args: {
          p_client_request_id: string;
          p_request_id: string;
          p_society_id: string;
          p_warning_text: string;
        };
        Returns: string;
      };
      tenancy_clearance_acknowledgement_get: {
        Args: { p_society_id: string };
        Returns: Json;
      };
      tenancy_clearance_dues_check: {
        Args: { p_case_id?: string; p_move_id?: string; p_society_id: string };
        Returns: Json;
      };
      tenancy_clearance_file_attach: {
        Args: {
          p_covered_membership_id: string;
          p_covered_party_id: string;
          p_expected_version: number;
          p_handover_id: string;
          p_path: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_clearance_file_upload_path: {
        Args: {
          p_content_type: string;
          p_covered_membership_id: string;
          p_covered_party_id: string;
          p_handover_id: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_clearance_handover_approve: {
        Args: {
          p_approval_reference: string;
          p_expected_version: number;
          p_handover_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      tenancy_clearance_handover_consent: {
        Args: {
          p_expected_version: number;
          p_handover_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_clearance_handover_draft: {
        Args: {
          p_admin_note: string;
          p_case_id: string;
          p_client_request_id: string;
          p_move_id: string;
          p_request_id: string;
          p_responsible_membership_id: string;
          p_responsible_party_id: string;
          p_responsible_role: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_clearance_handover_get: {
        Args: { p_handover_id: string; p_society_id: string };
        Returns: Json;
      };
      tenancy_clearance_handovers_page: {
        Args: {
          p_case_id?: string;
          p_limit?: number;
          p_move_id?: string;
          p_offset?: number;
          p_society_id: string;
        };
        Returns: Json;
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
      tenancy_move_complete:
        | {
            Args: {
              p_expected_version: number;
              p_move_id: string;
              p_request_id: string;
              p_society_id: string;
            };
            Returns: string;
          }
        | {
            Args: {
              p_expected_version: number;
              p_move_id: string;
              p_override_open_handover: boolean;
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
      tenancy_move_progress_get: {
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
      tenancy_settings_update:
        | {
            Args: {
              p_clearance_agreement_evidence: string;
              p_clearance_handover_basis: string;
              p_police_verification_required: boolean;
              p_request_id: string;
              p_society_id: string;
            };
            Returns: undefined;
          }
        | {
            Args: {
              p_clearance_agreement_evidence: string;
              p_clearance_handover_basis: string;
              p_police_verification_required: boolean;
              p_request_id: string;
              p_society_id: string;
              p_verification_tracking_enabled: boolean;
            };
            Returns: undefined;
          }
        | {
            Args: {
              p_police_verification_required: boolean;
              p_request_id: string;
              p_society_id: string;
            };
            Returns: undefined;
          };
      tenancy_transfer_case_advance:
        | {
            Args: {
              p_case_id: string;
              p_expected_version: number;
              p_next_stage: string;
              p_reason: string;
              p_request_id: string;
              p_society_id: string;
            };
            Returns: string;
          }
        | {
            Args: {
              p_case_id: string;
              p_expected_version: number;
              p_next_stage: string;
              p_override_open_handover: boolean;
              p_reason: string;
              p_request_id: string;
              p_society_id: string;
            };
            Returns: string;
          };
      tenancy_transfer_case_get: {
        Args: { p_case_id: string; p_society_id: string };
        Returns: Json;
      };
      tenancy_transfer_case_save: {
        Args: {
          p_buyer: Json;
          p_case_id: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_received_on: string;
          p_request_id: string;
          p_sellers: Json;
          p_society_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      tenancy_transfer_cases_page: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_society_id: string;
          p_stage?: string;
        };
        Returns: Json;
      };
      tenancy_transfer_decision_record: {
        Args: {
          p_case_id: string;
          p_client_request_id: string;
          p_conditions: Json;
          p_decision: string;
          p_expected_version: number;
          p_meeting_id: string;
          p_request_id: string;
          p_resolution_date: string;
          p_resolution_reference: string;
          p_society_id: string;
        };
        Returns: string;
      };
      tenancy_verification_save: {
        Args: {
          p_expected_version: number;
          p_move_id: string;
          p_request_id: string;
          p_society_id: string;
          p_verification_checked_on: string;
          p_verification_reference: string;
          p_verification_status: string;
        };
        Returns: undefined;
      };
      tenancy_verification_settings_update: {
        Args: {
          p_request_id: string;
          p_society_id: string;
          p_verification_tracking_enabled: boolean;
        };
        Returns: undefined;
      };
      tenancy_workspace_get: {
        Args: { p_include_targets?: boolean; p_society_id: string };
        Returns: Json;
      };
      unit_handover_acknowledge: {
        Args: {
          p_handover_id: string;
          p_note: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      unit_handover_close: {
        Args: {
          p_expected_version: number;
          p_handover_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      unit_handover_create: {
        Args: {
          p_client_request_id: string;
          p_event_type: string;
          p_handover_on: string;
          p_move_id: string;
          p_note: string;
          p_party_membership_ids: string[];
          p_request_trace: string;
          p_society_id: string;
          p_transfer_case_id: string;
          p_unit_id: string;
        };
        Returns: string;
      };
      unit_handover_file_access: {
        Args: { p_path: string; p_society_id: string };
        Returns: boolean;
      };
      unit_handover_items_save: {
        Args: {
          p_expected_version: number;
          p_handover_id: string;
          p_items: Json;
          p_reason: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      unit_handover_photo_add: {
        Args: {
          p_client_request_id: string;
          p_content_type: string;
          p_handover_id: string;
          p_path: string;
          p_request_trace: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      unit_handover_photo_upload_path: {
        Args: {
          p_content_type: string;
          p_handover_id: string;
          p_size_bytes: number;
          p_society_id: string;
        };
        Returns: string;
      };
      unit_handover_reading_link: {
        Args: {
          p_client_request_id: string;
          p_handover_id: string;
          p_reading_id: string;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      unit_handover_template_save: {
        Args: {
          p_client_request_id: string;
          p_expected_version: number;
          p_items: Json;
          p_request_trace: string;
          p_society_id: string;
        };
        Returns: string;
      };
      unit_handover_workspace: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: Json;
      };
      unit_records_get: {
        Args: { p_society_id: string; p_unit_id: string };
        Returns: Json;
      };
      unit_records_save: {
        Args: {
          p_client_request_id: string;
          p_kind: string;
          p_request_trace: string;
          p_society_id: string;
          p_unit_id: string;
          p_values: Json;
        };
        Returns: boolean;
      };
      unit_vacancy_retention_run: {
        Args: { p_request_trace: string; p_today: string };
        Returns: number;
      };
      user_erasure_complete: {
        Args: { p_actor_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      user_erasure_prepare: {
        Args: { p_actor_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      vendor_bill_cancel: {
        Args: {
          p_bill_id: string;
          p_expected_version: number;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_bill_payment_link: {
        Args: {
          p_amount_paise: number;
          p_bill_id: string;
          p_client_request_id: string;
          p_entry_id: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: string;
      };
      vendor_bill_payment_unlink: {
        Args: {
          p_payment_id: string;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
        };
        Returns: undefined;
      };
      vendor_bill_save: {
        Args: {
          p_amount_paise: number;
          p_bill_id: string;
          p_client_request_id: string;
          p_expected_version: number;
          p_invoice_date: string;
          p_invoice_number: string;
          p_request_id: string;
          p_society_id: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      vendor_bills_get: {
        Args: { p_society_id: string; p_vendor_id?: string };
        Returns: Json;
      };
      vendor_contract_reminders_run: {
        Args: { p_request_trace: string; p_society_id: string };
        Returns: number;
      };
      vendor_contract_renew: {
        Args: {
          p_annual_value_paise: number;
          p_auto_renew: boolean;
          p_client_request_id: string;
          p_deduction_per_day_paise: number;
          p_default_sanctioned_days: number;
          p_document_path: string;
          p_end_date: string;
          p_notice_days: number;
          p_payment_frequency: string;
          p_predecessor_id: string;
          p_request_id: string;
          p_scope: string;
          p_society_id: string;
          p_start_date: string;
        };
        Returns: string;
      };
      vendor_contract_save: {
        Args: {
          p_annual_value_paise: number;
          p_auto_renew: boolean;
          p_client_request_id: string;
          p_contract_id: string;
          p_deduction_per_day_paise: number;
          p_default_sanctioned_days: number;
          p_document_path: string;
          p_end_date: string;
          p_expected_version: number;
          p_notice_days: number;
          p_payment_frequency: string;
          p_request_id: string;
          p_scope: string;
          p_society_id: string;
          p_start_date: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      vendor_contract_terminate: {
        Args: {
          p_contract_id: string;
          p_expected_version: number;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
          p_terminated_on: string;
        };
        Returns: undefined;
      };
      vendor_contracts_get: {
        Args: { p_society_id: string; p_vendor_id?: string };
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
      vendor_save:
        | {
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
          }
        | {
            Args: {
              p_category: string;
              p_client_request_id: string;
              p_contact_person: string;
              p_email: string;
              p_expected_version: number;
              p_gstin: string;
              p_name: string;
              p_notes: string;
              p_onboarded_date: string;
              p_pan: string;
              p_payment_terms_days: number;
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
      vendor_set_blacklisted: {
        Args: {
          p_blacklisted: boolean;
          p_expected_version: number;
          p_reason: string;
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
      vendor_staff_day_check_save: {
        Args: {
          p_actual_days: number;
          p_bill_raised_paise: number;
          p_check_id: string;
          p_client_request_id: string;
          p_contract_id: string;
          p_contracted_amount_paise: number;
          p_edit_reason: string;
          p_expected_version: number;
          p_manual_deduction_paise: number;
          p_manual_deduction_reason: string;
          p_month: string;
          p_rate_paise: number;
          p_request_id: string;
          p_sanctioned_days: number;
          p_society_id: string;
        };
        Returns: string;
      };
      vendor_staff_day_checks_get: {
        Args: { p_society_id: string; p_vendor_id?: string };
        Returns: Json;
      };
      vendor_summary_get: {
        Args: { p_society_id: string; p_vendor_id?: string };
        Returns: Json;
      };
      vendor_work_order_create: {
        Args: {
          p_client_request_id: string;
          p_description: string;
          p_due_on: string;
          p_issued_on: string;
          p_purchase_request_id: string;
          p_request_id: string;
          p_society_id: string;
          p_value_paise: number;
        };
        Returns: string;
      };
      vendor_work_order_set_status: {
        Args: {
          p_completed_on: string;
          p_expected_version: number;
          p_reason: string;
          p_request_id: string;
          p_society_id: string;
          p_status: string;
          p_work_order_id: string;
        };
        Returns: undefined;
      };
      vendor_work_order_update: {
        Args: {
          p_description: string;
          p_due_on: string;
          p_expected_version: number;
          p_request_id: string;
          p_society_id: string;
          p_work_order_id: string;
        };
        Returns: undefined;
      };
      vendor_work_orders_get: {
        Args: { p_society_id: string; p_vendor_id?: string };
        Returns: Json;
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
      website_enquiry_create: {
        Args: {
          p_city: string;
          p_email: string;
          p_flat_count: number;
          p_full_name: string;
          p_message: string;
          p_phone: string;
          p_request_id: string;
          p_society_name: string;
        };
        Returns: string;
      };
      website_public_settings_get: {
        Args: Record<PropertyKey, never>;
        Returns: {
          contact_email: string;
          enquiry_hourly_limit: number;
        }[];
      };
      workspace_calendar_get: {
        Args: { p_from: string; p_society_id: string; p_to: string };
        Returns: {
          href: string;
          item_id: string;
          occurs_at: string;
          source: string;
          title: string;
        }[];
      };
      workspace_coming_up_get: {
        Args: { p_society_id: string };
        Returns: {
          href: string;
          item_id: string;
          occurs_at: string;
          source: string;
          title: string;
        }[];
      };
      workspace_quick_action_defaults_get: {
        Args: { p_role: string; p_society_id: string };
        Returns: string[];
      };
      workspace_quick_action_defaults_reset: {
        Args: { p_role: string; p_society_id: string };
        Returns: undefined;
      };
      workspace_quick_action_defaults_save: {
        Args: { p_action_keys: string[]; p_role: string; p_society_id: string };
        Returns: undefined;
      };
      workspace_quick_action_pins_get: {
        Args: { p_society_id: string };
        Returns: string[];
      };
      workspace_quick_action_pins_reset: {
        Args: { p_society_id: string };
        Returns: undefined;
      };
      workspace_quick_action_pins_save: {
        Args: { p_action_keys: string[]; p_society_id: string };
        Returns: string[];
      };
      workspace_search_records: {
        Args: { p_query: string; p_society_id: string };
        Returns: {
          href: string;
          kind: string;
          record_id: string;
          subtitle: string;
          title: string;
        }[];
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
