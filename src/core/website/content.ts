// Public website copy and synthetic examples, separate from product workflows.
// Static imports keep image optimization on the host-independent framework asset path.
import billingPreview from '../../../public/homeish-billing-preview.jpg';
import serviceRequestPreview from '../../../public/homeish-service-request-preview.jpg';
import amenityPreview from '../../../public/homeish-amenity-preview.jpg';

export const websiteContent = {
  metadataDescription:
    'Society management for committees, admins and residents. See Homeish features released for testing, synthetic product screenshots and the planned roadmap. Demo coming soon.',
  navigation: [
    { href: '#features', label: 'Features' },
    { href: '#product-preview', label: 'Product preview' },
    { href: '#roadmap', label: 'Planned modules' },
    { href: '#how-it-works', label: 'How it works' },
  ],
  labels: {
    skip: 'Skip to content',
    home: 'Homeish home',
    navigation: 'Main navigation',
    societyNavigation: 'Society access',
    society: 'Your society',
    signIn: 'Sign in',
    privacy: 'Privacy policy',
    screenshot: 'Synthetic screenshot',
  },
  eyebrow: 'For society committees and admins',
  headline: 'A clearer day for your committee. A calmer day for everyone.',
  introduction:
    'Bring your gate records, maintenance dues, service requests and daily work into one place. Give your committee a clearer view and residents less to chase.',
  availability:
    'Built in stages. Released features are still for testing, not live society use. Onboarding is not open yet.',
  demo: {
    action: 'Try demo',
    notice: 'Demo coming soon',
    description:
      'The separate demo will be connected when the product is ready. For now, explore the synthetic screenshots below.',
  },
  heroCaption:
    'Sharing payment details is not a payment confirmation. Your admin checks the payment first.',
  heroPreview: {
    image: billingPreview,
    alt: 'Synthetic payment-details form showing Rs. 2,500 and fields for a UPI reference and payment date.',
  },
  boundariesTitle: 'Clear boundaries from the start.',
  boundaries: [
    {
      name: 'Separate society spaces',
      description:
        'Society access is checked on the server and in the database. Live rollout still needs pilot checks and approval.',
    },
    {
      name: 'Access shaped by role',
      description:
        'Residents, guards, admins and committee members have different permissions. Modules are enabled per society.',
    },
    {
      name: 'Synthetic public examples',
      description:
        'These previews use invented data, not real resident records. This website does not publish a society directory.',
    },
  ],
  featuresTitle: 'Built for the work that fills your day.',
  featuresDescription:
    'These modules have been released for testing. Owner checks and live activation are still pending; they are not open for live society use.',
  testingLabel: 'Released for testing',
  modules: [
    {
      name: 'Visitors',
      description:
        'Resident approvals, gate records and visitor codes in one place.',
    },
    {
      name: 'Deliveries',
      description:
        'Record arrivals and track parcels still waiting at the gate.',
    },
    {
      name: 'Dues and payments',
      description:
        'Issue maintenance bills, record UPI details and confirm payments.',
    },
    {
      name: 'Service requests',
      description: 'Keep reported issues, updates and follow-ups together.',
    },
    {
      name: 'Notice board',
      description: 'Share society updates with the right audience.',
    },
    {
      name: 'Staff',
      description: 'Keep staff registration and attendance organised.',
    },
    {
      name: 'Housekeeping',
      description: 'Track supplies, stock movements and low-stock reminders.',
    },
    {
      name: 'Maintenance contracts',
      description:
        'Keep AMC service visits, renewals and contract history together.',
    },
    {
      name: 'Amenities',
      description: 'Manage exclusive slots, bookings and cancellation credits.',
    },
  ],
  developmentTitle: 'More work taking shape.',
  developmentDescription:
    'Built and checked locally, but not released to beta or approved for live societies.',
  developmentLabel: 'In development',
  development: [
    {
      name: 'Expenses and accounts',
      description:
        'Society expenses, committee approvals, cash and bank books, and reports.',
    },
    {
      name: 'Resident and vehicle directory',
      description:
        'Resident privacy choices, household vehicles and role-based access to directory details.',
    },
  ],
  peopleTitle: 'One society. Clearer roles.',
  peopleDescription:
    'The tools a person sees depend on their role and the modules enabled for their society.',
  people: [
    {
      name: 'Committee members',
      description:
        'Review records and follow the work without chasing every update.',
    },
    {
      name: 'Admins',
      description:
        'Keep bills, society records and everyday follow-through together.',
    },
    {
      name: 'Residents',
      description:
        'Find your dues, notices and request updates with less back-and-forth.',
    },
    {
      name: 'Guards',
      description: 'Focus on visitor and delivery decisions at the gate.',
    },
  ],
  previewsTitle: 'A look inside Homeish.',
  previewsDescription:
    'Actual product screens captured from development-only fixtures with invented data. These are still images, not a connected demo.',
  previews: [
    {
      title: 'Report an issue with context',
      description:
        'Choose a category, describe the issue and give your society team the details it needs.',
      image: serviceRequestPreview,
      alt: 'Synthetic common-area plumbing request form with an issue description, priority and optional photos.',
    },
    {
      title: 'Check the rules before booking',
      description:
        'Review the rules, guest count and fee before confirming an exclusive amenity booking.',
      image: amenityPreview,
      alt: 'Synthetic resident booking form showing a guest count, rules acknowledgement and a free exclusive booking.',
    },
  ],
  roadmapTitle: 'Planned modules',
  roadmapDescription:
    'Roadmap ideas, not usable features. Details depend on future phase decisions; no release dates are promised.',
  roadmap: [
    {
      name: 'Everyday essentials',
      modules: [
        'Move-in, move-out and tenancy',
        'Document repository',
        'Parking management',
        'Emergency and SOS',
      ],
    },
    {
      name: 'Better coordination',
      modules: [
        'Polls and voting',
        'Meetings and AGM',
        'Vendors and purchase approvals',
        'Guard patrol and incident logs',
        'Utility metering',
        'Committee analytics',
      ],
    },
    {
      name: 'Community and more',
      modules: [
        'Asset register',
        'Community and marketplace',
        'Events and RSVPs',
        'Home-services directory',
        'Service-request escalation',
        'More languages',
        'Multi-society views',
      ],
    },
  ],
  stepsTitle: 'When your society is ready.',
  stepsDescription:
    'Onboarding is not open yet. Setup will be owner-led after pilot checks, not a self-service sign-up.',
  steps: [
    {
      name: 'Set up your society',
      description:
        'Prepare your society address, units and members in a separate society space.',
    },
    {
      name: 'Enable what you need',
      description:
        'Enable approved modules for your society. Planned modules are not included until they are built and verified.',
    },
    {
      name: 'Give each role its view',
      description:
        'Residents, guards, admins and committee members use the tools allowed for their role.',
    },
  ],
  societyTitle: 'Already have a society address?',
  societyDescription:
    'Use the address shared by your society admin. This does not register a new society or open an unconfigured one.',
  questionsTitle: 'A few things worth knowing',
  questions: [
    {
      question: 'Can we use Homeish for our society today?',
      answer:
        'Not yet. Released modules are for testing, and live society onboarding is not open. Owner testing, pilot checks and live activation must be completed first.',
    },
    {
      question: 'Why is Try demo unavailable?',
      answer:
        'The separate demo is not set up yet. We will connect it after the product is ready and verify its synthetic-data and reset boundaries. Until then, the button stays disabled and the screenshots are not an interactive demo.',
    },
    {
      question: 'Does Homeish collect our maintenance payments?',
      answer:
        'No. The payment flow sends money directly to your society through its UPI details. You submit the reference, then your admin checks and confirms the payment in Homeish. Submitting details alone does not confirm a payment. Homeish does not hold society funds.',
    },
    {
      question: 'Will every society need every module?',
      answer:
        'No. Modules are enabled per society. A disabled module does not appear in that society, and a roadmap entry does not make it available.',
    },
    {
      question: 'Who can see society information?',
      answer:
        'Access depends on society membership, role and the enabled modules. This public website uses invented examples only; it does not expose a real society or resident directory. Live rollout still requires privacy checks and approval.',
    },
    {
      question: 'Do residents need to install an app?',
      answer:
        'Homeish is a web app that can be added to your home screen. A network connection is required for society workflows; society records are not stored for offline use.',
    },
    {
      question: 'What is the beta website?',
      answer:
        'Beta is a separate testing environment. It uses synthetic data only and is neither the public demo nor a place for real society information.',
    },
  ],
  closingTitle: 'Less chasing. More clarity.',
  closingDescription:
    'Built to help your committee keep society life moving. The demo will be connected here when it is ready.',
  tagline: 'Homeish. A little more like home.',
  footerAvailability: 'Not open for live society use.',
} as const;

export const demoExample = {
  visitor: 'Asha, sample visitor',
  unit: 'A-102',
  purpose: 'Visiting a resident',
};
