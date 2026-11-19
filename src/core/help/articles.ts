// App-authored help articles and getting-started paths, kept as typed static content.
import type { ModuleKey, SocietyRole } from '../permissions';

export const HELP_CATEGORIES = [
  'getting_started',
  'account',
  'money',
  'gate',
  'requests',
  'community',
  'operations',
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

export const HELP_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type HelpLevel = (typeof HELP_LEVELS)[number];

export const HELP_CATEGORY_LABELS: Readonly<Record<HelpCategory, string>> = {
  getting_started: 'Getting started',
  account: 'Your account',
  money: 'Bills and money',
  gate: 'Gate and security',
  requests: 'Requests and complaints',
  community: 'Notices and community',
  operations: 'Society operations',
};

export const HELP_LEVEL_LABELS: Readonly<Record<HelpLevel, string>> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const HELP_ROLE_LABELS: Readonly<Record<SocietyRole, string>> = {
  admin: 'Administrator',
  committee: 'Committee member',
  resident: 'Resident',
  guard: 'Guard',
  hk_supervisor: 'Housekeeping supervisor',
};

export interface HelpLink {
  href: string;
  label: string;
}

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  level: HelpLevel;
  roles: readonly SocietyRole[];
  // Every listed module must be enabled for the article to show.
  modules: readonly ModuleKey[];
  title: string;
  answer: string;
  links: readonly HelpLink[];
}

const STAFF: readonly SocietyRole[] = ['admin', 'committee'];
const EVERYONE: readonly SocietyRole[] = [
  'admin',
  'committee',
  'resident',
  'guard',
  'hk_supervisor',
];

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    id: 'profile-update',
    category: 'account',
    level: 'beginner',
    roles: EVERYONE,
    modules: ['core'],
    title: 'How do I update my profile?',
    answer:
      'Open Profile from the menu. Change the details shown there and save.',
    links: [{ href: '/profile', label: 'Profile' }],
  },
  {
    id: 'profile-language',
    category: 'account',
    level: 'beginner',
    roles: EVERYONE,
    modules: ['language'],
    title: 'How do I switch the app to Hindi?',
    answer:
      'Open Profile and choose Hindi as your language. The choice appears only when your society offers Hindi.',
    links: [{ href: '/profile', label: 'Profile' }],
  },
  {
    id: 'admin-structure',
    category: 'getting_started',
    level: 'beginner',
    roles: ['admin'],
    modules: ['core'],
    title: 'How do I add blocks and units?',
    answer:
      'Open Structure to add blocks, floors and units. Add units before adding members so each member can be linked to a flat.',
    links: [{ href: '/structure', label: 'Structure' }],
  },
  {
    id: 'admin-members',
    category: 'getting_started',
    level: 'beginner',
    roles: ['admin'],
    modules: ['core'],
    title: 'How do I add members to the society?',
    answer:
      'Open Members to add people to the society and see their roles and flats.',
    links: [{ href: '/members', label: 'Members' }],
  },
  {
    id: 'admin-analytics',
    category: 'getting_started',
    level: 'intermediate',
    roles: STAFF,
    modules: ['core'],
    title: 'Where do I see the society numbers in one place?',
    answer:
      'Open Analytics. It brings together figures from the modules your society uses.',
    links: [{ href: '/admin/analytics', label: 'Analytics' }],
  },
  {
    id: 'letters-make',
    category: 'operations',
    level: 'intermediate',
    roles: STAFF,
    modules: ['core'],
    title: 'How do I prepare a letter on the society letterhead?',
    answer:
      'Open Letters, choose the letter type and, where asked, the record it is about. Edit the text, preview it and download the PDF. Homeish does not send or keep the letter; it only logs who prepared which type.',
    links: [{ href: '/admin/letters', label: 'Letters' }],
  },
  {
    id: 'billing-generate',
    category: 'money',
    level: 'intermediate',
    roles: ['admin'],
    modules: ['billing'],
    title: 'How do I create maintenance bills?',
    answer:
      'Open Billing and choose Generate bills. Pick the period, check the preview and confirm. Residents then see their bills on the Bills screen.',
    links: [
      { href: '/admin/billing', label: 'Billing' },
      { href: '/admin/billing/generate', label: 'Generate bills' },
    ],
  },
  {
    id: 'billing-outstanding',
    category: 'money',
    level: 'beginner',
    roles: STAFF,
    modules: ['billing'],
    title: 'How do I see which units still owe dues?',
    answer:
      'Open Billing. Each unit shows its outstanding amount. Open a unit to see its bills and the payments recorded against them.',
    links: [{ href: '/admin/billing', label: 'Billing' }],
  },
  {
    id: 'bills-resident',
    category: 'money',
    level: 'beginner',
    roles: ['resident'],
    modules: ['billing'],
    title: 'How do I see and pay my maintenance bill?',
    answer:
      'Open Bills to see what is due for your flat. Choose Pay and follow the steps shown. The office confirms a payment before the bill shows as paid.',
    links: [{ href: '/bills', label: 'Bills' }],
  },
  {
    id: 'expenses-record',
    category: 'money',
    level: 'intermediate',
    roles: STAFF,
    modules: ['expense'],
    title: 'How do I record society expenses?',
    answer:
      'Open Expenses to record what the society spends. Reports show the totals for a period.',
    links: [{ href: '/admin/expenses', label: 'Expenses' }],
  },
  {
    id: 'visitors-guard',
    category: 'gate',
    level: 'beginner',
    roles: ['guard'],
    modules: ['visitor'],
    title: 'How do I log a visitor at the gate?',
    answer:
      'Open Visitors, record the visitor and the flat they are visiting, then mark the entry. Mark the exit when they leave.',
    links: [{ href: '/guard/visitors', label: 'Visitors' }],
  },
  {
    id: 'visitors-resident',
    category: 'gate',
    level: 'beginner',
    roles: ['resident'],
    modules: ['visitor'],
    title: 'How do I see who visited my flat?',
    answer: 'Open Visitors to see the visitors recorded for your flat.',
    links: [{ href: '/visitors', label: 'Visitors' }],
  },
  {
    id: 'deliveries-guard',
    category: 'gate',
    level: 'beginner',
    roles: ['guard'],
    modules: ['delivery'],
    title: 'How do I record a parcel left at the gate?',
    answer:
      'Open Deliveries, record the parcel against the flat and mark it collected when the resident picks it up.',
    links: [{ href: '/guard/deliveries', label: 'Deliveries' }],
  },
  {
    id: 'deliveries-resident',
    category: 'gate',
    level: 'beginner',
    roles: ['resident'],
    modules: ['delivery'],
    title: 'Where do I see parcels kept for me?',
    answer:
      'Open Deliveries to see parcels the gate has recorded for your flat.',
    links: [{ href: '/deliveries', label: 'Deliveries' }],
  },
  {
    id: 'sos-resident',
    category: 'gate',
    level: 'beginner',
    roles: ['resident'],
    modules: ['sos'],
    title: 'How do I raise an emergency alert?',
    answer:
      'Open Emergency and raise the alert so guards on duty can see it. In a life-threatening emergency, also call the public emergency number.',
    links: [{ href: '/sos', label: 'Emergency' }],
  },
  {
    id: 'sos-guard',
    category: 'gate',
    level: 'intermediate',
    roles: ['guard'],
    modules: ['sos'],
    title: 'How do I respond to an emergency alert?',
    answer:
      'Open Emergency to see open alerts and follow the steps shown to respond.',
    links: [{ href: '/guard/sos', label: 'Emergency' }],
  },
  {
    id: 'requests-resident',
    category: 'requests',
    level: 'beginner',
    roles: ['resident'],
    modules: ['service_request'],
    title: 'How do I raise a complaint or service request?',
    answer:
      'Open Requests and choose New request. Pick a category, describe the problem and submit. You can follow its status on the same screen.',
    links: [
      { href: '/requests/new', label: 'New request' },
      { href: '/requests', label: 'Requests' },
    ],
  },
  {
    id: 'requests-staff',
    category: 'requests',
    level: 'intermediate',
    roles: STAFF,
    modules: ['service_request'],
    title: 'How do I track service requests?',
    answer:
      'Open Requests to see requests by status. Update each request as the work progresses.',
    links: [{ href: '/admin/requests', label: 'Requests' }],
  },
  {
    id: 'housekeeping-checks',
    category: 'requests',
    level: 'beginner',
    roles: ['hk_supervisor'],
    modules: ['service_request'],
    title: 'How do I record daily checks and report issues?',
    answer:
      'Open Daily checks to record each round. If you find a problem, log a request so the office can follow it up.',
    links: [
      { href: '/housekeeping/rounds', label: 'Daily checks' },
      { href: '/housekeeping/requests/new', label: 'Log a request' },
    ],
  },
  {
    id: 'notices-staff',
    category: 'community',
    level: 'beginner',
    roles: STAFF,
    modules: ['notice'],
    title: 'How do I publish a notice?',
    answer:
      'Open Notices and create a new notice. Write it and publish it. Residents see it on their Notices screen.',
    links: [{ href: '/admin/notices', label: 'Notices' }],
  },
  {
    id: 'notices-resident',
    category: 'community',
    level: 'beginner',
    roles: ['resident'],
    modules: ['notice'],
    title: 'Where do I find society notices?',
    answer: 'Open Notices to read current notices from the society office.',
    links: [{ href: '/notices', label: 'Notices' }],
  },
  {
    id: 'amenity-resident',
    category: 'community',
    level: 'beginner',
    roles: ['resident'],
    modules: ['amenity'],
    title: 'How do I book the hall or another amenity?',
    answer:
      'Open Amenities, choose the amenity and date, pick a free slot and confirm. Any fee and rules shown are the terms saved by the society.',
    links: [{ href: '/amenities', label: 'Amenities' }],
  },
  {
    id: 'amenity-staff',
    category: 'operations',
    level: 'intermediate',
    roles: STAFF,
    modules: ['amenity'],
    title: 'How do I manage amenities and bookings?',
    answer:
      'Open Amenities to set up each amenity with its fee and rules, and to see the bookings for a day.',
    links: [{ href: '/admin/amenities', label: 'Amenities' }],
  },
  {
    id: 'polls-resident',
    category: 'community',
    level: 'beginner',
    roles: ['resident'],
    modules: ['poll'],
    title: 'How do I vote in a society poll?',
    answer:
      'Open Polls, choose an open poll and record your vote before it closes.',
    links: [{ href: '/polls', label: 'Polls' }],
  },
  {
    id: 'meetings-staff',
    category: 'operations',
    level: 'advanced',
    roles: STAFF,
    modules: ['meeting'],
    title: 'How do I plan a meeting and record minutes?',
    answer:
      'Open Meetings to schedule a meeting with its agenda, record attendance and minutes, and follow up action items afterwards.',
    links: [{ href: '/admin/meetings', label: 'Meetings' }],
  },
  {
    id: 'vendors-work-orders',
    category: 'operations',
    level: 'advanced',
    roles: STAFF,
    modules: ['vendor'],
    title: 'How do I issue a work order to a vendor?',
    answer:
      'Open Vendors, approve a purchase request with its chosen quote, then issue the work order. Track due and completion dates in the work order register.',
    links: [{ href: '/admin/vendors', label: 'Vendors' }],
  },
  {
    id: 'amc-expiry',
    category: 'operations',
    level: 'intermediate',
    roles: STAFF,
    modules: ['amc'],
    title: 'How do I keep track of AMC renewals?',
    answer:
      'Open AMC to record each maintenance contract with its end date, so contracts close to expiry can be renewed in time.',
    links: [{ href: '/admin/amc', label: 'AMC' }],
  },
  {
    id: 'directory-resident',
    category: 'community',
    level: 'beginner',
    roles: ['resident'],
    modules: ['directory'],
    title: 'How do I find a neighbour or society contact?',
    answer: 'Open Directory to find residents and society contacts.',
    links: [{ href: '/directory', label: 'Directory' }],
  },
];

export const GETTING_STARTED_STAGES = ['setup', 'enter', 'read'] as const;
export type GettingStartedStage = (typeof GETTING_STARTED_STAGES)[number];

export const GETTING_STARTED_STAGE_LABELS: Readonly<
  Record<GettingStartedStage, string>
> = {
  setup: 'Set up once',
  enter: 'Enter data',
  read: 'Read the dashboard',
};

export interface GettingStartedLink extends HelpLink {
  module: ModuleKey;
}

export interface GettingStartedStep {
  stage: GettingStartedStage;
  text: string;
  links: readonly GettingStartedLink[];
}

export const GETTING_STARTED_PATHS: Readonly<
  Record<SocietyRole, readonly GettingStartedStep[]>
> = {
  admin: [
    {
      stage: 'setup',
      text: 'Check society settings, add blocks and units, then add members.',
      links: [
        { href: '/settings', label: 'Settings', module: 'core' },
        { href: '/structure', label: 'Structure', module: 'core' },
        { href: '/members', label: 'Members', module: 'core' },
      ],
    },
    {
      stage: 'enter',
      text: 'Record bills, notices and requests as they happen.',
      links: [
        { href: '/admin/billing', label: 'Billing', module: 'billing' },
        { href: '/admin/notices', label: 'Notices', module: 'notice' },
        {
          href: '/admin/requests',
          label: 'Requests',
          module: 'service_request',
        },
      ],
    },
    {
      stage: 'read',
      text: 'Open Analytics to see the society numbers in one place.',
      links: [{ href: '/admin/analytics', label: 'Analytics', module: 'core' }],
    },
  ],
  committee: [
    {
      stage: 'setup',
      text: 'Check your name and language in your profile.',
      links: [{ href: '/profile', label: 'Profile', module: 'core' }],
    },
    {
      stage: 'enter',
      text: 'Record requests, notices and expenses on the screens your society uses.',
      links: [
        {
          href: '/admin/requests',
          label: 'Requests',
          module: 'service_request',
        },
        { href: '/admin/notices', label: 'Notices', module: 'notice' },
        { href: '/admin/expenses', label: 'Expenses', module: 'expense' },
      ],
    },
    {
      stage: 'read',
      text: 'Open Analytics to see the society numbers in one place.',
      links: [{ href: '/admin/analytics', label: 'Analytics', module: 'core' }],
    },
  ],
  resident: [
    {
      stage: 'setup',
      text: 'Check your profile and the people in your household.',
      links: [
        { href: '/profile', label: 'Profile', module: 'core' },
        { href: '/household', label: 'Household', module: 'core' },
      ],
    },
    {
      stage: 'enter',
      text: 'Raise requests and book amenities when you need them.',
      links: [
        {
          href: '/requests/new',
          label: 'New request',
          module: 'service_request',
        },
        { href: '/amenities', label: 'Amenities', module: 'amenity' },
      ],
    },
    {
      stage: 'read',
      text: 'Your home screen shows what needs attention. Open Bills and Notices for details.',
      links: [
        { href: '/bills', label: 'Bills', module: 'billing' },
        { href: '/notices', label: 'Notices', module: 'notice' },
      ],
    },
  ],
  guard: [
    {
      stage: 'setup',
      text: 'Sign in on the gate device and open the gate screen.',
      links: [{ href: '/guard', label: 'Gate', module: 'core' }],
    },
    {
      stage: 'enter',
      text: 'Record visitors and parcels as they arrive.',
      links: [
        { href: '/guard/visitors', label: 'Visitors', module: 'visitor' },
        { href: '/guard/deliveries', label: 'Deliveries', module: 'delivery' },
      ],
    },
    {
      stage: 'read',
      text: 'The gate screen shows what is waiting at the gate.',
      links: [{ href: '/guard', label: 'Gate', module: 'core' }],
    },
  ],
  hk_supervisor: [
    {
      stage: 'setup',
      text: 'Check your name and language in your profile.',
      links: [{ href: '/profile', label: 'Profile', module: 'core' }],
    },
    {
      stage: 'enter',
      text: 'Record daily checks and log requests for problems you find.',
      links: [
        {
          href: '/housekeeping/rounds',
          label: 'Daily checks',
          module: 'service_request',
        },
        {
          href: '/housekeeping/requests/new',
          label: 'Log a request',
          module: 'service_request',
        },
      ],
    },
    {
      stage: 'read',
      text: 'The housekeeping screen shows your stock and recent activity.',
      links: [
        {
          href: '/housekeeping',
          label: 'Housekeeping',
          module: 'housekeeping',
        },
      ],
    },
  ],
};
