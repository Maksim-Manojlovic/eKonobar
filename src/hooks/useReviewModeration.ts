"use client";
import { useState } from "react";
import type { VenueReview } from "@/app/(dashboard)/venue/venue-types";

/**
 * Shared moderation logic for PENDING venue reviews.
 * Eliminates the duplicate handleModerate implementations that previously
 * existed in both ReviewsSection and QrReviewSection.
 *
 * @param setReviews - state setter for the review list being moderated
 */
export function useReviewModeration(
  setReviews: React.Dispatch<React.SetStateAction<VenueReview[]>>,
) {
  const [moderating, setModerating] = useState<string | null>(null);

  async function handleModerate(reviewId: string, action: "approve" | "reject") {
    setModerating(reviewId);
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setModerating(null);
    if (res.ok) {
      setReviews(prev =>
        action === "reject"
          ? prev.filter(r => r.id !== reviewId)
          : prev.map(r => r.id === reviewId ? { ...r, status: "PUBLISHED" } : r),
      );
    }
  }

  return { moderating, handleModerate };
}
