"use client";

import { useState, useEffect } from "react";
import ImageUpload from "@/components/ui/ImageUpload";
import TagInput from "@/components/ui/TagInput";
import type { PassportData } from "./waiter-types";
import { BADGE_META, BADGE_PROGRESS, VENUE_TYPE_OPTIONS, SCORE_DIMS } from "./waiter-constants";
import { BELGRADE_MUNICIPALITIES } from "@/lib/geo/municipalities";
import { useNotifPrefs } from "./useNotifPrefs";
import { useSanitaryBook } from "./useSanitaryBook";


/* ── Section: Passport ───────────────────────────────────────────────────── */

export default function PassportSection({ userName }: { userName: string }) {
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const [bio, setBio]                             = useState("");
  const [skills, setSkills]                       = useState<string[]>([]);
  const [languages, setLanguages]                 = useState<string[]>([]);
  const [yearsExperience, setYears]               = useState(0);
  const [currentlyAvailable, setAvailable]        = useState(true);
  const [venueTypePreferences, setVenuePrefs]     = useState<string[]>([]);
  const [workMunicipalities, setWorkMunis]        = useState<string[]>([]);
  const [galleryPhotos, setGalleryPhotos]         = useState<string[]>([]);

  // Self-contained concerns live in their own hooks (CQ-G god-component split).
  const notif = useNotifPrefs();
  const san   = useSanitaryBook();

  useEffect(() => {
    fetch("/api/passport")
      .then(r => r.json())
      .then((passportData) => {
        if (passportData?.id) {
          setPassport(passportData);
          setBio(passportData.bio ?? "");
          setSkills(passportData.skills ?? []);
          setLanguages(passportData.languages ?? []);
          setYears(passportData.yearsExperience ?? 0);
          setAvailable(passportData.currentlyAvailable ?? true);
          setVenuePrefs(passportData.venueTypePreferences ?? []);
          setWorkMunis(passportData.workMunicipalities ?? []);
          setGalleryPhotos(passportData.galleryPhotos ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/passport", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: bio || null, skills, languages, yearsExperience, currentlyAvailable, venueTypePreferences, workMunicipalities }),
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

        <div>
          <label className="text-xs font-semibold text-neutral-600 mb-2 block">Gde radiš (opštine)</label>
          <div className="flex flex-wrap gap-2">
            {BELGRADE_MUNICIPALITIES.map(muni => {
              const active = workMunicipalities.includes(muni);
              return (
                <button key={muni} type="button"
                  onClick={() => setWorkMunis(p => active ? p.filter(v => v !== muni) : [...p, muni])}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${active ? "bg-orange-500 text-white border-orange-500" : "bg-white text-neutral-500 border-neutral-200 hover:border-orange-300"}`}>
                  {muni}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1.5">Lokali te pronalaze po opštinama u kojima si spreman da radiš.</p>
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
          {san.book && (
            <span className={`text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
              san.book.status === "APPROVED" ? "bg-green-100 text-green-700" :
              san.book.status === "REJECTED" ? "bg-red-100 text-red-600" :
              "bg-amber-100 text-amber-700"
            }`}>
              {san.book.status === "APPROVED" ? "✓ Odobrena" : san.book.status === "REJECTED" ? "✗ Odbijena" : "Na čekanju"}
            </span>
          )}
        </div>

        {san.book?.status === "REJECTED" && san.book.rejectReason && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            Razlog odbijanja: {san.book.rejectReason}
          </p>
        )}

        {san.book?.status === "APPROVED" && !san.fileUrl && (
          <p className="text-sm text-green-700 font-medium">Sanitarna knjižica je verifikovana. ✓</p>
        )}

        {san.book?.status !== "APPROVED" && (
          <>
            <ImageUpload
              current={san.fileUrl ?? undefined}
              uploadType="sanitary-doc"
              shape="rect"
              label="Fotografija ili PDF sanitarne knjižice"
              onUpload={async (url) => { san.setFileUrl(url); }}
            />
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Datum isteka (opciono)</label>
              <input
                type="date"
                value={san.expiry}
                onChange={e => san.setExpiry(e.target.value)}
                className="auth-input w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={san.submit}
                disabled={!san.fileUrl || san.submitting}
                className="btn-dash-orange px-5 py-2 text-sm disabled:opacity-50"
              >
                {san.submitting ? "Šaljem..." : "Pošalji na verifikaciju"}
              </button>
              {san.submitted && <span className="text-sm font-semibold text-green-600">✓ Poslato</span>}
            </div>
          </>
        )}

        {san.book?.status === "APPROVED" && (
          <button
            onClick={san.startReplace}
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
            onClick={notif.togglePush}
            disabled={notif.pushLoading}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${notif.pushEnabled ? "bg-green-500" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notif.pushEnabled ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div className="h-px bg-neutral-100" />

        {/* Phone */}
        <div>
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5 block">
            Broj telefona
          </label>
          <input
            value={notif.phone}
            onChange={e => notif.setPhone(e.target.value)}
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
            <div className="text-xs text-neutral-400 mt-0.5">Zahteva broj telefona</div>
          </div>
          <button
            onClick={() => notif.setWa(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notif.wa ? "bg-green-500" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notif.wa ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {/* SMS */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-semibold text-neutral-700">SMS notifikacije</div>
            <div className="text-xs text-neutral-400 mt-0.5">Zahteva broj telefona</div>
          </div>
          <button
            onClick={() => notif.setSms(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notif.sms ? "bg-green-500" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notif.sms ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={notif.save} disabled={notif.saving} className="btn-dash-orange px-5 py-2 text-sm disabled:opacity-50">
            {notif.saving ? "Čuvanje..." : "Sačuvaj"}
          </button>
          {notif.saved && <span className="text-sm font-semibold text-green-600">✓ Sačuvano</span>}
        </div>
      </div>
    </>
  );
}
