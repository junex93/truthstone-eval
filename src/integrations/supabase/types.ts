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
      evidence_artifacts: {
        Row: {
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
          sha256_hash: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
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
          sha256_hash?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
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
          sha256_hash?: string | null
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
          unit: string | null
          updated_at: string
          validation_status: Database["public"]["Enums"]["validation_status"]
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
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
          unit?: string | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
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
          address_number: string | null
          bathrooms: number | null
          bedrooms: number | null
          built_area: number | null
          city: string | null
          complement: string | null
          construction_year: number | null
          country: string | null
          created_at: string
          description: string | null
          district: string | null
          floor_number: number | null
          id: string
          land_area: number | null
          latitude: number | null
          longitude: number | null
          organization_id: string
          parking_spaces: number | null
          postal_code: string | null
          private_area: number | null
          property_type: string | null
          state: string | null
          updated_at: string
          valuation_case_id: string
        }
        Insert: {
          address_line?: string | null
          address_number?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_area?: number | null
          city?: string | null
          complement?: string | null
          construction_year?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          floor_number?: number | null
          id?: string
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          parking_spaces?: number | null
          postal_code?: string | null
          private_area?: number | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
          valuation_case_id: string
        }
        Update: {
          address_line?: string | null
          address_number?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_area?: number | null
          city?: string | null
          complement?: string | null
          construction_year?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          floor_number?: number | null
          id?: string
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          parking_spaces?: number | null
          postal_code?: string | null
          private_area?: number | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
          valuation_case_id?: string
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
      can_review: { Args: { _org: string }; Returns: boolean }
      can_write: { Args: { _org: string }; Returns: boolean }
      current_org_role: {
        Args: { _org: string }
        Returns: Database["public"]["Enums"]["org_role"]
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
      ai_run_status:
        | "PENDING"
        | "RUNNING"
        | "COMPLETED"
        | "FAILED"
        | "DISCARDED"
      case_status:
        | "DRAFT"
        | "EVIDENCE_COLLECTION"
        | "DATA_REVIEW"
        | "DATASET_FROZEN"
        | "VALUATION"
        | "REVIEW"
        | "COMPLETED"
        | "ARCHIVED"
      extraction_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "REVIEW_REQUIRED"
      field_state:
        | "PRESENT"
        | "NOT_FOUND"
        | "NOT_INFORMED"
        | "NOT_VERIFIABLE"
        | "DIVERGENT"
        | "PENDING_VALIDATION"
      member_status: "ACTIVE" | "SUSPENDED" | "REMOVED"
      org_role: "OWNER" | "ADMIN" | "VALUER" | "REVIEWER" | "VIEWER"
      processor_type:
        | "MANUAL"
        | "DETERMINISTIC_PARSER"
        | "OCR"
        | "LLM"
        | "COMPUTER_VISION"
        | "EXTERNAL_API"
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
      validation_status:
        | "CAPTURED"
        | "EXTRACTED"
        | "PENDING_REVIEW"
        | "VERIFIED"
        | "REJECTED"
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
      ai_run_status: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "DISCARDED"],
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
      extraction_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "REVIEW_REQUIRED",
      ],
      field_state: [
        "PRESENT",
        "NOT_FOUND",
        "NOT_INFORMED",
        "NOT_VERIFIABLE",
        "DIVERGENT",
        "PENDING_VALIDATION",
      ],
      member_status: ["ACTIVE", "SUSPENDED", "REMOVED"],
      org_role: ["OWNER", "ADMIN", "VALUER", "REVIEWER", "VIEWER"],
      processor_type: [
        "MANUAL",
        "DETERMINISTIC_PARSER",
        "OCR",
        "LLM",
        "COMPUTER_VISION",
        "EXTERNAL_API",
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
      validation_status: [
        "CAPTURED",
        "EXTRACTED",
        "PENDING_REVIEW",
        "VERIFIED",
        "REJECTED",
      ],
    },
  },
} as const
