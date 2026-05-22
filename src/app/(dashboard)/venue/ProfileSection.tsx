"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import ImageUpload from "@/components/ui/ImageUpload";
import DeactivateVenueButton from "@/components/venue/DeactivateVenueButton";
import VenueInsightsBadge from "@/components/venue/VenueInsightsBadge";
import type { Venue } from "./venue-types";
import { getInitials, trustDimensions, VENUE_TYPE_LABELS } from "./venue-types";
import { Sk } from "./venue-helpers";

function VenueCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", address: "", municipality: "", venueType: "RESTAURANT",
    latitude: "", longitude: "", capacity: "", description: "",
    phone: "", website: "", instagram: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        municipality: form.municipality,
        venueType: form.venueType,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        description: form.description || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        instagram: form.instagram || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška pri registraciji lokala.");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="font-black text-white">Registruj lokal</h2>
      <div className="dash-card p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Naziv lokala *</label>
          <input type="text" required value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="npr. Kafana Kod Mene" className="auth-input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Adresa *</label>
            <input type="text" required value={form.address}
              onChange={e => set("address", e.target.value)}
              placeholder="npr. Skadarska 5" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Opština *</label>
            <input type="text" required value={form.municipality}
              onChange={e => set("municipality", e.target.value)}
              placeholder="npr. Stari Grad" className="auth-input" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Tip lokala *</label>
            <select required value={form.venueType}
              onChange={e => set("venueType", e.target.value)} className="auth-input">
              <option value="RESTAURANT">Restoran</option>
              <option value="CAFE">Kafić</option>
              <option value="BAR">Bar</option>
              <option value="CATERING">Ketering</option>
              <option value="HOTEL">Hotel</option>
              <option value="EVENT">Event</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Kapacitet mesta</label>
            <input type="number" min={1} value={form.capacity}
              onChange={e => set("capacity", e.target.value)}
              placeholder="npr. 50" className="auth-input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Koordinate *</label>
          <p className="text-xs text-neutral-400 mb-2">
            Otvorite Google Maps → desni klik na lokaciju → kliknite na koordinate da ih kopirate
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <input type="number" step="any" required value={form.latitude}
              onChange={e => set("latitude", e.target.value)}
              placeholder="Geografska širina (npr. 44.8125)" className="auth-input" />
            <input type="number" step="any" required value={form.longitude}
              onChange={e => set("longitude", e.target.value)}
              placeholder="Geografska dužina (npr. 20.4612)" className="auth-input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Kratki opis</label>
          <textarea value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Kratki opis vašeg lokala..." rows={3}
            className="auth-input resize-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Telefon</label>
            <input type="tel" value={form.phone}
              onChange={e => set("phone", e.target.value)}
              placeholder="+381 11 123 4567" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Vebsajt</label>
            <input type="url" value={form.website}
              onChange={e => set("website", e.target.value)}
              placeholder="https://vaslokal.rs" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Instagram</label>
            <input type="text" value={form.instagram}
              onChange={e => set("instagram", e.target.value)}
              placeholder="@vaslokal" className="auth-input" />
          </div>
        </div>
      </div>
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
      )}
      <button type="submit" disabled={saving}
        className="btn-dash-orange px-6 py-2.5 self-start disabled:opacity-60">
        {saving ? "Registrovanje..." : "Registruj lokal"}
      </button>
    </form>
  );
}

export default function ProfileSection({ venue, loading, onVenueCreated, geofenceEnabled, geofenceSaving, onGeofenceToggle, onIsActiveToggle }: {
  venue: Venue | null; loading: boolean; onVenueCreated: () => void;
  geofenceEnabled: boolean; geofenceSaving: boolean; onGeofenceToggle: (val: boolean) => void;
  onIsActiveToggle: (newIsActive: boolean) => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [imgSaving, setImgSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ phone: "", website: "", instagram: "", description: "", capacity: "", priceRangeMin: "", priceRangeMax: "" });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { setImages(venue?.images ?? []); }, [venue?.images]);
  useEffect(() => { setLogo(venue?.logo ?? null); }, [venue?.logo]);
  useEffect(() => {
    if (venue) setEditForm({
      phone: venue.phone ?? "",
      website: venue.website ?? "",
      instagram: venue.instagram ?? "",
      description: venue.description ?? "",
      capacity: venue.capacity?.toString() ?? "",
      priceRangeMin: venue.priceRangeMin?.toString() ?? "",
      priceRangeMax: venue.priceRangeMax?.toString() ?? "",
    });
  }, [venue]);

  async function saveImages(next: string[]) {
    if (!venue) return;
    setImgSaving(true);
    await fetch(`/api/venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: next }),
    });
    setImages(next);
    setImgSaving(false);
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !venue) return;
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "avatar");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      await fetch(`/api/venues/${venue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: data.url }),
      });
      setLogo(data.url);
    }
    setLogoUploading(false);
  }

  if (loading) return (
    <div className="flex flex-col gap-5">
      {[1,2,3].map(i => <Sk key={i} className="h-24 w-full" />)}
    </div>
  );
  if (!venue) return <VenueCreateForm onCreated={onVenueCreated} />;

  const score = Math.round(venue.trustScore) || 0;
  const dims = trustDimensions(venue.venueTrustScore);

  const infoFields = [
    { label: "Adresa",          value: venue.address },
    { label: "Opština",         value: venue.municipality },
    { label: "Telefon",         value: venue.phone ?? "—" },
    { label: "Vebsajt",         value: venue.website ?? "—" },
    { label: "Instagram",       value: venue.instagram ?? "—" },
    { label: "Kapacitet",       value: venue.capacity ? `${venue.capacity} mesta` : "—" },
    { label: "Cenovni raspon",  value: venue.priceRangeMin && venue.priceRangeMax
        ? `${venue.priceRangeMin.toLocaleString("sr-RS")} – ${venue.priceRangeMax.toLocaleString("sr-RS")} RSD/h` : "—" },
  ];

  return (
    <>
      <h2 className="font-black text-white">Profil lokala</h2>
      <div className="dash-card p-5">
        <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="group disabled:opacity-60"
            >
              <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-dashed border-neutral-300 group-hover:border-orange-400 transition-colors" style={{ isolation: "isolate" }}>
                {logo ? (
                  <Image src={logo} alt="" width={72} height={72} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-xl">
                    {getInitials(venue.name)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{logoUploading ? "..." : "Izmeni"}</span>
                </div>
              </div>
            </button>
            <span className="text-[10px] text-neutral-400">Logo lokala</span>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
          </div>

          {/* Trust score */}
          <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r="38" fill="none" stroke="#f0efec" strokeWidth="9" />
              <circle cx="48" cy="48" r="38" fill="none" stroke="#f97316" strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 - (score / 100) * 2 * Math.PI * 38} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-neutral-900">{score || "—"}</span>
              <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">trust skor</span>
            </div>
          </div>

          {/* Info */}
          <div className="w-full sm:flex-1 sm:w-auto min-w-0">
            <h3 className="text-xl font-black text-neutral-900">{venue.name}</h3>
            <p className="text-sm text-neutral-500 mt-0.5">{venue.address} · {venue.municipality} · {venue.city}</p>
            <div className="flex gap-2 flex-wrap mt-2">
              <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">{VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType}</span>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full">Aktivan</span>
            </div>
          </div>

          {/* Edit button */}
          <button onClick={() => setIsEditing(v => !v)} className="btn-dash-outline px-4 py-2 w-full sm:w-auto flex-shrink-0 sm:self-start">
            {isEditing ? "Zatvori" : "Uredi profil"}
          </button>
        </div>
      </div>
      {isEditing && (
        <div className="dash-card p-5 flex flex-col gap-4">
          <h3 className="font-bold text-neutral-900 text-sm">Uredi kontakt i detalje</h3>
          {[
            { key: "phone",         label: "Telefon",         placeholder: "+381 11 ..." },
            { key: "website",       label: "Vebsajt",         placeholder: "https://..." },
            { key: "instagram",     label: "Instagram",        placeholder: "@naziv" },
            { key: "description",   label: "Opis lokala",      placeholder: "Kratki opis..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">{label}</label>
              {key === "description" ? (
                <textarea
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={3}
                  className="auth-input resize-none"
                />
              ) : (
                <input
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="auth-input"
                />
              )}
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "capacity",      label: "Kapacitet (mesta)" },
              { key: "priceRangeMin", label: "Min. plata (RSD/h)" },
              { key: "priceRangeMax", label: "Max. plata (RSD/h)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-neutral-600 mb-1 block">{label}</label>
                <input
                  type="number"
                  min={0}
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="auth-input"
                />
              </div>
            ))}
          </div>
          <button
            disabled={editSaving}
            onClick={async () => {
              setEditSaving(true);
              await fetch(`/api/venues/${venue.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phone:        editForm.phone        || null,
                  website:      editForm.website      || null,
                  instagram:    editForm.instagram    || null,
                  description:  editForm.description  || null,
                  capacity:     editForm.capacity     ? Number(editForm.capacity)     : null,
                  priceRangeMin: editForm.priceRangeMin ? Number(editForm.priceRangeMin) : null,
                  priceRangeMax: editForm.priceRangeMax ? Number(editForm.priceRangeMax) : null,
                }),
              });
              setEditSaving(false);
              setIsEditing(false);
            }}
            className="btn-dash-orange py-2.5 disabled:opacity-50 self-start px-8"
          >
            {editSaving ? "Čuvanje..." : "Sačuvaj"}
          </button>
        </div>
      )}

      <div className="dash-card p-5 grid gap-4 sm:grid-cols-2">
        {infoFields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-xs text-neutral-400 font-medium mb-0.5">{label}</div>
            <div className="text-sm font-semibold text-neutral-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <h3 className="font-bold text-neutral-900 text-sm">Podešavanja lokala</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-neutral-800">GPS geofencing za recenzije</div>
            <div className="text-xs text-neutral-400 mt-0.5">Gosti moraju biti fizički u lokalu da bi ostavili recenziju. Konobarima je potrebna lokacija za čekiranje smene.</div>
          </div>
          <button
            onClick={() => onGeofenceToggle(!geofenceEnabled)}
            disabled={geofenceSaving}
            aria-pressed={geofenceEnabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${geofenceEnabled ? "bg-orange-500" : "bg-neutral-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${geofenceEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="border-t border-neutral-100 pt-3">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">Zona opasnosti</p>
          <DeactivateVenueButton
            venueId={venue.id}
            venueName={venue.name}
            isActive={venue.isActive}
            onToggle={onIsActiveToggle}
          />
        </div>
      </div>

      {/* Photos */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 text-sm">Fotografije lokala</h3>
          <span className="text-xs text-neutral-400">{images.length}/8</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((src, i) => (
            <div key={src} className="relative group rounded-xl overflow-hidden aspect-video bg-neutral-100">
              <Image src={src} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  Naslovna
                </span>
              )}
              <button
                onClick={() => saveImages(images.filter((_, j) => j !== i))}
                disabled={imgSaving}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-40"
              >
                ×
              </button>
            </div>
          ))}

          {images.length < 8 && (
            <div className="aspect-video">
              <ImageUpload
                uploadType="venue-photo"
                className="h-full"
                onUpload={async (url) => saveImages([...images, url])}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-neutral-400">
          Prva slika je naslovna fotografija prikazana u pretrazi. Maks. 8 slika.
        </p>
      </div>

      <div className="dash-card p-5">
        <h3 className="font-bold text-neutral-900 text-sm mb-4">Trust Score — dimenzije</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {dims.map(d => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600 font-medium">{d.label}</span>
                <span className="font-bold text-neutral-900">{d.value || "—"}</span>
              </div>
              <div className="prog-track"><div className="prog-fill" style={{ width: `${d.value}%` }} /></div>
            </div>
          ))}
        </div>
        {!venue.venueTrustScore && <p className="text-xs text-neutral-400 mt-3 text-center">Trust Score se računa nakon prvih recenzija</p>}
      </div>

      {venue.venueInsights && (
        <VenueInsightsBadge insights={venue.venueInsights} />
      )}
    </>
  );
}
