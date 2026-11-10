CREATE POLICY developers_deny_direct_access
  ON public.developers
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
