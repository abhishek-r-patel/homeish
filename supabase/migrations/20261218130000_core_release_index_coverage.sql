-- Complete foreign-key index coverage for the locally verified P54–P57 redesign release.
CREATE INDEX module_setting_access_updated_by_idx
  ON public.module_setting_access (updated_by);
CREATE INDEX person_workspace_preferences_resident_unit_idx
  ON public.person_workspace_preferences (resident_unit_id);
CREATE INDEX platform_website_settings_updated_by_idx
  ON public.platform_website_settings (updated_by);
CREATE INDEX society_feature_requests_created_by_idx
  ON public.society_feature_requests (created_by);
CREATE INDEX society_feature_requests_status_updated_by_idx
  ON public.society_feature_requests (status_updated_by);
CREATE INDEX society_onboarding_records_updated_by_idx
  ON public.society_onboarding_records (updated_by);
CREATE INDEX society_opening_dues_import_run_idx
  ON public.society_opening_dues_imports (society_id, import_run_id);
CREATE INDEX society_opening_dues_imported_by_idx
  ON public.society_opening_dues_imports (imported_by);
CREATE INDEX society_workspace_settings_getting_started_dismissed_by_idx
  ON public.society_workspace_settings (getting_started_dismissed_by);
CREATE INDEX society_workspace_settings_updated_by_idx
  ON public.society_workspace_settings (updated_by);
CREATE INDEX website_enquiries_handled_by_idx
  ON public.website_enquiries (handled_by);
CREATE INDEX workspace_quick_action_defaults_society_idx
  ON public.workspace_quick_action_defaults (society_id);
CREATE INDEX workspace_quick_action_defaults_updated_by_idx
  ON public.workspace_quick_action_defaults (updated_by);
