"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SanitaryBook = {
  id: string;
  status: string;
  expiryDate: string | null;
  uploadedAt: string;
  rejectReason: string | null;
  user: { id: string; name: string | null; email: string };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminVerificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [books, setBooks]       = useState<SanitaryBook[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "ADMIN") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/verification/sanitary")
      .then((r) => r.json())
      .then((d) => setBooks(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status]);

  async function handleAction(id: string, action: "approve" | "reject", reason?: string) {
    setActing(id);
    setError(null);
    try {
      const res = await fetch(`/api/verification/sanitary/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectReason: reason ?? null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška");
      setBooks((prev) => prev.filter((b) => b.id !== id));
      setRejectId(null);
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
    } finally {
      setActing(null);
    }
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/admin" className="text-sm text-neutral-400 hover:text-orange-500 font-semibold transition-colors">← Admin</Link>
            </div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">Admin</p>
            <h1 className="text-2xl font-black text-neutral-900">Sanitarne knjižice</h1>
            <p className="text-sm text-neutral-500">{books.length} zahteva na čekanju</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
        )}

        {books.length === 0 ? (
          <div className="dash-card p-14 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-bold text-neutral-900">Nema zahteva na čekanju.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {books.map((book) => (
              <div key={book.id} className="dash-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-black text-sm flex items-center justify-center flex-shrink-0">
                        {book.user.name ? book.user.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : "?"}
                      </div>
                      <div>
                        <p className="font-bold text-neutral-900 text-sm">{book.user.name ?? "—"}</p>
                        <p className="text-xs text-neutral-400">{book.user.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-neutral-400 font-medium">Uploadovano</p>
                        <p className="font-semibold text-neutral-700">{formatDate(book.uploadedAt)}</p>
                      </div>
                      {book.expiryDate && (
                        <div>
                          <p className="text-neutral-400 font-medium">Ističe</p>
                          <p className="font-semibold text-neutral-700">{formatDate(book.expiryDate)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-neutral-400 font-medium">Fajl</p>
                        <a href={`/api/verification/sanitary/${book.id}/file`} target="_blank" rel="noopener noreferrer"
                          className="text-orange-500 font-semibold hover:underline truncate block max-w-[160px]">
                          Otvori dokument ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {rejectId === book.id ? (
                      <div className="flex flex-col gap-2 w-64">
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Razlog odbijanja (opciono)"
                          className="auth-input text-xs py-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(book.id, "reject", rejectReason)}
                            disabled={acting === book.id}
                            className="flex-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-all"
                          >
                            {acting === book.id ? "..." : "Potvrdi odbijanje"}
                          </button>
                          <button
                            onClick={() => { setRejectId(null); setRejectReason(""); }}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-all"
                          >
                            Otkaži
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAction(book.id, "approve")}
                          disabled={acting === book.id}
                          className="btn-dash-orange px-4 py-2 text-xs disabled:opacity-50"
                        >
                          {acting === book.id ? "..." : "Odobri"}
                        </button>
                        <button
                          onClick={() => setRejectId(book.id)}
                          className="text-xs font-bold px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                        >
                          Odbij
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
