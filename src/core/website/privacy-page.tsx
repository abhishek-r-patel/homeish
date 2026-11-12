// Public privacy policy, including the Google API user-data disclosure.
import { Brand } from '@/components/ui/brand';
import Link from 'next/link';

export const privacyContactEmail = 'tech.abhishekpatel@gmail.com';
export const privacyEffectiveDate = '12 November 2026';

const sections: { title: string; paragraphs: string[]; items?: string[] }[] = [
  {
    title: 'Who we are',
    paragraphs: [
      'Homeish is a society-management app for residential societies in India, covering visitors, deliveries, maintenance bills and service requests. It is in development and is not yet open for live society use.',
    ],
  },
  {
    title: 'Information we collect',
    paragraphs: ['We collect only what a society needs to run these features:'],
    items: [
      'Account details: name, email address, phone number and an optional photo.',
      'Society details: the flat or unit you belong to, your role, and household members.',
      'Visitor and delivery entries recorded at the gate, including visitor name, phone, vehicle and photo.',
      'Maintenance bills, payment records, receipts and payment screenshots you upload.',
      'Service requests, comments and attachments.',
      'Notification preferences and browser push subscriptions.',
      'Technical logs needed to keep the service secure and reliable. Logs never contain sign-in codes, tokens, PINs, full phone numbers or screenshots.',
    ],
  },
  {
    title: 'How we use it',
    paragraphs: [
      'Information is used only to provide Homeish to your society: to sign you in, show the right screens for your role, notify you, and keep records the society needs. People see only what their role allows. We do not sell personal data, show advertising, or use your data to train AI models.',
    ],
  },
  {
    title: 'Service providers',
    paragraphs: [
      'Homeish uses these providers to run the service. They process data only on our behalf:',
    ],
    items: [
      'Supabase: database, sign-in and private file storage.',
      'Vercel: website and application hosting.',
      'Brevo: transactional email, such as sign-in codes and alerts.',
      'Sentry: error monitoring, with personal data removed before sending.',
      'Google Drive and GitHub Actions: encrypted off-site database backups, described below.',
    ],
  },
  {
    title: 'Retention',
    paragraphs: ['A daily job removes data when its retention period ends:'],
    items: [
      'Visitor and delivery entries: personal details removed after 1 year.',
      'Service requests, comments and attachments: deleted 2 years after closing.',
      'Notifications: deleted after 180 days.',
      'Error logs and job records: deleted after 90 days. Audit logs: deleted after 2 years.',
      'Bills, payments and receipts: kept as financial records.',
      'Encrypted database backups: deleted after 30 days.',
    ],
  },
  {
    title: 'Your choices',
    paragraphs: [
      `You can ask your society administrator, or write to ${privacyContactEmail}, to see or correct your information or to delete your account. When an account is deleted, your name, contact details and photo are replaced with anonymous values and sign-in is removed. Financial and audit records the society must keep remain, but they no longer identify you.`,
    ],
  },
  {
    title: 'Google user data',
    paragraphs: [
      'Homeish Offsite Backup is an internal tool that copies Homeish’s own database to Google Drive. It is authorised only by the Homeish operator’s dedicated Google account. Residents and society members never sign in with Google, and Homeish does not access their Google accounts.',
      'The tool requests only the Google Drive “drive.file” permission. With it, the tool creates a private backup folder, uploads encrypted backup files into that folder, reads those files’ details to confirm each upload, and permanently deletes its own backups after 30 days. It cannot see or change any other file in the Drive account.',
      'Backups are encrypted with AES-256-GCM before upload, and Google OAuth credentials are kept as encrypted GitHub Actions secrets. Google user data is not shared, sold, used for advertising, or used to train AI models. Homeish’s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    title: 'Security',
    paragraphs: [
      'Data is encrypted in transit and at rest by our providers. Files are stored privately and shared only through short-lived links. Access is limited by role, and administrative actions are recorded in an audit log.',
    ],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      `We will update this page when our practices change and revise the date above. For privacy questions or requests, email ${privacyContactEmail}.`,
    ],
  },
];

export function PrivacyPage() {
  return (
    <>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-content-marketing items-center px-space-5 py-space-5">
          <Link aria-label="Homeish home" href="/">
            <Brand />
          </Link>
        </div>
      </header>
      <main
        className="mx-auto max-w-content-default px-space-5 py-space-8"
        id="main"
      >
        <h1 className="text-display font-bold">Privacy policy</h1>
        <p className="mt-space-3 text-ink-muted">
          Effective {privacyEffectiveDate}
        </p>
        {sections.map((section) => {
          const headingId = `privacy-${section.title
            .toLowerCase()
            .replace(/[^a-z]+/g, '-')}`;
          return (
            <section
              aria-labelledby={headingId}
              className="mt-space-7"
              key={section.title}
            >
              <h2 className="text-heading font-semibold" id={headingId}>
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p className="mt-space-3" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="mt-space-3 list-disc space-y-space-2 pl-space-5">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
        <p className="mt-space-7">
          <a
            className="text-brand underline underline-offset-4"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>
        </p>
      </main>
    </>
  );
}
