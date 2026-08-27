import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";

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
          // Controller already closed — the client navigated away. Happens on every
          // disconnect, so logging would emit a line per closed tab. Discarded.
          // eslint-disable-next-line no-restricted-syntax
        } catch { /* stream aborted by the client */ }
      };

      const ping = () => {
        try {
          // SSE comment — keeps proxy/CDN connections alive without triggering client onmessage
          controller.enqueue(encoder.encode(": ping\n\n"));
          // Same as send(): a closed stream is the normal end of life here.
          // eslint-disable-next-line no-restricted-syntax
        } catch { /* stream aborted by the client */ }
      };

      const poll = async () => {
        try {
          const count = await db.notification.count({ where: { userId, read: false } });
          send({ unread: count });
        } catch (err) {
          // Skip this tick; the next one retries. Logged because a persistently
          // failing poll means every open dashboard shows a frozen badge.
          logger.warn({ err, userId }, "notification stream: unread poll failed");
        }
      };

      await poll(); // send count immediately on connect

      const pollInterval = setInterval(poll, 30_000);
      const pingInterval = setInterval(ping, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        clearInterval(pingInterval);
        // Closing an already-closed controller throws; abort fires either way.
        // eslint-disable-next-line no-restricted-syntax
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
