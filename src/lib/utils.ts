
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | Date, formatPattern: string = "yyyy-MM-dd"): string {
  try {
    return format(new Date(dateString), formatPattern);
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString.toString();
  }
}
