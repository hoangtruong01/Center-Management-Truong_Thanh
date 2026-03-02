"use client";

import { create } from "zustand";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 3000) => {
    const id = Date.now().toString();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Toast helper functions
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast("success", message, duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast("error", message, duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast("warning", message, duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast("info", message, duration),
};

const TOAST_VARIANTS = {
  success: {
    container: "bg-green-600 text-white border-green-700 shadow-green-900/20",
    icon: CheckCircle2,
    title: "Thành công",
  },
  error: {
    container: "bg-red-600 text-white border-red-700 shadow-red-900/20",
    icon: XCircle,
    title: "Lỗi",
  },
  warning: {
    container: "bg-amber-500 text-white border-amber-600 shadow-amber-900/20",
    icon: AlertTriangle,
    title: "Chú ý",
  },
  info: {
    container: "bg-blue-600 text-white border-blue-700 shadow-blue-900/20",
    icon: Info,
    title: "Thông tin",
  },
};

// Toast Container Component
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 w-full max-w-[400px] pointer-events-none">
      {toasts.map((toastItem) => {
        const variant = TOAST_VARIANTS[toastItem.type];
        const Icon = variant.icon;

        return (
          <div
            key={toastItem.id}
            className={`
              pointer-events-auto
              flex items-start gap-4 px-5 py-4 rounded-xl border shadow-2xl
              transform transition-all duration-300 ease-out hover:scale-[1.02]
              animate-in slide-in-from-right-full fade-in zoom-in-95
              ${variant.container}
            `}
          >
            <div className="mt-1 shrink-0">
              <Icon className="w-6 h-6" strokeWidth={2.5} />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-base leading-none mb-1">
                {variant.title}
              </h4>
              <p className="text-sm font-medium opacity-90 leading-relaxed wrap-break-word">
                {toastItem.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toastItem.id)}
              className="shrink-0 mt-1 opacity-70 hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
