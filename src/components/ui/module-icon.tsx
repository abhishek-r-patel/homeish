// Map each module to one Lucide icon and accent colour for navigation and home tiles.
import {
  BookUser,
  Boxes,
  CalendarCheck,
  ClipboardCheck,
  Construction,
  FolderOpen,
  Gauge,
  Hammer,
  House,
  IdCard,
  KeyRound,
  Languages,
  Megaphone,
  MessagesSquare,
  Package,
  PartyPopper,
  Presentation,
  ReceiptIndianRupee,
  ShieldCheck,
  Siren,
  Sparkles,
  SquareParking,
  Store,
  UserRoundCheck,
  Vote,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/core/modules';

type Accent =
  | 'indigo'
  | 'orange'
  | 'emerald'
  | 'pink'
  | 'sky'
  | 'violet'
  | 'teal'
  | 'amber';

const MODULE_VISUALS: Readonly<
  Record<ModuleKey, { icon: LucideIcon; accent: Accent }>
> = {
  core: { icon: House, accent: 'indigo' },
  visitor: { icon: UserRoundCheck, accent: 'indigo' },
  delivery: { icon: Package, accent: 'orange' },
  billing: { icon: ReceiptIndianRupee, accent: 'emerald' },
  service_request: { icon: Wrench, accent: 'pink' },
  staff: { icon: IdCard, accent: 'teal' },
  housekeeping: { icon: Sparkles, accent: 'sky' },
  amc: { icon: ClipboardCheck, accent: 'teal' },
  notice: { icon: Megaphone, accent: 'amber' },
  amenity: { icon: CalendarCheck, accent: 'sky' },
  directory: { icon: BookUser, accent: 'violet' },
  expense: { icon: Wallet, accent: 'emerald' },
  tenancy: { icon: KeyRound, accent: 'amber' },
  document: { icon: FolderOpen, accent: 'amber' },
  parking: { icon: SquareParking, accent: 'sky' },
  sos: { icon: Siren, accent: 'pink' },
  vendor: { icon: Store, accent: 'orange' },
  patrol: { icon: ShieldCheck, accent: 'indigo' },
  metering: { icon: Gauge, accent: 'sky' },
  asset: { icon: Boxes, accent: 'violet' },
  home_services: { icon: Hammer, accent: 'orange' },
  poll: { icon: Vote, accent: 'teal' },
  meeting: { icon: Presentation, accent: 'indigo' },
  event: { icon: PartyPopper, accent: 'pink' },
  community: { icon: MessagesSquare, accent: 'violet' },
  language: { icon: Languages, accent: 'indigo' },
  major_works: { icon: Construction, accent: 'amber' },
};

// Full class names so Tailwind can find them at build time.
const ACCENT_CLASSES: Readonly<Record<Accent, string>> = {
  indigo: 'bg-accent-indigo-tint text-accent-indigo',
  orange: 'bg-accent-orange-tint text-accent-orange',
  emerald: 'bg-accent-emerald-tint text-accent-emerald',
  pink: 'bg-accent-pink-tint text-accent-pink',
  sky: 'bg-accent-sky-tint text-accent-sky',
  violet: 'bg-accent-violet-tint text-accent-violet',
  teal: 'bg-accent-teal-tint text-accent-teal',
  amber: 'bg-accent-amber-tint text-accent-amber',
};

export function ModuleIcon({
  moduleKey,
  className = 'size-6',
}: {
  moduleKey: ModuleKey;
  className?: string;
}) {
  const Icon = MODULE_VISUALS[moduleKey].icon;
  return (
    <Icon
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      strokeWidth={1.8}
    />
  );
}

export function ModuleIconTile({
  moduleKey,
  size = 'md',
}: {
  moduleKey: ModuleKey;
  size?: 'sm' | 'md';
}) {
  const accent = ACCENT_CLASSES[MODULE_VISUALS[moduleKey].accent];
  const box = size === 'sm' ? 'size-10 rounded-md' : 'size-12 rounded-md';
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center ${box} ${accent}`}
    >
      <ModuleIcon
        className={size === 'sm' ? 'size-5' : 'size-6'}
        moduleKey={moduleKey}
      />
    </span>
  );
}
