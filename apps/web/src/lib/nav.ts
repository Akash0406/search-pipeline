import {
  Building2,
  Compass,
  LayoutDashboard,
  Radar,
  Settings,
  ShieldCheck,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only show to users holding the admin role. */
  adminOnly?: boolean;
  /** Show in the mobile bottom navigation bar (space is limited there). */
  primary?: boolean;
}

/** Authenticated app navigation (Req 3.1, 3.2). */
export const APP_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/app', icon: LayoutDashboard, primary: true },
  { label: 'Opportunities', href: '/app/opportunities', icon: Radar, primary: true },
  { label: 'Sources', href: '/app/sources', icon: Building2, primary: true },
  { label: 'Profiles', href: '/app/profiles', icon: UserCircle, primary: true },
  { label: 'Settings', href: '/app/settings', icon: Settings },
  { label: 'Admin', href: '/admin/connector-health', icon: ShieldCheck, adminOnly: true },
];

/** Public marketing navigation (Req 2.2). */
export const PUBLIC_NAV: { label: string; href: string; icon?: LucideIcon }[] = [
  { label: 'Features', href: '/features', icon: Compass },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Sources', href: '/sources' },
  { label: 'Security', href: '/security' },
];
