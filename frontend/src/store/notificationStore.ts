import { create } from "zustand";

import {
  deleteNotification,
  fetchNotificationUnreadCount,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "../api/client";

type NotificationFilter = "all" | Notification["type"];

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  lastError: string | null;
  isOpen: boolean;
  activeFilter: NotificationFilter;
  fetchNotifications: (type?: Notification["type"]) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
  setFilter: (filter: NotificationFilter) => void;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  lastError: null,
  isOpen: false,
  activeFilter: "all",
  fetchNotifications: async (type) => {
    try {
      const notifications = await fetchNotifications(type ? { type } : undefined);
      set({ notifications, lastError: null });
    } catch (error) {
      set({ lastError: toErrorMessage(error) });
    }
  },
  fetchUnreadCount: async () => {
    try {
      const unreadCount = await fetchNotificationUnreadCount();
      set({ unreadCount, lastError: null });
    } catch (error) {
      set((state) => ({
        unreadCount: state.unreadCount,
        lastError: toErrorMessage(error),
      }));
    }
  },
  markAsRead: async (id) => {
    const notification = await markNotificationRead(id);
    set((state) => ({
      notifications: state.notifications.map((item) => (item.id === id ? notification : item)),
      unreadCount: Math.max(
        0,
        state.notifications.some((item) => item.id === id && !item.read) ? state.unreadCount - 1 : state.unreadCount,
      ),
    }));
  },
  markAllRead: async () => {
    await markAllNotificationsRead();
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, read: true })),
      unreadCount: 0,
    }));
  },
  dismiss: async (id) => {
    const wasUnread = get().notifications.some((item) => item.id === id && !item.read);
    await deleteNotification(id);
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
  },
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  closePanel: () => set({ isOpen: false }),
  setFilter: (filter) => set({ activeFilter: filter }),
}));
