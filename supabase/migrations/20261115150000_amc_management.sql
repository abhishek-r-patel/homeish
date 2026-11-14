CREATE TABLE public.amc_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  asset_label text NOT NULL CHECK (char_length(btrim(asset_label)) BETWEEN 1 AND 120),
  vendor_name text NOT NULL CHECK (char_length(btrim(vendor_name)) BETWEEN 1 AND 120),
  vendor_contact text NOT NULL CHECK (char_length(btrim(vendor_contact)) BETWEEN 1 AND 120),
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  cost_paise bigint NOT NULL CHECK (cost_paise BETWEEN 0 AND 9007199254740991),
  payment_terms text NOT NULL CHECK (char_length(payment_terms) <= 1000),
  visit_frequency text NOT NULL CHECK (char_length(visit_frequency) BETWEEN 1 AND 120),
  document_path text,
  predecessor_id uuid,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  last_reminder_days integer,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  UNIQUE (predecessor_id),
  FOREIGN KEY (society_id, predecessor_id) REFERENCES public.amc_contracts(society_id, id),
  CHECK (predecessor_id IS DISTINCT FROM id)
);
CREATE INDEX amc_contracts_expiry_idx ON public.amc_contracts(society_id, end_date);
CREATE INDEX amc_contracts_created_by_idx ON public.amc_contracts(created_by);
CREATE INDEX amc_contracts_updated_by_idx ON public.amc_contracts(updated_by);
CREATE INDEX amc_contracts_predecessor_idx ON public.amc_contracts(society_id, predecessor_id);

CREATE TABLE public.amc_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL,
  visit_date date NOT NULL,
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 2000),
  technician text NOT NULL CHECK (char_length(btrim(technician)) BETWEEN 1 AND 120),
  document_path text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  FOREIGN KEY (society_id, contract_id) REFERENCES public.amc_contracts(society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX amc_visits_contract_idx ON public.amc_visits(society_id, contract_id, visit_date);
CREATE INDEX amc_visits_created_by_idx ON public.amc_visits(created_by);
CREATE INDEX amc_visits_updated_by_idx ON public.amc_visits(updated_by);

CREATE TABLE public.amc_request_links (
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  request_id uuid PRIMARY KEY,
  contract_id uuid NOT NULL,
  FOREIGN KEY (society_id, request_id) REFERENCES public.service_requests(society_id, id),
  FOREIGN KEY (society_id, contract_id) REFERENCES public.amc_contracts(society_id, id)
);
CREATE INDEX amc_request_links_contract_idx ON public.amc_request_links(society_id, contract_id);
CREATE INDEX amc_request_links_request_idx ON public.amc_request_links(society_id, request_id);

ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_request_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amc_contracts, public.amc_visits, public.amc_request_links
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY amc_contracts_no_direct_access ON public.amc_contracts FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY amc_visits_no_direct_access ON public.amc_visits FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY amc_request_links_no_direct_access ON public.amc_request_links FOR ALL TO authenticated USING(false) WITH CHECK(false);

CREATE FUNCTION private.amc_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE entry jsonb; day_count integer; seen integer[] := '{}';
BEGIN
  IF jsonb_typeof(p_settings) <> 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_settings) AS key WHERE key NOT IN ('reminder_days','expiring_soon_days'))
  THEN RETURN false; END IF;
  IF p_settings ? 'expiring_soon_days' AND (
    jsonb_typeof(p_settings->'expiring_soon_days') <> 'number'
    OR (p_settings->>'expiring_soon_days') !~ '^[0-9]{1,3}$'
    OR (p_settings->>'expiring_soon_days')::integer NOT BETWEEN 1 AND 365
  ) THEN RETURN false; END IF;
  IF p_settings ? 'reminder_days' THEN
    IF jsonb_typeof(p_settings->'reminder_days') <> 'array' THEN RETURN false; END IF;
    IF jsonb_array_length(p_settings->'reminder_days') NOT BETWEEN 1 AND 10 THEN RETURN false; END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_settings->'reminder_days') LOOP
      IF jsonb_typeof(entry) <> 'number' OR entry::text !~ '^[0-9]{1,3}$' THEN RETURN false; END IF;
      day_count := entry::text::integer;
      IF day_count NOT BETWEEN 1 AND 365 OR day_count = ANY(seen) THEN RETURN false; END IF;
      seen := array_append(seen, day_count);
    END LOOP;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.amc_settings_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.amc_settings_valid(jsonb) TO authenticated, service_role;
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_amc_settings_check
  CHECK (module_key <> 'amc' OR private.amc_settings_valid(settings));

CREATE FUNCTION private.amc_authorize(p_society_id uuid, p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id,'amc')
    OR NOT private.has_role(p_society_id, CASE WHEN p_write THEN ARRAY['admin']::text[] ELSE ARRAY['admin','committee']::text[] END)
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN RAISE EXCEPTION 'AMC access is not available.' USING ERRCODE='42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.amc_authorize(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('amc-files','amc-files',false,5242880,ARRAY['image/jpeg','image/png','application/pdf']);

CREATE FUNCTION private.amc_file_scope(p_path text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_path IS NULL OR p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/amc/[0-9a-f-]{36}\.(jpg|png|pdf)$'
    OR split_part(p_path,'/',1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR split_part(p_path,'/',2) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR split_part(p_path,'/',4) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$'
  THEN RETURN NULL; END IF;
  RETURN split_part(p_path,'/',1)::uuid;
END;
$$;
REVOKE ALL ON FUNCTION private.amc_file_scope(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.amc_file_scope(text) TO authenticated, service_role;

CREATE FUNCTION private.amc_file_readable(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.module_enabled(private.amc_file_scope(p_path),'amc')
    AND private.has_role(private.amc_file_scope(p_path),ARRAY['admin','committee']::text[])
    AND (
      (split_part(p_path,'/',2) = auth.uid()::text AND private.has_role(private.amc_file_scope(p_path),ARRAY['admin']::text[]))
      OR EXISTS (SELECT 1 FROM public.amc_contracts WHERE document_path=p_path)
      OR EXISTS (SELECT 1 FROM public.amc_visits WHERE document_path=p_path)
    )
$$;
REVOKE ALL ON FUNCTION private.amc_file_readable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.amc_file_readable(text) TO authenticated, service_role;
CREATE POLICY amc_files_read ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='amc-files' AND private.amc_file_readable(name));
CREATE POLICY amc_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='amc-files' AND private.amc_file_scope(name) IS NOT NULL
    AND split_part(name,'/',2)=auth.uid()::text
    AND private.module_enabled(private.amc_file_scope(name),'amc')
    AND private.society_writable(private.amc_file_scope(name))
    AND private.has_role(private.amc_file_scope(name),ARRAY['admin']::text[]));

CREATE FUNCTION private.amc_verify_file(p_society_id uuid,p_path text,p_existing text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE metadata jsonb; mime text; size_bytes numeric;
BEGIN
  IF p_path IS NULL THEN RETURN; END IF;
  IF private.amc_file_scope(p_path) IS DISTINCT FROM p_society_id
    OR (p_path IS DISTINCT FROM p_existing AND split_part(p_path,'/',2) <> auth.uid()::text)
  THEN RAISE EXCEPTION 'The AMC attachment is not available.' USING ERRCODE='42501'; END IF;
  SELECT object.metadata INTO metadata FROM storage.objects AS object WHERE bucket_id='amc-files' AND name=p_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'AMC attachment not found.' USING ERRCODE='P0002'; END IF;
  mime := metadata->>'mimetype';
  IF COALESCE(metadata->>'size','') !~ '^[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'Invalid AMC attachment size.' USING ERRCODE='22023';
  END IF;
  size_bytes := (metadata->>'size')::numeric;
  IF size_bytes NOT BETWEEN 1 AND 5242880 OR NOT (
    (mime='image/jpeg' AND right(p_path,4)='.jpg') OR
    (mime='image/png' AND right(p_path,4)='.png') OR
    (mime='application/pdf' AND right(p_path,4)='.pdf')
  ) OR mime IS NULL THEN RAISE EXCEPTION 'Invalid AMC attachment.' USING ERRCODE='22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.amc_verify_file(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.amc_contract_save(
  p_society_id uuid,p_contract_id uuid,p_asset_label text,p_vendor_name text,p_vendor_contact text,
  p_start_date date,p_end_date date,p_cost_paise bigint,p_payment_terms text,p_visit_frequency text,
  p_document_path text,p_predecessor_id uuid,p_expected_updated_at timestamptz,
  p_client_request_id uuid,p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_row public.amc_contracts; saved_id uuid;
BEGIN
  PERFORM private.amc_authorize(p_society_id,true);
  IF p_client_request_id IS NULL OR p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
    OR p_start_date IS NULL OR p_end_date IS NULL OR p_start_date>p_end_date
  THEN RAISE EXCEPTION 'Check the AMC details.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_society_id::text||auth.uid()::text||p_client_request_id::text,0));
  IF p_contract_id IS NULL THEN
    SELECT * INTO old_row FROM public.amc_contracts
    WHERE society_id=p_society_id AND created_by=auth.uid() AND client_request_id=p_client_request_id;
    IF FOUND THEN
      IF ROW(old_row.asset_label,old_row.vendor_name,old_row.vendor_contact,old_row.start_date,old_row.end_date,
          old_row.cost_paise,old_row.payment_terms,old_row.visit_frequency,old_row.document_path,old_row.predecessor_id)
        IS DISTINCT FROM ROW(btrim(p_asset_label),btrim(p_vendor_name),btrim(p_vendor_contact),p_start_date,p_end_date,
          p_cost_paise,p_payment_terms,p_visit_frequency,p_document_path,p_predecessor_id)
      THEN RAISE EXCEPTION 'Retry details changed.' USING ERRCODE='23505'; END IF;
      RETURN old_row.id;
    END IF;
    IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid edit version.' USING ERRCODE='22023'; END IF;
    PERFORM private.amc_verify_file(p_society_id,p_document_path,NULL);
    IF p_predecessor_id IS NOT NULL THEN
      PERFORM 1 FROM public.amc_contracts WHERE society_id=p_society_id AND id=p_predecessor_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Previous contract not found.' USING ERRCODE='P0002'; END IF;
    END IF;
    INSERT INTO public.amc_contracts(society_id,asset_label,vendor_name,vendor_contact,start_date,end_date,
      cost_paise,payment_terms,visit_frequency,document_path,predecessor_id,created_by,updated_by,client_request_id)
    VALUES(p_society_id,btrim(p_asset_label),btrim(p_vendor_name),btrim(p_vendor_contact),p_start_date,p_end_date,
      p_cost_paise,p_payment_terms,p_visit_frequency,p_document_path,p_predecessor_id,auth.uid(),auth.uid(),p_client_request_id)
    RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO old_row FROM public.amc_contracts WHERE society_id=p_society_id AND id=p_contract_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found.' USING ERRCODE='P0002'; END IF;
    IF old_row.updated_at IS DISTINCT FROM p_expected_updated_at OR old_row.predecessor_id IS DISTINCT FROM p_predecessor_id
    THEN RAISE EXCEPTION 'Contract changed. Refresh.' USING ERRCODE='23505'; END IF;
    PERFORM private.amc_verify_file(p_society_id,p_document_path,old_row.document_path);
    UPDATE public.amc_contracts SET asset_label=btrim(p_asset_label),vendor_name=btrim(p_vendor_name),
      vendor_contact=btrim(p_vendor_contact),start_date=p_start_date,end_date=p_end_date,cost_paise=p_cost_paise,
      payment_terms=p_payment_terms,visit_frequency=p_visit_frequency,document_path=p_document_path,
      updated_by=auth.uid(),updated_at=clock_timestamp(),
      last_reminder_days=CASE WHEN end_date=p_end_date THEN last_reminder_days ELSE NULL END
    WHERE society_id=p_society_id AND id=p_contract_id;
    saved_id := p_contract_id;
  END IF;
  INSERT INTO public.audit_logs(society_id,actor_id,actor_role,action,entity_type,entity_id,"before","after",request_id)
  VALUES(p_society_id,auth.uid(),'admin','amc.contract.save','amc_contract',saved_id::text,
    CASE WHEN p_contract_id IS NULL THEN NULL ELSE jsonb_build_object('start_date',old_row.start_date,'end_date',old_row.end_date) END,
    jsonb_build_object('start_date',p_start_date,'end_date',p_end_date,'predecessor_id',p_predecessor_id),p_request_trace);
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.amc_visit_save(
  p_society_id uuid,p_contract_id uuid,p_visit_id uuid,p_visit_date date,p_summary text,p_technician text,
  p_document_path text,p_expected_updated_at timestamptz,p_client_request_id uuid,p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_row public.amc_visits; saved_id uuid;
BEGIN
  PERFORM private.amc_authorize(p_society_id,true);
  IF p_visit_date IS NULL OR p_visit_date>private.housekeeping_local_date(p_society_id) OR p_client_request_id IS NULL
    OR p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'Check the service visit details.' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.amc_contracts WHERE society_id=p_society_id AND id=p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found.' USING ERRCODE='P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_society_id::text||auth.uid()::text||p_client_request_id::text,0));
  IF p_visit_id IS NULL THEN
    SELECT * INTO old_row FROM public.amc_visits WHERE society_id=p_society_id AND created_by=auth.uid() AND client_request_id=p_client_request_id;
    IF FOUND THEN
      IF ROW(old_row.contract_id,old_row.visit_date,old_row.summary,old_row.technician,old_row.document_path)
        IS DISTINCT FROM ROW(p_contract_id,p_visit_date,btrim(p_summary),btrim(p_technician),p_document_path)
      THEN RAISE EXCEPTION 'Retry details changed.' USING ERRCODE='23505'; END IF;
      RETURN old_row.id;
    END IF;
    IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid edit version.' USING ERRCODE='22023'; END IF;
    PERFORM private.amc_verify_file(p_society_id,p_document_path,NULL);
    INSERT INTO public.amc_visits(society_id,contract_id,visit_date,summary,technician,document_path,created_by,updated_by,client_request_id)
    VALUES(p_society_id,p_contract_id,p_visit_date,btrim(p_summary),btrim(p_technician),p_document_path,auth.uid(),auth.uid(),p_client_request_id)
    RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO old_row FROM public.amc_visits WHERE society_id=p_society_id AND contract_id=p_contract_id AND id=p_visit_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Visit not found.' USING ERRCODE='P0002'; END IF;
    IF old_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Visit changed. Refresh.' USING ERRCODE='23505'; END IF;
    PERFORM private.amc_verify_file(p_society_id,p_document_path,old_row.document_path);
    UPDATE public.amc_visits SET visit_date=p_visit_date,summary=btrim(p_summary),technician=btrim(p_technician),
      document_path=p_document_path,updated_by=auth.uid(),updated_at=clock_timestamp()
    WHERE id=p_visit_id AND society_id=p_society_id;
    saved_id:=p_visit_id;
  END IF;
  INSERT INTO public.audit_logs(society_id,actor_id,actor_role,action,entity_type,entity_id,"before","after",request_id)
  VALUES(p_society_id,auth.uid(),'admin','amc.visit.save','amc_visit',saved_id::text,
    CASE WHEN p_visit_id IS NULL THEN NULL ELSE jsonb_build_object('visit_date',old_row.visit_date,'summary',old_row.summary,'technician',old_row.technician) END,
    jsonb_build_object('visit_date',p_visit_date,'summary',p_summary,'technician',p_technician),p_request_trace);
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.amc_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE today date; expiring_days integer;
BEGIN
  PERFORM private.amc_authorize(p_society_id,false);
  today := private.housekeeping_local_date(p_society_id);
  SELECT COALESCE((settings->>'expiring_soon_days')::integer,30) INTO expiring_days FROM public.module_configs
    WHERE society_id=p_society_id AND module_key='amc';
  RETURN jsonb_build_object('today',today,'can_manage',private.has_role(p_society_id,ARRAY['admin']::text[]),
    'contracts',COALESCE((SELECT jsonb_agg(to_jsonb(contract)||jsonb_build_object(
      'status',CASE WHEN contract.end_date<today THEN 'expired' WHEN contract.end_date<=today+expiring_days THEN 'expiring' ELSE 'active' END,
      'successor_id',(SELECT id FROM public.amc_contracts WHERE predecessor_id=contract.id)
    ) ORDER BY contract.end_date,contract.id) FROM public.amc_contracts AS contract WHERE society_id=p_society_id),'[]'::jsonb),
    'visits',COALESCE((SELECT jsonb_agg(to_jsonb(visit) ORDER BY visit_date DESC,id) FROM public.amc_visits AS visit WHERE society_id=p_society_id),'[]'::jsonb),
    'links',COALESCE((SELECT jsonb_agg(jsonb_build_object('request_id',request_id,'contract_id',contract_id)) FROM public.amc_request_links WHERE society_id=p_society_id),'[]'::jsonb));
END;
$$;

CREATE FUNCTION public.amc_request_link(p_society_id uuid,p_request_id uuid,p_contract_id uuid,p_request_trace text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.amc_authorize(p_society_id,true);
  IF NOT private.module_enabled(p_society_id,'service_request') THEN RAISE EXCEPTION 'Requests are disabled.' USING ERRCODE='42501'; END IF;
  PERFORM public.request_get(p_society_id,p_request_id);
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Invalid request trace.' USING ERRCODE='22023'; END IF;
  IF p_contract_id IS NULL THEN
    DELETE FROM public.amc_request_links WHERE society_id=p_society_id AND request_id=p_request_id;
  ELSE
    PERFORM 1 FROM public.amc_contracts WHERE society_id=p_society_id AND id=p_contract_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found.' USING ERRCODE='P0002'; END IF;
    INSERT INTO public.amc_request_links(society_id,request_id,contract_id) VALUES(p_society_id,p_request_id,p_contract_id)
    ON CONFLICT(request_id) DO UPDATE SET contract_id=EXCLUDED.contract_id;
  END IF;
  INSERT INTO public.audit_logs(society_id,actor_id,actor_role,action,entity_type,entity_id,"after",request_id)
    VALUES(p_society_id,auth.uid(),'admin','amc.request.link','service_request',p_request_id::text,jsonb_build_object('contract_id',p_contract_id),p_request_trace);
END;
$$;

CREATE FUNCTION public.amc_request_label(p_society_id uuid,p_request_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.module_enabled(p_society_id,'amc') OR NOT private.module_enabled(p_society_id,'service_request')
  THEN RAISE EXCEPTION 'AMC request links are disabled.' USING ERRCODE='42501'; END IF;
  PERFORM public.request_get(p_society_id,p_request_id);
  RETURN (SELECT contract.asset_label FROM public.amc_request_links AS link
    JOIN public.amc_contracts AS contract ON contract.society_id=link.society_id AND contract.id=link.contract_id
    WHERE link.society_id=p_society_id AND link.request_id=p_request_id);
END;
$$;

CREATE FUNCTION public.amc_reminders_run(p_society_id uuid,p_request_trace text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE contract public.amc_contracts; today date; days_remaining integer; due_threshold integer;
  reminders jsonb; recipient record; sent integer:=0;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required.' USING ERRCODE='42501'; END IF;
  IF NOT private.module_enabled(p_society_id,'amc') OR NOT private.society_writable(p_society_id) THEN RETURN 0; END IF;
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Invalid reminder trace.' USING ERRCODE='22023'; END IF;
  today:=private.housekeeping_local_date(p_society_id);
  SELECT COALESCE(settings->'reminder_days','[60,30,7]'::jsonb) INTO reminders FROM public.module_configs WHERE society_id=p_society_id AND module_key='amc';
  FOR contract IN SELECT * FROM public.amc_contracts AS candidate
    WHERE candidate.society_id=p_society_id AND NOT EXISTS(SELECT 1 FROM public.amc_contracts WHERE predecessor_id=candidate.id)
    ORDER BY candidate.id FOR UPDATE
  LOOP
    days_remaining:=contract.end_date-today;
    SELECT min(value::text::integer) INTO due_threshold FROM jsonb_array_elements(reminders)
      WHERE value::text::integer>=days_remaining;
    IF due_threshold IS NULL OR (contract.last_reminder_days IS NOT NULL AND contract.last_reminder_days<=due_threshold) THEN CONTINUE; END IF;
    UPDATE public.amc_contracts SET last_reminder_days=due_threshold WHERE id=contract.id;
    FOR recipient IN SELECT user_id FROM public.memberships WHERE society_id=p_society_id
      AND status='active' AND roles && ARRAY['admin','committee']::text[]
    LOOP
      PERFORM private.create_notification(p_society_id,recipient.user_id,'amc_expiry','AMC renewal reminder',
        left(contract.asset_label||' requires renewal review. Check the contract expiry date.',300),
        'amc',contract.id,p_request_trace);
      sent:=sent+1;
    END LOOP;
  END LOOP;
  RETURN sent;
END;
$$;

REVOKE ALL ON FUNCTION public.amc_contract_save(uuid,uuid,text,text,text,date,date,bigint,text,text,text,uuid,timestamptz,uuid,text),
  public.amc_visit_save(uuid,uuid,uuid,date,text,text,text,timestamptz,uuid,text),
  public.amc_workspace(uuid),public.amc_request_link(uuid,uuid,uuid,text),public.amc_request_label(uuid,uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.amc_contract_save(uuid,uuid,text,text,text,date,date,bigint,text,text,text,uuid,timestamptz,uuid,text),
  public.amc_visit_save(uuid,uuid,uuid,date,text,text,text,timestamptz,uuid,text),
  public.amc_workspace(uuid),public.amc_request_link(uuid,uuid,uuid,text),public.amc_request_label(uuid,uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.amc_reminders_run(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amc_reminders_run(uuid,text) TO service_role;
