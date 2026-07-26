/* ─────────────────────────────────────────────────────────────────────────
   BranV icon set — Lucide (THEME_REDESIGN_PLAN §4.5).

   Central 1:1 map of icon *meaning* → Lucide glyph. Components import from here
   so the icon family stays consistent (single stroke width / size tokens) and
   every swap is a like-for-like replacement of an existing icon's meaning —
   no new features implied, no functions removed (Scope Contract §2.4).

   Usage:  import { Icon } from '@/components/icons';
           <Icon.Search className="h-5 w-5" />
   ───────────────────────────────────────────────────────────────────────── */

import {
  Search,
  Heart,
  ShoppingBag,
  Menu,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Star,
  User,
  Home,
  LayoutGrid,
  Compass,
  HelpCircle,
  Bell,
  Truck,
  ShieldCheck,
  RefreshCw,
  Percent,
  Plus,
  Minus,
  Check,
  Flame,
  Trash2,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

/** Default presentation for BranV icons: 24px base, 1.75 stroke (§4.5). */
export const ICON_DEFAULTS = { size: 24, strokeWidth: 1.75 } as const;

/** Semantic icon registry — key = meaning in the UI, value = Lucide glyph. */
export const Icon = {
  Search,
  Wishlist: Heart,
  Heart,
  Cart: ShoppingBag,
  Bag: ShoppingBag,
  Menu,
  Close: X,
  Filter: SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Star,
  Account: User,
  User,
  Home,
  Categories: LayoutGrid,
  Explore: Compass,
  Help: HelpCircle,
  Shop: ShoppingBag,
  Notifications: Bell,
  Delivery: Truck,
  Secure: ShieldCheck,
  Returns: RefreshCw,
  Offers: Percent,
  Plus,
  Minus,
  Check,
  Trending: Flame,
  Delete: Trash2,
  Logout: LogOut,
} satisfies Record<string, LucideIcon>;

export type { LucideIcon };
