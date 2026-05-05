"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ui/ImageUpload";

type PassportData = {
  id: string;
  score: number;
  bio: string | null;
  skills: string[];
  languages: string[];
  yearsExperience: number;
  currentlyAvailable: boolean;
  sanitaryBookValid: boolean;
  reviewCount: number;
  totalEngagements: number;
  shareToken: string | null;
  shareTokenExpiry: string | null;
  profilePhoto: string | null;
  trustScore: {
    punctuality: number; skill: number; guestCommunication: number;
    personalHygiene: number; teamwork: number; speed: number;
    sampleSize: number;
  } | null;
};

const SCORE_DIMS = [
  { key: "punctuality",        label: "Tačnost" },
  { key: "skill",              label: "Veštine" },
  { key: "guestCommunication", label: "Komunikacija" },
  { key: "personalHygiene",    label: "Higijena" },
  { key: "teamwork",           label: "Tim" },
  { key: "speed",              label: "Brzina" },
] as const;

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = (v: string) => { const t = v.trim().toLowerCase(); if (t && !tags.includes(t)) onChange([...tags, t]); setInput(""); };
  const remove = (t: string) => onChange(tags.filter(x => x !== t));
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-neutral-200 rounded-xl min-h-[42px] focus-within:border-orange-400 transition-colors cursor-text">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full">
          {t}
          <button type="button" onClick={() => remove(t)} className="hover:text-orange-900 font-bold">&times;</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); } if (e.key === "Backspace" && input === "" && tags.length > 0) remove(tags[tags.length - 1]); }}
        onBlur={() => { if (input) add(input); }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent" />
    </div>
  );
}

export default function WaiterPassportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [passport, setPassport]     = useState<PassportData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [sharing, setSharing]       = useState(false);
  const [shareUrl, setShareUrl]     = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);

  const [bio, setBio]               = useState("");
  const [skills, setSkills]         = useState<string[]>([]);
  const [languages, setLanguages]   = useState<string[]>([]);
  const [years, setYears]           = useState(0);
  const [available, setAvailable]   = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "WAITER") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/passport")
      .then(r => r.json())
      .then(d => {
        if (d?.id) {
          setPassport(d);
          setBio(d.bio ?? "");
          setSkills(d.skills ?? []);
          setLanguages(d.languages ?? []);
          setYears(d.yearsExperience ?? 0);
          setAvailable(d.currentlyAvailable ?? true);
          if (d.shareToken && (!d.shareTokenExpiry || new Date(d.shareTokenExpiry) > new Date())) {
            setShareUrl(`${window.location.origin}/passport/${d.shareToken}`);
          }
        }
        setLoading(false);
      });
  }, [status]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/passport", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: bio || null, skills, languages, yearsExperience: years, currentlyAvailable: available }),
    });
    if (res.ok) { setPassport(await res.json()); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  }

  async function generateShareLink() {
    setSharing(true);
    const res = await fetch("/api/passport/share", { method: "POST" });
    if (res.ok) {
      const { shareToken } = await res.json();
      const url = `${window.location.origin}/passport/${shareToken}`;
      setShareUrl(url);
      setPassport(p => p ? { ...p, shareToken } : p);
    }
    setSharing(false);
  }

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const score = passport?.score ?? 0;
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div className="flex items-center gap-4">
          <Link href="/waiter" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Dashboard</Link>
          <h1 className="font-black text-2xl text-neutral-900">Waiter Passport™</h1>
        </div>

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
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-neutral-900 text-lg">{session?.user?.name}</div>
            <div className="flex gap-2 flex-wrap mt-1.5">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${available ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}`}>
                {available ? "Dostupan" : "Zauzet"}
              </span>
              {passport?.sanitaryBookValid && (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">Sanitarna ✓</span>
              )}
            </div>
            <div className="flex gap-5 mt-3">
              {[
                { label: "Recenzije",  val: passport?.reviewCount ?? 0 },
                { label: "Angažmani", val: passport?.totalEngagements ?? 0 },
                { label: "God. iskustva", val: years },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-xl font-black text-neutral-900">{s.val}</div>
                  <div className="text-[10px] text-neutral-400 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Share link */}
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 mb-3">Deli pasoš</h3>
          {shareUrl ? (
            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="auth-input flex-1 text-xs text-neutral-500" />
              <button onClick={copyShareUrl} className="btn-dash-orange px-4 py-2 text-xs flex-shrink-0">
                {copied ? "✓ Kopirano" : "Kopiraj"}
              </button>
            </div>
          ) : (
            <button onClick={generateShareLink} disabled={sharing} className="btn-dash-orange px-5 py-2.5 text-sm disabled:opacity-50">
              {sharing ? "Generišem..." : "Generiši link za deljenje (30 dana)"}
            </button>
          )}
        </div>

        {/* Trust score breakdown */}
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
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${val}%` }} />
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

          <div className="flex items-center gap-5">
            <ImageUpload
              current={passport?.profilePhoto}
              uploadType="avatar"
              shape="circle"
              label="Profilna slika"
              onUpload={async (url) => {
                const res = await fetch("/api/passport", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ profilePhoto: url }),
                });
                if (res.ok) setPassport(await res.json());
              }}
            />
            <div className="text-xs text-neutral-400">
              <p className="font-semibold text-neutral-600 mb-0.5">Profilna fotografija</p>
              <p>Vidljiva na pasošu i u rezultatima pretrage.</p>
              <p>JPG, PNG, WEBP · max 5MB</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-semibold text-neutral-700">Dostupan za angažman</div>
              <div className="text-xs text-neutral-400 mt-0.5">Vidljivo vlasnicima lokala i headhunterima</div>
            </div>
            <button type="button" onClick={() => setAvailable(p => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${available ? "bg-green-500" : "bg-neutral-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${available ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Godine iskustva</label>
            <input type="number" min={0} max={50} value={years} onChange={e => setYears(Number(e.target.value))} className="auth-input w-28" />
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

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-dash-orange px-6 py-2.5 disabled:opacity-50">
              {saving ? "Čuvanje..." : "Sačuvaj profil"}
            </button>
            {saved && <span className="text-sm font-semibold text-green-600">✓ Sačuvano</span>}
          </div>
        </form>

      </div>
    </div>
  );
}
