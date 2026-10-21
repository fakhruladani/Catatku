import {
  Baby, Banknote, Book, Briefcase, Bus, Car, CircleEllipsis, Clapperboard, Coffee, Coins, CreditCard,
  Droplet, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HandHeart, HeartPulse, House, Landmark,
  type LucideIcon, Music, PartyPopper, PawPrint, Percent, PiggyBank, Plane, Receipt, Shield, Shirt,
  ShoppingBag, Smartphone, Sparkles, Store, Tag, TrendingUp, Users, Utensils, Wallet, Wifi, Wrench, Zap,
} from "lucide-react";

/** Ikon yang boleh dipilih user (disimpan sebagai string kebab-case). */
export const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet, banknote: Banknote, landmark: Landmark, smartphone: Smartphone, "credit-card": CreditCard,
  "piggy-bank": PiggyBank, coins: Coins, utensils: Utensils, coffee: Coffee, car: Car, fuel: Fuel, bus: Bus,
  plane: Plane, receipt: Receipt, zap: Zap, droplet: Droplet, wifi: Wifi, house: House, wrench: Wrench,
  "shopping-bag": ShoppingBag, shirt: Shirt, "heart-pulse": HeartPulse, dumbbell: Dumbbell,
  "graduation-cap": GraduationCap, book: Book, clapperboard: Clapperboard, music: Music, gamepad: Gamepad2,
  "hand-heart": HandHeart, gift: Gift, users: Users, baby: Baby, "paw-print": PawPrint, sparkles: Sparkles,
  shield: Shield, percent: Percent, briefcase: Briefcase, store: Store, "party-popper": PartyPopper,
  "trending-up": TrendingUp, "circle-ellipsis": CircleEllipsis, tag: Tag,
};

export const ICON_NAMES = Object.keys(ICONS);

export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Tag;
  return <Cmp className={className} aria-hidden />;
}

export const COLOR_SWATCHES = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#64748b", "#737373",
];

export function IconBadge({ icon, color, className = "size-9" }: { icon: string; color: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <DynamicIcon name={icon} className="size-[55%]" />
    </span>
  );
}
