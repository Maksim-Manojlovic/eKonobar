"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { timeAgo } from "@/lib/formatting/utils";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export const TYPE_ICONS: Record<string, string> = {
  APPLICATION_RECEIVED:        "📋",
  APPLICATION_STATUS_CHANGED:  "✅",
  SWAP_REQUESTED:              "🔄",
  SWAP_RESOLVED:               "🔄",
  SHIFT_CLAIMED:               "📅",
  SHIFT_ASSIGNED:              "📅",
  REVIEW_RECEIVED:             "⭐",
  REVIEW_PUBLISHED:            "⭐",
  CLOCKIN_APPROVAL_REQUESTED:  "⏰",
  CLOCKIN_RESOLVED:            "✅",
};

function NotifRow({ n, onClick }: { n: NotificationItem; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-neutral-50 transition-colors ${!n.read ? "bg-orange-50/60" : ""}`}>
      <span className="text-base flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-bold text-neutral-900 leading-tight">{n.title}</span>
          <span className="text-[10px] text-neutral-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
        </div>
        <div className="text-xs text-neutral-500 mt-0.5 leading-snug line-clamp-2">{n.body}</div>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1" />}
    </div>
  );
}

export function NotificationBell({
  dashboardPath,
  onViewAll,
  onUnreadChange,
}: {
  dashboardPath: string;
  onViewAll?: () => void;
  onUnreadChange?: (count: number) => void;
}) {
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
        onUnreadChange?.(data.unreadCount);
      })
      .catch(() => {});
  }, [onUnreadChange]);

  useEffect(() => {
    fetchNotifications(); // initial full load

    // SSE stream for live unread-count badge updates.
    // EventSource auto-reconnects on drop (server restart, network blip).
    // Full list is only re-fetched when the dropdown opens.
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as { unread: number };
      setUnread(data.unread);
      onUnreadChange?.(data.unread);
    };

    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchNotifications]);

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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // lock body scroll when mobile sheet is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else       document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setUnread(0);
    onUnreadChange?.(0);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function handleOpen() {
    setOpen(o => !o);
    if (!open && unread > 0) {
      await markAllRead();
    }
  }

  function handleViewAll() {
    setOpen(false);
    if (onViewAll) onViewAll();
    else window.location.href = dashboardPath;
  }

  const preview = items.slice(0, 8);

  const header = (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
      <span className="text-sm font-black text-neutral-900">Obaveštenja</span>
      <div className="flex items-center gap-3">
        {pushEnabled && <span className="text-[10px] text-green-600 font-semibold">Push ✓</span>}
        {unread > 0 && (
          <button onClick={markAllRead} className="text-[10px] text-orange-500 font-semibold hover:underline">
            Označi sve pročitanim
          </button>
        )}
      </div>
    </div>
  );

  const body = (
    <>
      {preview.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-neutral-400">Nema obaveštenja</div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-50">
          {preview.map(n => (
            <NotifRow key={n.id} n={n} onClick={() => { if (n.link) window.location.href = n.link; setOpen(false); }} />
          ))}
        </div>
      )}
    </>
  );

  const footer = (
    <div className="px-5 py-3.5 border-t border-neutral-100 flex items-center justify-between gap-3">
      <button onClick={handleViewAll} className="text-xs text-orange-500 font-semibold hover:underline flex-1 text-left">
        Vidi sva obaveštenja →
      </button>
      {items.length > 8 && (
        <span className="text-[10px] text-neutral-400">+{items.length - 8} starijih</span>
      )}
    </div>
  );

  return (
    <div ref={dropRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
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

      {/* ── Desktop dropdown (md+) ────────────────────────────── */}
      {open && (
        <div className="hidden md:flex flex-col absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-neutral-100 z-50 overflow-hidden max-h-[480px]">
          {header}
          {body}
          {footer}
        </div>
      )}

      {/* ── Mobile bottom sheet (<md) — rendered via portal to escape backdrop-filter stacking context ── */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] md:hidden">
          {/* Backdrop */}
          <div className="fade-in-bg absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          {/* Sheet */}
          <div className="sheet-up absolute inset-x-0 bottom-0 flex flex-col bg-white rounded-t-3xl overflow-hidden"
            style={{ maxHeight: "82dvh" }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-neutral-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0">{header}</div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-50 overscroll-contain">
              {preview.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-neutral-400">Nema obaveštenja</div>
              ) : (
                preview.map(n => (
                  <NotifRow key={n.id} n={n} onClick={() => { if (n.link) window.location.href = n.link; setOpen(false); }} />
                ))
              )}
            </div>

            {/* Footer + safe area */}
            <div className="flex-shrink-0 border-t border-neutral-100 px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={handleViewAll}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-colors">
                Vidi sva obaveštenja
              </button>
            </div>
          </div>
        </div>,
        document.body
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
