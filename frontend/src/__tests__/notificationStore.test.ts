import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchNotificationUnreadCount } from "../api/client";
import { useNotificationStore } from "../store/notificationStore";

vi.mock("../api/client", () => ({
  fetchNotificationUnreadCount: vi.fn(),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));

const fetchUnreadMock = vi.mocked(fetchNotificationUnreadCount);

describe("notificationStore fetchUnreadCount", () => {
  beforeEach(() => {
    fetchUnreadMock.mockReset();
    useNotificationStore.setState({ unreadCount: 0, notifications: [], lastError: null });
  });

  it("sets unread count on success", async () => {
    fetchUnreadMock.mockResolvedValue(7);

    await useNotificationStore.getState().fetchUnreadCount();

    expect(useNotificationStore.getState().unreadCount).toBe(7);
  });

  it("does not throw on 401 failure", async () => {
    useNotificationStore.setState({ unreadCount: 3 });
    fetchUnreadMock.mockRejectedValue(new Error("401 Unauthorized"));

    await useNotificationStore.getState().fetchUnreadCount();
    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });

  it("does not throw on network failure and keeps prior count", async () => {
    useNotificationStore.setState({ unreadCount: 5 });
    fetchUnreadMock.mockRejectedValue(new Error("Network Error"));

    await useNotificationStore.getState().fetchUnreadCount();
    expect(useNotificationStore.getState().unreadCount).toBe(5);
  });
});
