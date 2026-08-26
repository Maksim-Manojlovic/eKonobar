"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/formatting/display-maps";

/**
 * Create an account an admin has verified off-platform.
 *
 * This is the only way a VENUE_OWNER account comes into existence: nothing on a
 * public signup form proves the person filling it in runs the venue they name,
 * so the account is created after a human has checked, and the public path is
 * the contact panel on /register.
 *
 * The admin never chooses a password. The API returns a one-hour, single-use
 * set-password link, shown here exactly once — reopening the user later will not
 * show it again, because nothing readable is stored.
 */

/** ADMIN is absent on purpose — see the note on the API route. */
const CREATABLE_ROLES = ["VENUE_OWNER", "WAITER"] as const;

type Created = {
  user: { id: string; name: string | null; email: string; role: string };
  emailSent: boolean;
  setPasswordUrl: string;
  expiresAt: string;
};

export function CreateUserPanel({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen]       = useState(false);
  // One object plus a setField updater, per the grouped-form-state convention.
  const [form, setForm]       = useState({ name: "", email: "", role: "VENUE_OWNER", phone: "" });
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied]   = useState(false);

  const setField = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const reset = () => {
    setForm({ name: "", email: "", role: "VENUE_OWNER", phone: "" });
    setCreated(null);
    setError(null);
    setCopied(false);
  };

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:  form.name.trim(),
          email: form.email.trim(),
          role:  form.role,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Kreiranje naloga nije uspelo.");
        return;
      }
      setCreated(json as Created);
      onCreated();
    } catch {
      setError("Greška u vezi. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.email) && !busy;

  if (!open) {
    return (
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="self-start rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors px-4 py-2.5 text-sm font-bold text-white"
      >
        + Novi nalog
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-white">Novi nalog</h2>
        <button
          onClick={() => { setOpen(false); reset(); }}
          className="text-white/30 hover:text-white/60 text-sm transition-colors"
        >
          Zatvori
        </button>
      </div>

      {created ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400 font-semibold">
            Nalog kreiran: {created.user.email}
          </p>

          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 flex flex-col gap-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-orange-400">
              Link za postavljanje lozinke
            </p>
            <p className="text-xs text-white/50">
              {created.emailSent
                ? "Poslat je i mejlom. Link važi 1 sat i može se iskoristiti samo jednom."
                : "Mejl nije poslat (SMTP nije podešen). Pošalji ovaj link ručno — važi 1 sat i može se iskoristiti samo jednom."}
            </p>

            {/* Shown once. Nothing readable is stored, so there is no way to get
                it back after this panel closes — only to issue a new one. */}
            <code className="block break-all rounded-lg bg-black/40 px-3 py-2 text-[11px] text-white/80">
              {created.setPasswordUrl}
            </code>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(created.setPasswordUrl);
                    setCopied(true);
                  } catch {
                    /* Clipboard is blocked in some browsers; the link is on screen to select. */
                  }
                }}
                className="rounded-lg bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 text-xs font-bold text-white"
              >
                {copied ? "Kopirano ✓" : "Kopiraj link"}
              </button>
              <button
                onClick={reset}
                className="rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors px-3 py-1.5 text-xs font-bold text-white"
              >
                Napravi još jedan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ime i prezime" value={form.name} onChange={v => setField("name", v)} placeholder="Petar Jovanović" />
            <Field label="Email" value={form.email} onChange={v => setField("email", v)} placeholder="petar@lokal.rs" type="email" />
            <Field label="Telefon (opciono)" value={form.phone} onChange={v => setField("phone", v)} placeholder="+381 60 000 0000" />
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-white/30">Tip naloga</label>
              <select
                value={form.role}
                onChange={e => setField("role", e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
              >
                {CREATABLE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-white/40">
            Korisnik dobija link za postavljanje lozinke — ti je ne vidiš i ne postavljaš.
            Vlasnik lokala sam kreira svoj lokal pri prvoj prijavi.
          </p>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="self-start rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/40 disabled:cursor-not-allowed transition-colors px-4 py-2.5 text-sm font-bold text-white"
          >
            {busy ? "Kreiranje…" : "Kreiraj nalog"}
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-white/30">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
      />
    </div>
  );
}
