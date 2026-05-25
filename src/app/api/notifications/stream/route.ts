import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
// Cap at 5 min — client EventSource auto-reconnects after the function exits.
// Vercel Hobby hard-limits at 60s regardless; Pro/Enterprise can reach 300s.
export const maxDuration = 300;

// Server-Sent Events stream for unread notification count.
// Sends { unread: N } immediately on connect, then every 30s.
// Sends a SSE comment heartbeat every 25s to keep proxy connections alive.
// EventSource auto-reconnects on drop — no client-side polling needed.
//
// X-Accel-Buffering: no — disables nginx/Vercel edge buffering so
// events are not held until the buffer fills.

export const GET = withAuth(async (req, _ctx, session) => {
  const userId  = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed — stream was aborted
        }
      };

      const ping = () => {
        try {
          // SSE comment — keeps proxy/CDN connections alive without triggering client onmessage
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch { /* closed */ }
      };

      const poll = async () => {
        try {
          const count = await db.notification.count({ where: { userId, read: false } });
          send({ unread: count });
        } catch {
          // DB error — skip this tick, next tick will retry
        }
      };

      await poll(); // send count immediately on connect

      const pollInterval = setInterval(poll, 30_000);
      const pingInterval = setInterval(ping, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        clearInterval(pingInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
