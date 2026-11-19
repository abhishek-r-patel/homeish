// Exercise Vendors & Purchases screens with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import { publicEnvironment } from '@/core/config/public-env';
import {
  vendorActiveInputSchema,
  vendorBillCancelInputSchema,
  vendorBillInputSchema,
  vendorBillPaymentLinkInputSchema,
  vendorBillPaymentUnlinkInputSchema,
  vendorContractInputSchema,
  vendorContractRenewInputSchema,
  vendorContractTerminateInputSchema,
  vendorStaffDayCheckInputSchema,
  vendorWorkOrderCreateInputSchema,
  vendorWorkOrderStatusInputSchema,
  vendorWorkOrderUpdateInputSchema,
  vendorBlacklistInputSchema,
  vendorDocumentArchiveInputSchema,
  vendorDocumentInputSchema,
  vendorFileInputSchema,
  vendorInputSchema,
  vendorQuoteInputSchema,
  vendorQuoteOverrideInputSchema,
  vendorQuoteRemoveInputSchema,
  vendorQuoteSelectInputSchema,
  vendorRatingInputSchema,
  vendorRequestCancelInputSchema,
  vendorRequestDecisionInputSchema,
  vendorRequestInputSchema,
  vendorRequestRejectInputSchema,
  vendorRequestSubmitInputSchema,
  vendorSettingsInputSchema,
  vendorUploadInputSchema,
  type VendorContract,
  type VendorDetail,
  type VendorRequestDetail,
  type VendorWorkspace,
} from '@/core/vendor/validation';
import { PurchaseRequestView } from '@/components/vendor/request-detail';
import {
  VendorRouteState,
  type VendorActions,
  type VendorRouteStateKind,
} from '@/components/vendor/shared';
import type { VendorRegisterLoads } from '@/components/vendor/registers';
import { VendorDetailView } from '@/components/vendor/vendor-detail';
import { VendorWorkspaceView } from '@/components/vendor/workspace';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const USER_ID = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const PLUMBER = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const ELECTRICIAN = 'a1d55fc3-0751-4b79-86c1-5b3e25942392';
const PAINTER = 'a2d55fc3-0751-4b79-86c1-5b3e25942392';
const REQUEST = 'e0d55fc3-0751-4b79-86c1-5b3e25942392';
const STORAGE_BASE = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL.replace(
  /\/$/,
  '',
);
const filePath = (id: string, extension = 'pdf') =>
  `${SOCIETY_ID}/vendors/${USER_ID}/${id}.${extension}`;

const roleSchema = z.enum(['admin', 'committee', 'requester']);
type FixtureRole = z.infer<typeof roleSchema>;
const viewSchema = z.enum(['workspace', 'vendor', 'request']);
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
  'not_found',
] as const satisfies readonly VendorRouteStateKind[];
const scenarioSchema = z.enum([
  'draft',
  'draft_rule_unmet',
  'submitted',
  'approved',
  'rejected',
  'empty',
  'expense_off',
  'register_error',
  ...ROUTE_STATES,
]);
type Scenario = z.infer<typeof scenarioSchema>;

const RULE_MET = {
  basis_amount_paise: 4_200_000,
  threshold_paise: 2_500_000,
  quote_count: 3,
  quotes_required: 3,
  overridden: false,
  met: true,
};

function workspace(scenario: Scenario, role: FixtureRole): VendorWorkspace {
  const empty = scenario === 'empty';
  return {
    can_manage: role === 'admin',
    expense_enabled: scenario !== 'expense_off',
    settings: {
      quote_threshold_paise: 2_500_000,
      quotes_above_threshold: 3,
      approvals_required: 2,
    },
    vendors: empty
      ? []
      : [
          {
            id: PLUMBER,
            name: 'Shree Plumbing Works',
            category: 'Plumbing',
            contact_person: 'Anil Deshmukh',
            phone: '+91 98765 43210',
            email: 'anil@example.test',
            gstin: '27ABCDE1234F1Z5',
            pan: role === 'admin' ? 'ABCDE1234F' : null,
            payment_terms_days: 30,
            onboarded_date: '2026-01-15',
            blacklisted: false,
            blacklist_reason: null,
            active: true,
            version: 2,
            rating_average: 4.5,
            rating_count: 2,
          },
          {
            id: ELECTRICIAN,
            name: 'Volt Electricals',
            category: 'Electrical',
            contact_person: null,
            phone: null,
            email: null,
            gstin: null,
            pan: null,
            payment_terms_days: null,
            onboarded_date: null,
            blacklisted: false,
            blacklist_reason: null,
            active: false,
            version: 1,
            rating_average: null,
            rating_count: 0,
          },
        ],
    requests: empty
      ? []
      : [
          {
            id: REQUEST,
            title: 'Replace terrace water pump',
            category: 'Plumbing',
            status: 'submitted',
            estimated_amount_paise: 4_500_000,
            selected_amount_paise: 4_200_000,
            selected_vendor_name: 'Shree Plumbing Works',
            rule: RULE_MET,
            approvals: 1,
            approvals_required: 2,
            created_by_name: 'Meera Iyer',
            mine: false,
            created_at: '2026-11-10T05:00:00Z',
            submitted_at: '2026-11-12T05:00:00Z',
            decided_at: null,
          },
          {
            id: 'e1d55fc3-0751-4b79-86c1-5b3e25942392',
            title: 'Lobby light fittings',
            category: null,
            status: 'draft',
            estimated_amount_paise: 1_800_000,
            selected_amount_paise: null,
            selected_vendor_name: null,
            rule: {
              ...RULE_MET,
              basis_amount_paise: 1_800_000,
              quote_count: 0,
              quotes_required: 1,
              met: false,
            },
            approvals: 0,
            approvals_required: 2,
            created_by_name: 'You',
            mine: true,
            created_at: '2026-11-15T05:00:00Z',
            submitted_at: null,
            decided_at: null,
          },
        ],
  };
}

function vendorDetail(role: FixtureRole): VendorDetail {
  return {
    can_manage: role === 'admin',
    vendor: {
      id: PLUMBER,
      name: 'Shree Plumbing Works',
      category: 'Plumbing',
      contact_person: 'Anil Deshmukh',
      phone: '+91 98765 43210',
      email: 'anil@example.test',
      gstin: '27ABCDE1234F1Z5',
      pan: role === 'admin' ? 'ABCDE1234F' : null,
      payment_terms_days: 30,
      onboarded_date: '2026-01-15',
      blacklisted: true,
      blacklist_reason: 'Repeated missed appointments.',
      notes: 'Available on weekends. Carries spare pumps.',
      active: true,
      version: 2,
      created_at: '2026-09-01T05:00:00Z',
    },
    rating_average: 4.5,
    rating_count: 2,
    my_rating: { stars: 5, comment: 'Quick and tidy.' },
    ratings: [
      {
        id: 'f0d55fc3-0751-4b79-86c1-5b3e25942392',
        stars: 5,
        comment: 'Quick and tidy.',
        rater_name: 'You',
        mine: true,
        updated_at: '2026-11-01T05:00:00Z',
      },
      {
        id: 'f1d55fc3-0751-4b79-86c1-5b3e25942392',
        stars: 4,
        comment: null,
        rater_name: 'Meera Iyer',
        mine: false,
        updated_at: '2026-10-20T05:00:00Z',
      },
    ],
    documents: [
      {
        id: 'f2d55fc3-0751-4b79-86c1-5b3e25942392',
        title: 'Trade licence',
        path: filePath('f3d55fc3-0751-4b79-86c1-5b3e25942392'),
        content_type: 'application/pdf',
        size_bytes: 204_800,
        archived_at: null,
        created_at: '2026-09-01T05:00:00Z',
      },
    ],
    quotes: [
      {
        id: 'f4d55fc3-0751-4b79-86c1-5b3e25942392',
        request_id: REQUEST,
        request_title: 'Replace terrace water pump',
        request_status: 'submitted',
        amount_paise: 4_200_000,
        selected: true,
        created_at: '2026-11-11T05:00:00Z',
      },
    ],
  };
}

function requestDetail(
  scenario: Scenario,
  role: FixtureRole,
): VendorRequestDetail {
  const status =
    scenario === 'submitted' ||
    scenario === 'approved' ||
    scenario === 'rejected'
      ? scenario
      : 'draft';
  const unmet = scenario === 'draft_rule_unmet';
  const requester = role === 'requester';
  const admin = role === 'admin';
  const draft = status === 'draft';
  const quotes = [
    {
      id: 'f5d55fc3-0751-4b79-86c1-5b3e25942392',
      vendor: PLUMBER,
      name: 'Shree Plumbing Works',
      amount: 4_200_000,
    },
    {
      id: 'f6d55fc3-0751-4b79-86c1-5b3e25942392',
      vendor: ELECTRICIAN,
      name: 'Volt Electricals',
      amount: 4_650_000,
    },
    {
      id: 'f7d55fc3-0751-4b79-86c1-5b3e25942392',
      vendor: PAINTER,
      name: 'Colour Coat Services',
      amount: 4_900_000,
    },
  ].slice(0, unmet ? 2 : 3);
  return {
    request: {
      id: REQUEST,
      title: 'Replace terrace water pump',
      description: 'The 2 HP pump on the terrace tank has failed twice.',
      category: 'Plumbing',
      status,
      estimated_amount_paise: 4_500_000,
      selected_quote_id: quotes[0]!.id,
      version: 4,
      created_by_name: 'Meera Iyer',
      created_at: '2026-11-10T05:00:00Z',
      submitted_at: draft ? null : '2026-11-12T05:00:00Z',
      decided_by_name: draft || status === 'submitted' ? null : 'Rahul Shah',
      decided_at:
        draft || status === 'submitted' ? null : '2026-11-13T05:00:00Z',
      rejection_reason:
        status === 'rejected' ? 'Get a quote with a warranty.' : null,
      cancelled_by_name: null,
      cancelled_at: null,
      cancel_reason: null,
      quote_override_reason: null,
      quote_override_by_name: null,
      quote_override_at: null,
      expense_id:
        status === 'approved' && scenario !== 'expense_off'
          ? 'f8d55fc3-0751-4b79-86c1-5b3e25942392'
          : null,
      expense_draft_status: status === 'approved' ? 'created' : null,
      expense_status: status === 'approved' ? 'pending_approval' : null,
    },
    rule: unmet ? { ...RULE_MET, quote_count: 2, met: false } : RULE_MET,
    approvals_required: 2,
    expense_enabled: scenario !== 'expense_off',
    quotes: quotes.map((quote, index) => ({
      id: quote.id,
      vendor_id: quote.vendor,
      vendor_name: quote.name,
      blacklisted: quote.vendor === PAINTER,
      blacklist_reason:
        quote.vendor === PAINTER ? 'Repeated missed appointments.' : null,
      amount_paise: quote.amount,
      note: index === 0 ? 'Includes installation and one-year warranty.' : null,
      file_path:
        index === 0 ? filePath('f9d55fc3-0751-4b79-86c1-5b3e25942392') : null,
      file_content_type: index === 0 ? 'application/pdf' : null,
      selected: index === 0,
      created_by_name: 'Meera Iyer',
      created_at: '2026-11-11T05:00:00Z',
    })),
    approvals:
      status === 'draft'
        ? []
        : [
            {
              approver_name: 'Rahul Shah',
              approver_role: 'admin',
              created_at: '2026-11-12T08:00:00Z',
            },
          ],
    vendors: draft
      ? [
          {
            id: PLUMBER,
            name: 'Shree Plumbing Works',
            blacklisted: false,
            blacklist_reason: null,
          },
          {
            id: PAINTER,
            name: 'Colour Coat Services',
            blacklisted: true,
            blacklist_reason: 'Repeated missed appointments.',
          },
          {
            id: 'fad55fc3-0751-4b79-86c1-5b3e25942392',
            name: 'Green Gardens',
            blacklisted: true,
            blacklist_reason: 'Repeated missed appointments.',
          },
        ]
      : [],
    can_edit: draft && (requester || admin),
    can_override: draft && admin,
    can_approve: status === 'submitted' && !requester && role === 'committee',
    can_reject: status === 'submitted' && !requester,
    can_cancel: (draft || status === 'submitted') && (requester || admin),
    can_retry_expense: false,
    approval_blocked_reason:
      status === 'submitted' && requester
        ? 'You raised this request, so someone else must approve or reject it.'
        : null,
    is_requester: requester,
    approved_by_me: status === 'submitted' && admin,
  };
}

const TODAY = '2026-11-20';
const STAMP = '2026-11-01T05:00:00Z';
const GUARD_CONTRACT = 'c1d55fc3-0751-4b79-86c1-5b3e25942392';
const PUMP_CONTRACT = 'c2d55fc3-0751-4b79-86c1-5b3e25942392';
const BILL = 'c3d55fc3-0751-4b79-86c1-5b3e25942392';
const BILL_PAID = 'c4d55fc3-0751-4b79-86c1-5b3e25942392';

function contract(
  overrides: Partial<VendorContract> & Pick<VendorContract, 'id'>,
): VendorContract {
  return {
    vendor_id: PLUMBER,
    vendor_name: 'Shree Plumbing Works',
    scope: 'Security staff, 4 guards',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    annual_value_paise: 120_000_000,
    payment_frequency: 'monthly',
    auto_renew: false,
    notice_days: 30,
    notice_deadline: '2027-03-01',
    document_path: filePath('c5d55fc3-0751-4b79-86c1-5b3e25942392'),
    document_content_type: 'application/pdf',
    document_size_bytes: 102_400,
    default_sanctioned_days: 26,
    deduction_per_day_paise: 100_000,
    predecessor_id: null,
    successor_id: null,
    terminated_on: null,
    termination_reason: null,
    terminated_by_name: null,
    terminated_at: null,
    status: 'active',
    version: 1,
    created_at: STAMP,
    created_by_name: 'Rahul Shah',
    updated_at: STAMP,
    updated_by_name: 'Rahul Shah',
    ...overrides,
  };
}

function registers(
  scenario: Scenario,
  role: FixtureRole,
  scoped = false,
): VendorRegisterLoads {
  const canManage = role === 'admin';
  const empty = scenario === 'empty';
  const contracts = empty
    ? []
    : [
        contract({ id: GUARD_CONTRACT }),
        contract({
          id: PUMP_CONTRACT,
          scope: 'Pump maintenance visits',
          start_date: '2025-12-01',
          end_date: '2026-11-30',
          annual_value_paise: 6_000_000,
          payment_frequency: 'quarterly',
          auto_renew: true,
          notice_days: null,
          notice_deadline: '2026-11-30',
          document_path: null,
          document_content_type: null,
          document_size_bytes: null,
          default_sanctioned_days: null,
          deduction_per_day_paise: null,
          status: 'urgent',
        }),
      ];
  return {
    summary: {
      ok: true,
      data: {
        vendor_id: scoped ? PLUMBER : null,
        active_vendors: scoped ? null : empty ? 0 : 1,
        active_contract_value_paise: empty ? 0 : 126_000_000,
        renewals_due: empty ? 0 : 2,
        renewals_due_general: empty ? 0 : 1,
        renewals_due_amc: empty ? 0 : 1,
        rating_average: empty ? null : 4.5,
        rating_count: empty ? 0 : 2,
        open_work_orders: empty ? 0 : 1,
        overdue_amc_services: empty ? 0 : 1,
        bills_owed_paise: empty ? 0 : 3_000_000,
        bills_owed_count: empty ? 0 : 1,
      },
    },
    contracts:
      scenario === 'register_error'
        ? {
            ok: false,
            message: 'Could not load contracts. Refresh and retry.',
            referenceId: 'ERR-C0A1B2C3D4',
          }
        : {
            ok: true,
            data: {
              today: TODAY,
              can_manage: canManage,
              settings: { due_soon_days: 60, urgent_days: 15 },
              contracts,
              amc_contracts: empty
                ? []
                : [
                    {
                      id: 'c6d55fc3-0751-4b79-86c1-5b3e25942392',
                      asset_label: 'Lift A',
                      vendor_name: 'Volt Electricals',
                      start_date: '2026-01-01',
                      end_date: '2026-12-31',
                      status: 'due_soon',
                      successor_id: null,
                    },
                  ],
            },
          },
    checks: {
      ok: true,
      data: {
        can_manage: canManage,
        checks: empty
          ? []
          : [
              {
                id: 'c7d55fc3-0751-4b79-86c1-5b3e25942392',
                contract_id: GUARD_CONTRACT,
                contract_scope: 'Security staff, 4 guards',
                vendor_id: PLUMBER,
                vendor_name: 'Shree Plumbing Works',
                month: '2026-10-01',
                sanctioned_days: 26,
                actual_days: 24,
                contracted_amount_paise: 10_000_000,
                rate_paise: 100_000,
                manual_deduction_paise: null,
                manual_deduction_reason: null,
                bill_raised_paise: 10_000_000,
                shortfall_days: 2,
                deduction_paise: 200_000,
                payable_paise: 9_800_000,
                variance_paise: 200_000,
                flagged: true,
                version: 1,
                created_at: STAMP,
                updated_at: STAMP,
                updated_by_name: 'Rahul Shah',
              },
            ],
      },
    },
    workOrders: {
      ok: true,
      data: {
        today: TODAY,
        can_manage: canManage,
        work_orders: empty
          ? []
          : [
              {
                id: 'c8d55fc3-0751-4b79-86c1-5b3e25942392',
                number: 'WO-2026-0001',
                purchase_request_id: REQUEST,
                request_title: 'Replace terrace water pump',
                vendor_id: PLUMBER,
                vendor_name: 'Shree Plumbing Works',
                description: 'Replace terrace water pump',
                value_paise: 4_200_000,
                issued_on: '2026-11-05',
                due_on: null,
                completed_on: null,
                status: 'issued',
                cancel_reason: null,
                cancelled_at: null,
                cancelled_by_name: null,
                days_open: 15,
                delay_days: null,
                version: 1,
                created_at: STAMP,
                created_by_name: 'Rahul Shah',
                updated_at: STAMP,
              },
            ],
        approved_requests: empty
          ? []
          : [
              {
                id: 'e2d55fc3-0751-4b79-86c1-5b3e25942392',
                title: 'Repaint stairwell',
                vendor_id: PLUMBER,
                vendor_name: 'Shree Plumbing Works',
                amount_paise: 1_500_000,
              },
            ],
      },
    },
    bills: {
      ok: true,
      data: {
        today: TODAY,
        can_manage: canManage,
        bills: empty
          ? []
          : [
              {
                id: BILL,
                vendor_id: PLUMBER,
                vendor_name: 'Shree Plumbing Works',
                invoice_number: 'INV-1042',
                invoice_date: '2026-10-15',
                amount_paise: 5_000_000,
                effective_terms_days: 30,
                due_date: '2026-11-14',
                paid_paise: 2_000_000,
                outstanding_paise: 3_000_000,
                payment_status: 'partly_paid',
                due_state: 'overdue',
                cancelled_at: null,
                cancel_reason: null,
                cancelled_by_name: null,
                version: 2,
                created_at: STAMP,
                created_by_name: 'Rahul Shah',
                updated_at: STAMP,
                payments: [
                  {
                    id: 'c9d55fc3-0751-4b79-86c1-5b3e25942392',
                    entry_id: 'cad55fc3-0751-4b79-86c1-5b3e25942392',
                    amount_paise: 2_000_000,
                    counting: true,
                    unlinked_at: null,
                    unlink_reason: null,
                    unlinked_by_name: null,
                    entry_date: '2026-11-02',
                    payee: 'Shree Plumbing Works',
                    reference: 'NEFT 4471',
                    entry_amount_paise: 2_000_000,
                    created_at: STAMP,
                  },
                  {
                    id: 'cbd55fc3-0751-4b79-86c1-5b3e25942392',
                    entry_id: 'ccd55fc3-0751-4b79-86c1-5b3e25942392',
                    amount_paise: 500_000,
                    counting: false,
                    unlinked_at: '2026-11-03T05:00:00Z',
                    unlink_reason: 'Linked to the wrong bill.',
                    unlinked_by_name: 'Rahul Shah',
                    entry_date: '2026-11-01',
                    payee: 'Shree Plumbing Works',
                    reference: null,
                    entry_amount_paise: 500_000,
                    created_at: STAMP,
                  },
                  {
                    id: 'cdd55fc3-0751-4b79-86c1-5b3e25942392',
                    entry_id: 'ced55fc3-0751-4b79-86c1-5b3e25942392',
                    amount_paise: 700_000,
                    counting: false,
                    unlinked_at: null,
                    unlink_reason: null,
                    unlinked_by_name: null,
                    entry_date: '2026-10-28',
                    payee: 'Shree Plumbing Works',
                    reference: null,
                    entry_amount_paise: 700_000,
                    created_at: STAMP,
                  },
                ],
              },
              {
                id: BILL_PAID,
                vendor_id: PLUMBER,
                vendor_name: 'Shree Plumbing Works',
                invoice_number: 'INV-1050',
                invoice_date: '2026-11-18',
                amount_paise: 1_200_000,
                effective_terms_days: 30,
                due_date: '2026-12-18',
                paid_paise: 0,
                outstanding_paise: 1_200_000,
                payment_status: 'pending',
                due_state: null,
                cancelled_at: null,
                cancel_reason: null,
                cancelled_by_name: null,
                version: 1,
                created_at: STAMP,
                created_by_name: 'Rahul Shah',
                updated_at: STAMP,
                payments: [],
              },
            ],
        linkable_entries:
          canManage && !empty
            ? [
                {
                  id: 'cfd55fc3-0751-4b79-86c1-5b3e25942392',
                  entry_date: '2026-11-19',
                  amount_paise: 3_000_000,
                  unlinked_paise: 3_000_000,
                  payee: 'Shree Plumbing Works',
                  reference: 'NEFT 4502',
                  description: 'Pump repair balance',
                },
              ]
            : [],
      },
    },
  };
}

const requestFiles: typeof fetch = async () =>
  new Response(null, { status: 200 });

function stub(
  schema: z.ZodType,
  message: string,
): (data: FormData) => Promise<ServerActionResult<unknown>> {
  return async (data) => {
    const raw = data.get('input');
    const parsed = schema.safeParse(
      typeof raw === 'string' ? JSON.parse(raw) : null,
    );
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0]?.message ?? 'Check the form.',
      };
    return { ok: true, message: `${message} (synthetic, nothing saved)` };
  };
}

async function prepareUpload(
  data: FormData,
): Promise<ServerActionResult<{ path: string; signedUrl: string }>> {
  const upload = vendorUploadInputSchema.parse(
    JSON.parse(String(data.get('input'))),
  );
  const extension =
    upload.contentType === 'application/pdf'
      ? 'pdf'
      : upload.contentType === 'image/png'
        ? 'png'
        : 'jpg';
  const path = filePath(crypto.randomUUID(), extension);
  return {
    ok: true,
    data: {
      path,
      signedUrl: `${STORAGE_BASE}/storage/v1/object/upload/sign/vendor-files/${path}?token=synthetic`,
    },
  };
}

const ACTIONS: VendorActions = {
  prepareDocumentUpload: prepareUpload,
  prepareQuoteUpload: prepareUpload,
  fileLink: async (data) => {
    const { path } = vendorFileInputSchema.parse(
      JSON.parse(String(data.get('input'))),
    );
    return {
      ok: true,
      data: {
        signedUrl: `${STORAGE_BASE}/storage/v1/object/sign/vendor-files/${path}?token=synthetic`,
        expiresIn: 300,
        fileName: 'synthetic.pdf',
      },
    };
  },
  saveSettings: stub(vendorSettingsInputSchema, 'Settings saved.'),
  saveVendor: stub(vendorInputSchema, 'Vendor saved.'),
  setActive: stub(vendorActiveInputSchema, 'Vendor updated.'),
  setBlacklisted: stub(
    vendorBlacklistInputSchema,
    'Vendor blacklist status updated and recorded.',
  ),
  addDocument: stub(vendorDocumentInputSchema, 'Document attached.'),
  archiveDocument: stub(vendorDocumentArchiveInputSchema, 'Document archived.'),
  saveRating: stub(vendorRatingInputSchema, 'Rating saved.'),
  saveRequest: stub(vendorRequestInputSchema, 'Request saved.'),
  addQuote: stub(vendorQuoteInputSchema, 'Quote added.'),
  removeQuote: stub(vendorQuoteRemoveInputSchema, 'Quote removed.'),
  selectQuote: stub(vendorQuoteSelectInputSchema, 'Quote selected.'),
  overrideRule: stub(vendorQuoteOverrideInputSchema, 'Override saved.'),
  submit: stub(vendorRequestSubmitInputSchema, 'Submitted for approval.'),
  approve: stub(vendorRequestDecisionInputSchema, 'Approval recorded.'),
  reject: stub(vendorRequestRejectInputSchema, 'Request rejected.'),
  cancel: stub(vendorRequestCancelInputSchema, 'Request cancelled.'),
  retryExpense: stub(
    vendorRequestDecisionInputSchema,
    'Expense draft retried.',
  ),
  saveContract: stub(vendorContractInputSchema, 'Contract saved.'),
  renewContract: stub(vendorContractRenewInputSchema, 'Renewal saved.'),
  terminateContract: stub(
    vendorContractTerminateInputSchema,
    'Contract ended early.',
  ),
  saveStaffDayCheck: stub(
    vendorStaffDayCheckInputSchema,
    'Agency check saved. No bill or payment was created.',
  ),
  createWorkOrder: stub(vendorWorkOrderCreateInputSchema, 'Work order issued.'),
  updateWorkOrder: stub(vendorWorkOrderUpdateInputSchema, 'Work order saved.'),
  setWorkOrderStatus: stub(
    vendorWorkOrderStatusInputSchema,
    'Work order status updated.',
  ),
  saveBill: stub(vendorBillInputSchema, 'Bill saved.'),
  cancelBill: stub(vendorBillCancelInputSchema, 'Bill cancelled.'),
  linkBillPayment: stub(
    vendorBillPaymentLinkInputSchema,
    'Payment linked to the bill.',
  ),
  unlinkBillPayment: stub(
    vendorBillPaymentUnlinkInputSchema,
    'Payment unlinked.',
  ),
  uploadRequest: requestFiles,
};

export default function VendorFixturePage() {
  const [role, setRole] = useState<FixtureRole>('admin');
  const [view, setView] = useState<z.infer<typeof viewSchema>>('workspace');
  const [scenario, setScenario] = useState<Scenario>('submitted');
  const routeState = ROUTE_STATES.find((state) => state === scenario);

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic vendors fixture" tone="info">
          Development-only vendors, quotes and approvals with injected actions.
          No hosted Auth, database writes, uploads or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-3">
          <SelectInput
            id="fixture-role"
            label="Fixture role"
            value={role}
            options={roleSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setRole(roleSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="fixture-view"
            label="Fixture screen"
            value={view}
            options={viewSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setView(viewSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="fixture-scenario"
            label="Fixture scenario"
            value={scenario}
            options={scenarioSchema.options.map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            }))}
            onChange={(event) =>
              setScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        {routeState ? (
          <VendorRouteState
            kind={routeState}
            returnHref="/fixtures/vendor"
            retryHref={routeState === 'error' ? '/fixtures/vendor' : undefined}
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : view === 'vendor' ? (
          <VendorDetailView
            detail={vendorDetail(role)}
            registers={registers(scenario, role, true)}
            actions={ACTIONS}
          />
        ) : view === 'request' ? (
          <PurchaseRequestView
            detail={requestDetail(scenario, role)}
            actions={ACTIONS}
          />
        ) : (
          <VendorWorkspaceView
            workspace={workspace(scenario, role)}
            registers={registers(scenario, role)}
            actions={ACTIONS}
          />
        )}
      </main>
    </>
  );
}
