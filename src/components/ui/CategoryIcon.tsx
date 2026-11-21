import React from "react";
import {
  User,
  Users,
  Building2,
  Briefcase,
  Sparkles,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Plane,
  TrendingUp,
  ShieldAlert,
  Gem,
  Cake,
  Flower2,
  Landmark,
  Trophy,
  Ticket,
  Home,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  personal: User,
  family: Users,
  community: Building2,
  business: Briefcase,
  event: Sparkles,
  education: GraduationCap,
  charity: HeartHandshake,
  health: HeartPulse,
  travel: Plane,
  investment: TrendingUp,
  emergency: ShieldAlert,
  wedding: Gem,
  birthday: Cake,
  funeral: Flower2,
  religious: Landmark,
  sports: Trophy,
  entertainment: Ticket,
  housing: Home,
  other: Layers,
};

export function getCategoryIconComponent(category?: string | null): LucideIcon {
  if (!category) return Layers;
  return CATEGORY_ICON_MAP[category.toLowerCase()] || Layers;
}

export interface CategoryIconProps {
  category?: string | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 18,
  strokeWidth = 2,
  className,
}) => {
  const Icon = getCategoryIconComponent(category);
  return <Icon size={size} strokeWidth={strokeWidth} className={cn("shrink-0", className)} aria-hidden="true" />;
};

export default CategoryIcon;
