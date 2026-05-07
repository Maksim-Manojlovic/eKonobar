"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
  APPLICATION_RECEIVED:       "📋",
  APPLICATION_STATUS_CHANGED: "✅",
  SWAP_REQUESTED:             "🔄",
  SWAP_RESOLVED:              "🔄",
  SHIFT_CLAIMED:              "📅",
  SHIFT_ASSIGNED:             "📅",
  REVIEW_PUBLISHED:           "⭐",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "upravo";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell({ dashboardPath }: { dashboardPath: string }) {
  const [open, setOpen]               = useState(false);
  const [items, setItems]             = useState<NotificationItem[]>([]);
  const [unread, setUnread]           = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const dropRef                       = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(() => {
    fetch("/api/notifications")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setItems(data.notifications);
        setUnread(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Register service worker + subscribe to push
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!process.env.NEXT_PUBLIC_VAPID_KEY) return;

    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_KEY!),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.toJSON().keys?.p256dh, auth: sub.toJSON().keys?.auth } }),
      });

      setPushEnabled(true);
    }).catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleOpen() {
    setOpen(o => !o);
    if (!open && unread > 0) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setUnread(0);
      setItems(prev => prev.map(n => ({ ...n, read: true })));
    }
  }

  return (
    <div ref={dropRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors">
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-neutral-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <span className="text-sm font-black text-neutral-900">Obaveštenja</span>
            {pushEnabled && <span className="text-[10px] text-green-600 font-semibold">Push aktivan</span>}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">Nema obaveštenja</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50">
              {items.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (n.link) window.location.href = n.link; setOpen(false); }}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors ${!n.read ? "bg-orange-50/60" : ""}`}>
                  <span className="text-base flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-neutral-900 leading-tight">{n.title}</div>
                    <div className="text-xs text-neutral-500 mt-0.5 leading-snug line-clamp-2">{n.body}</div>
                  </div>
                  <span className="text-[10px] text-neutral-400 flex-shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-2.5 border-t border-neutral-100">
            <a href={dashboardPath} className="text-xs text-orange-500 font-semibold hover:underline">
              Vidi sve →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  const buf     = new ArrayBuffer(raw.length);
  const view    = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}
