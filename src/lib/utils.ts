
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'NGN'): string {
  if (currency === 'NGN') {
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch (error) {
    return 'Invalid date';
  }
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
