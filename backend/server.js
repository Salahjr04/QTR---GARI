/* Gari backend: one small Node.js server, no dependencies.
 *
 *  - serves the website (rider app at /, admin at /admin.html) with security headers
 *  - REST API under /api: sign-in, shared rides / bikes / settings, live positions, API log
 *  - riders only see and change their own rides; the admin sees everything
 *  - ride prices are recalculated here, so a phone cannot send its own total
 *  - data is kept in one JSON file (DATA_DIR/db.json)
 *
 * Run:  node backend/server.js        (PORT, ADMIN_PASSWORD, GARI_SECRET, DATA_DIR, ALLOWED_ORIGINS are optional)
 * Read backend/README.md before changing this file.
 */
"use strict";
const http = require("node:http"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 8000);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_BODY = 3 * 1024 * 1024;          // one request
const MAX_RIDE_BYTES = 400 * 1024;         // one ride (route + photo thumbnail)
const MAX_RIDES = 3000, MAX_LOG = 600;
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------- secrets
// The signing secret and the admin password never go into the repository. Set them as environment
// variables on the host; without them the server makes its own and prints the admin password once.
function loadSecret() {
  if (process.env.GARI_SECRET) return process.env.GARI_SECRET;
  const f = path.join(DATA_DIR, "secret");
  try { return fs.readFileSync(f, "utf8"); } catch {}
  const s = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(5).toString("hex");
if (!process.env.ADMIN_PASSWORD) console.log(`[gari] ADMIN_PASSWORD is not set. Admin password for this run: ${ADMIN_PASSWORD}`);

// ---------------------------------------------------------------- database (one JSON file)
const fresh = () => ({ epoch: crypto.randomBytes(4).toString("hex"), seq: 1, rides: {}, bikes: {}, users: {}, settings: null, settingsRev: 0, log: [], seeded: false });
let db = fresh();
try { const d = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); if (d && d.epoch) db = { ...fresh(), ...d }; } catch {}
let live = { t: 0, list: [] };              // positions of simulated riders (not saved)
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = DB_FILE + ".tmp";
    fs.writeFile(tmp, JSON.stringify(db), (e) => { if (!e) fs.rename(tmp, DB_FILE, () => {}); else console.error("[gari] save failed", e.message); });
  }, 400);
}
const nextRev = () => ++db.seq;

// ---------------------------------------------------------------- tokens (HMAC-SHA256 signed, expire after 7 days)
const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (data) => crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
function makeToken(payload) { const body = b64(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS })); return `${body}.${sign(body)}`; }
function readToken(tok) {
  if (typeof tok !== "string" || tok.length > 600) return null;
  const [body, sig] = tok.split(".");
  if (!body || !sig) return null;
  const want = sign(body), a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const safeEqual = (x, y) => { const a = crypto.createHash("sha256").update(String(x)).digest(), b = crypto.createHash("sha256").update(String(y)).digest(); return crypto.timingSafeEqual(a, b); };
function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) { return `${salt}:${crypto.scryptSync(String(pw), salt, 32).toString("hex")}`; }
function checkPassword(pw, stored) { const [salt, h] = String(stored).split(":"); const a = Buffer.from(h || "", "hex"), b = crypto.scryptSync(String(pw), salt, 32); return a.length === b.length && crypto.timingSafeEqual(a, b); }

// ---------------------------------------------------------------- rate limits (per IP, in memory)
const buckets = new Map();
function limited(ip, kind, max, windowMs) {
  const k = `${kind}:${ip}`, now = Date.now(), b = buckets.get(k);
  if (!b || now > b.reset) { buckets.set(k, { n: 1, reset: now + windowMs }); return false; }
  return ++b.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 60000).unref();

// ---------------------------------------------------------------- helpers
const str = (v, max = 80) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v, lo, hi, d) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const userSlug = (name) => (String(name || "rider").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "").slice(0, 16) || "rider"); // same rule as js/core.js signIn
const idOk = (id) => typeof id === "string" && /^[\w\-؀-ۿ]{1,60}$/.test(id);
const BIKE_STATUS = ["available", "reserved", "in_use"], LOCK = ["locked", "unlocked"];
const RIDE_STATUS = ["reserved", "riding", "locked", "completed", "cancelled", "expired"];
const SETTING_KEYS = { unlockFee: [0, 100], reserveFee: [0, 100], blockFee: [0, 100], blockMin: [1, 240], nearM: [0, 5000], holdMin: [1, 240], parkRadiusM: [10, 2000] };

function cleanBike(b) {
  if (!b || !idOk(b.id) || !BIKE_STATUS.includes(b.status) || !LOCK.includes(b.lock)) return null;
  const lat = num(b.lat, 28, 31, null), lng = num(b.lng, 46, 49, null);
  if (lat == null || lng == null) return null;
  return { id: b.id, lat, lng, spot: str(b.spot, 8) || null, status: b.status, lock: b.lock, battery: num(b.battery, 0, 100, 50), rides: num(b.rides, 0, 1e6, 0), rideId: idOk(b.rideId) ? b.rideId : null };
}
function rideFee(s, rideSec) { // same rule as js/core.js rideFee
  const blocks = Math.floor(Math.max(0, rideSec) / (s.blockMin * 60));
  return { unlock: s.unlockFee, time: +(blocks * s.blockFee).toFixed(3) };
}
function cleanRide(r, who) {
  if (!r || typeof r !== "object" || !idOk(r.id) || !idOk(r.userId) || !idOk(r.bikeId) || !RIDE_STATUS.includes(r.status)) return null;
  if (who.role !== "admin" && (r.userId !== who.uid || r.sim)) return null;                 // riders write only their own rides
  const old = db.rides[r.id];
  if (old && who.role !== "admin" && old.userId !== who.uid) return null;
  if (Buffer.byteLength(JSON.stringify(r)) > MAX_RIDE_BYTES) return null;
  const out = { ...r, userName: str(r.userName, 40) };
  delete out._u;
  if (out.photo && out.photo.thumb && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(out.photo.thumb)) out.photo = { ...out.photo, thumb: null };
  // the price is decided here, not by the phone
  if (!r.sim && db.settings && out.status === "completed" && typeof out.unlockedAt === "number" && typeof out.endedAt === "number") {
    const sec = Math.max(0, Math.round((out.endedAt - out.unlockedAt) / 1000)), f = rideFee(db.settings, sec), reserve = out.reservedAt ? db.settings.reserveFee : 0;
    out.rideSec = sec; out.fees = { reserve, unlock: f.unlock, time: f.time, total: +(reserve + f.unlock + f.time).toFixed(3) };
  }
  return out;
}
function cleanSettings(s) {
  if (!s || typeof s !== "object") return null;
  const out = { currency: "KD" };
  for (const [k, [lo, hi]] of Object.entries(SETTING_KEYS)) { const v = num(s[k], lo, hi, null); if (v == null) return null; out[k] = v; }
  out.visionEngine = ["auto", "device", "claude"].includes(s.visionEngine) ? s.visionEngine : "auto";
  out.visionProxy = /^https:\/\/[\w.\-/:]{4,200}$/.test(s.visionProxy || "") ? s.visionProxy : "";
  out.claudeModel = str(s.claudeModel, 60);
  out.photoStrict = s.photoStrict ? "1" : "";
  return out; // an API key is never accepted or stored here
}
function trim() {
  const ids = Object.keys(db.rides);
  if (ids.length > MAX_RIDES) ids.sort((a, b) => db.rides[a]._u - db.rides[b]._u).slice(0, ids.length - MAX_RIDES).forEach((id) => delete db.rides[id]);
  if (db.log.length > MAX_LOG) db.log = db.log.slice(-MAX_LOG);
}

// ---------------------------------------------------------------- HTTP plumbing
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(self), camera=(self), microphone=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
function send(res, status, body, extra = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS, ...extra });
  res.end(data);
}
function readBody(req) {
  return new Promise((ok, bad) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { bad(Object.assign(new Error("too_large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { bad(Object.assign(new Error("bad_json"), { status: 400 })); } });
    req.on("error", bad);
  });
}
const clientIp = (req) => (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?");
function cors(req) { // same-origin needs nothing; other sites must be listed in ALLOWED_ORIGINS
  const o = req.headers.origin;
  if (!o || !ALLOWED_ORIGINS.includes(o)) return {};
  return { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
}
function auth(req) { const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? readToken(h.slice(7)) : null; }

// ---------------------------------------------------------------- API
async function api(req, res, url) {
  const ip = clientIp(req), H = cors(req), p = url.pathname;
  if (req.method === "OPTIONS") return send(res, H["Access-Control-Allow-Origin"] ? 204 : 403, "", H);
  if (limited(ip, "all", 900, 60000)) return send(res, 429, { error: "rate_limited" }, H);

  if (p === "/api/health" && req.method === "GET") return send(res, 200, { ok: true, service: "gari-backend", version: 1, time: Date.now(), bikes: Object.keys(db.bikes).length }, H);

  // ---- sign-in
  if (p === "/api/auth/rider" && req.method === "POST") {
    if (limited(ip, "auth", 30, 60000)) return send(res, 429, { error: "rate_limited" }, H);
    const b = await readBody(req), provider = str(b.provider, 12), name = str(b.name, 40) || "Rider";
    let id;
    if (provider === "password") {
      const pw = String(b.password || "");
      if (pw.length < 4 || pw.length > 200) return send(res, 400, { error: "bad_password" }, H);
      id = `u_password_${userSlug(b.username)}`;
      const u = db.users[id];
      if (u && u.pass) { if (!checkPassword(pw, u.pass)) return send(res, 401, { error: "wrong_password" }, H); }
      else { db.users[id] = { ...(u || {}), id, name: str(b.username, 40), provider, pass: hashPassword(pw), joinedAt: Date.now(), _u: nextRev() }; save(); }
    } else if (["apple", "google", "guest"].includes(provider)) {
      // Apple / Google sign-in is simulated in this prototype: the id belongs to the device that made it
      id = str(b.id, 60);
      if (!idOk(id) || id.startsWith("u_password_") || !(id.startsWith(`u_${provider}_`) || id.startsWith("guest"))) return send(res, 400, { error: "bad_id" }, H);
      if (!db.users[id]) { db.users[id] = { id, name, provider, joinedAt: Date.now(), _u: nextRev() }; save(); }
    } else return send(res, 400, { error: "bad_provider" }, H);
    return send(res, 200, { token: makeToken({ role: "rider", uid: id }), user: { id, name: db.users[id].name || name, provider } }, H);
  }
  if (p === "/api/auth/admin" && req.method === "POST") {
    if (limited(ip, "admin-auth", 8, 60000)) return send(res, 429, { error: "rate_limited" }, H);
    const b = await readBody(req);
    if (!safeEqual(b.password || "", ADMIN_PASSWORD)) return send(res, 401, { error: "wrong_password" }, H);
    return send(res, 200, { token: makeToken({ role: "admin", uid: "admin" }) }, H);
  }

  const who = auth(req);
  if (!who) return send(res, 401, { error: "sign_in_required" }, H);
  const admin = who.role === "admin";

  // ---- read: everything that changed since revision `since`
  if (p === "/api/state" && req.method === "GET") {
    const since = url.searchParams.get("epoch") === db.epoch ? Number(url.searchParams.get("since")) || 0 : 0;
    const newer = (o) => Object.values(o).filter((x) => x._u > since);
    const rides = newer(db.rides).filter((r) => admin || r.userId === who.uid);
    const users = admin ? newer(db.users).map(({ pass, ...u }) => u) : newer(db.users).filter((u) => u.id === who.uid).map(({ pass, ...u }) => u);
    return send(res, 200, {
      epoch: db.epoch, seq: db.seq, seeded: db.seeded, bikeCount: Object.keys(db.bikes).length,
      rides, bikes: newer(db.bikes), users,
      settings: db.settings && db.settingsRev > since ? db.settings : null,
      log: admin ? db.log.filter((x) => x._u > since) : [],
      live: Date.now() - live.t < 15000 ? live.list : [],
    }, H);
  }

  // ---- write: a batch of changed rides / bikes (+ the rider's own profile, + admin-only settings)
  if (p === "/api/sync" && req.method === "POST") {
    const b = await readBody(req), rejected = [];
    for (const r of Array.isArray(b.rides) ? b.rides.slice(0, 200) : []) {
      const c = cleanRide(r, who);
      if (!c) { rejected.push(r && r.id); continue; }
      db.rides[c.id] = { ...c, _u: nextRev() };
    }
    for (const x of Array.isArray(b.bikes) ? b.bikes.slice(0, 400) : []) {
      const c = cleanBike(x);
      if (!c) { rejected.push(x && x.id); continue; }
      // riders cannot invent bikes; the one exception is the very first visitor filling an empty fleet (ids G-101...)
      if (!admin && !db.bikes[c.id] && !(/^G-\d{3}$/.test(c.id) && c.status === "available" && Object.keys(db.bikes).length < 80)) continue;
      db.bikes[c.id] = { ...c, _u: nextRev() };
    }
    for (const u of Array.isArray(b.users) ? b.users.slice(0, 50) : []) {
      if (!u || !idOk(u.id) || (!admin && u.id !== who.uid)) continue;
      const pay = u.payment && ["applepay", "knet", "visa"].includes(u.payment.type) ? { type: u.payment.type, last4: /^\d{4}$/.test(u.payment.last4 || "") ? u.payment.last4 : undefined } : null;
      db.users[u.id] = { ...(db.users[u.id] || {}), id: u.id, name: str(u.name, 40), provider: str(u.provider, 12), payment: pay, _u: nextRev() };
    }
    for (const x of Array.isArray(b.log) ? b.log.slice(0, 80) : []) {
      if (!x || typeof x.t !== "number") continue;
      db.log.push({ t: x.t, method: str(x.method, 8), path: str(x.path, 120), body: JSON.stringify(x.body || null).length < 2000 ? x.body : null, by: who.uid, _u: nextRev() });
    }
    if (admin && b.settings) { const s = cleanSettings(b.settings); if (s) { db.settings = s; db.settingsRev = nextRev(); } else rejected.push("settings"); }
    if (admin && Array.isArray(b.live)) live = { t: Date.now(), list: b.live.slice(0, 120).filter((x) => Array.isArray(x) && x.length === 3) };
    if (admin && b.seeded) db.seeded = true;
    trim(); save();
    return send(res, 200, { ok: true, seq: db.seq, rejected }, H);
  }

  // ---- admin: wipe everything (bikes go back to their zones on the next admin sync)
  if (p === "/api/admin/reset" && req.method === "POST") {
    if (!admin) return send(res, 403, { error: "admin_only" }, H);
    const users = db.users; db = fresh(); for (const [id, u] of Object.entries(users)) if (u.pass) db.users[id] = { id, name: u.name, provider: u.provider, pass: u.pass, _u: 1 };
    live = { t: 0, list: [] }; save();
    return send(res, 200, { ok: true, epoch: db.epoch }, H);
  }
  return send(res, 404, { error: "not_found" }, H);
}

// ---------------------------------------------------------------- website files
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".bin": "application/octet-stream", ".md": "text/plain; charset=utf-8" };
const PUBLIC = ["index.html", "admin.html", "css", "js", "assets", "vendor", "test-photos"];   // nothing else in the repository is served
function statics(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method_not_allowed" });
  let rel; try { rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html"; } catch { return send(res, 400, { error: "bad_path" }); }
  if (rel === "admin") rel = "admin.html";
  const file = path.resolve(ROOT, rel);
  if (!PUBLIC.includes(rel.split("/")[0]) || !file.startsWith(ROOT + path.sep) || rel.split("/").some((s) => s.startsWith("."))) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
    const ext = path.extname(file), heavy = rel.startsWith("vendor/") || rel.startsWith("assets/") || rel.startsWith("js/map/");
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": heavy ? "public, max-age=86400" : "no-cache", ...SECURITY_HEADERS });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, "http://x"); } catch { return send(res, 400, { error: "bad_url" }); }
  if (url.pathname.startsWith("/api/")) return api(req, res, url).catch((e) => { if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "server" }); if (!e.status) console.error("[gari]", e); });
  statics(req, res, url);
});
server.requestTimeout = 30000;
if (require.main === module) server.listen(PORT, () => console.log(`[gari] http://localhost:${PORT}  (rider /, admin /admin.html, API /api)`));
module.exports = { server };
