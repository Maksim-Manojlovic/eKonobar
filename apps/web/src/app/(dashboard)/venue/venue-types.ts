// Type declarations for the Venue dashboard.
// Runtime display constants live in ./venue-constants.
//
// The API response shapes live in @ekonobar/shared/api/venue so the mobile app
// consumes the same contract; they are re-exported here so every existing
// importer in this directory keeps working unchanged. What stays below is the
// analytics re-export (a web-only lib path) and this dashboard's navigation types.
export * from "@ekonobar/shared/api/venue";

export type { WaiterAnalytics, WaiterReliability, WaiterFlag, AnalyticsTeamSummary, GuestRating } from "@/lib/analytics/waiter-analytics";
export type Section = "overview" | "posts" | "new-post" | "smene" | "tim" | "odmori" | "applications" | "waiters" | "discover" | "reviews" | "qr-review" | "analitika" | "profile" | "notifications";
export type AppFilter = "SVE" | "PENDING" | "SHORTLISTED" | "ACCEPTED" | "REJECTED";
