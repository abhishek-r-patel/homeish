// Public P57 website copy, topic-grouped registry evidence and synthetic preview assets.
import billingPreview from '../../../public/homeish-billing-preview.jpg';
import adminPreview from '../../../public/homeish-admin-preview.png';
import committeePreview from '../../../public/homeish-committee-preview.png';
import guardPreview from '../../../public/homeish-guard-preview.png';
import housekeepingPreview from '../../../public/homeish-housekeeping-preview.png';
import residentPreview from '../../../public/homeish-resident-preview.png';
import dayVisitorPreview from '../../../public/homeish-day-visitor-approved.png';
import dayDeliveryPreview from '../../../public/homeish-day-delivery-recorded.png';
import dayBillPreview from '../../../public/homeish-day-bill-available.png';
import dayRequestPreview from '../../../public/homeish-day-request-resolved.png';
import dayNoticePreview from '../../../public/homeish-day-notice-read.png';
import {
  getRoleNavigationGroups,
  MODULE_KEYS,
  MODULE_REGISTRY,
} from '../modules';

const moduleGroups = getRoleNavigationGroups(['admin'], MODULE_KEYS).map(
  (group) => ({
    name: group.topic,
    modules: [
      ...new Set(
        group.items.map((item) => MODULE_REGISTRY[item.moduleKey].name),
      ),
    ],
  }),
);

const moduleCount = MODULE_KEYS.length - 1;

export const websiteContent = {
  metadataDescription:
    'Homeish brings society records, daily work and resident communication into one installable web app. Explore its features, sample previews and guided setup.',
  navigation: [
    { href: '#features', label: 'Features' },
    { href: '#roles', label: 'For every person' },
    { href: '#product-preview', label: 'Product preview' },
    { href: '#how-it-works', label: 'Setup' },
    { href: '#enquiry', label: 'Talk to us' },
  ],
  labels: {
    skip: 'Skip to content',
    home: 'Homeish home',
    navigation: 'Main navigation',
    societyNavigation: 'Society access',
    society: 'Your society',
    signIn: 'Sign in',
    privacy: 'Privacy policy',
    screenshot: 'Sample preview',
  },
  eyebrow: 'For societies and their managing committees',
  headline: 'A clearer day for your committee. A calmer day for everyone.',
  introduction:
    'Keep society records, daily work and resident communication in one simple place, with the features your society chooses.',
  availability:
    'Homeish is currently in beta. New societies join through guided setup while testing and go-live checks continue.',
  facts: [
    `${moduleCount} society features to choose from`,
    'The right view for every person',
    'Features chosen for your society',
    'Works on a phone or laptop browser',
    'UPI payments go directly to the society',
  ],
  demo: {
    action: 'Try demo',
    notice: 'Demo coming soon',
    description:
      'The separate connected demo is not open yet. Explore synthetic still images below.',
  },
  contact: {
    action: 'Talk to us',
    enquiryAction: 'Send an enquiry',
  },
  heroCaption:
    'Sharing payment details is not a payment confirmation. Your society administrator checks the payment first.',
  heroPreview: {
    image: billingPreview,
    alt: 'Synthetic payment-details form showing Rs. 2,500 and fields for a UPI reference and payment date.',
  },
  boundariesTitle: 'Clear boundaries from the start.',
  boundaries: [
    {
      name: 'Separate society spaces',
      description:
        'Each society keeps its own records, settings and selected features.',
    },
    {
      name: 'Access shaped by responsibility',
      description:
        'Residents, guards, committee members, administrators and housekeeping supervisors see only the work meant for them.',
    },
    {
      name: 'Examples using fictional data',
      description:
        'Public screenshots use invented data. No real resident names, contacts, vehicles or society directory are published.',
    },
  ],
  problemsTitle: 'Problems Homeish solves.',
  problemsDescription:
    'Everyday society work becomes easier to find, follow and close.',
  problems: [
    {
      before: 'Paper visitor registers',
      after: 'Visitor records stay linked to the right home.',
    },
    {
      before: 'Chasing dues on WhatsApp',
      after: 'Bills and payment checks stay together in Billing.',
    },
    {
      before: 'Lost complaints',
      after: 'Service requests stay visible from report to resolution.',
    },
    {
      before: 'Missed delivery handovers',
      after: 'Gate staff record parcels and residents can respond.',
    },
    {
      before: 'Scattered notices',
      after: 'Residents find selected society notices in one notice board.',
    },
  ],
  featuresTitle: 'Features grouped around everyday society work.',
  featuresDescription:
    'These features are available for beta testing. Go-live checks are separate, and each society uses only the features selected for it.',
  testingLabel: 'Released for testing',
  moduleGroups,
  peopleTitle: 'One app. The right view for every person.',
  peopleDescription:
    'Each person gets a focused workspace with the information and actions they need.',
  people: [
    {
      name: 'Residents',
      description:
        'See your own bills, notices, bookings, visitors and requests with flat-aware navigation.',
      image: residentPreview,
      alt: 'Synthetic resident Homeish dashboard with quick actions, visitor requests and upcoming dates.',
    },
    {
      name: 'Guards',
      description:
        'Keep gate actions first, with big visitor and delivery controls and no unrelated society data.',
      image: guardPreview,
      alt: 'Synthetic guard dashboard with visitor, delivery, round and vehicle actions.',
    },
    {
      name: 'Committee members',
      description:
        'Review society work, meetings and reports with clear read-only limits where required.',
      image: committeePreview,
      alt: 'Synthetic committee dashboard with society figures, quick actions and upcoming work.',
    },
    {
      name: 'Society administrators',
      description:
        'Manage bills, requests, people and everyday follow-through from one organized workspace.',
      image: adminPreview,
      alt: 'Synthetic administrator dashboard with four figures and grouped society actions.',
    },
    {
      name: 'Housekeeping supervisors',
      description:
        'Record stock, log issues and follow daily work without seeing unrelated society areas.',
      image: housekeepingPreview,
      alt: 'Synthetic housekeeping dashboard with inventory, request and daily-check actions.',
    },
  ],
  dayTitle: 'One day in your society.',
  dayDescription:
    'Five small moments, from the morning gate to the evening notice board.',
  day: [
    {
      time: '8:00 AM',
      title: 'A guest is expected',
      description:
        'The resident approves the visitor, and the guard sees the right arrival at the gate.',
      image: dayVisitorPreview,
      alt: 'Synthetic close-up showing an approved visitor expected at one flat.',
    },
    {
      time: '11:30 AM',
      title: 'A parcel is recorded',
      description:
        'The delivery stays traceable until the resident responds and the gate closes the handover.',
      image: dayDeliveryPreview,
      alt: 'Synthetic close-up showing a courier delivery recorded for one resident.',
    },
    {
      time: '2:00 PM',
      title: 'A bill is ready',
      description:
        'The resident sees the society bill and submits payment details for the society administrator to check.',
      image: dayBillPreview,
      alt: 'Synthetic close-up showing a monthly society bill available to view.',
    },
    {
      time: '5:00 PM',
      title: 'A request is resolved',
      description:
        'The repair moves from reported work to a clear resolved state without a separate chase thread.',
      image: dayRequestPreview,
      alt: 'Synthetic close-up showing a resolved society maintenance request.',
    },
    {
      time: '7:00 PM',
      title: 'A notice is read',
      description:
        'The chosen audience can open the notice and managers can see the aggregate read count.',
      image: dayNoticePreview,
      alt: 'Synthetic close-up showing a society notice opened by its intended audience.',
    },
  ],
  previewsTitle: 'A look at the new Homeish design.',
  previewsDescription:
    'Sample previews use fictional data. They are not a connected demo.',
  previews: [
    {
      title: 'Calm administrator overview',
      description:
        'A grouped workspace with four figures, quick actions and the next society dates.',
      image: adminPreview,
      alt: 'Synthetic administrator overview using the new Homeish grouped navigation and dashboard.',
    },
    {
      title: 'Resident-first Home',
      description:
        'Quick actions and coming work stay focused on the person’s selected flat.',
      image: residentPreview,
      alt: 'Synthetic resident Home screen using the new quick-action layout.',
    },
    {
      title: 'Focused housekeeping work',
      description:
        'Supervisors see stock and daily tasks without unrelated society controls.',
      image: housekeepingPreview,
      alt: 'Synthetic housekeeping supervisor dashboard with stock and request actions.',
    },
  ],
  nextTitle: 'What comes next',
  nextDescription:
    'A short list of work being considered or prepared. It is not available yet.',
  next: [
    {
      name: 'Try Homeish by person',
      description:
        'Available only after a separately approved demo is set up, checked and reset safely.',
    },
    {
      name: 'More regional languages',
      description:
        'Possible future Pro languages, only if demand and willingness to pay are clear.',
    },
  ],
  stepsTitle: 'How setup works.',
  stepsDescription:
    'Setup is guided by the Homeish team. New societies are not opened through open sign-up.',
  steps: [
    {
      name: 'Set up the society',
      description:
        'The Homeish team works with your committee to understand the society, flats and required features.',
    },
    {
      name: 'Switch on the agreed tools',
      description:
        'Your committee and the Homeish team agree which features and settings are needed.',
    },
    {
      name: 'Complete the administrator checklist',
      description:
        'The society administrator follows the Getting started checklist for society details, people and payment setup.',
    },
  ],
  rightForYouTitle: 'Is Homeish right for you?',
  rightForYou: [
    'Homeish is a web app, not a native phone download.',
    'An internet connection is needed for society workflows.',
    'Homeish never holds society money.',
    'Homeish is not accounting or legal advice.',
    'Features not selected for your society do not appear.',
  ],
  societyTitle: 'Already have a society address?',
  societyDescription:
    'Use the address shared by your society administrator. This does not register a new society or open an unconfigured one.',
  questionsTitle: 'A few things worth knowing',
  questions: [
    {
      question: 'Can we use Homeish for our society today?',
      answer:
        'Not yet through open sign-up. Homeish is currently in beta, and testing, guided setup and go-live checks remain separate steps.',
    },
    {
      question: 'Why is Try demo unavailable?',
      answer:
        'The connected demo is not set up yet. The button stays disabled, and the public screenshots remain still images.',
    },
    {
      question: 'Does Homeish collect maintenance payments?',
      answer:
        'No. Money goes directly to the society through its UPI details. A resident submits a reference, then the society administrator checks and confirms it.',
    },
    {
      question: 'Will every society get every feature?',
      answer:
        'No. Each society chooses the features it needs, and people still see only the information and actions meant for them.',
    },
    {
      question: 'Can our society change how a feature works?',
      answer:
        'Society administrators can change everyday settings. Broader setup choices are agreed with the Homeish team because requirements can differ between societies.',
    },
    {
      question: 'Who can see an enquiry?',
      answer:
        'Only authorized Homeish team members can view or delete public enquiries. The form does not expose them to societies, residents or administrators.',
    },
    {
      question: 'Do residents need to install an app?',
      answer:
        'No. Homeish is an installable web app that works in a phone or laptop browser and can be added to the home screen. It requires a network connection.',
    },
  ],
  enquiryTitle: 'Talk to us.',
  enquiryDescription:
    'Tell us about your society. Enter an email address or phone number so the Homeish team can reply.',
  closingTitle: 'Less chasing. More clarity.',
  closingDescription:
    'Built to help every part of a society keep work moving, with clear limits and no claims about work that is not available yet.',
  tagline: 'Homeish. A little more like home.',
  footerAvailability: 'Not open for live society use.',
} as const;

export const demoExample = {
  visitor: 'Asha, sample visitor',
  unit: 'A-102',
  purpose: 'Visiting a resident',
};
