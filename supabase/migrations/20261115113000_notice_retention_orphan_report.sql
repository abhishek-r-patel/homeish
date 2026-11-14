-- Retention: include unattached notice attachments in the orphan file report
-- (P11). The body is otherwise unchanged from 20261110230000_core_retention.sql.
CREATE OR REPLACE FUNCTION public.housekeeping_retention_run(
  p_today date,
  p_request_trace text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retention_day timestamptz;
  visitor_count integer := 0;
  delivery_count integer := 0;
  pre_approval_count integer := 0;
  pre_approval_reference_count integer := 0;
  request_attachment_count integer := 0;
  request_comment_count integer := 0;
  request_event_count integer := 0;
  request_count integer := 0;
  notification_count integer := 0;
  error_log_count integer := 0;
  audit_log_count integer := 0;
  job_count integer := 0;
  job_run_count integer := 0;
  rate_limit_count integer := 0;
  orphan_visitor_count integer := 0;
  orphan_delivery_count integer := 0;
  orphan_request_count integer := 0;
  orphan_payment_count integer := 0;
  orphan_asset_count integer := 0;
  orphan_notice_count integer := 0;
  orphan_file_report jsonb;
  retention_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Invalid retention arguments.'
      USING ERRCODE = '22023';
  END IF;

  retention_day := p_today::timestamp AT TIME ZONE 'Asia/Kolkata';

  PERFORM pg_catalog.set_config('homeish.retention_purge', 'on', true);

  UPDATE public.visitor_entries AS entry
  SET visitor_name = '[Anonymized]',
      visitor_phone = NULL,
      vehicle_no = NULL,
      photo_path = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE entry.created_at < retention_day - interval '1 year'
    AND (entry.visitor_name <> '[Anonymized]'
      OR entry.visitor_phone IS NOT NULL
      OR entry.vehicle_no IS NOT NULL
      OR entry.photo_path IS NOT NULL)
    AND (
      entry.photo_path IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = 'visitor-photos'
          AND object.name = entry.photo_path
      )
    );
  GET DIAGNOSTICS visitor_count = ROW_COUNT;

  UPDATE public.delivery_entries AS entry
  SET delivery_person = NULL,
      photo_path = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE entry.created_at < retention_day - interval '1 year'
    AND (entry.delivery_person IS NOT NULL OR entry.photo_path IS NOT NULL)
    AND (
      entry.photo_path IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = 'delivery-photos'
          AND object.name = entry.photo_path
      )
    );
  GET DIAGNOSTICS delivery_count = ROW_COUNT;

  UPDATE public.visitor_entries AS entry
  SET pre_approval_id = NULL
  WHERE EXISTS (
    SELECT 1
    FROM public.visitor_pre_approvals AS approval
    WHERE approval.id = entry.pre_approval_id
      AND approval.society_id = entry.society_id
      AND approval.valid_to < retention_day - interval '1 year'
  );
  GET DIAGNOSTICS pre_approval_reference_count = ROW_COUNT;

  DELETE FROM public.visitor_pre_approvals AS approval
  WHERE approval.valid_to < retention_day - interval '1 year'
    AND NOT EXISTS (
      SELECT 1
      FROM public.visitor_entries AS entry
      WHERE entry.pre_approval_id = approval.id
        AND entry.society_id = approval.society_id
    );
  GET DIAGNOSTICS pre_approval_count = ROW_COUNT;

  DELETE FROM public.service_request_attachments AS attachment
  WHERE EXISTS (
    SELECT 1
    FROM public.service_requests AS request
    WHERE request.id = attachment.request_id
      AND request.society_id = attachment.society_id
      AND request.status = 'closed'
      AND request.closed_at < retention_day - interval '2 years'
  )
    AND NOT EXISTS (
      SELECT 1
      FROM storage.objects AS object
      WHERE object.bucket_id = 'request-files'
        AND object.name = attachment.storage_path
    );
  GET DIAGNOSTICS request_attachment_count = ROW_COUNT;

  DELETE FROM public.service_request_comments AS comment
  WHERE EXISTS (
    SELECT 1
    FROM public.service_requests AS request
    WHERE request.id = comment.request_id
      AND request.society_id = comment.society_id
      AND request.status = 'closed'
      AND request.closed_at < retention_day - interval '2 years'
  )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.request_id = comment.request_id
    );
  GET DIAGNOSTICS request_comment_count = ROW_COUNT;

  DELETE FROM public.service_request_events AS event
  WHERE EXISTS (
    SELECT 1
    FROM public.service_requests AS request
    WHERE request.id = event.request_id
      AND request.society_id = event.society_id
      AND request.status = 'closed'
      AND request.closed_at < retention_day - interval '2 years'
  )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.request_id = event.request_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_comments AS comment
      WHERE comment.request_id = event.request_id
    );
  GET DIAGNOSTICS request_event_count = ROW_COUNT;

  DELETE FROM public.service_requests AS request
  WHERE request.status = 'closed'
    AND request.closed_at < retention_day - interval '2 years'
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.request_id = request.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_comments AS comment
      WHERE comment.request_id = request.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_events AS event
      WHERE event.request_id = request.id
    );
  GET DIAGNOSTICS request_count = ROW_COUNT;

  DELETE FROM public.notifications
  WHERE created_at < retention_day - interval '180 days';
  GET DIAGNOSTICS notification_count = ROW_COUNT;

  DELETE FROM public.error_logs
  WHERE created_at < retention_day - interval '90 days';
  GET DIAGNOSTICS error_log_count = ROW_COUNT;

  DELETE FROM public.audit_logs
  WHERE created_at < retention_day - interval '2 years';
  GET DIAGNOSTICS audit_log_count = ROW_COUNT;

  DELETE FROM public.jobs
  WHERE created_at < retention_day - interval '90 days';
  GET DIAGNOSTICS job_count = ROW_COUNT;

  DELETE FROM public.job_run_keys
  WHERE ran_at < retention_day - interval '90 days';
  GET DIAGNOSTICS job_run_count = ROW_COUNT;

  DELETE FROM public.rate_limits
  WHERE window_start < retention_day - interval '1 day';
  GET DIAGNOSTICS rate_limit_count = ROW_COUNT;

  SELECT count(*)::integer INTO orphan_visitor_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'visitor-photos'
    AND NOT EXISTS (
      SELECT 1
      FROM public.visitor_entries AS entry
      WHERE entry.photo_path = object.name
    );

  SELECT count(*)::integer INTO orphan_delivery_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'delivery-photos'
    AND NOT EXISTS (
      SELECT 1
      FROM public.delivery_entries AS entry
      WHERE entry.photo_path = object.name
    );

  SELECT count(*)::integer INTO orphan_request_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'request-files'
    AND NOT EXISTS (
      SELECT 1
      FROM public.service_request_attachments AS attachment
      WHERE attachment.storage_path = object.name
    );

  SELECT count(*)::integer INTO orphan_payment_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'payment-proofs'
    AND NOT EXISTS (
      SELECT 1
      FROM public.billing_payments AS payment
      WHERE payment.proof_path = object.name
    );

  SELECT count(*)::integer INTO orphan_asset_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'society-assets'
    AND NOT EXISTS (
      SELECT 1
      FROM public.societies AS society
      WHERE society.logo_path = object.name
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.billing_payment_details AS details
      WHERE details.qr_path = object.name
    );

  SELECT count(*)::integer INTO orphan_notice_count
  FROM storage.objects AS object
  WHERE object.bucket_id = 'notice-files'
    AND NOT EXISTS (
      SELECT 1
      FROM public.notices AS notice
      WHERE notice.attachment_path = object.name
    );

  orphan_file_report := pg_catalog.jsonb_build_object(
    'visitor-photos', orphan_visitor_count,
    'delivery-photos', orphan_delivery_count,
    'request-files', orphan_request_count,
    'payment-proofs', orphan_payment_count,
    'society-assets', orphan_asset_count,
    'notice-files', orphan_notice_count
  );

  retention_result := pg_catalog.jsonb_build_object(
    'visitorEntriesAnonymized', visitor_count,
    'deliveryEntriesAnonymized', delivery_count,
    'preApprovalReferencesCleared', pre_approval_reference_count,
    'preApprovalsDeleted', pre_approval_count,
    'requestAttachmentsDeleted', request_attachment_count,
    'requestCommentsDeleted', request_comment_count,
    'requestEventsDeleted', request_event_count,
    'requestsDeleted', request_count,
    'notificationsDeleted', notification_count,
    'errorLogsDeleted', error_log_count,
    'auditLogsDeleted', audit_log_count,
    'jobsDeleted', job_count,
    'jobRunKeysDeleted', job_run_count,
    'rateLimitsDeleted', rate_limit_count,
    'orphanFilesReported', orphan_file_report
  );

  IF visitor_count + delivery_count + pre_approval_reference_count
    + pre_approval_count
    + request_attachment_count + request_comment_count + request_event_count
    + request_count + notification_count + error_log_count + audit_log_count
    + job_count + job_run_count + rate_limit_count
    + orphan_visitor_count + orphan_delivery_count + orphan_request_count
    + orphan_payment_count + orphan_asset_count + orphan_notice_count > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.audit_logs AS audit
      WHERE audit.action = 'housekeeping.retention'
        AND audit.entity_type = 'retention_run'
        AND audit.entity_id = p_today::text
    )
  THEN
    INSERT INTO public.audit_logs (
      actor_role,
      action,
      entity_type,
      entity_id,
      "after",
      request_id
    )
    VALUES (
      'service_role',
      'housekeeping.retention',
      'retention_run',
      p_today::text,
      retention_result,
      p_request_trace
    );
  END IF;

  RETURN retention_result;
END;
$$;
