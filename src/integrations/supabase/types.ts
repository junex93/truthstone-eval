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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          input_evidence_ids: string[]
          model: string | null
          model_version: string | null
          organization_id: string
          output_raw: Json | null
          provider: string | null
          purpose: string
          started_at: string | null
          status: Database["public"]["Enums"]["ai_run_status"]
          system_prompt_version: string | null
          task_prompt_version: string | null
          valuation_case_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          input_evidence_ids?: string[]
          model?: string | null
          model_version?: string | null
          organization_id: string
          output_raw?: Json | null
          provider?: string | null
          purpose: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_run_status"]
          system_prompt_version?: string | null
          task_prompt_version?: string | null
          valuation_case_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          input_evidence_ids?: string[]
          model?: string | null
          model_version?: string | null
          organization_id?: string
          output_raw?: Json | null
          provider?: string | null
          purpose?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_run_status"]
          system_prompt_version?: string | null
          task_prompt_version?: string | null
          valuation_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_case_org_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "ai_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_valuation_case_id_fkey"
            columns: ["valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          valuation_case_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          valuation_case_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          valuation_case_id?: string | null
        }
        Relationships: []
      }
      comparable_candidates: {
        Row: {
          candidate_status: Database["public"]["Enums"]["comparable_candidate_status"]
          created_at: string
          created_by: string
          exclusion_notes: string | null
          exclusion_reason_code: string | null
          id: string
          inclusion_reason: string | null
          inclusion_status: Database["public"]["Enums"]["comparable_inclusion_status"]
          market_observation_id: string
          market_property_id: string
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          subject_property_id: string
          updated_at: string
          valuation_case_id: string
        }
        Insert: {
          candidate_status?: Database["public"]["Enums"]["comparable_candidate_status"]
          created_at?: string
          created_by: string
          exclusion_notes?: string | null
          exclusion_reason_code?: string | null
          id?: string
          inclusion_reason?: string | null
          inclusion_status?: Database["public"]["Enums"]["comparable_inclusion_status"]
          market_observation_id: string
          market_property_id: string
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject_property_id: string
          updated_at?: string
          valuation_case_id: string
        }
        Update: {
          candidate_status?: Database["public"]["Enums"]["comparable_candidate_status"]
          created_at?: string
          created_by?: string
          exclusion_notes?: string | null
          exclusion_reason_code?: string | null
          id?: string
          inclusion_reason?: string | null
          inclusion_status?: Database["public"]["Enums"]["comparable_inclusion_status"]
          market_observation_id?: string
          market_property_id?: string
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject_property_id?: string
          updated_at?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "comp_market_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_property_id",
            ]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "comp_observation_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_observation_id",
            ]
            isOneToOne: false
            referencedRelation: "market_observations"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "comp_subject_fk"
            columns: ["organization_id", "subject_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "comparable_candidates_exclusion_reason_code_fkey"
            columns: ["exclusion_reason_code"]
            isOneToOne: false
            referencedRelation: "comparable_exclusion_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "comparable_candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comparable_decision_history: {
        Row: {
          actor_user_id: string | null
          candidate_id: string
          created_at: string
          id: string
          new_candidate_status:
            | Database["public"]["Enums"]["comparable_candidate_status"]
            | null
          new_inclusion_status:
            | Database["public"]["Enums"]["comparable_inclusion_status"]
            | null
          notes: string | null
          organization_id: string
          previous_candidate_status:
            | Database["public"]["Enums"]["comparable_candidate_status"]
            | null
          previous_inclusion_status:
            | Database["public"]["Enums"]["comparable_inclusion_status"]
            | null
          reason_code: string | null
          valuation_case_id: string
        }
        Insert: {
          actor_user_id?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          new_candidate_status?:
            | Database["public"]["Enums"]["comparable_candidate_status"]
            | null
          new_inclusion_status?:
            | Database["public"]["Enums"]["comparable_inclusion_status"]
            | null
          notes?: string | null
          organization_id: string
          previous_candidate_status?:
            | Database["public"]["Enums"]["comparable_candidate_status"]
            | null
          previous_inclusion_status?:
            | Database["public"]["Enums"]["comparable_inclusion_status"]
            | null
          reason_code?: string | null
          valuation_case_id: string
        }
        Update: {
          actor_user_id?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          new_candidate_status?:
            | Database["public"]["Enums"]["comparable_candidate_status"]
            | null
          new_inclusion_status?:
            | Database["public"]["Enums"]["comparable_inclusion_status"]
            | null
          notes?: string | null
          organization_id?: string
          previous_candidate_status?:
            | Database["public"]["Enums"]["comparable_candidate_status"]
            | null
          previous_inclusion_status?:
            | Database["public"]["Enums"]["comparable_inclusion_status"]
            | null
          reason_code?: string | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparable_decision_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "comparable_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparable_decision_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comparable_exclusion_reasons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_active: boolean
          label: string
          taxonomy_version: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label: string
          taxonomy_version?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label?: string
          taxonomy_version?: number
        }
        Relationships: []
      }
      comparable_feature_snapshots: {
        Row: {
          calculated_at: string
          comparable_candidate_id: string
          created_at: string
          created_by: string | null
          derivation_version: string
          features: Json
          id: string
          input_references: Json
          market_observation_id: string
          market_property_id: string
          organization_id: string
          subject_property_id: string
          valuation_case_id: string
        }
        Insert: {
          calculated_at?: string
          comparable_candidate_id: string
          created_at?: string
          created_by?: string | null
          derivation_version: string
          features: Json
          id?: string
          input_references: Json
          market_observation_id: string
          market_property_id: string
          organization_id: string
          subject_property_id: string
          valuation_case_id: string
        }
        Update: {
          calculated_at?: string
          comparable_candidate_id?: string
          created_at?: string
          created_by?: string | null
          derivation_version?: string
          features?: Json
          id?: string
          input_references?: Json
          market_observation_id?: string
          market_property_id?: string
          organization_id?: string
          subject_property_id?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparable_feature_snapshots_comparable_candidate_id_fkey"
            columns: ["comparable_candidate_id"]
            isOneToOne: false
            referencedRelation: "comparable_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparable_feature_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparable_feature_snapshots_organization_id_valuation_cas_fkey"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      dataset_item_snapshots: {
        Row: {
          artifact_id: string
          artifact_sha256: string | null
          created_at: string
          dataset_item_id: string | null
          dataset_version_id: string
          evidence_field_id: string
          evidence_field_revision: number
          evidence_source_id: string
          extraction_id: string
          extraction_version: number
          field_name: string
          field_state_at_freeze: Database["public"]["Enums"]["field_state"]
          id: string
          item_ordinal: number
          normalized_value_at_freeze: string | null
          numeric_value_at_freeze: number | null
          organization_id: string
          raw_value_at_freeze: string | null
          role_in_dataset: string | null
          source_excerpt_at_freeze: string | null
          source_locator_at_freeze: Json | null
          unit_at_freeze: string | null
          validation_status_at_freeze: Database["public"]["Enums"]["validation_status"]
          valuation_case_id: string
          verified_at_at_freeze: string | null
          verified_by_at_freeze: string | null
        }
        Insert: {
          artifact_id: string
          artifact_sha256?: string | null
          created_at?: string
          dataset_item_id?: string | null
          dataset_version_id: string
          evidence_field_id: string
          evidence_field_revision: number
          evidence_source_id: string
          extraction_id: string
          extraction_version: number
          field_name: string
          field_state_at_freeze: Database["public"]["Enums"]["field_state"]
          id?: string
          item_ordinal: number
          normalized_value_at_freeze?: string | null
          numeric_value_at_freeze?: number | null
          organization_id: string
          raw_value_at_freeze?: string | null
          role_in_dataset?: string | null
          source_excerpt_at_freeze?: string | null
          source_locator_at_freeze?: Json | null
          unit_at_freeze?: string | null
          validation_status_at_freeze: Database["public"]["Enums"]["validation_status"]
          valuation_case_id: string
          verified_at_at_freeze?: string | null
          verified_by_at_freeze?: string | null
        }
        Update: {
          artifact_id?: string
          artifact_sha256?: string | null
          created_at?: string
          dataset_item_id?: string | null
          dataset_version_id?: string
          evidence_field_id?: string
          evidence_field_revision?: number
          evidence_source_id?: string
          extraction_id?: string
          extraction_version?: number
          field_name?: string
          field_state_at_freeze?: Database["public"]["Enums"]["field_state"]
          id?: string
          item_ordinal?: number
          normalized_value_at_freeze?: string | null
          numeric_value_at_freeze?: number | null
          organization_id?: string
          raw_value_at_freeze?: string | null
          role_in_dataset?: string | null
          source_excerpt_at_freeze?: string | null
          source_locator_at_freeze?: Json | null
          unit_at_freeze?: string | null
          validation_status_at_freeze?: Database["public"]["Enums"]["validation_status"]
          valuation_case_id?: string
          verified_at_at_freeze?: string | null
          verified_by_at_freeze?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dataset_item_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsis_version_org_fk"
            columns: ["organization_id", "dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      dataset_items: {
        Row: {
          created_at: string
          created_by: string
          dataset_version_id: string
          evidence_field_id: string
          id: string
          notes: string | null
          organization_id: string
          role_in_dataset: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          dataset_version_id: string
          evidence_field_id: string
          id?: string
          notes?: string | null
          organization_id: string
          role_in_dataset?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          dataset_version_id?: string
          evidence_field_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          role_in_dataset?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dataset_items_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_items_evidence_field_id_fkey"
            columns: ["evidence_field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsi_field_org_fk"
            columns: ["organization_id", "evidence_field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "dsi_version_org_fk"
            columns: ["organization_id", "dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      dataset_versions: {
        Row: {
          created_at: string
          created_by: string
          dataset_hash: string | null
          dataset_manifest: Json | null
          description: string | null
          exclusion_criteria: string | null
          frozen_at: string | null
          frozen_by: string | null
          geographic_scope: string | null
          hash_algorithm: string | null
          id: string
          inclusion_criteria: string | null
          known_limitations: string | null
          manifest_schema_version: string | null
          name: string
          organization_id: string
          purpose: string | null
          temporal_scope: string | null
          valuation_case_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          dataset_hash?: string | null
          dataset_manifest?: Json | null
          description?: string | null
          exclusion_criteria?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          geographic_scope?: string | null
          hash_algorithm?: string | null
          id?: string
          inclusion_criteria?: string | null
          known_limitations?: string | null
          manifest_schema_version?: string | null
          name: string
          organization_id: string
          purpose?: string | null
          temporal_scope?: string | null
          valuation_case_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          dataset_hash?: string | null
          dataset_manifest?: Json | null
          description?: string | null
          exclusion_criteria?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          geographic_scope?: string | null
          hash_algorithm?: string | null
          id?: string
          inclusion_criteria?: string | null
          known_limitations?: string | null
          manifest_schema_version?: string | null
          name?: string
          organization_id?: string
          purpose?: string | null
          temporal_scope?: string | null
          valuation_case_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "dataset_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_versions_valuation_case_id_fkey"
            columns: ["valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsv_case_org_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      derived_values: {
        Row: {
          area_basis: string | null
          calculated_at: string
          calculated_value: number | null
          created_by: string
          derivation_type: string
          derivation_version: string
          id: string
          input_references: Json
          market_observation_id: string | null
          market_property_id: string | null
          organization_id: string
          subject_property_id: string | null
          unit: string | null
          valuation_case_id: string
        }
        Insert: {
          area_basis?: string | null
          calculated_at?: string
          calculated_value?: number | null
          created_by: string
          derivation_type: string
          derivation_version?: string
          id?: string
          input_references?: Json
          market_observation_id?: string | null
          market_property_id?: string | null
          organization_id: string
          subject_property_id?: string | null
          unit?: string | null
          valuation_case_id: string
        }
        Update: {
          area_basis?: string | null
          calculated_at?: string
          calculated_value?: number | null
          created_by?: string
          derivation_type?: string
          derivation_version?: string
          id?: string
          input_references?: Json
          market_observation_id?: string | null
          market_property_id?: string | null
          organization_id?: string
          subject_property_id?: string | null
          unit?: string | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "derived_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "derived_observation_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_observation_id",
            ]
            isOneToOne: false
            referencedRelation: "market_observations"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "derived_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      developments: {
        Row: {
          address_normalization_status: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized: string | null
          address_raw: string | null
          city: string | null
          construction_year: number | null
          country_code: string | null
          created_at: string
          created_by: string
          developer_name: string | null
          development_type: Database["public"]["Enums"]["development_type"]
          district: string | null
          geo_point: unknown
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          number_of_floors: number | null
          number_of_units: number | null
          organization_id: string
          postal_code: string | null
          state: string | null
          updated_at: string
          valuation_case_id: string
        }
        Insert: {
          address_normalization_status?: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized?: string | null
          address_raw?: string | null
          city?: string | null
          construction_year?: number | null
          country_code?: string | null
          created_at?: string
          created_by: string
          developer_name?: string | null
          development_type?: Database["public"]["Enums"]["development_type"]
          district?: string | null
          geo_point?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          number_of_floors?: number | null
          number_of_units?: number | null
          organization_id: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          valuation_case_id: string
        }
        Update: {
          address_normalization_status?: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized?: string | null
          address_raw?: string | null
          city?: string | null
          construction_year?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          developer_name?: string | null
          development_type?: Database["public"]["Enums"]["development_type"]
          district?: string | null
          geo_point?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          number_of_floors?: number | null
          number_of_units?: number | null
          organization_id?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developments_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "developments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirement_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          profile_code: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          profile_code: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          profile_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requirement_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_artifacts: {
        Row: {
          capture_method: Database["public"]["Enums"]["capture_method"]
          captured_at: string
          created_at: string
          created_by: string
          evidence_source_id: string
          file_name: string
          file_size: number | null
          hash_computed_by: string
          id: string
          mime_type: string | null
          organization_id: string
          provider_metadata: Json | null
          sha256_hash: string | null
          source_content_text: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          capture_method?: Database["public"]["Enums"]["capture_method"]
          captured_at?: string
          created_at?: string
          created_by: string
          evidence_source_id: string
          file_name: string
          file_size?: number | null
          hash_computed_by?: string
          id?: string
          mime_type?: string | null
          organization_id: string
          provider_metadata?: Json | null
          sha256_hash?: string | null
          source_content_text?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          capture_method?: Database["public"]["Enums"]["capture_method"]
          captured_at?: string
          created_at?: string
          created_by?: string
          evidence_source_id?: string
          file_name?: string
          file_size?: number | null
          hash_computed_by?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          provider_metadata?: Json | null
          sha256_hash?: string | null
          source_content_text?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_source_org_fk"
            columns: ["organization_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "evidence_artifacts_evidence_source_id_fkey"
            columns: ["evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_artifacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_extractions: {
        Row: {
          artifact_id: string
          created_at: string
          created_by: string
          error_message: string | null
          extraction_type: string | null
          id: string
          organization_id: string
          processor_name: string | null
          processor_type: Database["public"]["Enums"]["processor_type"]
          processor_version: string | null
          prompt_version: string | null
          raw_output: Json | null
          status: Database["public"]["Enums"]["extraction_status"]
          version_number: number
        }
        Insert: {
          artifact_id: string
          created_at?: string
          created_by: string
          error_message?: string | null
          extraction_type?: string | null
          id?: string
          organization_id: string
          processor_name?: string | null
          processor_type?: Database["public"]["Enums"]["processor_type"]
          processor_version?: string | null
          prompt_version?: string | null
          raw_output?: Json | null
          status?: Database["public"]["Enums"]["extraction_status"]
          version_number?: number
        }
        Update: {
          artifact_id?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          extraction_type?: string | null
          id?: string
          organization_id?: string
          processor_name?: string | null
          processor_type?: Database["public"]["Enums"]["processor_type"]
          processor_version?: string | null
          prompt_version?: string | null
          raw_output?: Json | null
          status?: Database["public"]["Enums"]["extraction_status"]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidence_extractions_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extractions_artifact_org_fk"
            columns: ["organization_id", "artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      evidence_field_revisions: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          extraction_id: string | null
          field_id: string
          field_name: string | null
          field_state: Database["public"]["Enums"]["field_state"] | null
          id: string
          normalized_value: string | null
          numeric_value: number | null
          organization_id: string
          raw_value: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          revision_number: number
          source_excerpt: string | null
          source_locator: Json | null
          unit: string | null
          validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          extraction_id?: string | null
          field_id: string
          field_name?: string | null
          field_state?: Database["public"]["Enums"]["field_state"] | null
          id?: string
          normalized_value?: string | null
          numeric_value?: number | null
          organization_id: string
          raw_value?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          revision_number: number
          source_excerpt?: string | null
          source_locator?: Json | null
          unit?: string | null
          validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          extraction_id?: string | null
          field_id?: string
          field_name?: string | null
          field_state?: Database["public"]["Enums"]["field_state"] | null
          id?: string
          normalized_value?: string | null
          numeric_value?: number | null
          organization_id?: string
          raw_value?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          revision_number?: number
          source_excerpt?: string | null
          source_locator?: Json | null
          unit?: string | null
          validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_field_revisions_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisions_field_org_fk"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      evidence_fields: {
        Row: {
          ai_support_status:
            | Database["public"]["Enums"]["extraction_support_status"]
            | null
          created_at: string
          created_by: string
          extraction_id: string
          field_name: string
          field_state: Database["public"]["Enums"]["field_state"]
          id: string
          normalized_value: string | null
          numeric_value: number | null
          organization_id: string
          raw_value: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          revision_number: number
          source_excerpt: string | null
          source_locator: Json | null
          support_check_details: Json | null
          support_check_status:
            | Database["public"]["Enums"]["support_check_status"]
            | null
          unit: string | null
          updated_at: string
          validation_status: Database["public"]["Enums"]["validation_status"]
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          ai_support_status?:
            | Database["public"]["Enums"]["extraction_support_status"]
            | null
          created_at?: string
          created_by: string
          extraction_id: string
          field_name: string
          field_state?: Database["public"]["Enums"]["field_state"]
          id?: string
          normalized_value?: string | null
          numeric_value?: number | null
          organization_id: string
          raw_value?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          revision_number?: number
          source_excerpt?: string | null
          source_locator?: Json | null
          support_check_details?: Json | null
          support_check_status?:
            | Database["public"]["Enums"]["support_check_status"]
            | null
          unit?: string | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          ai_support_status?:
            | Database["public"]["Enums"]["extraction_support_status"]
            | null
          created_at?: string
          created_by?: string
          extraction_id?: string
          field_name?: string
          field_state?: Database["public"]["Enums"]["field_state"]
          id?: string
          normalized_value?: string | null
          numeric_value?: number | null
          organization_id?: string
          raw_value?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          revision_number?: number
          source_excerpt?: string | null
          source_locator?: Json | null
          support_check_details?: Json | null
          support_check_status?:
            | Database["public"]["Enums"]["support_check_status"]
            | null
          unit?: string | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_fields_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "evidence_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_extraction_org_fk"
            columns: ["organization_id", "extraction_id"]
            isOneToOne: false
            referencedRelation: "evidence_extractions"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      evidence_reviews: {
        Row: {
          artifact_id: string | null
          created_at: string
          decision: Database["public"]["Enums"]["validation_status"]
          field_id: string | null
          id: string
          notes: string | null
          organization_id: string
          reviewer_id: string
        }
        Insert: {
          artifact_id?: string | null
          created_at?: string
          decision: Database["public"]["Enums"]["validation_status"]
          field_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          reviewer_id: string
        }
        Update: {
          artifact_id?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["validation_status"]
          field_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_reviews_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_reviews_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_artifact_org_fk"
            columns: ["organization_id", "artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "reviews_field_org_fk"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      evidence_sources: {
        Row: {
          accessed_at: string | null
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          notes: string | null
          organization_id: string
          publication_date: string | null
          publisher_or_owner: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["source_type"]
          source_url: string | null
          updated_at: string
          valuation_case_id: string | null
        }
        Insert: {
          accessed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          organization_id: string
          publication_date?: string | null
          publisher_or_owner?: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          updated_at?: string
          valuation_case_id?: string | null
        }
        Update: {
          accessed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          organization_id?: string
          publication_date?: string | null
          publisher_or_owner?: string | null
          source_name?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          updated_at?: string
          valuation_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_sources_valuation_case_id_fkey"
            columns: ["valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_case_org_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_data_issue_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          issue_id: string
          new_status: Database["public"]["Enums"]["market_data_issue_status"]
          notes: string | null
          organization_id: string
          previous_status:
            | Database["public"]["Enums"]["market_data_issue_status"]
            | null
          resolution_type:
            | Database["public"]["Enums"]["issue_resolution_type"]
            | null
          rule_version: string | null
          valuation_case_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          issue_id: string
          new_status: Database["public"]["Enums"]["market_data_issue_status"]
          notes?: string | null
          organization_id: string
          previous_status?:
            | Database["public"]["Enums"]["market_data_issue_status"]
            | null
          resolution_type?:
            | Database["public"]["Enums"]["issue_resolution_type"]
            | null
          rule_version?: string | null
          valuation_case_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          issue_id?: string
          new_status?: Database["public"]["Enums"]["market_data_issue_status"]
          notes?: string | null
          organization_id?: string
          previous_status?:
            | Database["public"]["Enums"]["market_data_issue_status"]
            | null
          resolution_type?:
            | Database["public"]["Enums"]["issue_resolution_type"]
            | null
          rule_version?: string | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_data_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "market_data_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_issues: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          detail: string
          entity_id: string | null
          entity_type: string
          facts: Json | null
          id: string
          issue_type: Database["public"]["Enums"]["market_data_issue_type"]
          opened_at: string
          organization_id: string
          resolution_notes: string | null
          resolution_type:
            | Database["public"]["Enums"]["issue_resolution_type"]
            | null
          resolved_at: string | null
          resolved_by: string | null
          rule_version: string
          severity: Database["public"]["Enums"]["market_data_issue_severity"]
          status: Database["public"]["Enums"]["market_data_issue_status"]
          valuation_case_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          detail: string
          entity_id?: string | null
          entity_type: string
          facts?: Json | null
          id?: string
          issue_type: Database["public"]["Enums"]["market_data_issue_type"]
          opened_at?: string
          organization_id: string
          resolution_notes?: string | null
          resolution_type?:
            | Database["public"]["Enums"]["issue_resolution_type"]
            | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_version: string
          severity: Database["public"]["Enums"]["market_data_issue_severity"]
          status?: Database["public"]["Enums"]["market_data_issue_status"]
          valuation_case_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          detail?: string
          entity_id?: string | null
          entity_type?: string
          facts?: Json | null
          id?: string
          issue_type?: Database["public"]["Enums"]["market_data_issue_type"]
          opened_at?: string
          organization_id?: string
          resolution_notes?: string | null
          resolution_type?:
            | Database["public"]["Enums"]["issue_resolution_type"]
            | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_version?: string
          severity?: Database["public"]["Enums"]["market_data_issue_severity"]
          status?: Database["public"]["Enums"]["market_data_issue_status"]
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_data_issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_data_issues_organization_id_valuation_case_id_fkey"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_diagnostic_policies: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          status: Database["public"]["Enums"]["diagnostic_policy_status"]
          version: string
        }
        Insert: {
          configuration: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["diagnostic_policy_status"]
          version: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["diagnostic_policy_status"]
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_diagnostic_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_evidence_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          domain_count: number
          hash_algorithm: string
          id: string
          identity_cluster_count: number
          independent_property_count: number
          market_property_count: number
          observation_count: number
          organization_id: string
          schema_version: string
          snapshot_hash: string
          snapshot_manifest: Json
          source_count: number
          valuation_case_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain_count: number
          hash_algorithm?: string
          id?: string
          identity_cluster_count: number
          independent_property_count: number
          market_property_count: number
          observation_count: number
          organization_id: string
          schema_version: string
          snapshot_hash: string
          snapshot_manifest: Json
          source_count: number
          valuation_case_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain_count?: number
          hash_algorithm?: string
          id?: string
          identity_cluster_count?: number
          independent_property_count?: number
          market_property_count?: number
          observation_count?: number
          organization_id?: string
          schema_version?: string
          snapshot_hash?: string
          snapshot_manifest?: Json
          source_count?: number
          valuation_case_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_evidence_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_evidence_snapshots_organization_id_valuation_case_i_fkey"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_identity_cluster_members: {
        Row: {
          added_at: string
          added_by: string | null
          cluster_id: string
          id: string
          market_property_id: string
          organization_id: string
          source_match_candidate_id: string | null
          valuation_case_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          cluster_id: string
          id?: string
          market_property_id: string
          organization_id: string
          source_match_candidate_id?: string | null
          valuation_case_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          cluster_id?: string
          id?: string
          market_property_id?: string
          organization_id?: string
          source_match_candidate_id?: string | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_identity_cluster_membe_organization_id_market_prope_fkey"
            columns: ["organization_id", "market_property_id"]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "market_identity_cluster_members_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "market_identity_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_identity_cluster_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_identity_cluster_members_source_match_candidate_id_fkey"
            columns: ["source_match_candidate_id"]
            isOneToOne: false
            referencedRelation: "property_match_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      market_identity_clusters: {
        Row: {
          confirmation_reason: string
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          id: string
          label: string | null
          organization_id: string
          representative_market_property_id: string
          valuation_case_id: string
        }
        Insert: {
          confirmation_reason: string
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          organization_id: string
          representative_market_property_id: string
          valuation_case_id: string
        }
        Update: {
          confirmation_reason?: string
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          organization_id?: string
          representative_market_property_id?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_identity_clusters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_identity_clusters_organization_id_representative_ma_fkey"
            columns: ["organization_id", "representative_market_property_id"]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "market_identity_clusters_organization_id_valuation_case_id_fkey"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_observation_price_history: {
        Row: {
          asking_monthly_rent: number | null
          asking_price: number | null
          created_at: string
          created_by: string
          currency_code: string
          evidence_field_id: string | null
          evidence_source_id: string | null
          id: string
          market_observation_id: string
          notes: string | null
          observation_status:
            | Database["public"]["Enums"]["market_observation_status"]
            | null
          observed_at: string
          organization_id: string
          valuation_case_id: string
        }
        Insert: {
          asking_monthly_rent?: number | null
          asking_price?: number | null
          created_at?: string
          created_by: string
          currency_code?: string
          evidence_field_id?: string | null
          evidence_source_id?: string | null
          id?: string
          market_observation_id: string
          notes?: string | null
          observation_status?:
            | Database["public"]["Enums"]["market_observation_status"]
            | null
          observed_at?: string
          organization_id: string
          valuation_case_id: string
        }
        Update: {
          asking_monthly_rent?: number | null
          asking_price?: number | null
          created_at?: string
          created_by?: string
          currency_code?: string
          evidence_field_id?: string | null
          evidence_source_id?: string | null
          id?: string
          market_observation_id?: string
          notes?: string | null
          observation_status?:
            | Database["public"]["Enums"]["market_observation_status"]
            | null
          observed_at?: string
          organization_id?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_observation_price_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_field_fk"
            columns: ["organization_id", "evidence_field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "price_history_observation_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_observation_id",
            ]
            isOneToOne: false
            referencedRelation: "market_observations"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "price_history_source_fk"
            columns: ["organization_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_observations: {
        Row: {
          asking_monthly_rent: number | null
          asking_price: number | null
          broker_name: string | null
          broker_reference: string | null
          contracted_monthly_rent: number | null
          created_at: string
          created_by: string
          currency_code: string
          evidence_source_id: string | null
          external_listing_id: string | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          listing_url: string | null
          market_property_id: string
          notes: string | null
          observation_date: string | null
          observation_type: Database["public"]["Enums"]["market_observation_type"]
          organization_id: string
          portal_name: string | null
          primary_artifact_id: string | null
          publication_date: string | null
          publisher_name: string | null
          registry_reference: string | null
          seller_type: Database["public"]["Enums"]["seller_type"]
          status: Database["public"]["Enums"]["market_observation_status"]
          transaction_date: string | null
          transaction_document_type: string | null
          transaction_evidence_status:
            | Database["public"]["Enums"]["transaction_evidence_status"]
            | null
          transaction_price: number | null
          updated_at: string
          valuation_case_id: string
        }
        Insert: {
          asking_monthly_rent?: number | null
          asking_price?: number | null
          broker_name?: string | null
          broker_reference?: string | null
          contracted_monthly_rent?: number | null
          created_at?: string
          created_by: string
          currency_code?: string
          evidence_source_id?: string | null
          external_listing_id?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          listing_url?: string | null
          market_property_id: string
          notes?: string | null
          observation_date?: string | null
          observation_type: Database["public"]["Enums"]["market_observation_type"]
          organization_id: string
          portal_name?: string | null
          primary_artifact_id?: string | null
          publication_date?: string | null
          publisher_name?: string | null
          registry_reference?: string | null
          seller_type?: Database["public"]["Enums"]["seller_type"]
          status?: Database["public"]["Enums"]["market_observation_status"]
          transaction_date?: string | null
          transaction_document_type?: string | null
          transaction_evidence_status?:
            | Database["public"]["Enums"]["transaction_evidence_status"]
            | null
          transaction_price?: number | null
          updated_at?: string
          valuation_case_id: string
        }
        Update: {
          asking_monthly_rent?: number | null
          asking_price?: number | null
          broker_name?: string | null
          broker_reference?: string | null
          contracted_monthly_rent?: number | null
          created_at?: string
          created_by?: string
          currency_code?: string
          evidence_source_id?: string | null
          external_listing_id?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          listing_url?: string | null
          market_property_id?: string
          notes?: string | null
          observation_date?: string | null
          observation_type?: Database["public"]["Enums"]["market_observation_type"]
          organization_id?: string
          portal_name?: string | null
          primary_artifact_id?: string | null
          publication_date?: string | null
          publisher_name?: string | null
          registry_reference?: string | null
          seller_type?: Database["public"]["Enums"]["seller_type"]
          status?: Database["public"]["Enums"]["market_observation_status"]
          transaction_date?: string | null
          transaction_document_type?: string | null
          transaction_evidence_status?:
            | Database["public"]["Enums"]["transaction_evidence_status"]
            | null
          transaction_price?: number | null
          updated_at?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_observations_artifact_fk"
            columns: ["organization_id", "primary_artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "market_observations_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "market_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_observations_property_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_property_id",
            ]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "market_observations_source_fk"
            columns: ["organization_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      market_properties: {
        Row: {
          address_normalization_status: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized: string | null
          address_raw: string | null
          bathrooms: number | null
          bedrooms: number | null
          built_area: number | null
          city: string | null
          common_area: number | null
          complement: string | null
          condition_status:
            | Database["public"]["Enums"]["condition_status"]
            | null
          construction_year: number | null
          country_code: string | null
          created_at: string
          created_by: string
          description: string | null
          development_id: string | null
          district: string | null
          floor_number: number | null
          furnished_status:
            | Database["public"]["Enums"]["furnished_status"]
            | null
          geo_point: unknown
          half_bathrooms: number | null
          id: string
          label: string | null
          land_area: number | null
          latitude: number | null
          longitude: number | null
          occupancy_status:
            | Database["public"]["Enums"]["occupancy_status"]
            | null
          organization_id: string
          parking_spaces: number | null
          postal_code: string | null
          private_area: number | null
          property_type_code:
            | Database["public"]["Enums"]["property_type_code"]
            | null
          renovation_year: number | null
          state: string | null
          street_name: string | null
          street_number: string | null
          street_type: string | null
          subdistrict: string | null
          suites: number | null
          total_area: number | null
          total_floors: number | null
          unit_identifier: string | null
          updated_at: string
          usable_area: number | null
          valuation_case_id: string
        }
        Insert: {
          address_normalization_status?: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized?: string | null
          address_raw?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_area?: number | null
          city?: string | null
          common_area?: number | null
          complement?: string | null
          condition_status?:
            | Database["public"]["Enums"]["condition_status"]
            | null
          construction_year?: number | null
          country_code?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          development_id?: string | null
          district?: string | null
          floor_number?: number | null
          furnished_status?:
            | Database["public"]["Enums"]["furnished_status"]
            | null
          geo_point?: unknown
          half_bathrooms?: number | null
          id?: string
          label?: string | null
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          occupancy_status?:
            | Database["public"]["Enums"]["occupancy_status"]
            | null
          organization_id: string
          parking_spaces?: number | null
          postal_code?: string | null
          private_area?: number | null
          property_type_code?:
            | Database["public"]["Enums"]["property_type_code"]
            | null
          renovation_year?: number | null
          state?: string | null
          street_name?: string | null
          street_number?: string | null
          street_type?: string | null
          subdistrict?: string | null
          suites?: number | null
          total_area?: number | null
          total_floors?: number | null
          unit_identifier?: string | null
          updated_at?: string
          usable_area?: number | null
          valuation_case_id: string
        }
        Update: {
          address_normalization_status?: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized?: string | null
          address_raw?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_area?: number | null
          city?: string | null
          common_area?: number | null
          complement?: string | null
          condition_status?:
            | Database["public"]["Enums"]["condition_status"]
            | null
          construction_year?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          development_id?: string | null
          district?: string | null
          floor_number?: number | null
          furnished_status?:
            | Database["public"]["Enums"]["furnished_status"]
            | null
          geo_point?: unknown
          half_bathrooms?: number | null
          id?: string
          label?: string | null
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          occupancy_status?:
            | Database["public"]["Enums"]["occupancy_status"]
            | null
          organization_id?: string
          parking_spaces?: number | null
          postal_code?: string | null
          private_area?: number | null
          property_type_code?:
            | Database["public"]["Enums"]["property_type_code"]
            | null
          renovation_year?: number | null
          state?: string | null
          street_name?: string | null
          street_number?: string | null
          street_type?: string | null
          subdistrict?: string | null
          suites?: number | null
          total_area?: number | null
          total_floors?: number | null
          unit_identifier?: string | null
          updated_at?: string
          usable_area?: number | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_properties_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "market_properties_development_fk"
            columns: ["organization_id", "valuation_case_id", "development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "market_properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_source_quality_assessments: {
        Row: {
          assessed_by: string
          created_at: string
          cross_source_confirmation: Database["public"]["Enums"]["quality_dimension_state"]
          data_completeness: Database["public"]["Enums"]["quality_dimension_state"]
          id: string
          market_observation_id: string
          notes: string | null
          organization_id: string
          source_reliability: Database["public"]["Enums"]["quality_dimension_state"]
          spatial_relevance: Database["public"]["Enums"]["quality_dimension_state"]
          temporal_relevance: Database["public"]["Enums"]["quality_dimension_state"]
          updated_at: string
          valuation_case_id: string
        }
        Insert: {
          assessed_by: string
          created_at?: string
          cross_source_confirmation?: Database["public"]["Enums"]["quality_dimension_state"]
          data_completeness?: Database["public"]["Enums"]["quality_dimension_state"]
          id?: string
          market_observation_id: string
          notes?: string | null
          organization_id: string
          source_reliability?: Database["public"]["Enums"]["quality_dimension_state"]
          spatial_relevance?: Database["public"]["Enums"]["quality_dimension_state"]
          temporal_relevance?: Database["public"]["Enums"]["quality_dimension_state"]
          updated_at?: string
          valuation_case_id: string
        }
        Update: {
          assessed_by?: string
          created_at?: string
          cross_source_confirmation?: Database["public"]["Enums"]["quality_dimension_state"]
          data_completeness?: Database["public"]["Enums"]["quality_dimension_state"]
          id?: string
          market_observation_id?: string
          notes?: string | null
          organization_id?: string
          source_reliability?: Database["public"]["Enums"]["quality_dimension_state"]
          spatial_relevance?: Database["public"]["Enums"]["quality_dimension_state"]
          temporal_relevance?: Database["public"]["Enums"]["quality_dimension_state"]
          updated_at?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_source_quality_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_observation_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_observation_id",
            ]
            isOneToOne: false
            referencedRelation: "market_observations"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
        ]
      }
      method_applicability_rules: {
        Row: {
          created_at: string
          created_by: string | null
          criterion_code: string
          criterion_description: string
          expected_result: Database["public"]["Enums"]["method_applicability_result"]
          id: string
          method_specification_id: string
          notes: string | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criterion_code: string
          criterion_description: string
          expected_result: Database["public"]["Enums"]["method_applicability_result"]
          id?: string
          method_specification_id: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criterion_code?: string
          criterion_description?: string
          expected_result?: Database["public"]["Enums"]["method_applicability_result"]
          id?: string
          method_specification_id?: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_applicability_rules_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_applicability_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      method_compliance_assessments: {
        Row: {
          created_at: string
          id: string
          method_specification_id: string
          notes: string | null
          organization_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          method_specification_id: string
          notes?: string | null
          organization_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          method_specification_id?: string
          notes?: string | null
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_compliance_assessments_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_compliance_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      method_implementations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          checksum: string | null
          created_at: string
          created_by: string | null
          id: string
          implementation_code: string
          method_specification_id: string
          notes: string | null
          organization_id: string | null
          runtime: string | null
          status: Database["public"]["Enums"]["method_implementation_status"]
          updated_at: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_code: string
          method_specification_id: string
          notes?: string | null
          organization_id?: string | null
          runtime?: string | null
          status?: Database["public"]["Enums"]["method_implementation_status"]
          updated_at?: string
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_code?: string
          method_specification_id?: string
          notes?: string | null
          organization_id?: string | null
          runtime?: string | null
          status?: Database["public"]["Enums"]["method_implementation_status"]
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_implementations_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_implementations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      method_output_contracts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          method_specification_id: string
          organization_id: string | null
          output_type: Database["public"]["Enums"]["methodology_output_type"]
          required: boolean
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          method_specification_id: string
          organization_id?: string | null
          output_type: Database["public"]["Enums"]["methodology_output_type"]
          required?: boolean
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          method_specification_id?: string
          organization_id?: string | null
          output_type?: Database["public"]["Enums"]["methodology_output_type"]
          required?: boolean
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_output_contracts_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_output_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_output_contracts_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "methodology_units"
            referencedColumns: ["code"]
          },
        ]
      }
      method_parameter_sets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          method_specification_id: string
          organization_id: string
          scope_description: string | null
          set_code: string
          status: Database["public"]["Enums"]["method_spec_status"]
          updated_at: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          method_specification_id: string
          organization_id: string
          scope_description?: string | null
          set_code: string
          status?: Database["public"]["Enums"]["method_spec_status"]
          updated_at?: string
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          method_specification_id?: string
          organization_id?: string
          scope_description?: string | null
          set_code?: string
          status?: Database["public"]["Enums"]["method_spec_status"]
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_parameter_sets_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_parameter_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      method_parameter_values: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          justification: string
          numeric_value: number | null
          organization_id: string
          parameter_id: string
          parameter_set_id: string
          source_id: string | null
          text_value: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          justification: string
          numeric_value?: number | null
          organization_id: string
          parameter_id: string
          parameter_set_id: string
          source_id?: string | null
          text_value?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          justification?: string
          numeric_value?: number | null
          organization_id?: string
          parameter_id?: string
          parameter_set_id?: string
          source_id?: string | null
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "method_parameter_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_parameter_values_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "methodology_parameters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_parameter_values_parameter_set_id_fkey"
            columns: ["parameter_set_id"]
            isOneToOne: false
            referencedRelation: "method_parameter_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_parameter_values_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      method_specification_sections: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          method_specification_id: string
          ordinal: number
          organization_id: string | null
          section_key: Database["public"]["Enums"]["method_spec_section_key"]
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method_specification_id: string
          ordinal?: number
          organization_id?: string | null
          section_key: Database["public"]["Enums"]["method_spec_section_key"]
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method_specification_id?: string
          ordinal?: number
          organization_id?: string | null
          section_key?: Database["public"]["Enums"]["method_spec_section_key"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_specification_sections_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_specification_sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      method_specification_source_requirements: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_satisfied: boolean
          method_specification_id: string
          notes: string | null
          organization_id: string | null
          requirement_code: string
          satisfied_by_source_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_satisfied?: boolean
          method_specification_id: string
          notes?: string | null
          organization_id?: string | null
          requirement_code: string
          satisfied_by_source_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_satisfied?: boolean
          method_specification_id?: string
          notes?: string | null
          organization_id?: string | null
          requirement_code?: string
          satisfied_by_source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_specification_source_requir_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_specification_source_require_satisfied_by_source_id_fkey"
            columns: ["satisfied_by_source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_specification_source_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      method_specifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_until: string | null
          hash_algorithm: string | null
          id: string
          jurisdiction: Database["public"]["Enums"]["methodology_jurisdiction"]
          manifest_schema_version: string | null
          organization_id: string | null
          purpose: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          review_notes: string | null
          scope: string | null
          specification_hash: string | null
          specification_manifest: Json | null
          status: Database["public"]["Enums"]["method_spec_status"]
          submitted_by: string | null
          submitted_for_review_at: string | null
          supersedes_specification_id: string | null
          title: string
          updated_at: string
          valuation_method_id: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          hash_algorithm?: string | null
          id?: string
          jurisdiction?: Database["public"]["Enums"]["methodology_jurisdiction"]
          manifest_schema_version?: string | null
          organization_id?: string | null
          purpose?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          scope?: string | null
          specification_hash?: string | null
          specification_manifest?: Json | null
          status?: Database["public"]["Enums"]["method_spec_status"]
          submitted_by?: string | null
          submitted_for_review_at?: string | null
          supersedes_specification_id?: string | null
          title: string
          updated_at?: string
          valuation_method_id: string
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_until?: string | null
          hash_algorithm?: string | null
          id?: string
          jurisdiction?: Database["public"]["Enums"]["methodology_jurisdiction"]
          manifest_schema_version?: string | null
          organization_id?: string | null
          purpose?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          scope?: string | null
          specification_hash?: string | null
          specification_manifest?: Json | null
          status?: Database["public"]["Enums"]["method_spec_status"]
          submitted_by?: string | null
          submitted_for_review_at?: string | null
          supersedes_specification_id?: string | null
          title?: string
          updated_at?: string
          valuation_method_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_specifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_specifications_supersedes_specification_id_fkey"
            columns: ["supersedes_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_specifications_valuation_method_id_fkey"
            columns: ["valuation_method_id"]
            isOneToOne: false
            referencedRelation: "valuation_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      method_test_cases: {
        Row: {
          created_at: string
          created_by: string | null
          expected_result: Json | null
          expected_status: string | null
          id: string
          input_fixture: Json | null
          method_specification_id: string
          organization_id: string | null
          source_reference: string | null
          test_code: string
          test_type: Database["public"]["Enums"]["method_test_type"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_result?: Json | null
          expected_status?: string | null
          id?: string
          input_fixture?: Json | null
          method_specification_id: string
          organization_id?: string | null
          source_reference?: string | null
          test_code: string
          test_type: Database["public"]["Enums"]["method_test_type"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_result?: Json | null
          expected_status?: string | null
          id?: string
          input_fixture?: Json | null
          method_specification_id?: string
          organization_id?: string | null
          source_reference?: string | null
          test_code?: string
          test_type?: Database["public"]["Enums"]["method_test_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "method_test_cases_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_test_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_change_requests: {
        Row: {
          change_type: Database["public"]["Enums"]["methodology_change_type"]
          created_at: string
          description: string
          id: string
          organization_id: string
          proposed_by: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["methodology_change_status"]
          target_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          change_type: Database["public"]["Enums"]["methodology_change_type"]
          created_at?: string
          description: string
          id?: string
          organization_id: string
          proposed_by: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["methodology_change_status"]
          target_id?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          change_type?: Database["public"]["Enums"]["methodology_change_type"]
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          proposed_by?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["methodology_change_status"]
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_change_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_crosswalks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          left_source_id: string | null
          notes: string | null
          organization_id: string | null
          relationship: Database["public"]["Enums"]["methodology_crosswalk_relationship"]
          right_source_id: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          left_source_id?: string | null
          notes?: string | null
          organization_id?: string | null
          relationship: Database["public"]["Enums"]["methodology_crosswalk_relationship"]
          right_source_id?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          left_source_id?: string | null
          notes?: string | null
          organization_id?: string | null
          relationship?: Database["public"]["Enums"]["methodology_crosswalk_relationship"]
          right_source_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_crosswalks_left_source_id_fkey"
            columns: ["left_source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_crosswalks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_crosswalks_right_source_id_fkey"
            columns: ["right_source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_data_dictionary: {
        Row: {
          concept_code: string
          created_at: string
          created_by: string | null
          data_type: Database["public"]["Enums"]["methodology_data_type"]
          description: string | null
          id: string
          name: string
          organization_id: string | null
          semantic_notes: string | null
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          concept_code: string
          created_at?: string
          created_by?: string | null
          data_type: Database["public"]["Enums"]["methodology_data_type"]
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          semantic_notes?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          concept_code?: string
          created_at?: string
          created_by?: string | null
          data_type?: Database["public"]["Enums"]["methodology_data_type"]
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          semantic_notes?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_data_dictionary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_data_dictionary_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "methodology_units"
            referencedColumns: ["code"]
          },
        ]
      }
      methodology_families: {
        Row: {
          code: string
          created_at: string
          description: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          name?: string
        }
        Relationships: []
      }
      methodology_formula_variables: {
        Row: {
          constraints: string | null
          created_at: string
          data_type: Database["public"]["Enums"]["methodology_data_type"]
          description: string | null
          formula_id: string
          id: string
          input_semantic: string | null
          name: string
          organization_id: string | null
          required: boolean
          unit_code: string | null
          updated_at: string
          variable_code: string
        }
        Insert: {
          constraints?: string | null
          created_at?: string
          data_type: Database["public"]["Enums"]["methodology_data_type"]
          description?: string | null
          formula_id: string
          id?: string
          input_semantic?: string | null
          name: string
          organization_id?: string | null
          required?: boolean
          unit_code?: string | null
          updated_at?: string
          variable_code: string
        }
        Update: {
          constraints?: string | null
          created_at?: string
          data_type?: Database["public"]["Enums"]["methodology_data_type"]
          description?: string | null
          formula_id?: string
          id?: string
          input_semantic?: string | null
          name?: string
          organization_id?: string | null
          required?: boolean
          unit_code?: string | null
          updated_at?: string
          variable_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_formula_variables_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "methodology_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_formula_variables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_formula_variables_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "methodology_units"
            referencedColumns: ["code"]
          },
        ]
      }
      methodology_formulas: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expression: string
          expression_language: Database["public"]["Enums"]["methodology_expression_language"]
          formula_code: string
          id: string
          name: string
          organization_id: string | null
          rule_id: string
          status: Database["public"]["Enums"]["methodology_formula_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expression: string
          expression_language?: Database["public"]["Enums"]["methodology_expression_language"]
          formula_code: string
          id?: string
          name: string
          organization_id?: string | null
          rule_id: string
          status?: Database["public"]["Enums"]["methodology_formula_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expression?: string
          expression_language?: Database["public"]["Enums"]["methodology_expression_language"]
          formula_code?: string
          id?: string
          name?: string
          organization_id?: string | null
          rule_id?: string
          status?: Database["public"]["Enums"]["methodology_formula_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_formulas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_formulas_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "methodology_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_parameters: {
        Row: {
          created_at: string
          created_by: string | null
          data_type: Database["public"]["Enums"]["methodology_data_type"]
          default_value: number | null
          description: string | null
          id: string
          max_value: number | null
          method_specification_id: string | null
          min_value: number | null
          name: string
          organization_id: string | null
          parameter_code: string
          source_required: boolean
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_type: Database["public"]["Enums"]["methodology_data_type"]
          default_value?: number | null
          description?: string | null
          id?: string
          max_value?: number | null
          method_specification_id?: string | null
          min_value?: number | null
          name: string
          organization_id?: string | null
          parameter_code: string
          source_required?: boolean
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_type?: Database["public"]["Enums"]["methodology_data_type"]
          default_value?: number | null
          description?: string | null
          id?: string
          max_value?: number | null
          method_specification_id?: string | null
          min_value?: number | null
          name?: string
          organization_id?: string | null
          parameter_code?: string
          source_required?: boolean
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_parameters_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_parameters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_parameters_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "methodology_units"
            referencedColumns: ["code"]
          },
        ]
      }
      methodology_rule_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interpretation_notes: string | null
          organization_id: string | null
          relationship_type: Database["public"]["Enums"]["methodology_source_relationship"]
          rule_id: string
          source_id: string
          source_locator_id: string | null
          support_excerpt: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interpretation_notes?: string | null
          organization_id?: string | null
          relationship_type: Database["public"]["Enums"]["methodology_source_relationship"]
          rule_id: string
          source_id: string
          source_locator_id?: string | null
          support_excerpt?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interpretation_notes?: string | null
          organization_id?: string | null
          relationship_type?: Database["public"]["Enums"]["methodology_source_relationship"]
          rule_id?: string
          source_id?: string
          source_locator_id?: string | null
          support_excerpt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "methodology_rule_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_rule_sources_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "methodology_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_rule_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_rule_sources_source_locator_id_fkey"
            columns: ["source_locator_id"]
            isOneToOne: false
            referencedRelation: "methodology_source_locators"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          method_specification_id: string
          normative_strength: Database["public"]["Enums"]["methodology_normative_strength"]
          organization_id: string | null
          priority: number
          rule_code: string
          rule_type: Database["public"]["Enums"]["methodology_rule_type"]
          status: Database["public"]["Enums"]["methodology_rule_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          method_specification_id: string
          normative_strength: Database["public"]["Enums"]["methodology_normative_strength"]
          organization_id?: string | null
          priority?: number
          rule_code: string
          rule_type: Database["public"]["Enums"]["methodology_rule_type"]
          status?: Database["public"]["Enums"]["methodology_rule_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          method_specification_id?: string
          normative_strength?: Database["public"]["Enums"]["methodology_normative_strength"]
          organization_id?: string | null
          priority?: number
          rule_code?: string
          rule_type?: Database["public"]["Enums"]["methodology_rule_type"]
          status?: Database["public"]["Enums"]["methodology_rule_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_rules_method_specification_id_fkey"
            columns: ["method_specification_id"]
            isOneToOne: false
            referencedRelation: "method_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_source_artifacts: {
        Row: {
          access_basis: Database["public"]["Enums"]["methodology_access_status"]
          created_at: string
          created_by: string | null
          evidence_artifact_id: string
          id: string
          notes: string | null
          organization_id: string
          source_id: string
        }
        Insert: {
          access_basis: Database["public"]["Enums"]["methodology_access_status"]
          created_at?: string
          created_by?: string | null
          evidence_artifact_id: string
          id?: string
          notes?: string | null
          organization_id: string
          source_id: string
        }
        Update: {
          access_basis?: Database["public"]["Enums"]["methodology_access_status"]
          created_at?: string
          created_by?: string | null
          evidence_artifact_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_source_artifacts_evidence_artifact_id_fkey"
            columns: ["evidence_artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_artifacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_artifacts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_source_conflicts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_critical: boolean
          organization_id: string
          professional_resolution: string | null
          resolution_status: Database["public"]["Enums"]["methodology_conflict_status"]
          resolved_at: string | null
          resolved_by: string | null
          source_a_id: string
          source_b_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_critical?: boolean
          organization_id: string
          professional_resolution?: string | null
          resolution_status?: Database["public"]["Enums"]["methodology_conflict_status"]
          resolved_at?: string | null
          resolved_by?: string | null
          source_a_id: string
          source_b_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_critical?: boolean
          organization_id?: string
          professional_resolution?: string | null
          resolution_status?: Database["public"]["Enums"]["methodology_conflict_status"]
          resolved_at?: string | null
          resolved_by?: string | null
          source_a_id?: string
          source_b_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_source_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_conflicts_source_a_id_fkey"
            columns: ["source_a_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_conflicts_source_b_id_fkey"
            columns: ["source_b_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_source_locators: {
        Row: {
          artifact_id: string | null
          chapter: string | null
          clause: string | null
          created_at: string
          created_by: string | null
          external_anchor: string | null
          figure: string | null
          id: string
          locator_type: Database["public"]["Enums"]["methodology_locator_type"]
          notes: string | null
          organization_id: string | null
          page: string | null
          section: string | null
          source_id: string
          support_excerpt: string | null
          table_reference: string | null
          updated_at: string
        }
        Insert: {
          artifact_id?: string | null
          chapter?: string | null
          clause?: string | null
          created_at?: string
          created_by?: string | null
          external_anchor?: string | null
          figure?: string | null
          id?: string
          locator_type: Database["public"]["Enums"]["methodology_locator_type"]
          notes?: string | null
          organization_id?: string | null
          page?: string | null
          section?: string | null
          source_id: string
          support_excerpt?: string | null
          table_reference?: string | null
          updated_at?: string
        }
        Update: {
          artifact_id?: string | null
          chapter?: string | null
          clause?: string | null
          created_at?: string
          created_by?: string | null
          external_anchor?: string | null
          figure?: string | null
          id?: string
          locator_type?: Database["public"]["Enums"]["methodology_locator_type"]
          notes?: string | null
          organization_id?: string | null
          page?: string | null
          section?: string | null
          source_id?: string
          support_excerpt?: string | null
          table_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_source_locators_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_locators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_locators_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_source_verifications: {
        Row: {
          id: string
          locator_id: string | null
          notes: string | null
          organization_id: string
          source_id: string
          verification_type: Database["public"]["Enums"]["methodology_verification_type"]
          verified_at: string
          verified_by: string
        }
        Insert: {
          id?: string
          locator_id?: string | null
          notes?: string | null
          organization_id: string
          source_id: string
          verification_type: Database["public"]["Enums"]["methodology_verification_type"]
          verified_at?: string
          verified_by: string
        }
        Update: {
          id?: string
          locator_id?: string | null
          notes?: string | null
          organization_id?: string
          source_id?: string
          verification_type?: Database["public"]["Enums"]["methodology_verification_type"]
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_source_verifications_locator_id_fkey"
            columns: ["locator_id"]
            isOneToOne: false
            referencedRelation: "methodology_source_locators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_source_verifications_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_sources: {
        Row: {
          access_status: Database["public"]["Enums"]["methodology_access_status"]
          authority_level: Database["public"]["Enums"]["methodology_authority_level"]
          authors: string | null
          created_at: string
          created_by: string | null
          doi: string | null
          edition: string | null
          effective_from: string | null
          effective_until: string | null
          external_url: string | null
          id: string
          identifier: string | null
          isbn: string | null
          issuing_body: string | null
          jurisdiction: Database["public"]["Enums"]["methodology_jurisdiction"]
          jurisdiction_detail: string | null
          language: string | null
          notes: string | null
          organization_id: string | null
          publication_date: string | null
          publication_year: number | null
          short_title: string | null
          source_type: Database["public"]["Enums"]["methodology_source_type"]
          status: Database["public"]["Enums"]["methodology_source_status"]
          supersedes_source_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["methodology_access_status"]
          authority_level: Database["public"]["Enums"]["methodology_authority_level"]
          authors?: string | null
          created_at?: string
          created_by?: string | null
          doi?: string | null
          edition?: string | null
          effective_from?: string | null
          effective_until?: string | null
          external_url?: string | null
          id?: string
          identifier?: string | null
          isbn?: string | null
          issuing_body?: string | null
          jurisdiction?: Database["public"]["Enums"]["methodology_jurisdiction"]
          jurisdiction_detail?: string | null
          language?: string | null
          notes?: string | null
          organization_id?: string | null
          publication_date?: string | null
          publication_year?: number | null
          short_title?: string | null
          source_type: Database["public"]["Enums"]["methodology_source_type"]
          status?: Database["public"]["Enums"]["methodology_source_status"]
          supersedes_source_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          access_status?: Database["public"]["Enums"]["methodology_access_status"]
          authority_level?: Database["public"]["Enums"]["methodology_authority_level"]
          authors?: string | null
          created_at?: string
          created_by?: string | null
          doi?: string | null
          edition?: string | null
          effective_from?: string | null
          effective_until?: string | null
          external_url?: string | null
          id?: string
          identifier?: string | null
          isbn?: string | null
          issuing_body?: string | null
          jurisdiction?: Database["public"]["Enums"]["methodology_jurisdiction"]
          jurisdiction_detail?: string | null
          language?: string | null
          notes?: string | null
          organization_id?: string | null
          publication_date?: string | null
          publication_year?: number | null
          short_title?: string | null
          source_type?: Database["public"]["Enums"]["methodology_source_type"]
          status?: Database["public"]["Enums"]["methodology_source_status"]
          supersedes_source_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "methodology_sources_supersedes_source_id_fkey"
            columns: ["supersedes_source_id"]
            isOneToOne: false
            referencedRelation: "methodology_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_units: {
        Row: {
          code: string
          created_at: string
          description: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          name?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
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
          created_at: string
          created_by: string
          id: string
          legal_name: string | null
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          legal_name?: string | null
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          legal_name?: string | null
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          professional_registration: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          professional_registration?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          professional_registration?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line: string | null
          address_normalization_status: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized: string | null
          address_number: string | null
          address_raw: string | null
          bathrooms: number | null
          bedrooms: number | null
          building_units: number | null
          built_area: number | null
          ceiling_height: number | null
          city: string | null
          common_area: number | null
          complement: string | null
          condition_status:
            | Database["public"]["Enums"]["condition_status"]
            | null
          construction_year: number | null
          country: string | null
          country_code: string | null
          created_at: string
          depth: number | null
          description: string | null
          development_id: string | null
          district: string | null
          elevators: number | null
          floor_number: number | null
          frontage: number | null
          furnished_status:
            | Database["public"]["Enums"]["furnished_status"]
            | null
          geo_point: unknown
          half_bathrooms: number | null
          id: string
          land_area: number | null
          latitude: number | null
          longitude: number | null
          occupancy_status:
            | Database["public"]["Enums"]["occupancy_status"]
            | null
          organization_id: string
          orientation: string | null
          parking_spaces: number | null
          position_in_building: string | null
          postal_code: string | null
          private_area: number | null
          property_type: string | null
          property_type_code:
            | Database["public"]["Enums"]["property_type_code"]
            | null
          renovation_year: number | null
          state: string | null
          street_name: string | null
          street_number: string | null
          street_type: string | null
          subdistrict: string | null
          suites: number | null
          topography: string | null
          total_area: number | null
          total_floors: number | null
          units_per_floor: number | null
          updated_at: string
          usable_area: number | null
          valuation_case_id: string
          view_type: string | null
        }
        Insert: {
          address_line?: string | null
          address_normalization_status?: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized?: string | null
          address_number?: string | null
          address_raw?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_units?: number | null
          built_area?: number | null
          ceiling_height?: number | null
          city?: string | null
          common_area?: number | null
          complement?: string | null
          condition_status?:
            | Database["public"]["Enums"]["condition_status"]
            | null
          construction_year?: number | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          depth?: number | null
          description?: string | null
          development_id?: string | null
          district?: string | null
          elevators?: number | null
          floor_number?: number | null
          frontage?: number | null
          furnished_status?:
            | Database["public"]["Enums"]["furnished_status"]
            | null
          geo_point?: unknown
          half_bathrooms?: number | null
          id?: string
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          occupancy_status?:
            | Database["public"]["Enums"]["occupancy_status"]
            | null
          organization_id: string
          orientation?: string | null
          parking_spaces?: number | null
          position_in_building?: string | null
          postal_code?: string | null
          private_area?: number | null
          property_type?: string | null
          property_type_code?:
            | Database["public"]["Enums"]["property_type_code"]
            | null
          renovation_year?: number | null
          state?: string | null
          street_name?: string | null
          street_number?: string | null
          street_type?: string | null
          subdistrict?: string | null
          suites?: number | null
          topography?: string | null
          total_area?: number | null
          total_floors?: number | null
          units_per_floor?: number | null
          updated_at?: string
          usable_area?: number | null
          valuation_case_id: string
          view_type?: string | null
        }
        Update: {
          address_line?: string | null
          address_normalization_status?: Database["public"]["Enums"]["address_normalization_status"]
          address_normalized?: string | null
          address_number?: string | null
          address_raw?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_units?: number | null
          built_area?: number | null
          ceiling_height?: number | null
          city?: string | null
          common_area?: number | null
          complement?: string | null
          condition_status?:
            | Database["public"]["Enums"]["condition_status"]
            | null
          construction_year?: number | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          depth?: number | null
          description?: string | null
          development_id?: string | null
          district?: string | null
          elevators?: number | null
          floor_number?: number | null
          frontage?: number | null
          furnished_status?:
            | Database["public"]["Enums"]["furnished_status"]
            | null
          geo_point?: unknown
          half_bathrooms?: number | null
          id?: string
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          occupancy_status?:
            | Database["public"]["Enums"]["occupancy_status"]
            | null
          organization_id?: string
          orientation?: string | null
          parking_spaces?: number | null
          position_in_building?: string | null
          postal_code?: string | null
          private_area?: number | null
          property_type?: string | null
          property_type_code?:
            | Database["public"]["Enums"]["property_type_code"]
            | null
          renovation_year?: number | null
          state?: string | null
          street_name?: string | null
          street_number?: string | null
          street_type?: string | null
          subdistrict?: string | null
          suites?: number | null
          topography?: string | null
          total_area?: number | null
          total_floors?: number | null
          units_per_floor?: number | null
          updated_at?: string
          usable_area?: number | null
          valuation_case_id?: string
          view_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_case_org_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "properties_development_fk"
            columns: ["organization_id", "valuation_case_id", "development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_valuation_case_id_fkey"
            columns: ["valuation_case_id"]
            isOneToOne: true
            referencedRelation: "valuation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      property_attribute_observations: {
        Row: {
          attribute_name: string
          created_at: string
          created_by: string
          evidence_field_id: string | null
          evidence_source_id: string | null
          id: string
          knowledge_state: Database["public"]["Enums"]["knowledge_state"]
          market_property_id: string | null
          normalized_value: string | null
          notes: string | null
          numeric_value: number | null
          observed_at: string | null
          organization_id: string
          raw_value: string | null
          subject_property_id: string | null
          unit: string | null
          valuation_case_id: string
          value_origin: Database["public"]["Enums"]["value_origin"]
        }
        Insert: {
          attribute_name: string
          created_at?: string
          created_by: string
          evidence_field_id?: string | null
          evidence_source_id?: string | null
          id?: string
          knowledge_state?: Database["public"]["Enums"]["knowledge_state"]
          market_property_id?: string | null
          normalized_value?: string | null
          notes?: string | null
          numeric_value?: number | null
          observed_at?: string | null
          organization_id: string
          raw_value?: string | null
          subject_property_id?: string | null
          unit?: string | null
          valuation_case_id: string
          value_origin: Database["public"]["Enums"]["value_origin"]
        }
        Update: {
          attribute_name?: string
          created_at?: string
          created_by?: string
          evidence_field_id?: string | null
          evidence_source_id?: string | null
          id?: string
          knowledge_state?: Database["public"]["Enums"]["knowledge_state"]
          market_property_id?: string | null
          normalized_value?: string | null
          notes?: string | null
          numeric_value?: number | null
          observed_at?: string | null
          organization_id?: string
          raw_value?: string | null
          subject_property_id?: string | null
          unit?: string | null
          valuation_case_id?: string
          value_origin?: Database["public"]["Enums"]["value_origin"]
        }
        Relationships: [
          {
            foreignKeyName: "attr_obs_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attr_obs_field_fk"
            columns: ["organization_id", "evidence_field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attr_obs_market_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_property_id",
            ]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "attr_obs_source_fk"
            columns: ["organization_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attr_obs_subject_fk"
            columns: ["organization_id", "subject_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "property_attribute_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_canonical_facts: {
        Row: {
          adopted_at: string
          adopted_by: string
          adopted_from_observation_id: string | null
          adopted_numeric_value: number | null
          adopted_unit: string | null
          adopted_value: string | null
          adoption_reason: string
          attribute_name: string
          created_at: string
          id: string
          market_property_id: string | null
          organization_id: string
          subject_property_id: string | null
          superseded_at: string | null
          superseded_by_fact_id: string | null
          valuation_case_id: string
        }
        Insert: {
          adopted_at?: string
          adopted_by: string
          adopted_from_observation_id?: string | null
          adopted_numeric_value?: number | null
          adopted_unit?: string | null
          adopted_value?: string | null
          adoption_reason: string
          attribute_name: string
          created_at?: string
          id?: string
          market_property_id?: string | null
          organization_id: string
          subject_property_id?: string | null
          superseded_at?: string | null
          superseded_by_fact_id?: string | null
          valuation_case_id: string
        }
        Update: {
          adopted_at?: string
          adopted_by?: string
          adopted_from_observation_id?: string | null
          adopted_numeric_value?: number | null
          adopted_unit?: string | null
          adopted_value?: string | null
          adoption_reason?: string
          attribute_name?: string
          created_at?: string
          id?: string
          market_property_id?: string | null
          organization_id?: string
          subject_property_id?: string | null
          superseded_at?: string | null
          superseded_by_fact_id?: string | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canonical_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "canonical_market_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "market_property_id",
            ]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "canonical_observation_fk"
            columns: ["organization_id", "adopted_from_observation_id"]
            isOneToOne: false
            referencedRelation: "property_attribute_observations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "canonical_subject_fk"
            columns: ["organization_id", "subject_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "property_canonical_facts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_match_candidates: {
        Row: {
          created_at: string
          created_by: string
          deterministic_signals: Json
          id: string
          left_market_property_id: string
          match_status: Database["public"]["Enums"]["property_match_status"]
          organization_id: string
          reason_codes: string[]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          right_market_property_id: string
          valuation_case_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deterministic_signals?: Json
          id?: string
          left_market_property_id: string
          match_status?: Database["public"]["Enums"]["property_match_status"]
          organization_id: string
          reason_codes?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          right_market_property_id: string
          valuation_case_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deterministic_signals?: Json
          id?: string
          left_market_property_id?: string
          match_status?: Database["public"]["Enums"]["property_match_status"]
          organization_id?: string
          reason_codes?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          right_market_property_id?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "match_left_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "left_market_property_id",
            ]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "match_right_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "right_market_property_id",
            ]
            isOneToOne: false
            referencedRelation: "market_properties"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "property_match_candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_research_runs: {
        Row: {
          ai_calls_actual: number
          completed_at: string | null
          created_at: string
          extraction_model: string | null
          extractions_actual: number
          failure_reason: string | null
          fetches_actual: number
          id: string
          location_city: string | null
          location_country: string | null
          location_region: string | null
          max_extractions: number
          max_fetches: number
          max_search_uses: number
          max_sources: number
          objective: string
          organization_id: string
          provider: string
          requested_by: string
          research_model: string | null
          research_type: Database["public"]["Enums"]["research_type"]
          search_uses_actual: number
          started_at: string | null
          status: Database["public"]["Enums"]["research_run_status"]
          subject_property_id: string | null
          updated_at: string
          valuation_case_id: string
        }
        Insert: {
          ai_calls_actual?: number
          completed_at?: string | null
          created_at?: string
          extraction_model?: string | null
          extractions_actual?: number
          failure_reason?: string | null
          fetches_actual?: number
          id?: string
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
          max_extractions?: number
          max_fetches?: number
          max_search_uses?: number
          max_sources?: number
          objective: string
          organization_id: string
          provider?: string
          requested_by: string
          research_model?: string | null
          research_type: Database["public"]["Enums"]["research_type"]
          search_uses_actual?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["research_run_status"]
          subject_property_id?: string | null
          updated_at?: string
          valuation_case_id: string
        }
        Update: {
          ai_calls_actual?: number
          completed_at?: string | null
          created_at?: string
          extraction_model?: string | null
          extractions_actual?: number
          failure_reason?: string | null
          fetches_actual?: number
          id?: string
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
          max_extractions?: number
          max_fetches?: number
          max_search_uses?: number
          max_sources?: number
          objective?: string
          organization_id?: string
          provider?: string
          requested_by?: string
          research_model?: string | null
          research_type?: Database["public"]["Enums"]["research_type"]
          search_uses_actual?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["research_run_status"]
          subject_property_id?: string | null
          updated_at?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_research_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prr_case_fk"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "prr_subject_fk"
            columns: ["organization_id", "subject_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      research_context_snapshots: {
        Row: {
          captured_at: string
          created_at: string
          created_by: string
          fact_references: Json
          facts: Json
          id: string
          organization_id: string
          research_run_id: string
          schema_version: string
          subject_property_id: string | null
          valuation_case_id: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          created_by: string
          fact_references?: Json
          facts: Json
          id?: string
          organization_id: string
          research_run_id: string
          schema_version?: string
          subject_property_id?: string | null
          valuation_case_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          created_by?: string
          fact_references?: Json
          facts?: Json
          id?: string
          organization_id?: string
          research_run_id?: string
          schema_version?: string
          subject_property_id?: string | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rcs_run_fk"
            columns: ["organization_id", "valuation_case_id", "research_run_id"]
            isOneToOne: false
            referencedRelation: "property_research_runs"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "research_context_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_entity_candidate_fields: {
        Row: {
          candidate_id: string
          created_at: string
          evidence_field_id: string
          id: string
          organization_id: string
          semantic_role: string
          valuation_case_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evidence_field_id: string
          id?: string
          organization_id: string
          semantic_role: string
          valuation_case_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evidence_field_id?: string
          id?: string
          organization_id?: string
          semantic_role?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recf_candidate_fk"
            columns: ["organization_id", "valuation_case_id", "candidate_id"]
            isOneToOne: false
            referencedRelation: "research_entity_candidates"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "recf_field_fk"
            columns: ["organization_id", "evidence_field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "research_entity_candidate_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_entity_candidates: {
        Row: {
          candidate_type: Database["public"]["Enums"]["research_candidate_type"]
          created_at: string
          created_by: string
          evidence_artifact_id: string | null
          evidence_extraction_id: string | null
          evidence_source_id: string | null
          id: string
          organization_id: string
          promoted_market_observation_id: string | null
          promoted_market_property_id: string | null
          rejection_reason: string | null
          research_run_id: string
          research_search_result_id: string | null
          status: Database["public"]["Enums"]["research_candidate_status"]
          updated_at: string
          valuation_case_id: string
        }
        Insert: {
          candidate_type: Database["public"]["Enums"]["research_candidate_type"]
          created_at?: string
          created_by: string
          evidence_artifact_id?: string | null
          evidence_extraction_id?: string | null
          evidence_source_id?: string | null
          id?: string
          organization_id: string
          promoted_market_observation_id?: string | null
          promoted_market_property_id?: string | null
          rejection_reason?: string | null
          research_run_id: string
          research_search_result_id?: string | null
          status?: Database["public"]["Enums"]["research_candidate_status"]
          updated_at?: string
          valuation_case_id: string
        }
        Update: {
          candidate_type?: Database["public"]["Enums"]["research_candidate_type"]
          created_at?: string
          created_by?: string
          evidence_artifact_id?: string | null
          evidence_extraction_id?: string | null
          evidence_source_id?: string | null
          id?: string
          organization_id?: string
          promoted_market_observation_id?: string | null
          promoted_market_property_id?: string | null
          rejection_reason?: string | null
          research_run_id?: string
          research_search_result_id?: string | null
          status?: Database["public"]["Enums"]["research_candidate_status"]
          updated_at?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rec_artifact_fk"
            columns: ["organization_id", "evidence_artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "rec_extraction_fk"
            columns: ["organization_id", "evidence_extraction_id"]
            isOneToOne: false
            referencedRelation: "evidence_extractions"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "rec_result_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "research_search_result_id",
            ]
            isOneToOne: false
            referencedRelation: "research_search_results"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "rec_run_fk"
            columns: ["organization_id", "valuation_case_id", "research_run_id"]
            isOneToOne: false
            referencedRelation: "property_research_runs"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "rec_source_fk"
            columns: ["organization_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "research_entity_candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_extraction_issues: {
        Row: {
          created_at: string
          detail: string | null
          evidence_extraction_id: string | null
          evidence_field_id: string | null
          id: string
          issue_type: string
          organization_id: string
          payload: Json | null
          research_run_id: string | null
          valuation_case_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          evidence_extraction_id?: string | null
          evidence_field_id?: string | null
          id?: string
          issue_type: string
          organization_id: string
          payload?: Json | null
          research_run_id?: string | null
          valuation_case_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          evidence_extraction_id?: string | null
          evidence_field_id?: string | null
          id?: string
          issue_type?: string
          organization_id?: string
          payload?: Json | null
          research_run_id?: string | null
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rei_field_fk"
            columns: ["organization_id", "evidence_field_id"]
            isOneToOne: false
            referencedRelation: "evidence_fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "research_extraction_issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_field_taxonomy: {
        Row: {
          applies_to: string
          created_at: string
          data_kind: string
          field_name: string
          taxonomy_version: string
        }
        Insert: {
          applies_to: string
          created_at?: string
          data_kind: string
          field_name: string
          taxonomy_version?: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          data_kind?: string
          field_name?: string
          taxonomy_version?: string
        }
        Relationships: []
      }
      research_queries: {
        Row: {
          ai_run_id: string | null
          created_at: string
          created_by: string
          executed_at: string | null
          generated_by: Database["public"]["Enums"]["research_query_origin"]
          id: string
          input_fact_references: Json
          organization_id: string
          purpose: string | null
          query_text: string
          research_run_id: string
          result_count: number
          status: Database["public"]["Enums"]["research_query_status"]
          valuation_case_id: string
        }
        Insert: {
          ai_run_id?: string | null
          created_at?: string
          created_by: string
          executed_at?: string | null
          generated_by: Database["public"]["Enums"]["research_query_origin"]
          id?: string
          input_fact_references?: Json
          organization_id: string
          purpose?: string | null
          query_text: string
          research_run_id: string
          result_count?: number
          status?: Database["public"]["Enums"]["research_query_status"]
          valuation_case_id: string
        }
        Update: {
          ai_run_id?: string | null
          created_at?: string
          created_by?: string
          executed_at?: string | null
          generated_by?: Database["public"]["Enums"]["research_query_origin"]
          id?: string
          input_fact_references?: Json
          organization_id?: string
          purpose?: string | null
          query_text?: string
          research_run_id?: string
          result_count?: number
          status?: Database["public"]["Enums"]["research_query_status"]
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_queries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rq_run_fk"
            columns: ["organization_id", "valuation_case_id", "research_run_id"]
            isOneToOne: false
            referencedRelation: "property_research_runs"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
        ]
      }
      research_result_query_hits: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          rank: number | null
          research_query_id: string
          research_search_result_id: string
          returned_at: string
          valuation_case_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          rank?: number | null
          research_query_id: string
          research_search_result_id: string
          returned_at?: string
          valuation_case_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          rank?: number | null
          research_query_id?: string
          research_search_result_id?: string
          returned_at?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_result_query_hits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rqh_query_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "research_query_id",
            ]
            isOneToOne: false
            referencedRelation: "research_queries"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "rqh_result_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "research_search_result_id",
            ]
            isOneToOne: false
            referencedRelation: "research_search_results"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
        ]
      }
      research_search_results: {
        Row: {
          canonical_url: string
          capture_failure_reason: string | null
          capture_status: Database["public"]["Enums"]["research_capture_status"]
          created_at: string
          created_by: string
          domain: string
          evidence_artifact_id: string | null
          evidence_source_id: string | null
          id: string
          organization_id: string
          page_age: string | null
          provider: string
          provider_result_reference: string | null
          rank: number | null
          raw_payload_hash: string | null
          raw_result_payload: Json | null
          research_query_id: string | null
          research_run_id: string
          returned_at: string
          selection_status: Database["public"]["Enums"]["research_selection_status"]
          snippet: string | null
          title: string | null
          updated_at: string
          url: string
          valuation_case_id: string
        }
        Insert: {
          canonical_url: string
          capture_failure_reason?: string | null
          capture_status?: Database["public"]["Enums"]["research_capture_status"]
          created_at?: string
          created_by: string
          domain: string
          evidence_artifact_id?: string | null
          evidence_source_id?: string | null
          id?: string
          organization_id: string
          page_age?: string | null
          provider: string
          provider_result_reference?: string | null
          rank?: number | null
          raw_payload_hash?: string | null
          raw_result_payload?: Json | null
          research_query_id?: string | null
          research_run_id: string
          returned_at?: string
          selection_status?: Database["public"]["Enums"]["research_selection_status"]
          snippet?: string | null
          title?: string | null
          updated_at?: string
          url: string
          valuation_case_id: string
        }
        Update: {
          canonical_url?: string
          capture_failure_reason?: string | null
          capture_status?: Database["public"]["Enums"]["research_capture_status"]
          created_at?: string
          created_by?: string
          domain?: string
          evidence_artifact_id?: string | null
          evidence_source_id?: string | null
          id?: string
          organization_id?: string
          page_age?: string | null
          provider?: string
          provider_result_reference?: string | null
          rank?: number | null
          raw_payload_hash?: string | null
          raw_result_payload?: Json | null
          research_query_id?: string | null
          research_run_id?: string
          returned_at?: string
          selection_status?: Database["public"]["Enums"]["research_selection_status"]
          snippet?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_search_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsr_artifact_fk"
            columns: ["organization_id", "evidence_artifact_id"]
            isOneToOne: false
            referencedRelation: "evidence_artifacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "rsr_query_fk"
            columns: [
              "organization_id",
              "valuation_case_id",
              "research_query_id",
            ]
            isOneToOne: false
            referencedRelation: "research_queries"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "rsr_run_fk"
            columns: ["organization_id", "valuation_case_id", "research_run_id"]
            isOneToOne: false
            referencedRelation: "property_research_runs"
            referencedColumns: ["organization_id", "valuation_case_id", "id"]
          },
          {
            foreignKeyName: "rsr_source_fk"
            columns: ["organization_id", "evidence_source_id"]
            isOneToOne: false
            referencedRelation: "evidence_sources"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      research_source_domain_policies: {
        Row: {
          created_at: string
          created_by: string
          domain: string
          id: string
          notes: string | null
          organization_id: string
          policy_status: Database["public"]["Enums"]["domain_policy_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          domain: string
          id?: string
          notes?: string | null
          organization_id: string
          policy_status?: Database["public"]["Enums"]["domain_policy_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          domain?: string
          id?: string
          notes?: string | null
          organization_id?: string
          policy_status?: Database["public"]["Enums"]["domain_policy_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_source_domain_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_usage_events: {
        Row: {
          actor_user_id: string
          cache_read_tokens: number | null
          cache_write_tokens: number | null
          created_at: string
          id: string
          input_tokens: number | null
          model: string | null
          organization_id: string
          output_tokens: number | null
          provider: string | null
          quantity: number
          research_run_id: string | null
          server_tool_uses: number | null
          usage_type: string
          valuation_case_id: string | null
        }
        Insert: {
          actor_user_id: string
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          organization_id: string
          output_tokens?: number | null
          provider?: string | null
          quantity?: number
          research_run_id?: string | null
          server_tool_uses?: number | null
          usage_type: string
          valuation_case_id?: string | null
        }
        Update: {
          actor_user_id?: string
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          organization_id?: string
          output_tokens?: number | null
          provider?: string | null
          quantity?: number
          research_run_id?: string | null
          server_tool_uses?: number | null
          usage_type?: string
          valuation_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_readiness_assessments: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledgement_notes: string | null
          computed_by: string
          created_at: string
          created_by: string | null
          diagnostic_policy_id: string | null
          diagnostic_policy_version: string
          feature_derivation_version: string
          hard_blockers: Json
          id: string
          market_evidence_snapshot_id: string | null
          metrics: Json
          organization_id: string
          readiness_state: Database["public"]["Enums"]["sample_readiness_state"]
          sample_selection_snapshot_id: string | null
          valuation_case_id: string
          version_number: number
          warnings: Json
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgement_notes?: string | null
          computed_by?: string
          created_at?: string
          created_by?: string | null
          diagnostic_policy_id?: string | null
          diagnostic_policy_version: string
          feature_derivation_version: string
          hard_blockers: Json
          id?: string
          market_evidence_snapshot_id?: string | null
          metrics: Json
          organization_id: string
          readiness_state: Database["public"]["Enums"]["sample_readiness_state"]
          sample_selection_snapshot_id?: string | null
          valuation_case_id: string
          version_number: number
          warnings: Json
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgement_notes?: string | null
          computed_by?: string
          created_at?: string
          created_by?: string | null
          diagnostic_policy_id?: string | null
          diagnostic_policy_version?: string
          feature_derivation_version?: string
          hard_blockers?: Json
          id?: string
          market_evidence_snapshot_id?: string | null
          metrics?: Json
          organization_id?: string
          readiness_state?: Database["public"]["Enums"]["sample_readiness_state"]
          sample_selection_snapshot_id?: string | null
          valuation_case_id?: string
          version_number?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sample_readiness_assessments_diagnostic_policy_id_fkey"
            columns: ["diagnostic_policy_id"]
            isOneToOne: false
            referencedRelation: "market_diagnostic_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_readiness_assessments_market_evidence_snapshot_id_fkey"
            columns: ["market_evidence_snapshot_id"]
            isOneToOne: false
            referencedRelation: "market_evidence_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_readiness_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_readiness_assessments_organization_id_valuation_cas_fkey"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sample_readiness_assessments_sample_selection_snapshot_id_fkey"
            columns: ["sample_selection_snapshot_id"]
            isOneToOne: false
            referencedRelation: "sample_selection_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_selection_items: {
        Row: {
          actor_user_id: string | null
          comparable_candidate_id: string | null
          created_at: string
          decided_at: string | null
          final_state: Database["public"]["Enums"]["sample_selection_state"]
          id: string
          initial_state: Database["public"]["Enums"]["sample_selection_state"]
          market_observation_id: string
          market_property_id: string
          organization_id: string
          reason: string | null
          reason_code: string | null
          selection_run_id: string
          valuation_case_id: string
        }
        Insert: {
          actor_user_id?: string | null
          comparable_candidate_id?: string | null
          created_at?: string
          decided_at?: string | null
          final_state?: Database["public"]["Enums"]["sample_selection_state"]
          id?: string
          initial_state?: Database["public"]["Enums"]["sample_selection_state"]
          market_observation_id: string
          market_property_id: string
          organization_id: string
          reason?: string | null
          reason_code?: string | null
          selection_run_id: string
          valuation_case_id: string
        }
        Update: {
          actor_user_id?: string | null
          comparable_candidate_id?: string | null
          created_at?: string
          decided_at?: string | null
          final_state?: Database["public"]["Enums"]["sample_selection_state"]
          id?: string
          initial_state?: Database["public"]["Enums"]["sample_selection_state"]
          market_observation_id?: string
          market_property_id?: string
          organization_id?: string
          reason?: string | null
          reason_code?: string | null
          selection_run_id?: string
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_selection_items_comparable_candidate_id_fkey"
            columns: ["comparable_candidate_id"]
            isOneToOne: false
            referencedRelation: "comparable_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_selection_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_selection_items_selection_run_id_fkey"
            columns: ["selection_run_id"]
            isOneToOne: false
            referencedRelation: "sample_selection_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_selection_runs: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          market_evidence_snapshot_id: string
          notes: string | null
          organization_id: string
          purpose: string
          selection_policy_version: string
          status: Database["public"]["Enums"]["sample_selection_run_status"]
          valuation_case_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          market_evidence_snapshot_id: string
          notes?: string | null
          organization_id: string
          purpose: string
          selection_policy_version?: string
          status?: Database["public"]["Enums"]["sample_selection_run_status"]
          valuation_case_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          market_evidence_snapshot_id?: string
          notes?: string | null
          organization_id?: string
          purpose?: string
          selection_policy_version?: string
          status?: Database["public"]["Enums"]["sample_selection_run_status"]
          valuation_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_selection_runs_market_evidence_snapshot_id_fkey"
            columns: ["market_evidence_snapshot_id"]
            isOneToOne: false
            referencedRelation: "market_evidence_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_selection_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_selection_runs_organization_id_valuation_case_id_fkey"
            columns: ["organization_id", "valuation_case_id"]
            isOneToOne: false
            referencedRelation: "valuation_cases"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sample_selection_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          excluded_count: number
          feature_derivation_version: string
          hash_algorithm: string
          id: string
          market_evidence_snapshot_id: string
          organization_id: string
          schema_version: string
          selected_count: number
          selection_run_id: string
          snapshot_hash: string
          snapshot_manifest: Json
          valuation_case_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          excluded_count: number
          feature_derivation_version: string
          hash_algorithm?: string
          id?: string
          market_evidence_snapshot_id: string
          organization_id: string
          schema_version: string
          selected_count: number
          selection_run_id: string
          snapshot_hash: string
          snapshot_manifest: Json
          valuation_case_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          excluded_count?: number
          feature_derivation_version?: string
          hash_algorithm?: string
          id?: string
          market_evidence_snapshot_id?: string
          organization_id?: string
          schema_version?: string
          selected_count?: number
          selection_run_id?: string
          snapshot_hash?: string
          snapshot_manifest?: Json
          valuation_case_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sample_selection_snapshots_market_evidence_snapshot_id_fkey"
            columns: ["market_evidence_snapshot_id"]
            isOneToOne: false
            referencedRelation: "market_evidence_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_selection_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_selection_snapshots_selection_run_id_fkey"
            columns: ["selection_run_id"]
            isOneToOne: true
            referencedRelation: "sample_selection_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_cases: {
        Row: {
          case_code: string
          created_at: string
          created_by: string
          id: string
          organization_id: string
          purpose: string | null
          status: Database["public"]["Enums"]["case_status"]
          title: string
          updated_at: string
          valuation_date: string | null
        }
        Insert: {
          case_code: string
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          purpose?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title: string
          updated_at?: string
          valuation_date?: string | null
        }
        Update: {
          case_code?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          purpose?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title?: string
          updated_at?: string
          valuation_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_methods: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          family_code: string
          id: string
          name: string
          organization_id: string | null
          status: Database["public"]["Enums"]["method_lifecycle_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          family_code: string
          id?: string
          name: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["method_lifecycle_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          family_code?: string
          id?: string
          name?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["method_lifecycle_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_methods_family_code_fkey"
            columns: ["family_code"]
            isOneToOne: false
            referencedRelation: "methodology_families"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "valuation_methods_organization_id_fkey"
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
      acknowledge_market_data_issue: {
        Args: { _issue_id: string; _notes: string }
        Returns: string
      }
      acknowledge_readiness_warnings: {
        Args: { _assessment_id: string; _notes: string }
        Returns: string
      }
      adopt_canonical_fact: {
        Args: {
          _attribute_name: string
          _market_property_id: string
          _observation_id: string
          _reason: string
          _subject_property_id: string
        }
        Returns: string
      }
      approve_method_specification: {
        Args: { _notes?: string; _spec_id: string }
        Returns: Json
      }
      assess_sample_readiness: {
        Args: {
          _case_id: string
          _market_evidence_snapshot_id: string
          _policy_id: string
          _sample_selection_snapshot_id: string
        }
        Returns: string
      }
      audit_write_internal: {
        Args: {
          _after: Json
          _before: Json
          _case: string
          _entity_id: string
          _entity_type: string
          _event_type: string
          _metadata: Json
          _org: string
        }
        Returns: string
      }
      build_comparable_feature_snapshot: {
        Args: { _candidate_id: string }
        Returns: string
      }
      build_specification_manifest: {
        Args: { _spec_id: string }
        Returns: Json
      }
      can_review: { Args: { _org: string }; Returns: boolean }
      can_write: { Args: { _org: string }; Returns: boolean }
      complete_sample_selection: {
        Args: { _notes: string; _run_id: string }
        Returns: string
      }
      confirm_market_identity_cluster: {
        Args: {
          _case_id: string
          _market_property_ids: string[]
          _reason: string
          _representative_market_property_id: string
        }
        Returns: string
      }
      create_market_evidence_snapshot: {
        Args: { _case_id: string; _description: string }
        Returns: string
      }
      current_actor_organization: { Args: never; Returns: string }
      current_org_role: {
        Args: { _org: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      decide_comparable: {
        Args: {
          _candidate_id: string
          _candidate_status: Database["public"]["Enums"]["comparable_candidate_status"]
          _inclusion_status: Database["public"]["Enums"]["comparable_inclusion_status"]
          _notes: string
          _reason_code: string
        }
        Returns: string
      }
      decide_sample_selection_item: {
        Args: {
          _final_state: Database["public"]["Enums"]["sample_selection_state"]
          _market_observation_id: string
          _reason: string
          _reason_code: string
          _run_id: string
        }
        Returns: string
      }
      distance_between_properties_meters: {
        Args: {
          _left_market_property_id: string
          _right_market_property_id: string
        }
        Returns: number
      }
      distance_subject_to_market_property_meters: {
        Args: { _market_property_id: string; _subject_property_id: string }
        Returns: number
      }
      freeze_dataset: {
        Args: { _confirmation: string; _dataset_version_id: string }
        Returns: Json
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      in_privileged_op: { Args: never; Returns: boolean }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      market_intelligence_report: { Args: { _case_id: string }; Returns: Json }
      market_source_domain: {
        Args: { _portal: string; _publisher: string; _url: string }
        Returns: string
      }
      market_universe_metrics: { Args: { _case_id: string }; Returns: Json }
      p_unit_unknown: { Args: { _unit: string }; Returns: boolean }
      promote_research_candidate: {
        Args: {
          _candidate_id: string
          _field_ids: string[]
          _label: string
          _market_property_id: string
          _notes: string
          _observation_status: Database["public"]["Enums"]["market_observation_status"]
          _observation_type: Database["public"]["Enums"]["market_observation_type"]
        }
        Returns: Json
      }
      record_price_observation: {
        Args: {
          _asking_monthly_rent: number
          _asking_price: number
          _evidence_field_id: string
          _evidence_source_id: string
          _notes: string
          _observation_id: string
          _observed_at: string
          _status: Database["public"]["Enums"]["market_observation_status"]
        }
        Returns: string
      }
      refresh_market_data_issues: {
        Args: { _case_id: string; _policy_id: string }
        Returns: Json
      }
      reject_evidence_field: {
        Args: { _field_id: string; _reason: string }
        Returns: string
      }
      reject_method_specification: {
        Args: { _reason: string; _spec_id: string }
        Returns: string
      }
      resolve_market_data_issue: {
        Args: { _issue_id: string; _notes: string }
        Returns: string
      }
      resolve_methodology_source_conflict: {
        Args: {
          _conflict_id: string
          _professional_resolution: string
          _resolution_status: Database["public"]["Enums"]["methodology_conflict_status"]
        }
        Returns: string
      }
      resolve_property_match: {
        Args: {
          _match_id: string
          _notes: string
          _status: Database["public"]["Enums"]["property_match_status"]
        }
        Returns: string
      }
      revise_evidence_field: {
        Args: {
          _field_id: string
          _field_state: Database["public"]["Enums"]["field_state"]
          _normalized_value: string
          _numeric_value: number
          _raw_value: string
          _reason: string
          _source_excerpt: string
          _source_locator: Json
          _unit: string
        }
        Returns: string
      }
      specification_completeness: { Args: { _spec_id: string }; Returns: Json }
      start_sample_selection: {
        Args: {
          _case_id: string
          _market_evidence_snapshot_id: string
          _notes: string
          _purpose: string
        }
        Returns: string
      }
      submit_method_specification: {
        Args: { _notes?: string; _spec_id: string }
        Returns: string
      }
      transition_case_status: {
        Args: {
          _case_id: string
          _next_status: Database["public"]["Enums"]["case_status"]
          _reason: string
        }
        Returns: Database["public"]["Enums"]["case_status"]
      }
      verify_evidence_field: {
        Args: { _field_id: string; _notes: string }
        Returns: string
      }
      verify_methodology_source: {
        Args: {
          _locator_id?: string
          _notes?: string
          _source_id: string
          _verification_type: Database["public"]["Enums"]["methodology_verification_type"]
        }
        Returns: string
      }
      verify_snapshot_integrity: {
        Args: { _kind: string; _snapshot_id: string }
        Returns: Json
      }
      verify_specification_integrity: {
        Args: { _spec_id: string }
        Returns: Json
      }
      write_audit_event: {
        Args: {
          _after: Json
          _before: Json
          _case: string
          _entity_id: string
          _entity_type: string
          _event_type: string
          _metadata: Json
          _org: string
        }
        Returns: string
      }
    }
    Enums: {
      address_normalization_status:
        | "NOT_ATTEMPTED"
        | "CANDIDATE"
        | "VERIFIED"
        | "AMBIGUOUS"
        | "FAILED"
      ai_run_status:
        | "PENDING"
        | "RUNNING"
        | "COMPLETED"
        | "FAILED"
        | "DISCARDED"
      capture_method:
        | "ANTHROPIC_WEB_SEARCH_RESULT"
        | "ANTHROPIC_WEB_FETCH"
        | "DIRECT_HTTP"
        | "USER_UPLOAD"
        | "EXTERNAL_API"
        | "OTHER"
      case_status:
        | "DRAFT"
        | "EVIDENCE_COLLECTION"
        | "DATA_REVIEW"
        | "DATASET_FROZEN"
        | "VALUATION"
        | "REVIEW"
        | "COMPLETED"
        | "ARCHIVED"
      comparable_candidate_status:
        | "DISCOVERED"
        | "UNDER_REVIEW"
        | "ELIGIBLE"
        | "INELIGIBLE"
      comparable_inclusion_status: "NOT_DECIDED" | "INCLUDED" | "EXCLUDED"
      condition_status:
        | "UNKNOWN"
        | "NEW"
        | "RENOVATED"
        | "GOOD"
        | "REGULAR"
        | "POOR"
        | "UNDER_RENOVATION"
        | "RUIN"
      development_type:
        | "BUILDING"
        | "GATED_COMMUNITY"
        | "CONDOMINIUM"
        | "MIXED_USE_COMPLEX"
        | "COMMERCIAL_COMPLEX"
        | "INDUSTRIAL_COMPLEX"
        | "OTHER"
      diagnostic_policy_status: "ACTIVE" | "SUPERSEDED"
      domain_policy_status: "ALLOWED" | "REVIEW_REQUIRED" | "BLOCKED"
      extraction_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "REVIEW_REQUIRED"
      extraction_support_status:
        | "EXPLICIT_TEXT"
        | "EXPLICIT_STRUCTURED_DATA"
        | "VISUAL_EVIDENCE"
        | "AMBIGUOUS"
        | "NOT_FOUND"
        | "UNSUPPORTED"
      field_state:
        | "PRESENT"
        | "NOT_FOUND"
        | "NOT_INFORMED"
        | "NOT_VERIFIABLE"
        | "DIVERGENT"
        | "PENDING_VALIDATION"
      furnished_status:
        | "UNKNOWN"
        | "UNFURNISHED"
        | "PARTIALLY_FURNISHED"
        | "FURNISHED"
      issue_resolution_type: "SYSTEM" | "HUMAN"
      knowledge_state:
        | "KNOWN"
        | "UNKNOWN"
        | "NOT_APPLICABLE"
        | "CONFLICTING"
        | "PENDING_VERIFICATION"
      market_data_issue_severity: "INFO" | "WARNING" | "BLOCKER"
      market_data_issue_status:
        | "OPEN"
        | "ACKNOWLEDGED"
        | "RESOLVED"
        | "NOT_APPLICABLE"
      market_data_issue_type:
        | "MISSING_CRITICAL_FIELD"
        | "CONFLICTING_ATTRIBUTE"
        | "UNRESOLVED_DUPLICATE"
        | "SOURCE_CONCENTRATION"
        | "TEMPORAL_CONCENTRATION"
        | "SPATIAL_CONCENTRATION"
        | "UNVERIFIED_PRICE"
        | "UNVERIFIED_TRANSACTION"
        | "MISSING_GEO"
        | "MISSING_DATE"
        | "BROKEN_LINEAGE"
        | "SUPPORT_CHECK_FAILED"
        | "OTHER"
      market_observation_status:
        | "ACTIVE"
        | "INACTIVE"
        | "REMOVED"
        | "EXPIRED"
        | "UNKNOWN"
      market_observation_type:
        | "SALE_LISTING"
        | "CLOSED_SALE"
        | "RENT_LISTING"
        | "CLOSED_RENT"
        | "BROKER_QUOTE"
        | "APPRAISAL_REFERENCE"
        | "OTHER"
      member_status: "ACTIVE" | "SUSPENDED" | "REMOVED"
      method_applicability_result:
        | "METHOD_APPLICABLE"
        | "METHOD_APPLICABLE_WITH_CONDITIONS"
        | "METHOD_NOT_APPLICABLE"
        | "METHOD_REQUIRES_PROFESSIONAL_REVIEW"
      method_implementation_status:
        | "NOT_IMPLEMENTED"
        | "IN_DEVELOPMENT"
        | "AVAILABLE"
        | "VALIDATED"
        | "DEPRECATED"
        | "SUSPENDED"
      method_lifecycle_status:
        | "CONCEPT"
        | "SPECIFICATION_IN_PROGRESS"
        | "SPECIFICATION_REVIEW"
        | "APPROVED_FOR_IMPLEMENTATION"
        | "IMPLEMENTED"
        | "VALIDATED"
        | "DEPRECATED"
        | "SUSPENDED"
      method_spec_section_key:
        | "PURPOSE"
        | "INTENDED_USE"
        | "APPLICABILITY"
        | "NON_APPLICABILITY"
        | "REQUIRED_INPUTS"
        | "OPTIONAL_INPUTS"
        | "DATA_REQUIREMENTS"
        | "RULES"
        | "FORMULAS"
        | "ASSUMPTIONS"
        | "DIAGNOSTICS"
        | "LIMITATIONS"
        | "OUTPUTS"
        | "UNCERTAINTY"
        | "REPORTING_REQUIREMENTS"
        | "SOURCE_REFERENCES"
        | "TEST_REQUIREMENTS"
        | "KNOWN_RISKS"
      method_spec_status:
        | "DRAFT"
        | "UNDER_REVIEW"
        | "APPROVED"
        | "SUPERSEDED"
        | "SUSPENDED"
        | "REJECTED"
      method_test_type:
        | "UNIT"
        | "BOUNDARY"
        | "NEGATIVE"
        | "COMPLIANCE"
        | "REPRODUCIBILITY"
        | "NUMERIC"
        | "AUDITABILITY"
      methodology_access_status:
        | "METADATA_ONLY"
        | "PUBLICLY_ACCESSIBLE"
        | "USER_PROVIDED_COPY"
        | "LICENSED_COPY"
        | "INTERNAL_AUTHORIZED_COPY"
      methodology_authority_level:
        | "PRIMARY_NORMATIVE"
        | "PRIMARY_REGULATORY"
        | "PROFESSIONAL_STANDARD"
        | "AUTHORITATIVE_GUIDANCE"
        | "PEER_REVIEWED_RESEARCH"
        | "ESTABLISHED_TECHNICAL_LITERATURE"
        | "SECONDARY_GUIDANCE"
        | "INTERNAL_SPECIFICATION"
      methodology_change_status:
        | "OPEN"
        | "UNDER_REVIEW"
        | "APPROVED"
        | "REJECTED"
        | "IMPLEMENTED"
        | "WITHDRAWN"
      methodology_change_type:
        | "NEW_RULE"
        | "MODIFY_RULE"
        | "REMOVE_RULE"
        | "NEW_SOURCE"
        | "SOURCE_SUPERSEDED"
        | "FORMULA_CHANGE"
        | "PARAMETER_CHANGE"
        | "SCOPE_CHANGE"
        | "TEST_CHANGE"
        | "BUG_FIX"
      methodology_conflict_status:
        | "OPEN"
        | "UNDER_ANALYSIS"
        | "RESOLVED"
        | "NOT_A_CONFLICT"
      methodology_crosswalk_relationship:
        | "RELATED"
        | "SIMILAR_CONCEPT"
        | "COMPLEMENTARY"
        | "POTENTIAL_CONFLICT"
      methodology_data_type:
        | "NUMBER"
        | "INTEGER"
        | "PERCENT"
        | "RATIO"
        | "MONEY"
        | "DATE"
        | "BOOLEAN"
        | "TEXT"
        | "ENUM"
        | "COUNT"
      methodology_expression_language: "SYMBOLIC"
      methodology_formula_status:
        | "DRAFT"
        | "UNDER_REVIEW"
        | "APPROVED"
        | "SUPERSEDED"
      methodology_jurisdiction:
        | "BRAZIL"
        | "INTERNATIONAL"
        | "STATE"
        | "MUNICIPAL"
        | "ORGANIZATIONAL"
        | "NOT_SPECIFIED"
      methodology_locator_type:
        | "CLAUSE"
        | "SECTION"
        | "PAGE"
        | "CHAPTER"
        | "FIGURE"
        | "TABLE"
        | "ANNEX"
        | "EXTERNAL_ANCHOR"
        | "OTHER"
      methodology_normative_strength:
        | "MANDATORY"
        | "RECOMMENDED"
        | "PERMITTED"
        | "PROHIBITED"
        | "INTERNAL_CONTROL"
      methodology_output_type:
        | "ESTIMATED_VALUE"
        | "VALUE_INTERVAL"
        | "UNIT_VALUE"
        | "DIAGNOSTICS"
        | "WARNINGS"
        | "ASSUMPTIONS"
        | "USED_EVIDENCE"
        | "EXCLUDED_EVIDENCE"
        | "UNCERTAINTY"
        | "COMPLIANCE"
      methodology_rule_status:
        | "DRAFT"
        | "UNDER_REVIEW"
        | "APPROVED"
        | "SUPERSEDED"
        | "REJECTED"
      methodology_rule_type:
        | "APPLICABILITY"
        | "REQUIREMENT"
        | "INPUT_REQUIREMENT"
        | "TRANSFORMATION"
        | "FORMULA"
        | "VALIDATION"
        | "DIAGNOSTIC"
        | "WARNING"
        | "BLOCKER"
        | "OUTPUT"
        | "REPORTING"
        | "PROHIBITION"
        | "HUMAN_DECISION"
        | "OTHER"
      methodology_source_relationship:
        | "DIRECT_REQUIREMENT"
        | "DIRECT_PROHIBITION"
        | "TECHNICAL_SUPPORT"
        | "INTERPRETATION"
        | "BACKGROUND"
        | "INTERNAL_DESIGN"
      methodology_source_status:
        | "DRAFT"
        | "ACTIVE"
        | "SUPERSEDED"
        | "REVOKED"
        | "ARCHIVED"
        | "PENDING_METADATA_REVIEW"
      methodology_source_type:
        | "TECHNICAL_STANDARD"
        | "LAW"
        | "REGULATION"
        | "PROFESSIONAL_STANDARD"
        | "PROFESSIONAL_GUIDANCE"
        | "COURT_OR_OFFICIAL_RULE"
        | "ACADEMIC_PAPER"
        | "BOOK"
        | "TECHNICAL_ARTICLE"
        | "COURSE_MATERIAL"
        | "INTERNAL_POLICY"
        | "OTHER"
      methodology_verification_type:
        | "METADATA_VERIFIED"
        | "CONTENT_VERIFIED"
        | "LOCATOR_VERIFIED"
      occupancy_status:
        | "UNKNOWN"
        | "VACANT"
        | "OWNER_OCCUPIED"
        | "TENANT_OCCUPIED"
        | "UNDER_CONSTRUCTION"
        | "OTHER"
      org_role: "OWNER" | "ADMIN" | "VALUER" | "REVIEWER" | "VIEWER"
      processor_type:
        | "MANUAL"
        | "DETERMINISTIC_PARSER"
        | "OCR"
        | "LLM"
        | "COMPUTER_VISION"
        | "EXTERNAL_API"
      property_match_status:
        | "CANDIDATE"
        | "CONFIRMED_SAME"
        | "CONFIRMED_DIFFERENT"
        | "UNRESOLVED"
      property_type_code:
        | "APARTMENT"
        | "HOUSE"
        | "CONDOMINIUM_HOUSE"
        | "PENTHOUSE"
        | "STUDIO"
        | "RESIDENTIAL_LAND"
        | "COMMERCIAL_ROOM"
        | "OFFICE"
        | "RETAIL"
        | "WAREHOUSE"
        | "LOGISTICS_PROPERTY"
        | "INDUSTRIAL_PROPERTY"
        | "COMMERCIAL_BUILDING"
        | "MIXED_USE"
        | "URBAN_LAND"
        | "RURAL_PROPERTY"
        | "OTHER"
      quality_dimension_state:
        | "NOT_ASSESSED"
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "NOT_APPLICABLE"
      research_candidate_status:
        | "DISCOVERED"
        | "CAPTURED"
        | "EXTRACTED"
        | "REVIEW_REQUIRED"
        | "READY_TO_PROMOTE"
        | "PROMOTED"
        | "REJECTED"
      research_candidate_type:
        | "MARKET_PROPERTY"
        | "SALE_LISTING"
        | "CLOSED_SALE"
        | "RENT_LISTING"
        | "CLOSED_RENT"
        | "SUBJECT_PROPERTY_INFORMATION"
      research_capture_status:
        | "NOT_CAPTURED"
        | "CAPTURING"
        | "CAPTURED"
        | "FAILED"
        | "ACCESS_RESTRICTED"
        | "BLOCKED_BY_POLICY"
        | "DUPLICATE"
      research_query_origin: "AI" | "USER"
      research_query_status:
        | "PROPOSED"
        | "APPROVED"
        | "EXECUTED"
        | "DISCARDED"
        | "FAILED"
      research_run_status:
        | "DRAFT"
        | "PLANNING"
        | "PLAN_READY"
        | "SEARCHING"
        | "RESULTS_READY"
        | "CAPTURING"
        | "EXTRACTING"
        | "REVIEW_REQUIRED"
        | "COMPLETED"
        | "FAILED"
        | "CANCELLED"
      research_selection_status: "UNREVIEWED" | "SELECTED" | "REJECTED"
      research_type:
        | "SUBJECT_PROPERTY_FACTS"
        | "COMPARABLE_DISCOVERY"
        | "TRANSACTION_DISCOVERY"
        | "MARKET_DISCOVERY"
      sample_readiness_state:
        | "NOT_ASSESSED"
        | "READY_FOR_METHOD_REVIEW"
        | "READY_WITH_WARNINGS"
        | "NOT_READY"
      sample_selection_run_status:
        | "DRAFT"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "ABANDONED"
      sample_selection_state:
        | "AVAILABLE"
        | "REVIEWING"
        | "SELECTED"
        | "EXCLUDED"
      seller_type:
        | "OWNER"
        | "BROKER"
        | "REAL_ESTATE_AGENCY"
        | "DEVELOPER"
        | "UNKNOWN"
      source_type:
        | "OFFICIAL_PUBLIC_SOURCE"
        | "PUBLIC_REGISTRY"
        | "PRIVATE_DOCUMENT"
        | "TRANSACTION_EVIDENCE"
        | "REAL_ESTATE_LISTING"
        | "BROKER_INFORMATION"
        | "USER_PROVIDED"
        | "FIELD_INSPECTION"
        | "OTHER"
      support_check_status:
        | "EXACT_MATCH"
        | "NORMALIZED_MATCH"
        | "VISUAL_ONLY"
        | "FAILED"
        | "NOT_APPLICABLE"
      transaction_evidence_status:
        | "DOCUMENTED"
        | "MULTI_SOURCE_CONFIRMED"
        | "DECLARED"
        | "UNVERIFIED"
      validation_status:
        | "CAPTURED"
        | "EXTRACTED"
        | "PENDING_REVIEW"
        | "VERIFIED"
        | "REJECTED"
      value_origin:
        | "MANUAL_USER_INPUT"
        | "EVIDENCE_EXTRACTION"
        | "EXTERNAL_API"
        | "DETERMINISTIC_DERIVATION"
        | "FIELD_INSPECTION"
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
      address_normalization_status: [
        "NOT_ATTEMPTED",
        "CANDIDATE",
        "VERIFIED",
        "AMBIGUOUS",
        "FAILED",
      ],
      ai_run_status: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "DISCARDED"],
      capture_method: [
        "ANTHROPIC_WEB_SEARCH_RESULT",
        "ANTHROPIC_WEB_FETCH",
        "DIRECT_HTTP",
        "USER_UPLOAD",
        "EXTERNAL_API",
        "OTHER",
      ],
      case_status: [
        "DRAFT",
        "EVIDENCE_COLLECTION",
        "DATA_REVIEW",
        "DATASET_FROZEN",
        "VALUATION",
        "REVIEW",
        "COMPLETED",
        "ARCHIVED",
      ],
      comparable_candidate_status: [
        "DISCOVERED",
        "UNDER_REVIEW",
        "ELIGIBLE",
        "INELIGIBLE",
      ],
      comparable_inclusion_status: ["NOT_DECIDED", "INCLUDED", "EXCLUDED"],
      condition_status: [
        "UNKNOWN",
        "NEW",
        "RENOVATED",
        "GOOD",
        "REGULAR",
        "POOR",
        "UNDER_RENOVATION",
        "RUIN",
      ],
      development_type: [
        "BUILDING",
        "GATED_COMMUNITY",
        "CONDOMINIUM",
        "MIXED_USE_COMPLEX",
        "COMMERCIAL_COMPLEX",
        "INDUSTRIAL_COMPLEX",
        "OTHER",
      ],
      diagnostic_policy_status: ["ACTIVE", "SUPERSEDED"],
      domain_policy_status: ["ALLOWED", "REVIEW_REQUIRED", "BLOCKED"],
      extraction_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "REVIEW_REQUIRED",
      ],
      extraction_support_status: [
        "EXPLICIT_TEXT",
        "EXPLICIT_STRUCTURED_DATA",
        "VISUAL_EVIDENCE",
        "AMBIGUOUS",
        "NOT_FOUND",
        "UNSUPPORTED",
      ],
      field_state: [
        "PRESENT",
        "NOT_FOUND",
        "NOT_INFORMED",
        "NOT_VERIFIABLE",
        "DIVERGENT",
        "PENDING_VALIDATION",
      ],
      furnished_status: [
        "UNKNOWN",
        "UNFURNISHED",
        "PARTIALLY_FURNISHED",
        "FURNISHED",
      ],
      issue_resolution_type: ["SYSTEM", "HUMAN"],
      knowledge_state: [
        "KNOWN",
        "UNKNOWN",
        "NOT_APPLICABLE",
        "CONFLICTING",
        "PENDING_VERIFICATION",
      ],
      market_data_issue_severity: ["INFO", "WARNING", "BLOCKER"],
      market_data_issue_status: [
        "OPEN",
        "ACKNOWLEDGED",
        "RESOLVED",
        "NOT_APPLICABLE",
      ],
      market_data_issue_type: [
        "MISSING_CRITICAL_FIELD",
        "CONFLICTING_ATTRIBUTE",
        "UNRESOLVED_DUPLICATE",
        "SOURCE_CONCENTRATION",
        "TEMPORAL_CONCENTRATION",
        "SPATIAL_CONCENTRATION",
        "UNVERIFIED_PRICE",
        "UNVERIFIED_TRANSACTION",
        "MISSING_GEO",
        "MISSING_DATE",
        "BROKEN_LINEAGE",
        "SUPPORT_CHECK_FAILED",
        "OTHER",
      ],
      market_observation_status: [
        "ACTIVE",
        "INACTIVE",
        "REMOVED",
        "EXPIRED",
        "UNKNOWN",
      ],
      market_observation_type: [
        "SALE_LISTING",
        "CLOSED_SALE",
        "RENT_LISTING",
        "CLOSED_RENT",
        "BROKER_QUOTE",
        "APPRAISAL_REFERENCE",
        "OTHER",
      ],
      member_status: ["ACTIVE", "SUSPENDED", "REMOVED"],
      method_applicability_result: [
        "METHOD_APPLICABLE",
        "METHOD_APPLICABLE_WITH_CONDITIONS",
        "METHOD_NOT_APPLICABLE",
        "METHOD_REQUIRES_PROFESSIONAL_REVIEW",
      ],
      method_implementation_status: [
        "NOT_IMPLEMENTED",
        "IN_DEVELOPMENT",
        "AVAILABLE",
        "VALIDATED",
        "DEPRECATED",
        "SUSPENDED",
      ],
      method_lifecycle_status: [
        "CONCEPT",
        "SPECIFICATION_IN_PROGRESS",
        "SPECIFICATION_REVIEW",
        "APPROVED_FOR_IMPLEMENTATION",
        "IMPLEMENTED",
        "VALIDATED",
        "DEPRECATED",
        "SUSPENDED",
      ],
      method_spec_section_key: [
        "PURPOSE",
        "INTENDED_USE",
        "APPLICABILITY",
        "NON_APPLICABILITY",
        "REQUIRED_INPUTS",
        "OPTIONAL_INPUTS",
        "DATA_REQUIREMENTS",
        "RULES",
        "FORMULAS",
        "ASSUMPTIONS",
        "DIAGNOSTICS",
        "LIMITATIONS",
        "OUTPUTS",
        "UNCERTAINTY",
        "REPORTING_REQUIREMENTS",
        "SOURCE_REFERENCES",
        "TEST_REQUIREMENTS",
        "KNOWN_RISKS",
      ],
      method_spec_status: [
        "DRAFT",
        "UNDER_REVIEW",
        "APPROVED",
        "SUPERSEDED",
        "SUSPENDED",
        "REJECTED",
      ],
      method_test_type: [
        "UNIT",
        "BOUNDARY",
        "NEGATIVE",
        "COMPLIANCE",
        "REPRODUCIBILITY",
        "NUMERIC",
        "AUDITABILITY",
      ],
      methodology_access_status: [
        "METADATA_ONLY",
        "PUBLICLY_ACCESSIBLE",
        "USER_PROVIDED_COPY",
        "LICENSED_COPY",
        "INTERNAL_AUTHORIZED_COPY",
      ],
      methodology_authority_level: [
        "PRIMARY_NORMATIVE",
        "PRIMARY_REGULATORY",
        "PROFESSIONAL_STANDARD",
        "AUTHORITATIVE_GUIDANCE",
        "PEER_REVIEWED_RESEARCH",
        "ESTABLISHED_TECHNICAL_LITERATURE",
        "SECONDARY_GUIDANCE",
        "INTERNAL_SPECIFICATION",
      ],
      methodology_change_status: [
        "OPEN",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "IMPLEMENTED",
        "WITHDRAWN",
      ],
      methodology_change_type: [
        "NEW_RULE",
        "MODIFY_RULE",
        "REMOVE_RULE",
        "NEW_SOURCE",
        "SOURCE_SUPERSEDED",
        "FORMULA_CHANGE",
        "PARAMETER_CHANGE",
        "SCOPE_CHANGE",
        "TEST_CHANGE",
        "BUG_FIX",
      ],
      methodology_conflict_status: [
        "OPEN",
        "UNDER_ANALYSIS",
        "RESOLVED",
        "NOT_A_CONFLICT",
      ],
      methodology_crosswalk_relationship: [
        "RELATED",
        "SIMILAR_CONCEPT",
        "COMPLEMENTARY",
        "POTENTIAL_CONFLICT",
      ],
      methodology_data_type: [
        "NUMBER",
        "INTEGER",
        "PERCENT",
        "RATIO",
        "MONEY",
        "DATE",
        "BOOLEAN",
        "TEXT",
        "ENUM",
        "COUNT",
      ],
      methodology_expression_language: ["SYMBOLIC"],
      methodology_formula_status: [
        "DRAFT",
        "UNDER_REVIEW",
        "APPROVED",
        "SUPERSEDED",
      ],
      methodology_jurisdiction: [
        "BRAZIL",
        "INTERNATIONAL",
        "STATE",
        "MUNICIPAL",
        "ORGANIZATIONAL",
        "NOT_SPECIFIED",
      ],
      methodology_locator_type: [
        "CLAUSE",
        "SECTION",
        "PAGE",
        "CHAPTER",
        "FIGURE",
        "TABLE",
        "ANNEX",
        "EXTERNAL_ANCHOR",
        "OTHER",
      ],
      methodology_normative_strength: [
        "MANDATORY",
        "RECOMMENDED",
        "PERMITTED",
        "PROHIBITED",
        "INTERNAL_CONTROL",
      ],
      methodology_output_type: [
        "ESTIMATED_VALUE",
        "VALUE_INTERVAL",
        "UNIT_VALUE",
        "DIAGNOSTICS",
        "WARNINGS",
        "ASSUMPTIONS",
        "USED_EVIDENCE",
        "EXCLUDED_EVIDENCE",
        "UNCERTAINTY",
        "COMPLIANCE",
      ],
      methodology_rule_status: [
        "DRAFT",
        "UNDER_REVIEW",
        "APPROVED",
        "SUPERSEDED",
        "REJECTED",
      ],
      methodology_rule_type: [
        "APPLICABILITY",
        "REQUIREMENT",
        "INPUT_REQUIREMENT",
        "TRANSFORMATION",
        "FORMULA",
        "VALIDATION",
        "DIAGNOSTIC",
        "WARNING",
        "BLOCKER",
        "OUTPUT",
        "REPORTING",
        "PROHIBITION",
        "HUMAN_DECISION",
        "OTHER",
      ],
      methodology_source_relationship: [
        "DIRECT_REQUIREMENT",
        "DIRECT_PROHIBITION",
        "TECHNICAL_SUPPORT",
        "INTERPRETATION",
        "BACKGROUND",
        "INTERNAL_DESIGN",
      ],
      methodology_source_status: [
        "DRAFT",
        "ACTIVE",
        "SUPERSEDED",
        "REVOKED",
        "ARCHIVED",
        "PENDING_METADATA_REVIEW",
      ],
      methodology_source_type: [
        "TECHNICAL_STANDARD",
        "LAW",
        "REGULATION",
        "PROFESSIONAL_STANDARD",
        "PROFESSIONAL_GUIDANCE",
        "COURT_OR_OFFICIAL_RULE",
        "ACADEMIC_PAPER",
        "BOOK",
        "TECHNICAL_ARTICLE",
        "COURSE_MATERIAL",
        "INTERNAL_POLICY",
        "OTHER",
      ],
      methodology_verification_type: [
        "METADATA_VERIFIED",
        "CONTENT_VERIFIED",
        "LOCATOR_VERIFIED",
      ],
      occupancy_status: [
        "UNKNOWN",
        "VACANT",
        "OWNER_OCCUPIED",
        "TENANT_OCCUPIED",
        "UNDER_CONSTRUCTION",
        "OTHER",
      ],
      org_role: ["OWNER", "ADMIN", "VALUER", "REVIEWER", "VIEWER"],
      processor_type: [
        "MANUAL",
        "DETERMINISTIC_PARSER",
        "OCR",
        "LLM",
        "COMPUTER_VISION",
        "EXTERNAL_API",
      ],
      property_match_status: [
        "CANDIDATE",
        "CONFIRMED_SAME",
        "CONFIRMED_DIFFERENT",
        "UNRESOLVED",
      ],
      property_type_code: [
        "APARTMENT",
        "HOUSE",
        "CONDOMINIUM_HOUSE",
        "PENTHOUSE",
        "STUDIO",
        "RESIDENTIAL_LAND",
        "COMMERCIAL_ROOM",
        "OFFICE",
        "RETAIL",
        "WAREHOUSE",
        "LOGISTICS_PROPERTY",
        "INDUSTRIAL_PROPERTY",
        "COMMERCIAL_BUILDING",
        "MIXED_USE",
        "URBAN_LAND",
        "RURAL_PROPERTY",
        "OTHER",
      ],
      quality_dimension_state: [
        "NOT_ASSESSED",
        "LOW",
        "MEDIUM",
        "HIGH",
        "NOT_APPLICABLE",
      ],
      research_candidate_status: [
        "DISCOVERED",
        "CAPTURED",
        "EXTRACTED",
        "REVIEW_REQUIRED",
        "READY_TO_PROMOTE",
        "PROMOTED",
        "REJECTED",
      ],
      research_candidate_type: [
        "MARKET_PROPERTY",
        "SALE_LISTING",
        "CLOSED_SALE",
        "RENT_LISTING",
        "CLOSED_RENT",
        "SUBJECT_PROPERTY_INFORMATION",
      ],
      research_capture_status: [
        "NOT_CAPTURED",
        "CAPTURING",
        "CAPTURED",
        "FAILED",
        "ACCESS_RESTRICTED",
        "BLOCKED_BY_POLICY",
        "DUPLICATE",
      ],
      research_query_origin: ["AI", "USER"],
      research_query_status: [
        "PROPOSED",
        "APPROVED",
        "EXECUTED",
        "DISCARDED",
        "FAILED",
      ],
      research_run_status: [
        "DRAFT",
        "PLANNING",
        "PLAN_READY",
        "SEARCHING",
        "RESULTS_READY",
        "CAPTURING",
        "EXTRACTING",
        "REVIEW_REQUIRED",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
      ],
      research_selection_status: ["UNREVIEWED", "SELECTED", "REJECTED"],
      research_type: [
        "SUBJECT_PROPERTY_FACTS",
        "COMPARABLE_DISCOVERY",
        "TRANSACTION_DISCOVERY",
        "MARKET_DISCOVERY",
      ],
      sample_readiness_state: [
        "NOT_ASSESSED",
        "READY_FOR_METHOD_REVIEW",
        "READY_WITH_WARNINGS",
        "NOT_READY",
      ],
      sample_selection_run_status: [
        "DRAFT",
        "IN_PROGRESS",
        "COMPLETED",
        "ABANDONED",
      ],
      sample_selection_state: [
        "AVAILABLE",
        "REVIEWING",
        "SELECTED",
        "EXCLUDED",
      ],
      seller_type: [
        "OWNER",
        "BROKER",
        "REAL_ESTATE_AGENCY",
        "DEVELOPER",
        "UNKNOWN",
      ],
      source_type: [
        "OFFICIAL_PUBLIC_SOURCE",
        "PUBLIC_REGISTRY",
        "PRIVATE_DOCUMENT",
        "TRANSACTION_EVIDENCE",
        "REAL_ESTATE_LISTING",
        "BROKER_INFORMATION",
        "USER_PROVIDED",
        "FIELD_INSPECTION",
        "OTHER",
      ],
      support_check_status: [
        "EXACT_MATCH",
        "NORMALIZED_MATCH",
        "VISUAL_ONLY",
        "FAILED",
        "NOT_APPLICABLE",
      ],
      transaction_evidence_status: [
        "DOCUMENTED",
        "MULTI_SOURCE_CONFIRMED",
        "DECLARED",
        "UNVERIFIED",
      ],
      validation_status: [
        "CAPTURED",
        "EXTRACTED",
        "PENDING_REVIEW",
        "VERIFIED",
        "REJECTED",
      ],
      value_origin: [
        "MANUAL_USER_INPUT",
        "EVIDENCE_EXTRACTION",
        "EXTERNAL_API",
        "DETERMINISTIC_DERIVATION",
        "FIELD_INSPECTION",
      ],
    },
  },
} as const
