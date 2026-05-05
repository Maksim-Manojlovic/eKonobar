"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface ImageUploadProps {
  current?: string | null;
  uploadType: "avatar" | "venue-photo";
  onUpload: (url: string) => Promise<void>;
  shape?: "circle" | "rect";
  label?: string;
  className?: string;
}

export default function ImageUpload({
  current,
  uploadType,
  onUpload,
  shape = "rect",
  label,
  className = "",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const displayed = preview ?? current;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Dozvoljen je samo format slike.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Maksimalna veličina je 5MB.");
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", uploadType);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload nije uspeo");
      await onUpload(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška pri uploadu.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (shape === "circle") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-neutral-300 hover:border-orange-400 transition-colors group disabled:opacity-60"
        >
          {displayed ? (
            <Image src={displayed} alt="" fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-2xl text-neutral-300">
              👤
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-bold">{uploading ? "..." : "Izmeni"}</span>
          </div>
        </button>
        {label && <span className="text-xs text-neutral-400">{label}</span>}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className={`relative rounded-xl border-2 border-dashed transition-colors overflow-hidden cursor-pointer ${
          uploading ? "opacity-60 pointer-events-none" : "hover:border-orange-400"
        } ${displayed ? "border-neutral-200" : "border-neutral-300 bg-neutral-50"}`}
        style={{ minHeight: 120 }}
      >
        {displayed ? (
          <Image src={displayed} alt="" width={800} height={400} className="w-full object-cover" style={{ maxHeight: 200 }} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
            <span className="text-3xl">📸</span>
            <p className="text-sm font-medium text-neutral-500">
              {uploading ? "Uploadujem..." : "Klikni ili prevuci sliku"}
            </p>
            <p className="text-xs text-neutral-400">PNG, JPG, WEBP · max 5MB</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="w-7 h-7 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" style={{ borderWidth: 3 }} />
          </div>
        )}

        {displayed && !uploading && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            Promeni
          </div>
        )}
      </div>

      {label && <p className="text-xs text-neutral-500">{label}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
    </div>
  );
}
