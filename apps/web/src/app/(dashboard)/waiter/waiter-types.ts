// Type declarations for the Waiter dashboard.
// Runtime display constants live in ./waiter-constants.
// No JSX — safe to import in both client and server contexts.
//
// The API response shapes live in @ekonobar/shared/api/waiter so the mobile app
// consumes the same contract; they are re-exported here so every existing
// importer in this directory keeps working unchanged. What stays below is only
// the types describing THIS dashboard's navigation.
export * from "@ekonobar/shared/api/waiter";

export type Section = "overview" | "alerts" | "jobs" | "applications" | "shifts" | "odmori" | "invites" | "reviews" | "passport" | "manage" | "notifications";
export type AppFilter = "all" | "accepted" | "pending" | "rejected";
