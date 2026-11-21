// Society member directory and household occupancy management.
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import {
  MemberDirectory,
  InviteResidentForm,
} from '@/components/members/member-controls';
import { ResidentsImportControl } from '@/components/members/residents-import-control';
import { PendingRegistrations } from '@/components/members/registration-controls';
import { AppError } from '@/core/errors';
import { listSocietyMembers } from '@/core/members/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'People | Homeish',
  robots: { index: false, follow: false },
};

export default async function MembersPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  let directory: Awaited<ReturnType<typeof listSocietyMembers>> | null = null;
  let loadError: unknown;
  try {
    directory = await listSocietyMembers();
  } catch (error) {
    loadError = error;
  }
  if (!directory) {
    if (loadError instanceof AppError && loadError.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message={t(
            'Sign in with an administrator or committee account for this society.',
          )}
          title={t('Member access is restricted')}
        />
      );
    }
    throw loadError;
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('People')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Invite residents, manage society roles and keep unit occupancy history.',
          )}
        </p>
      </header>
      {directory.canManage ? (
        <>
          <Card
            description={t('Review requests made with the society join code.')}
            title={t('Pending registrations')}
          >
            <PendingRegistrations
              registrations={directory.members.filter(
                (member) => member.status === 'pending_approval',
              )}
            />
          </Card>
          <Card
            description={t(
              'Invitations are linked when the resident signs in with this email address.',
            )}
            title={t('Invite a resident')}
          >
            <InviteResidentForm units={directory.units} />
          </Card>
          <Card
            description={t(
              'Preview is read-only. Imports create invitations and report any row-level failures in a job.',
            )}
            title={t('Import residents from CSV')}
          >
            <ResidentsImportControl />
          </Card>
        </>
      ) : null}
      <Card title={t('Society members')}>
        <MemberDirectory directory={directory} />
      </Card>
    </section>
  );
}
