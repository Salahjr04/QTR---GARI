// Gari vision proxy (Cloudflare Worker).
// The website sends ONLY a JPEG photo; this worker adds the secret API key, a fixed prompt and model,
// and returns the photo-check JSON. Visitors can't read the key, change the prompt, or use it for anything else.
import Anthropic from "@anthropic-ai/sdk";

const MAX_BYTES = 1_500_000; // ~1.5 MB base64 photo
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["is_bicycle", "smart_lock_visible", "lock_on_wheel", "bike_upright", "blocking_path", "parked_properly", "confidence", "reason_en", "reason_ar"],
  properties: {
    is_bicycle: { type: "boolean" }, smart_lock_visible: { type: "boolean" }, lock_on_wheel: { type: "boolean" },
    bike_upright: { type: "boolean" }, blocking_path: { type: "boolean" }, parked_properly: { type: "boolean" },
    confidence: { type: "number" }, reason_en: { type: "string" }, reason_ar: { type: "string" },
  },
};
const PROMPT = "You check end-of-ride photos for Gari, a bike-sharing service in Kuwait. Every Gari bike has a smart lock with a green housing mounted on the rear wheel; when locked its bolt passes through the wheel. Look at the photo and report: is there a bicycle; is the green smart lock visible; is the lock on a wheel (not lying loose); is the bike upright; is it blocking a walkway, door or road; and overall is it parked properly. Give a short reason in English and in Kuwaiti Arabic.";

const hits = new Map(); // best-effort per-IP limit (per worker instance); add a Cloudflare rate-limit rule for a hard limit

function cors(origin, env) {
  const ok = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).includes(origin);
  return { ok, headers: { "Access-Control-Allow-Origin": ok ? origin : "null", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" } };
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

export default {
  async fetch(req, env) {
    const { ok, headers } = cors(req.headers.get("Origin") || "", env);
    if (req.method === "OPTIONS") return new Response(null, { status: ok ? 204 : 403, headers });
    if (!ok) return json({ error: "origin_not_allowed" }, 403, headers);
    if (req.method !== "POST" || new URL(req.url).pathname !== "/check") return json({ error: "not_found" }, 404, headers);

    const ip = req.headers.get("CF-Connecting-IP") || "?", hour = Math.floor(Date.now() / 3600000), k = `${ip}:${hour}`;
    const n = (hits.get(k) || 0) + 1; hits.set(k, n);
    if (n > Number(env.RATE_PER_HOUR || 30)) return json({ error: "rate_limited" }, 429, headers);

    let image;
    try { ({ image } = await req.json()); } catch { return json({ error: "bad_json" }, 400, headers); }
    if (typeof image !== "string" || image.length > MAX_BYTES || !/^[A-Za-z0-9+/=]+$/.test(image)) return json({ error: "bad_image" }, 400, headers);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const res = await client.beta.messages.create({
        model: env.MODEL || "claude-opus-5-5",
        max_tokens: 1024,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text: PROMPT },
        ] }],
      });
      if (res.stop_reason === "refusal") return json({ error: "refused" }, 422, headers);
      const txt = res.content.find((b) => b.type === "text")?.text || "{}";
      return json(JSON.parse(txt), 200, headers);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 503, headers);
      if (e instanceof Anthropic.APIError) return json({ error: "upstream", status: e.status }, 502, headers);
      return json({ error: "server" }, 500, headers);
    }
  },
};
