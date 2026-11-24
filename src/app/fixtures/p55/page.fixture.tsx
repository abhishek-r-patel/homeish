// Exercise P55 search-adjacent calendars, feature requests and onboarding with synthetic data.
'use client';

import {
  DeveloperFeatureRequests,
  DeveloperOnboardingForm,
} from '@/components/developer/console-controls';
import { FeatureList } from '@/components/home/feature-list';
import { SocietyCalendar } from '@/components/home/society-calendar';
import { LanguageProvider } from '@/components/language-provider';
import { Card } from '@/components/ui/data-display';

const month = '2026-11';

export default function P55Fixture() {
  return (
    <LanguageProvider initialLocale="en" mode="device">
      <main className="mx-auto grid max-w-content-wide gap-space-6 p-space-5">
        <FeatureList
          data={{
            canRequest: true,
            features: [
              {
                key: 'visitor',
                name: 'Visitor Management',
                description:
                  'Visitor Management tools and records for this society.',
                enabled: true,
                request: null,
              },
              {
                key: 'metering',
                name: 'Utility Metering',
                description:
                  'Utility Metering tools and records for this society.',
                enabled: false,
                request: {
                  id: 'd1d55fc3-0751-4b79-86c1-5b3e25942392',
                  module_key: 'metering',
                  note: 'Need water readings',
                  status: 'new',
                  created_at: '2026-11-24T10:00:00Z',
                },
              },
            ],
          }}
        />
        <SocietyCalendar
          month={month}
          items={[
            {
              source: 'meeting',
              item_id: 'b1d55fc3-0751-4b79-86c1-5b3e25942392',
              title: 'Monthly meeting',
              occurs_at: '2026-11-18T12:30:00Z',
              href: '/admin/meetings/example',
            },
          ]}
        />
        <Card title="Onboarding record">
          <DeveloperOnboardingForm
            societyId="a1d55fc3-0751-4b79-86c1-5b3e25942392"
            record={{
              stage: 'setting_up',
              agreed_modules: ['billing'],
              go_live_on: '2026-12-01',
              contact_name: 'Synthetic Contact',
              contact_phone: null,
              contact_email: null,
              notes: null,
              progress: {
                dismissed: false,
                residents_joined_percent: 75,
                total_units: 20,
                joined_units: 10,
                steps: [
                  {
                    key: 'units',
                    module_key: 'core',
                    title: 'Add towers and flats',
                    href: '/admin/structure',
                    complete: true,
                  },
                ],
              },
            }}
          />
        </Card>
        <Card title="Feature requests">
          <DeveloperFeatureRequests
            requests={[
              {
                id: 'c1d55fc3-0751-4b79-86c1-5b3e25942392',
                society_id: 'a1d55fc3-0751-4b79-86c1-5b3e25942392',
                society_name: 'Synthetic Society',
                module_key: 'metering',
                note: 'Need water readings',
                status: 'new',
                requested_by: 'Synthetic Admin',
                created_at: '2026-11-24T10:00:00Z',
              },
            ]}
          />
        </Card>
      </main>
    </LanguageProvider>
  );
}
