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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      can_review: { Args: { _org: string }; Returns: boolean }
      can_write: { Args: { _org: string }; Returns: boolean }
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
      reject_evidence_field: {
        Args: { _field_id: string; _reason: string }
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
      knowledge_state:
        | "KNOWN"
        | "UNKNOWN"
        | "NOT_APPLICABLE"
        | "CONFLICTING"
        | "PENDING_VERIFICATION"
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
      knowledge_state: [
        "KNOWN",
        "UNKNOWN",
        "NOT_APPLICABLE",
        "CONFLICTING",
        "PENDING_VERIFICATION",
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
