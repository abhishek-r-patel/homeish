// Responsive society directory table for the developer console.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, Pagination } from '@/components/ui/table-controls';
import type { DataTableColumn, PageSize } from '@/components/ui/table-controls';
import { Card, StatusChip } from '@/components/ui/data-display';
import type { ProductStatus } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import { societyStatusSchema } from '@/core/developer/status';
import type { getDeveloperSocieties } from '@/core/developer/console';

type SocietyList = Awaited<ReturnType<typeof getDeveloperSocieties>>;
type SocietyListRow = SocietyList['societies'][number];

const societyStatusChips: Record<
  'trial' | 'active' | 'suspended' | 'archived',
  ProductStatus
> = {
  trial: 'society.trial',
  active: 'society.active',
  suspended: 'society.suspended',
  archived: 'society.archived',
};

function statusChip(status: string): ProductStatus | undefined {
  const parsed = societyStatusSchema.safeParse(status);
  return parsed.success ? societyStatusChips[parsed.data] : undefined;
}

function formatTime(value: string | null) {
  if (!value) return 'None';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function SocietyList({ result }: { result: SocietyList }) {
  const router = useRouter();
  const columns: readonly DataTableColumn<SocietyListRow>[] = [
    {
      header: 'Society',
      id: 'name',
      render: (society) => (
        <Link
          className="font-semibold text-brand underline"
          href={`/developer/societies/${society.id}`}
        >
          {society.name}
        </Link>
      ),
    },
    {
      header: 'City',
      id: 'city',
      render: (society) => society.city ?? 'Not set',
    },
    {
      header: 'Status',
      id: 'status',
      render: (society) => {
        const status = statusChip(society.status);
        return status ? <StatusChip status={status} /> : 'Unknown';
      },
    },
    {
      header: 'Plan',
      id: 'plan',
      render: (society) => society.plan ?? 'Not set',
    },
    {
      header: 'Enabled modules',
      id: 'modules',
      render: (society) => society.enabledModuleCount,
    },
    {
      header: 'Last error',
      id: 'last-error',
      render: (society) => formatTime(society.lastErrorAt),
    },
  ];

  function navigate(nextPage: number, pageSize: PageSize) {
    router.push(`/developer?page=${nextPage}&pageSize=${pageSize}`);
  }

  if (result.total === 0) {
    return (
      <Card>
        <EmptyState
          description="Create the first society to begin setting up its Core Platform."
          title="No societies yet"
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-space-3">
      <DataTable
        caption="Societies"
        columns={columns}
        getRowHref={(society) => `/developer/societies/${society.id}`}
        getRowId={(society) => society.id}
        getRowLabel={(society) => society.name}
        mobilePrimary={(society) => (
          <Link
            className="font-semibold text-brand underline"
            href={`/developer/societies/${society.id}`}
          >
            {society.name}
          </Link>
        )}
        mobileSecondary={(society) => (
          <span>
            {society.city ?? 'City not set'} · {society.enabledModuleCount}{' '}
            enabled modules · Last error: {formatTime(society.lastErrorAt)}
          </span>
        )}
        mobileStatus={(society) => statusChip(society.status)}
        rows={result.societies}
      />
      <Pagination
        onPageChange={(page) => navigate(page, result.pageSize)}
        onPageSizeChange={(pageSize) => navigate(1, pageSize)}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
