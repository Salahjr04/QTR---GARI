/* Gari sync: connects this page to the Gari backend (backend/server.js) when there is one.
 *
 * With a backend: rides, bikes, settings and the API log are shared between every phone and the admin
 * dashboard. The page keeps working from its local copy (fast, survives a bad connection) and this file
 * pushes local changes and pulls everyone else's every couple of seconds.
 * Without a backend (plain static hosting): nothing happens here and the app runs on localStorage as before.
 *
 * Backend address: same origin by default; or ?api=https://host once (remembered), for a site hosted elsewhere.
 */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const G = window.Gari;
  const ADMIN = document.body.dataset.role === "admin";
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  const q = new URLSearchParams(location.search).get("api");
  if (q != null) LS.set("gari.api", /^https:\/\/[\w.\-:]+$/.test(q) ? q : null);
  const BASE = LS.get("gari.api") || "";
  const TOKEN_KEY = ADMIN ? "gari.admin.token" : "gari.token";
  const tokenStore = ADMIN ? sessionStorage : localStorage; // the admin token is forgotten when the tab closes

  let pushAllBikes = false; // the server has no fleet yet: this page sends its bikes
  let online = false, token = null, tokenUid = null, timer = 0, busy = false, failures = 0;
  let cursor = (() => { try { return JSON.parse(LS.get(ADMIN ? "gari.sync.admin" : "gari.sync")) || {}; } catch { return {}; } })(); // { epoch, since }
  const sig = { rides: new Map(), bikes: new Map(), users: new Map(), settings: null, logT: 0, live: "" };
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(online); } catch {} });

  const readTok = () => { try { const t = tokenStore.getItem(TOKEN_KEY); if (!t) return null; const p = JSON.parse(atob(t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))); return p.exp > Date.now() + 60000 ? { t, uid: p.uid, role: p.role } : null; } catch { return null; } };
  const saveTok = (t) => { try { t ? tokenStore.setItem(TOKEN_KEY, t) : tokenStore.removeItem(TOKEN_KEY); } catch {} const r = readTok(); token = r && r.t; tokenUid = r && r.uid; };

  async function call(path, { method = "GET", body, auth = true, timeout = 8000 } = {}) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(BASE + path, { method, signal: ctl.signal, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(auth && token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || "http_" + res.status), { status: res.status, code: data.error });
      return data;
    } finally { clearTimeout(to); }
  }

  // ---------------------------------------------------------------- signatures (what changed locally since the last push)
  const rideSig = (r) => [r.status, r.route ? r.route.length : 0, r.attempts || 0, r.photo ? r.photo.at : 0, r.payment ? r.payment.status + (r.payment.ref || "") : "", r.rating || 0, r.fees ? r.fees.total : 0, r.endedAt || 0].join("|");
  const bikeSig = (b) => [b.status, b.lock, b.lat, b.lng, b.rideId || "", b.battery, b.rides || 0, b.spot || ""].join("|");
  const userSig = (u) => [u.name, u.payment ? u.payment.type + (u.payment.last4 || "") : ""].join("|");
  const shareSettings = (s) => { const { claudeKey, ...rest } = s; return rest; }; // an API key never leaves this browser
  const settingsSig = (s) => JSON.stringify(shareSettings(s));
  const mine = (r) => ADMIN || (r.userId === tokenUid && !r.sim);
  function remember(db) { // mark the current local state as "already on the server"
    db.rides.forEach((r) => sig.rides.set(r.id, rideSig(r)));
    Object.values(db.bikes).forEach((b) => sig.bikes.set(b.id, bikeSig(b)));
    Object.values(db.users).forEach((u) => sig.users.set(u.id, userSig(u)));
    sig.settings = settingsSig(db.settings);
    sig.logT = db.api.length ? db.api[db.api.length - 1].t : 0;
  }

  // ---------------------------------------------------------------- pull: merge what others changed
  async function pull() {
    const st = await call(`/api/state?since=${cursor.since || 0}&epoch=${encodeURIComponent(cursor.epoch || "")}`);
    const firstContact = st.epoch !== cursor.epoch;
    const bootstrap = firstContact && st.bikeCount === 0;          // empty server: this page fills it
    let changed = false;
    const apply = (db) => {
      if (firstContact && !bootstrap) {                            // the server is the truth: start from its copy
        // admin: drop old local copies but keep a real rider's ride that is still in progress in this browser.
        // rider: keep the local ride history (it is pushed up), take the fleet from the server.
        if (ADMIN) db.rides = db.rides.filter((r) => !r.sim && ["reserved", "riding", "locked"].includes(r.status));
        if (st.bikes.length) db.bikes = {};
        sig.rides.clear(); sig.bikes.clear();
        changed = true;
      }
      const byId = new Map(db.rides.map((r, i) => [r.id, i]));
      for (const r of st.rides) {
        const i = byId.get(r.id), local = i == null ? null : db.rides[i];
        if (local && sig.rides.has(r.id) && sig.rides.get(r.id) !== rideSig(local)) continue;   // local change not pushed yet: keep it
        if (local && rideSig(local) === rideSig(r)) { sig.rides.set(r.id, rideSig(r)); continue; }
        if (local) db.rides[i] = r; else { db.rides.push(r); byId.set(r.id, db.rides.length - 1); }
        sig.rides.set(r.id, rideSig(r)); changed = true;
      }
      for (const b of st.bikes) {
        const local = db.bikes[b.id];
        if (local && sig.bikes.has(b.id) && sig.bikes.get(b.id) !== bikeSig(local)) continue;
        const { _u, ...bike } = b;
        if (!local || bikeSig(local) !== bikeSig(bike)) { db.bikes[b.id] = bike; changed = true; }
        sig.bikes.set(b.id, bikeSig(bike));
      }
      for (const u of st.users || []) {
        const local = db.users[u.id];
        if (local && sig.users.has(u.id) && sig.users.get(u.id) !== userSig(local)) continue;
        const { _u, ...user } = u;
        if (!local || userSig(local) !== userSig(user)) { db.users[u.id] = { ...(local || {}), ...user }; changed = true; }
        sig.users.set(u.id, userSig(db.users[u.id]));
      }
      if (st.settings && (sig.settings == null || sig.settings === settingsSig(db.settings) || !ADMIN)) {
        const next = { ...db.settings, ...st.settings, claudeKey: db.settings.claudeKey || "" };
        if (settingsSig(next) !== settingsSig(db.settings)) { db.settings = next; changed = true; }
        sig.settings = settingsSig(db.settings);
      }
      if (ADMIN && st.log && st.log.length) {
        const seen = new Set(db.api.map((x) => x.t + x.path));
        for (const x of st.log) if (!seen.has(x.t + x.path)) { db.api.push({ t: x.t, method: x.method, path: x.path, body: x.body }); changed = true; }
        db.api.sort((a, b) => a.t - b.t); sig.logT = Math.max(sig.logT, db.api[db.api.length - 1].t);
      }
      if (st.seeded && !db.seeded) { db.seeded = true; changed = true; }
      if (changed) db.rides.sort((a, b) => (a.unlockedAt || a.reservedAt || 0) - (b.unlockedAt || b.reservedAt || 0));
      if (firstContact && !bootstrap) {
        if (ADMIN) { const live = db.rides.filter((r) => !r.sim && !st.rides.some((x) => x.id === r.id)).map((r) => r.id); remember(db); live.forEach((id) => sig.rides.delete(id)); }
        else { sig.settings = settingsSig(db.settings); sig.logT = db.api.length ? db.api[db.api.length - 1].t : 0; }
      }
      pushAllBikes = bootstrap;
    };
    // only touch the store (and re-render the page) when something really changed
    const probe = G.Store.get();
    const needs = firstContact || st.rides.length || st.bikes.length || (st.users || []).length || st.settings || (st.log || []).length || (st.seeded && !probe.seeded);
    if (needs) { G.Store.reload(); apply(G.Store.db); if (changed) { G.Store.persist(); G.Store.update(() => {}); } }
    if (!(G.Sim && G.Sim.running()) && st.live) { const s = JSON.stringify(st.live); if (s !== sig.live) { sig.live = s; G.Live.write(st.live); } }
    cursor = { epoch: st.epoch, since: st.seq };
    LS.set(ADMIN ? "gari.sync.admin" : "gari.sync", JSON.stringify(cursor));
  }

  // ---------------------------------------------------------------- push: send what changed here
  async function push() {
    const db = G.Store.get(), out = { rides: [], bikes: [], users: [], log: [] };
    let bytes = 0;
    for (const r of db.rides) {
      if (!mine(r) || sig.rides.get(r.id) === rideSig(r)) continue;
      const size = JSON.stringify(r).length;
      if (out.rides.length && (bytes + size > 1500000 || out.rides.length >= 60)) break;           // the rest goes in the next round
      out.rides.push(r); bytes += size;
    }
    const bikeIds = new Set(out.rides.map((r) => r.bikeId));
    for (const b of Object.values(db.bikes)) if (sig.bikes.get(b.id) !== bikeSig(b) && (ADMIN || pushAllBikes || bikeIds.has(b.id) || db.rides.some((r) => r.bikeId === b.id && mine(r)))) out.bikes.push(b);
    for (const u of Object.values(db.users)) if ((ADMIN ? false : u.id === tokenUid) && sig.users.get(u.id) !== userSig(u)) out.users.push({ id: u.id, name: u.name, provider: u.provider, payment: u.payment || null });
    for (const x of db.api) if (x.t > sig.logT && !(x.body && x.body.sim)) out.log.push(x);
    out.log = out.log.slice(-60);
    if (ADMIN) {
      if (sig.settings !== settingsSig(db.settings)) out.settings = shareSettings(db.settings);
      if (G.Sim && G.Sim.running()) out.live = G.Live.read();
      if (db.seeded) out.seeded = true;
    }
    if (!out.rides.length && !out.bikes.length && !out.users.length && !out.log.length && !out.settings && !out.live) return;
    const res = await call("/api/sync", { method: "POST", body: out, timeout: 15000 });
    const bad = new Set(res.rejected || []);
    out.rides.forEach((r) => sig.rides.set(r.id, rideSig(r)));          // rejected ones are not retried forever
    out.bikes.forEach((b) => sig.bikes.set(b.id, bikeSig(b))); pushAllBikes = false;
    out.users.forEach((u) => sig.users.set(u.id, userSig(db.users[u.id])));
    if (out.log.length) sig.logT = out.log[out.log.length - 1].t;
    if (out.settings && !bad.has("settings")) sig.settings = settingsSig(db.settings);
  }

  // ---------------------------------------------------------------- loop
  async function ensureToken() {
    const cur = readTok(); token = cur && cur.t; tokenUid = cur && cur.uid;
    if (ADMIN) return !!token;
    const sess = G.Session.get();
    if (!sess) return false;
    if (token && tokenUid === sess.id) return true;
    if (sess.provider === "password") return false;                    // needs the password again (handled at sign-in)
    const r = await call("/api/auth/rider", { method: "POST", auth: false, body: { provider: sess.provider, id: sess.id, name: sess.name } });
    saveTok(r.token);
    return true;
  }
  async function cycle() {
    if (busy || !online) return;
    busy = true;
    try {
      if (await ensureToken()) { await pull(); await push(); }
      failures = 0;
    } catch (e) {
      if (e.status === 401) saveTok(null);
      failures++;
    } finally { busy = false; }
  }
  let resolveReady; const ready = new Promise((r) => (resolveReady = r));       // first sync done (or no backend)
  let resolveChecked; const checked = new Promise((r) => (resolveChecked = r)); // we know whether a backend exists
  async function start() {
    try { const h = await call("/api/health", { auth: false, timeout: 2500 }); online = !!(h && h.ok && h.service === "gari-backend"); } catch { online = false; }
    emit(); resolveChecked(online);
    if (!online) return resolveReady(false);
    document.documentElement.dataset.backend = "on";
    if (!ADMIN || readTok()) { await cycle(); resolveReady(true); }
    timer = setInterval(cycle, 1500);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) cycle(); });
  }

  // ---------------------------------------------------------------- sign-in helpers used by the pages
  // rider with username + password: the server creates the account or checks the password
  async function passwordAuth(username, password) {
    const r = await call("/api/auth/rider", { method: "POST", auth: false, body: { provider: "password", username, password } });
    saveTok(r.token);
    return r.user;
  }
  async function adminLogin(password) {
    const r = await call("/api/auth/admin", { method: "POST", auth: false, body: { password } });
    saveTok(r.token);
    await cycle();
    resolveReady(true);
    return true;
  }
  async function resetAll() { if (online && ADMIN) { await call("/api/admin/reset", { method: "POST" }); cursor = {}; sig.rides.clear(); sig.bikes.clear(); sig.settings = null; } }
  function signOut() { saveTok(null); }

  G.Sync = { ready, checked, isOnline: () => online, isAdmin: ADMIN, hasToken: () => !!readTok(), passwordAuth, adminLogin, resetAll, signOut, now: cycle, on: (f) => (listeners.add(f), () => listeners.delete(f)) };
  start();
})();
