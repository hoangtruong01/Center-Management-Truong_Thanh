import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function formatTeacherPayout(amount: number) {
  return formatCurrency(amount * 0.7);
}

export function formatCenterShare(amount: number) {
  return formatCurrency(amount * 0.3);
}
