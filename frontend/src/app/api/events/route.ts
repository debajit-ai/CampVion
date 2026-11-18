import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBackendOrigin(): string {
  const configured =
    process.env.BACKEND_URL ||
    process.env.INTERNAL_API_URL ||
    (process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_API_URL
      : "http://127.0.0.1:8000");

  return configured
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "")
    .replace("://localhost:", "://127.0.0.1:");
}

export async function GET(req: NextRequest) {
  const upstreamUrl = new URL(`${getBackendOrigin()}/api/events`);
  const lastEventIdParam = req.nextUrl.searchParams.get("last_event_id");
  if (lastEventIdParam) {
    upstreamUrl.searchParams.set("last_event_id", lastEventIdParam);
  }

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const lastEventId = req.headers.get("last-event-id");
  if (lastEventId) headers.set("last-event-id", lastEventId);

  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return new Response(
      JSON.stringify({ detail: "Unable to connect to event stream upstream." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const bodyText = await upstreamRes.text().catch(() => "");
    return new Response(bodyText || "Unauthorized", {
      status: upstreamRes.status || 502,
      headers: {
        "Content-Type": upstreamRes.headers.get("content-type") || "text/plain",
      },
    });
  }

  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
