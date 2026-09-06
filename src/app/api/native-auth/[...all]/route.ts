import { getNativeAuth } from "@/lib/postgres/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (process.env.NATIVE_AUTH_ENABLED !== "true") return new Response(null, { status: 404 });
  // Account provisioning remains an administrative operation, never public signup.
  const path = new URL(request.url).pathname.replace(/^\/api\/native-auth/, "");
  const allowed = request.method === "GET"
    ? path === "/get-session"
    : request.method === "POST" && ["/sign-in/username", "/sign-out"].includes(path);
  if (!allowed) return new Response(null, { status: 404 });
  try {
    const response = await getNativeAuth().handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    console.error("[native-auth] Authentication service unavailable");
    return Response.json({ error: "Authentication unavailable" }, { status: 503 });
  }
}

export const GET = handle;
export const POST = handle;
