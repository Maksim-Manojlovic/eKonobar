"use client";

import { useEffect, useState } from "react";

/**
 * Owns the waiter notification-preferences concern, extracted out of
 * `WaiterPassportSection` (CQ-G — god-component split). Encapsulates phone / WhatsApp /
 * SMS opt-in state, the save call, and the web-push subscribe/unsubscribe toggle, plus
 * the initial load of saved prefs. The consuming component reads `subscription.tier`
 * itself to decide which toggles are enabled — this hook only owns the prefs themselves.
 */
export function useNotifPrefs() {
  const [phone, setPhone]   = useState("");
  const [wa, setWa]         = useState(false);
  const [sms, setSms]       = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Load saved prefs (best-effort — toggles stay at defaults on failure).
  useEffect(() => {
    fetch("/api/user/notification-prefs")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && !d.error) {
          setPhone(d.phone ?? "");
          setWa(d.waOptIn ?? false);
          setSms(d.smsOptIn ?? false);
        }
      })
      .catch(() => {});
  }, []);

  // Reflect whether a web-push subscription already exists.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      }).catch(() => {});
    }
  }, []);

  async function togglePush() {
    if (!("serviceWorker" in navigator)) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        setPushEnabled(false);
      } else {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY,
        });
        const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        await fetch("/api/push/subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint, keys }),
        });
        setPushEnabled(true);
      }
    } catch { /* push not supported or permission denied */ }
    setPushLoading(false);
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/user/notification-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone || null, waOptIn: wa, smsOptIn: sms }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  }

  return { phone, setPhone, wa, setWa, sms, setSms, saving, saved, save, pushEnabled, pushLoading, togglePush };
}
