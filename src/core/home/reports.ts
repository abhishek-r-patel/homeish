// Keep the existing report/export catalogue next to the navigation registry.
import type { ModuleKey } from '../modules';
import type { SocietyRole } from '../permissions';
import { hasPermission } from '../permissions';

export type ReportCatalogueItem = {
  id: string;
  name: string;
  description: string;
  moduleKey: ModuleKey;
  permission: string;
  href: string;
  topic: 'Money' | 'Gate & security' | 'Upkeep' | 'Community';
};

export const REPORTS_CATALOGUE: readonly ReportCatalogueItem[] = [
  {
    id: 'billing-reports',
    name: 'Billing reports',
    description: 'Collection totals and CSV/PDF maintenance exports.',
    moduleKey: 'billing',
    permission: 'billing:charges:read',
    href: '/admin/billing?tab=reports',
    topic: 'Money',
  },
  {
    id: 'dues-follow-up',
    name: 'Dues follow-up',
    description: 'Outstanding bills and the next follow-up list.',
    moduleKey: 'billing',
    permission: 'billing:dues_follow_up:read',
    href: '/admin/billing?tab=dues-follow-up',
    topic: 'Money',
  },
  {
    id: 'collection-efficiency',
    name: 'Collection efficiency',
    description: 'As-of paid, waived and unallocated collection figures.',
    moduleKey: 'billing',
    permission: 'billing:charges:read',
    href: '/admin/billing?tab=collection-efficiency',
    topic: 'Money',
  },
  {
    id: 'expense-reports',
    name: 'Accounts reports',
    description: 'Society income, expenditure and account statements.',
    moduleKey: 'expense',
    permission: 'expense:list',
    href: '/admin/expenses/reports',
    topic: 'Money',
  },
  {
    id: 'vendor-spend',
    name: 'Vendor spend',
    description: 'Vendor requests, quotes and linked Accounts spend.',
    moduleKey: 'expense',
    permission: 'expense:list',
    href: '/admin/expenses/vendor-spend',
    topic: 'Money',
  },
  {
    id: 'budget-report',
    name: 'Budget report',
    description:
      'Budget, forecast and actual comparison for the financial year.',
    moduleKey: 'expense',
    permission: 'expense:list',
    href: '/admin/expenses/budget',
    topic: 'Money',
  },
  {
    id: 'agm-report',
    name: 'AGM report',
    description: 'The audited annual report, figures and committee selections.',
    moduleKey: 'expense',
    permission: 'expense:list',
    href: '/admin/expenses/agm-report',
    topic: 'Money',
  },
  {
    id: 'account-statements',
    name: 'Account statements',
    description: 'Bank and cash statement items, matching and reconciliation.',
    moduleKey: 'expense',
    permission: 'expense:list',
    href: '/admin/expenses/statements',
    topic: 'Money',
  },
  {
    id: 'savings-report',
    name: 'Savings register',
    description: 'Savings records, evidence and related account links.',
    moduleKey: 'expense',
    permission: 'expense:list',
    href: '/admin/expenses/savings',
    topic: 'Money',
  },
  {
    id: 'analytics-export',
    name: 'Analytics export',
    description: 'Export the selected society metrics as CSV or PDF.',
    moduleKey: 'core',
    permission: 'analytics:export',
    href: '/admin/analytics',
    topic: 'Money',
  },
  {
    id: 'request-report',
    name: 'Request reports',
    description: 'Resolution, repeat-request and daily-check summaries.',
    moduleKey: 'service_request',
    permission: 'request:report',
    href: '/admin/requests?tab=report',
    topic: 'Upkeep',
  },
  {
    id: 'meeting-summary',
    name: 'Meeting summary',
    description: 'Attendance, action completion and meeting activity.',
    moduleKey: 'meeting',
    permission: 'meeting:list',
    href: '/admin/meetings/summary',
    topic: 'Community',
  },
  {
    id: 'major-work-audits',
    name: 'Structural audit register',
    description: 'Private audit reports, due reminders and linked projects.',
    moduleKey: 'major_works',
    permission: 'major_works:list',
    href: '/admin/major-works/audits',
    topic: 'Upkeep',
  },
  {
    id: 'metering-report',
    name: 'Metering reports',
    description: 'Consumption, pending readings and utility billing state.',
    moduleKey: 'metering',
    permission: 'metering:list',
    href: '/admin/metering',
    topic: 'Upkeep',
  },
];

export function getAllowedReports(
  roles: readonly SocietyRole[],
  enabledModules: ReadonlySet<ModuleKey>,
) {
  return REPORTS_CATALOGUE.filter(
    (report) =>
      enabledModules.has(report.moduleKey) &&
      hasPermission(roles, report.moduleKey, report.permission),
  );
}
