"use client";

import { useState, useEffect } from "react";
import ImageUpload from "@/components/ui/ImageUpload";
import TagInput from "@/components/ui/TagInput";
import type { PassportData, PassportSubscription } from "./waiter-types";
import { BADGE_META, BADGE_PROGRESS, VENUE_TYPE_OPTIONS, SCORE_DIMS } from "./waiter-types";


/* ── Section: Passport ───────────────────────────────────────────────────── */

export default function PassportSection({ userName }: { userName: string }) {
  const [passport, setPassport]         = useState<PassportData | null>(null);
  const [subscription, setSubscription] = useState<PassportSubscription | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [subscribing, setSubscribing]   = useState(false);

  const [bio, setBio]                             = useState("");
  const [skills, setSkills]                       = useState<string[]>([]);
  const [languages, setLanguages]                 = useState<string[]>([]);
  const [yearsExperience, setYears]               = useState(0);
  const [currentlyAvailable, setAvailable]        = useState(true);
  const [venueTypePreferences, setVenuePrefs]     = useState<string[]>([]);
  const [galleryPhotos, setGalleryPhotos]         = useState<string[]>([]);

  // Sanitary book
  const [sanBook, setSanBook]       = useState<{ status: string; fileUrl: string; rejectReason?: string | null; expiryDate?: string | null } | null>(null);
  const [sanFileUrl, setSanFileUrl] = useState<string | null>(null);
  const [sanExpiry, setSanExpiry]   = useState("");
  const [sanSubmitting, setSanSubmitting] = useState(false);
  const [sanSubmitted, setSanSubmitted]   = useState(false);

  // Notification prefs
  const [notifPhone, setNotifPhone]     = useState("");
  const [notifWa, setNotifWa]           = useState(false);
  const [notifSms, setNotifSms]         = useState(false);
  const [notifSaving, setNotifSaving]   = useState(false);
  const [notifSaved, setNotifSaved]     = useState(false);
  const [pushEnabled, setPushEnabled]   = useState(false);
  const [pushLoading, setPushLoading]   = useState(false);

  useEffect(() => {
    // Check existing push subscription
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/passport").then(r => r.json()),
      fetch("/api/passport/subscription").then(r => r.json()),
      fetch("/api/user/notification-prefs").then(r => r.json()),
      fetch("/api/verification/sanitary").then(r => r.ok ? r.json() : null),
    ]).then(([passportData, subData, notifData, sanData]) => {
      if (passportData?.id) {
        setPassport(passportData);
        setBio(passportData.bio ?? "");
        setSkills(passportData.skills ?? []);
        setLanguages(passportData.languages ?? []);
        setYears(passportData.yearsExperience ?? 0);
        setAvailable(passportData.currentlyAvailable ?? true);
        setVenuePrefs(passportData.venueTypePreferences ?? []);
        setGalleryPhotos(passportData.galleryPhotos ?? []);
      }
      if (subData?.tier) setSubscription(subData);
      if (notifData && !notifData.error) {
        setNotifPhone(notifData.phone ?? "");
        setNotifWa(notifData.waOptIn ?? false);
        setNotifSms(notifData.smsOptIn ?? false);
      }
      if (sanData) setSanBook(sanData);
      setLoading(false);
    }).catch(() => setLoading(false));
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

  async function saveNotifPrefs() {
    setNotifSaving(true);
    const res = await fetch("/api/user/notification-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: notifPhone || null, waOptIn: notifWa, smsOptIn: notifSms }),
    });
    if (res.ok) { setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2500); }
    setNotifSaving(false);
  }

  async function handleSubscribe(tier: "PRO" | "PRO_PLUS") {
    setSubscribing(true);
    const res = await fetch("/api/payments/monri/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    if (res.ok) {
      const { paymentUrl } = await res.json();
      window.location.href = paymentUrl;
      // Don't setSubscribing(false) — page will redirect away
      return;
    }
    setSubscribing(false);
  }

  async function handleCancel() {
    setSubscribing(true);
    const res = await fetch("/api/passport/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "FREE" }),
    });
    if (res.ok) {
      setSubscription({ tier: "FREE", subscriptionExpiresAt: null, isActive: false, daysRemaining: 0 });
    }
    setSubscribing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/passport", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: bio || null, skills, languages, yearsExperience, currentlyAvailable, venueTypePreferences }),
    });
    if (res.ok) {
      const data = await res.json();
      setPassport(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-7 w-52 bg-neutral-200 rounded-lg" />
      <div className="dash-card p-6 flex gap-6 items-center">
        <div className="w-28 h-28 rounded-full bg-neutral-200 flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="h-5 w-36 bg-neutral-200 rounded" />
          <div className="h-4 w-24 bg-neutral-200 rounded" />
          <div className="h-4 w-full bg-neutral-200 rounded mt-1" />
          <div className="h-4 w-3/4 bg-neutral-200 rounded" />
        </div>
      </div>
      <div className="dash-card p-5 h-32 bg-neutral-100 rounded-2xl" />
      <div className="dash-card p-5 h-48 bg-neutral-100 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dash-card p-4 h-28 bg-neutral-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );

  const score         = passport?.score ?? 0;
  const circumference = 2 * Math.PI * 46;
  const offset        = circumference - (score / 100) * circumference;
  const earnedBadges  = passport?.badges ?? [];

  return (
    <>
      <h2 className="font-black text-white">Waiter Passport™</h2>

      {/* Score card */}
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="relative flex-shrink-0" style={{ width: 112, height: 112 }}>
          <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
            <circle cx="56" cy="56" r="46" fill="none" stroke="#f0efec" strokeWidth="10" />
            <circle cx="56" cy="56" r="46" fill="none" stroke="#f97316" strokeWidth="10"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-neutral-900">{Math.round(score)}</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">skor</span>
          </div>
          <div className="group absolute -top-1 -right-1 z-10">
            <div className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-500 text-[9px] font-bold flex items-center justify-center cursor-help select-none">ℹ</div>
            <div className="absolute bottom-full right-0 mb-1.5 w-52 bg-neutral-900 text-white text-[10px] rounded-xl p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed shadow-lg">
              Skor raste verifikovanjem smena i pozitivnim recenzijama vlasnika i gostiju. Brzi odgovor na Red Alert povećava vidljivost na listi vlasnika.
              <div className="absolute top-full right-3 border-4 border-transparent border-t-neutral-900" />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-neutral-900 text-lg">{userName}</div>
          <div className="flex gap-2 flex-wrap mt-1.5">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${currentlyAvailable ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}`}>
              {currentlyAvailable ? "Dostupan" : "Zauzet"}
            </span>
            {currentlyAvailable && passport?.lastAvailableDate && (() => {
              const days = Math.floor((Date.now() - new Date(passport.lastAvailableDate).getTime()) / 86_400_000) + 1;
              return days >= 2 ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-500">🔥 {days}d streak</span>
              ) : null;
            })()}
            {passport?.sanitaryBookValid && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">Sanitarna ✓</span>
            )}
          </div>
          {bio && <p className="text-sm text-neutral-500 mt-2 leading-relaxed line-clamp-2">{bio}</p>}
          <div className="flex gap-5 mt-3">
            {[
              { label: "Recenzije",     val: passport?.reviewCount ?? 0 },
              { label: "Angažmani",     val: passport?.totalEngagements ?? 0 },
              { label: "God. iskustva", val: yearsExperience },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-black text-neutral-900">{s.val}</div>
                <div className="text-[10px] text-neutral-400 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
          {passport?.avgRedAlertResponseMinutes != null && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold bg-orange-50 text-orange-600 px-3 py-1 rounded-full">
              ⚡ Prosečan odgovor:{" "}
              {passport.avgRedAlertResponseMinutes < 60
                ? `${passport.avgRedAlertResponseMinutes}min`
                : `${Math.round(passport.avgRedAlertResponseMinutes / 60)}h`}
              {" "}· {passport.redAlertResponseCount} Red Alert{passport.redAlertResponseCount !== 1 ? "a" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Passport Pro subscription card */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-neutral-900 text-sm">Passport Pro</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Plaćate samo odrađenu smenu — pretplatom dobijate prioritet i direktne notifikacije.</p>
          </div>
          {subscription?.tier === "PRO" && (
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-orange-100 text-orange-600 flex-shrink-0">PRO</span>
          )}
          {subscription?.tier === "PRO_PLUS" && (
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white flex-shrink-0">PRO+</span>
          )}
          {(!subscription || subscription.tier === "FREE") && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-400 flex-shrink-0">FREE</span>
          )}
        </div>

        {subscription?.isActive && (
          <p className="text-xs text-green-600 font-medium mb-4">
            Aktivan — ističe za {subscription.daysRemaining} {subscription.daysRemaining === 1 ? "dan" : "dana"}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {/* PRO card */}
          <div className={`rounded-2xl p-4 border ${subscription?.tier === "PRO" ? "border-orange-300 bg-orange-50" : "border-neutral-200 bg-white"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-orange-600 tracking-wider uppercase">PRO</span>
              <span className="font-extrabold text-neutral-900">290 <span className="text-xs font-medium text-neutral-400">RSD/mes</span></span>
            </div>
            <ul className="flex flex-col gap-1.5 text-xs text-neutral-600 mb-4">
              {[
                "Prioritet u pretrazi vlasnika",
                "Red Alert 30 min pre svih",
                "WhatsApp notifikacije",
                "\"Aktivan\" bedž na profilu",
              ].map(f => (
                <li key={f} className="flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#f97316" strokeWidth="2" strokeLinecap="round" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            {subscription?.tier !== "PRO" && (
              <button
                onClick={() => handleSubscribe("PRO")}
                disabled={subscribing}
                className="w-full btn-primary text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50"
              >
                {subscribing ? "..." : "Aktiviraj PRO"}
              </button>
            )}
            {subscription?.tier === "PRO" && (
              <button onClick={handleCancel} className="w-full text-xs text-neutral-400 py-1.5 hover:text-red-500 transition-colors">
                Otkaži pretplatu
              </button>
            )}
          </div>

          {/* PRO+ card */}
          <div className={`rounded-2xl p-4 border relative overflow-hidden ${subscription?.tier === "PRO_PLUS" ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}>
            <div className="absolute top-3 right-3 text-[9px] font-black tracking-wider bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded-full">NAJPOPULARNIJI</div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-amber-600 tracking-wider uppercase">PRO+</span>
              <span className="font-extrabold text-neutral-900">490 <span className="text-xs font-medium text-neutral-400">RSD/mes</span></span>
            </div>
            <ul className="flex flex-col gap-1.5 text-xs text-neutral-600 mb-4">
              {[
                "Sve iz PRO plana",
                "SMS notifikacije (Infobip)",
                "Prvo u rezultatima pretrage",
                "Mesečni izveštaj skora",
              ].map(f => (
                <li key={f} className="flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            {subscription?.tier !== "PRO_PLUS" && (
              <button
                onClick={() => handleSubscribe("PRO_PLUS")}
                disabled={subscribing}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50 transition-all"
              >
                {subscribing ? "..." : "Aktiviraj PRO+"}
              </button>
            )}
            {subscription?.tier === "PRO_PLUS" && (
              <button onClick={handleCancel} className="w-full text-xs text-neutral-400 py-1.5 hover:text-red-500 transition-colors">
                Otkaži pretplatu
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Trust score breakdown — only if there are reviews */}
      {passport?.trustScore && passport.trustScore.sampleSize > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-4">Dimenzije skora</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SCORE_DIMS.map(({ key, label }) => {
              const val = Math.round((passport.trustScore as NonNullable<PassportData["trustScore"]>)[key]);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-500">{label}</span>
                    <span className="font-bold text-neutral-800">{val}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${val}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400 mt-3">Na osnovu {passport.trustScore.sampleSize} recenzija</p>
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSave} className="dash-card p-5 flex flex-col gap-5">
        <h3 className="font-bold text-neutral-900">Uredi profil</h3>

        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-neutral-700">Dostupan za angažman</div>
            <div className="text-xs text-neutral-400 mt-0.5">Vidljivo vlasnicima lokala</div>
          </div>
          <button type="button" onClick={() => setAvailable(p => !p)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${currentlyAvailable ? "bg-green-500" : "bg-neutral-200"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${currentlyAvailable ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Godine iskustva</label>
          <input type="number" min={0} max={50} value={yearsExperience}
            onChange={e => setYears(Number(e.target.value))}
            className="auth-input w-28" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
            placeholder="Kratko predstavljanje — šta te čini dobrim konobarom?"
            className="auth-input resize-none" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Veštine</label>
          <TagInput tags={skills} onChange={setSkills} placeholder="fine dining, cocktails... (Enter za dodavanje)" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Jezici</label>
          <TagInput tags={languages} onChange={setLanguages} placeholder="srpski, engleski... (Enter za dodavanje)" />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-2 block">Tip objekta (preferencije)</label>
          <div className="flex flex-wrap gap-2">
            {VENUE_TYPE_OPTIONS.map(opt => {
              const active = venueTypePreferences.includes(opt.value);
              return (
                <button key={opt.value} type="button"
                  onClick={() => setVenuePrefs(p => active ? p.filter(v => v !== opt.value) : [...p, opt.value])}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${active ? "bg-orange-500 text-white border-orange-500" : "bg-white text-neutral-500 border-neutral-200 hover:border-orange-300"}`}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1.5">Algoritam šalje Red Alert samo za odabrane tipove.</p>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-dash-orange px-6 py-2.5 disabled:opacity-50">
            {saving ? "Čuvanje..." : "Sačuvaj profil"}
          </button>
          {saved && <span className="text-sm font-semibold text-green-600">✓ Sačuvano</span>}
        </div>
      </form>

      {/* Gallery */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-neutral-900">Galerija &ldquo;U radu&rdquo;</h3>
          <p className="text-xs text-neutral-400 mt-0.5">Do 4 fotografije — uniforma, koktel, servis. Vizuelni dokaz iskustva.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ImageUpload key={i} current={galleryPhotos[i]} uploadType="venue-photo" shape="rect" label=""
              onUpload={async (url) => {
                const updated = [...galleryPhotos];
                updated[i] = url;
                setGalleryPhotos(updated);
                await fetch("/api/passport", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ galleryPhotos: updated }),
                });
              }} />
          ))}
        </div>
      </div>

      {/* Sanitary book verification */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-neutral-900">Sanitarna knjižica</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Priložite fotografiju sanitarne knjižice — admin proverava u roku od 24h.</p>
          </div>
          {sanBook && (
            <span className={`text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
              sanBook.status === "APPROVED" ? "bg-green-100 text-green-700" :
              sanBook.status === "REJECTED" ? "bg-red-100 text-red-600" :
              "bg-amber-100 text-amber-700"
            }`}>
              {sanBook.status === "APPROVED" ? "✓ Odobrena" : sanBook.status === "REJECTED" ? "✗ Odbijena" : "Na čekanju"}
            </span>
          )}
        </div>

        {sanBook?.status === "REJECTED" && sanBook.rejectReason && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            Razlog odbijanja: {sanBook.rejectReason}
          </p>
        )}

        {sanBook?.status === "APPROVED" && !sanFileUrl && (
          <p className="text-sm text-green-700 font-medium">Sanitarna knjižica je verifikovana. ✓</p>
        )}

        {sanBook?.status !== "APPROVED" && (
          <>
            <ImageUpload
              current={sanFileUrl ?? undefined}
              uploadType="sanitary-doc"
              shape="rect"
              label="Fotografija ili PDF sanitarne knjižice"
              onUpload={async (url) => { setSanFileUrl(url); }}
            />
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Datum isteka (opciono)</label>
              <input
                type="date"
                value={sanExpiry}
                onChange={e => setSanExpiry(e.target.value)}
                className="auth-input w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!sanFileUrl) return;
                  setSanSubmitting(true);
                  const res = await fetch("/api/verification/sanitary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileUrl: sanFileUrl, expiryDate: sanExpiry || undefined }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setSanBook(data);
                    setSanFileUrl(null);
                    setSanSubmitted(true);
                    setTimeout(() => setSanSubmitted(false), 3000);
                  }
                  setSanSubmitting(false);
                }}
                disabled={!sanFileUrl || sanSubmitting}
                className="btn-dash-orange px-5 py-2 text-sm disabled:opacity-50"
              >
                {sanSubmitting ? "Šaljem..." : "Pošalji na verifikaciju"}
              </button>
              {sanSubmitted && <span className="text-sm font-semibold text-green-600">✓ Poslato</span>}
            </div>
          </>
        )}

        {sanBook?.status === "APPROVED" && (
          <button
            onClick={() => setSanBook(prev => prev ? { ...prev, status: "REPLACE" } : null)}
            className="text-xs text-neutral-400 hover:text-orange-500 transition-colors self-start"
          >
            Zameni knjižicu →
          </button>
        )}
      </div>

      {/* Top endorsements */}
      {passport?.recentReviews && passport.recentReviews.length > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-4">Poslednje recenzije vlasnika</h3>
          <div className="flex flex-col gap-4">
            {passport.recentReviews.map(r => (
              <div key={r.id} className="flex gap-3">
                <span className="text-orange-300 text-2xl leading-none font-serif">&ldquo;</span>
                <div className="flex-1">
                  <p className="text-sm text-neutral-700 italic leading-relaxed">{r.comment}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-xs ${i < Math.round(r.overallRating / 20) ? "text-orange-400" : "text-neutral-200"}`}>★</span>
                      ))}
                    </div>
                    <span className="text-xs text-neutral-400 font-medium">
                      {r.author.venues[0]?.name ?? r.author.name ?? "Vlasnik"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      <h3 className="font-bold text-neutral-900">Bedževi</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(BADGE_META).map(([key, meta]) => {
          const earned = earnedBadges.includes(key);
          const progressFn = BADGE_PROGRESS[key];
          const progress = !earned && passport && progressFn ? progressFn(passport) : null;
          return (
            <div key={key} className={`dash-card p-4 flex flex-col items-center text-center gap-2 transition-opacity ${!earned ? "opacity-60" : ""}`}>
              <span className="text-3xl">{meta.emoji}</span>
              <div>
                <div className="font-bold text-neutral-900 text-sm">{meta.label}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{meta.sub}</div>
              </div>
              {earned && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">✓ Otključano</span>}
              {!earned && progress && (
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                    <span>{progress.current}/{progress.total} {progress.unit}</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full transition-all"
                      style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
                  </div>
                </div>
              )}
              {!earned && !progress && (
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">🔒 Zahteva verifikaciju</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Notification preferences */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <h3 className="font-bold text-neutral-900 text-sm">Podešavanja notifikacija</h3>

        {/* Web push */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-neutral-700">Push notifikacije</div>
            <div className="text-xs text-neutral-400 mt-0.5">Obaveštenja u browseru — besplatno za sve</div>
          </div>
          <button
            onClick={togglePush}
            disabled={pushLoading}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${pushEnabled ? "bg-green-500" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushEnabled ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div className="h-px bg-neutral-100" />

        {/* Phone */}
        <div>
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5 block">
            Broj telefona
          </label>
          <input
            value={notifPhone}
            onChange={e => setNotifPhone(e.target.value)}
            placeholder="+381 6x xxx xxxx"
            maxLength={20}
            className="auth-input"
          />
          <p className="text-xs text-neutral-400 mt-1">Koristi se za WhatsApp i SMS notifikacije</p>
        </div>

        {/* WhatsApp */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-neutral-700">WhatsApp notifikacije</div>
            <div className="text-xs text-neutral-400 mt-0.5">
              {subscription?.tier === "PRO" || subscription?.tier === "PRO_PLUS"
                ? "Aktivno za vaš PRO plan"
                : <span>Dostupno uz <span className="font-bold text-orange-500">PRO</span> pretplatu</span>
              }
            </div>
          </div>
          <button
            onClick={() => setNotifWa(v => !v)}
            disabled={subscription?.tier !== "PRO" && subscription?.tier !== "PRO_PLUS"}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ${notifWa ? "bg-green-500" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifWa ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {/* SMS */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-neutral-700">SMS notifikacije</div>
            <div className="text-xs text-neutral-400 mt-0.5">
              {subscription?.tier === "PRO_PLUS"
                ? "Aktivno za vaš PRO+ plan"
                : <span>Dostupno uz <span className="font-bold text-amber-500">PRO+</span> pretplatu</span>
              }
            </div>
          </div>
          <button
            onClick={() => setNotifSms(v => !v)}
            disabled={subscription?.tier !== "PRO_PLUS"}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ${notifSms ? "bg-green-500" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifSms ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveNotifPrefs} disabled={notifSaving} className="btn-dash-orange px-5 py-2 text-sm disabled:opacity-50">
            {notifSaving ? "Čuvanje..." : "Sačuvaj"}
          </button>
          {notifSaved && <span className="text-sm font-semibold text-green-600">✓ Sačuvano</span>}
        </div>
      </div>
    </>
  );
}
