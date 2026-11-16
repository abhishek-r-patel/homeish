// Exercise Vendors & Purchases screens with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import { publicEnvironment } from '@/core/config/public-env';
import {
  vendorActiveInputSchema,
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
          { id: PLUMBER, name: 'Shree Plumbing Works' },
          { id: PAINTER, name: 'Colour Coat Services' },
          { id: 'fad55fc3-0751-4b79-86c1-5b3e25942392', name: 'Green Gardens' },
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
          <VendorDetailView detail={vendorDetail(role)} actions={ACTIONS} />
        ) : view === 'request' ? (
          <PurchaseRequestView
            detail={requestDetail(scenario, role)}
            actions={ACTIONS}
          />
        ) : (
          <VendorWorkspaceView
            workspace={workspace(scenario, role)}
            actions={ACTIONS}
          />
        )}
      </main>
    </>
  );
}
