import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NotificationBell from "./NotificationBell";

vi.mock("../../services/employeeNotificationsService", () => ({
  default: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

import employeeNotificationsService from "../../services/employeeNotificationsService";

function makeNotification(overrides = {}) {
  return {
    id: "n1",
    title: "Leave approved",
    message: "Your leave request was approved.",
    created_at: new Date().toISOString(),
    read_at: null,
    ...overrides,
  };
}

describe("NotificationBell", () => {
  it("renders the unread count badge from the list response", async () => {
    employeeNotificationsService.list.mockResolvedValue({
      notifications: [makeNotification({ id: "n1" }), makeNotification({ id: "n2" })],
      unreadCount: 2,
    });

    render(<NotificationBell />);

    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("shows no badge when there are no unread notifications", async () => {
    employeeNotificationsService.list.mockResolvedValue({
      notifications: [makeNotification({ read_at: new Date().toISOString() })],
      unreadCount: 0,
    });

    render(<NotificationBell />);

    // Let the initial load settle.
    await waitFor(() =>
      expect(employeeNotificationsService.list).toHaveBeenCalled()
    );

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("caps the badge at '9+' beyond 9 unread", async () => {
    employeeNotificationsService.list.mockResolvedValue({
      notifications: [],
      unreadCount: 15,
    });

    render(<NotificationBell />);

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("marking a notification read updates the UI without a full reload", async () => {
    const user = userEvent.setup();

    employeeNotificationsService.list.mockResolvedValue({
      notifications: [makeNotification({ id: "n1", title: "Leave approved" })],
      unreadCount: 1,
    });
    employeeNotificationsService.markRead.mockResolvedValue({});

    render(<NotificationBell />);

    // Open the dropdown.
    await screen.findByText("1"); // unread badge present
    await user.click(screen.getByLabelText("Notifications"));

    expect(await screen.findByText("Leave approved")).toBeInTheDocument();
    const markReadButton = screen.getByLabelText("Mark as read");

    await user.click(markReadButton);

    await waitFor(() =>
      expect(employeeNotificationsService.markRead).toHaveBeenCalledWith("n1")
    );

    // Badge count should drop to 0 (no badge rendered) and the
    // per-item "mark as read" button should disappear for that item.
    await waitFor(() =>
      expect(screen.queryByLabelText("Mark as read")).not.toBeInTheDocument()
    );
  });

  it("rolls back the optimistic update if markRead fails", async () => {
    const user = userEvent.setup();

    employeeNotificationsService.list.mockResolvedValue({
      notifications: [makeNotification({ id: "n1", title: "Leave approved" })],
      unreadCount: 1,
    });
    employeeNotificationsService.markRead.mockRejectedValue(new Error("network error"));

    render(<NotificationBell />);

    await screen.findByText("1");
    await user.click(screen.getByLabelText("Notifications"));
    await screen.findByText("Leave approved");

    await user.click(screen.getByLabelText("Mark as read"));

    // The optimistic update flips it read immediately, then the
    // failed request should restore the unread state (badge back to 1,
    // "Mark as read" button back).
    await waitFor(() =>
      expect(employeeNotificationsService.markRead).toHaveBeenCalled()
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Mark as read")).toBeInTheDocument()
    );
  });
});
