"use client";

import { useEffect, useState } from "react";

export type SanitaryBook = {
  status: string;
  fileUrl: string;
  rejectReason?: string | null;
  expiryDate?: string | null;
} | null;

/**
 * Owns the sanitary-book verification concern, extracted out of `WaiterPassportSection`
 * (CQ-G god-component split, same pattern as [[useNotifPrefs]]). Loads the current record,
 * holds the upload/expiry draft, and submits a (re-)verification request.
 */
export function useSanitaryBook() {
  const [book, setBook]           = useState<SanitaryBook>(null);
  const [fileUrl, setFileUrl]     = useState<string | null>(null);
  const [expiry, setExpiry]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    fetch("/api/verification/sanitary")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setBook(d); })
      .catch(() => {});
  }, []);

  async function submit() {
    if (!fileUrl) return;
    setSubmitting(true);
    const res = await fetch("/api/verification/sanitary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl, expiryDate: expiry || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setBook(data);
      setFileUrl(null);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    }
    setSubmitting(false);
  }

  // "Zameni knjižicu" — flip an approved record into replace mode so the upload form shows again.
  function startReplace() {
    setBook(prev => (prev ? { ...prev, status: "REPLACE" } : null));
  }

  return { book, fileUrl, setFileUrl, expiry, setExpiry, submitting, submitted, submit, startReplace };
}
