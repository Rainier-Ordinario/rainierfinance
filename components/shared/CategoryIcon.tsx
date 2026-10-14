import {
  ArrowLeftRight,
  Banknote,
  Bike,
  Bitcoin,
  Car,
  Circle,
  CircleEllipsis,
  Fuel,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Play,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  TrainFront,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

// Maps the lucide kebab-case names stored on categories to their components.
// Covers the default category set; anything else falls back to a neutral dot.
const ICONS: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  bike: Bike,
  fuel: Fuel,
  "train-front": TrainFront,
  car: Car,
  play: Play,
  repeat: Repeat,
  "shopping-bag": ShoppingBag,
  receipt: Receipt,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  "gamepad-2": Gamepad2,
  bitcoin: Bitcoin,
  "trending-up": TrendingUp,
  banknote: Banknote,
  "arrow-left-right": ArrowLeftRight,
  "circle-ellipsis": CircleEllipsis,
};

/**
 * Category badge: the category's lucide icon tinted with its color, sitting in
 * a soft same-color chip. Same color source as the CategoryDot used in tables.
 */
export function CategoryIcon({
  category,
  categories,
  className,
}: {
  category: string;
  categories: Category[];
  className?: string;
}) {
  const cat = categories.find((c) => c.name === category);
  const Icon = (cat && ICONS[cat.icon]) || Circle;
  const color = cat?.color ?? "var(--muted-foreground)";
  const isHex = /^#[0-9a-fA-F]{6}$/.test(color);

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        className
      )}
      // ~14% alpha tint of the category color; neutral chip for non-hex colors.
      style={{ background: isHex ? `${color}24` : "var(--muted)" }}
      aria-hidden
    >
      <Icon className="size-4" style={{ color }} />
    </span>
  );
}
