import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Server-Sent Events stream for unread notification count.
// Sends { unread: N } immediately on connect, then every 30s.
// EventSource auto-reconnects on drop — no client-side polling needed.
//
// X-Accel-Buffering: no — disables nginx/Vercel edge buffering so
// events are not held until the buffer fills.

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

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

      const poll = async () => {
        try {
          const count = await db.notification.count({ where: { userId, read: false } });
          send({ unread: count });
        } catch {
          // DB error — skip this tick, next tick will retry
        }
      };

      await poll(); // send count immediately on connect

      const interval = setInterval(poll, 30_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
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
}
