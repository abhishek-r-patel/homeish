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
      job_run_keys: {
        Row: {
          job_name: string;
          period_key: string;
          ran_at: string;
          society_id: string;
        };
        ComputedFields: never;
        Insert: {
          job_name: string;
          period_key: string;
          ran_at?: string;
          society_id: string;
        };
        Update: {
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: {
          allowed: boolean;
          count: number;
          retry_after_seconds: number;
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
