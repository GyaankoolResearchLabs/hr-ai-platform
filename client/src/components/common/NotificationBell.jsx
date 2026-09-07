import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import employeeNotificationsService from "../../services/employeeNotificationsService";

/**
 * Notification bell for the employee dashboard chrome.
 *
 * Rendered only for organization?.role === 'employee' (see TopBar.jsx),
 * so it never mounts — and never polls — for HR users.
 */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        const result = await employeeNotificationsService.list();

        if (!isMounted) {
          return;
        }

        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadNotifications();

    const interval = setInterval(loadNotifications, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkRead(id) {
    const previous = notifications;

    setNotifications((items) =>
      items.map((item) =>
        item.id === id && !item.read_at
          ? { ...item, read_at: new Date().toISOString() }
          : item
      )
    );

    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await employeeNotificationsService.markRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      setNotifications(previous);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) {
      return;
    }

    const previous = notifications;
    const previousUnread = unreadCount;

    setNotifications((items) =>
      items.map((item) =>
        item.read_at ? item : { ...item, read_at: new Date().toISOString() }
      )
    );

    setUnreadCount(0);

    try {
      await employeeNotificationsService.markAllRead();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      setNotifications(previous);
      setUnreadCount(previousUnread);
    }
  }

  function formatTimestamp(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-ink-100 bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 transition hover:text-brand-700"
              >
                <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-ink-400">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-400">
                You're all caught up.
              </p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-2 border-b border-ink-50 px-4 py-3 last:border-b-0 ${
                    item.read_at ? "" : "bg-brand-50/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {item.title}
                    </p>
                    {item.message && (
                      <p className="mt-0.5 text-xs text-ink-500">
                        {item.message}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-ink-400">
                      {formatTimestamp(item.created_at)}
                    </p>
                  </div>

                  {!item.read_at && (
                    <button
                      onClick={() => handleMarkRead(item.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-50 hover:text-brand-600"
                      aria-label="Mark as read"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
