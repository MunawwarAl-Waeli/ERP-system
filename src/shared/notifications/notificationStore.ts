import { create } from "zustand";
import { NotificationOptions, ActiveNotification } from "./types";

interface NotificationState {
  current: ActiveNotification | null;
  queue: ActiveNotification[];
  show: (options: NotificationOptions) => string;
  dismiss: () => void;
  clear: () => void;
}

let idCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  current: null,
  queue: [],

  show: (options) => {
    const id = "notif_" + (++idCounter) + "_" + Date.now();
    const notification: ActiveNotification = {
      ...options,
      id,
      createdAt: Date.now(),
    };

    const { current } = get();
    if (!current) {
      set({ current: notification });
    } else {
      set({ queue: [...get().queue, notification] });
    }

    return id;
  },

  dismiss: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ current: next, queue: rest });
    } else {
      set({ current: null });
    }
  },

  clear: () => set({ current: null, queue: [] }),
}));

export const notify = {
  success: (message: string, opts?: Partial<Omit<NotificationOptions, "type" | "message">>) =>
    useNotificationStore.getState().show({ type: "success", message, ...opts }),

  error: (message: string, opts?: Partial<Omit<NotificationOptions, "type" | "message">>) =>
    useNotificationStore.getState().show({ type: "error", message, ...opts }),

  warning: (message: string, opts?: Partial<Omit<NotificationOptions, "type" | "message">>) =>
    useNotificationStore.getState().show({ type: "warning", message, ...opts }),

  info: (message: string, opts?: Partial<Omit<NotificationOptions, "type" | "message">>) =>
    useNotificationStore.getState().show({ type: "info", message, ...opts }),
};
