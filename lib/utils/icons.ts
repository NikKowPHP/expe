import { 
  Coffee, Bus, ShoppingCart, Home, Zap, Heart, Briefcase, MoreHorizontal,
  DollarSign, TrendingUp, Gift, Music, Book, Car, Plane, Film,
  type LucideIcon
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  'coffee': Coffee,
  'bus': Bus,
  'shopping-cart': ShoppingCart,
  'home': Home,
  'zap': Zap,
  'heart': Heart,
  'briefcase': Briefcase,
  'dollar-sign': DollarSign,
  'trending-up': TrendingUp,
  'gift': Gift,
  'music': Music,
  'book': Book,
  'car': Car,
  'plane': Plane,
  'film': Film,
  'more-horizontal': MoreHorizontal,
};

export function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || MoreHorizontal;
}

export const AVAILABLE_ICONS = [
  { name: 'coffee', icon: Coffee, label: 'Food' },
  { name: 'bus', icon: Bus, label: 'Transport' },
  { name: 'shopping-cart', icon: ShoppingCart, label: 'Shopping' },
  { name: 'home', icon: Home, label: 'Home' },
  { name: 'zap', icon: Zap, label: 'Utilities' },
  { name: 'heart', icon: Heart, label: 'Health' },
  { name: 'briefcase', icon: Briefcase, label: 'Work' },
  { name: 'dollar-sign', icon: DollarSign, label: 'Money' },
  { name: 'trending-up', icon: TrendingUp, label: 'Investment' },
  { name: 'gift', icon: Gift, label: 'Gifts' },
  { name: 'music', icon: Music, label: 'Entertainment' },
  { name: 'book', icon: Book, label: 'Education' },
  { name: 'car', icon: Car, label: 'Vehicle' },
  { name: 'plane', icon: Plane, label: 'Travel' },
  { name: 'film', icon: Film, label: 'Movies' },
  { name: 'more-horizontal', icon: MoreHorizontal, label: 'Other' },
];

export const COLOR_OPTIONS = [
  'bg-orange-100 text-orange-600',
  'bg-blue-100 text-blue-600',
  'bg-purple-100 text-purple-600',
  'bg-green-100 text-green-600',
  'bg-yellow-100 text-yellow-600',
  'bg-red-100 text-red-600',
  'bg-slate-100 text-slate-600',
  'bg-gray-100 text-gray-600',
  'bg-pink-100 text-pink-600',
  'bg-indigo-100 text-indigo-600',
  'bg-teal-100 text-teal-600',
  'bg-cyan-100 text-cyan-600',
];
