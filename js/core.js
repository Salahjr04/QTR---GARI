/* Gari core: settings, pricing, simulation clock, shared store, fleet and ride API.
 * Used by both the rider app (index.html) and the admin dashboard (admin.html).
 *
 * Storage: localStorage of this browser (prototype). Both pages see the same data, and changes are pushed
 * between open tabs with BroadcastChannel + the `storage` event. A real deployment would swap `Store`
 * for an HTTPS API (see docs/ARCHITECTURE.md); every write here is logged as the API call it stands for.
 */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const G = window.Gari;
  const KEY = "gari.db.v1", CLOCK_KEY = "gari.clock.v1", LIVE_KEY = "gari.live.v1";

  // ---------------------------------------------------------------- settings & pricing
  const DEFAULT_SETTINGS = {
    currency: "KD",
    unlockFee: 1.0,       // charged when the smart lock opens (covers the first 10 minutes)
    reserveFee: 0.25,     // booking a bike that is not next to you
    blockFee: 0.1,        // every further 10 minutes
    blockMin: 10,
    nearM: 100,           // within this distance you just unlock, no booking needed
    holdMin: 15,          // a booking holds the bike this long
    parkRadiusM: 80,      // a ride must end inside a Gari parking zone
    visionEngine: "auto", // auto | device | claude
    visionProxy: "",      // URL of the server proxy that holds the API key (recommended for a public site)
    claudeKey: "",
    claudeModel: "claude-opus-5-5",
  };
  const KD = (v) => (Math.round(v * 1000) / 1000).toFixed(3);

  function rideFee(settings, rideSec) {
    const blocks = Math.floor(Math.max(0, rideSec) / (settings.blockMin * 60)); // first block is in the unlock fee
    return { unlock: settings.unlockFee, time: +(blocks * settings.blockFee).toFixed(3), blocks };
  }

  // ---------------------------------------------------------------- geo
  const KX = 111320 * Math.cos((29.35 * Math.PI) / 180), KY = 110574;
  const distM = (a, b) => Math.hypot((a.lat - b.lat) * KY, (a.lng - b.lng) * KX);

  // ---------------------------------------------------------------- parking spots (real places, OpenStreetMap)
  const EN = ["Bike parking · Kuwait Towers", "Rawda Park, Block 3", "Khaled Al-Jeran Park · Kaifan", "Kaifan Park, Block 2", "Faiha Park, Block 7",
    "Martyr Hussein Al-Zaabi Park · Faiha", "Gamal Abdel Nasser Park · Rawda", "Shuwaikh Park, Block 6", "Abdullah Al-Salem Park, Block 4",
    "Abdullah Al-Salem Park, Block 3", "Mansouriya Park, Block 2", "Al-Shaheed Park", "Mansouriya Park, Block 1", "Dasma Park, Block 3",
    "Dasma Park, Block 6", "Green Island", "Al-Seif Square", "Al-Zahamil Square · Sharq"];
  const SPOTS = (G.REAL_SPOTS || []).map((s, i) => ({ id: `P${String(i + 1).padStart(2, "0")}`, ar: s.name, en: EN[i] || s.name, lat: s.lat, lng: s.lng, kind: s.kind }));
  const spotName = (s) => (s ? (document.documentElement.lang === "en" ? s.en : s.ar) : "");
  function nearestSpot(p) {
    let best = null, bd = Infinity;
    for (const s of SPOTS) { const d = distM(p, s); if (d < bd) { bd = d; best = s; } }
    return { spot: best, d: bd };
  }

  // ---------------------------------------------------------------- initial fleet
  const COUNTS = [4, 3, 3, 2, 3, 2, 3, 2, 3, 3, 2, 4, 2, 3, 2, 3, 3, 3];
  function seedBikes() {
    const bikes = {}; let id = 101;
    SPOTS.forEach((s, si) => {
      for (let i = 0; i < COUNTS[si % COUNTS.length]; i++) {
        const a = si * 1.7 + i * 2.1, r = i === 0 ? 0 : 0.00011 + i * 0.00003;
        bikes[`G-${id}`] = { id: `G-${id}`, lat: s.lat + Math.sin(a) * r, lng: s.lng + Math.cos(a) * r, spot: s.id, status: "available",
          lock: "locked", battery: 55 + ((id * 37) % 45), rides: 0 };
        id++;
      }
    });
    return bikes;
  }

  // ---------------------------------------------------------------- simulation clock
  // now() = baseSim + (realNow - baseReal) * speed. Speed 30 means one real second is 30 simulated seconds.
  const Clock = {
    s: null,
    load() { try { this.s = JSON.parse(localStorage.getItem(CLOCK_KEY)); } catch { this.s = null; } if (!this.s) this.s = { speed: 1, baseReal: Date.now(), baseSim: Date.now() }; return this; },
    now() { const s = this.s || this.load().s; return s.baseSim + (Date.now() - s.baseReal) * s.speed; },
    get speed() { return (this.s || this.load().s).speed; },
    setSpeed(x) { const n = this.now(); this.s = { speed: Math.max(1, Math.min(600, +x || 1)), baseReal: Date.now(), baseSim: n }; this.save(); },
    jump(ms) { const n = this.now(); this.s = { ...this.s, baseReal: Date.now(), baseSim: n + ms }; this.save(); },
    reset() { this.s = { speed: 1, baseReal: Date.now(), baseSim: Date.now() }; this.save(); },
    save() { try { localStorage.setItem(CLOCK_KEY, JSON.stringify(this.s)); } catch {} bus.post({ t: "clock" }); emit("clock"); },
  };

  // ---------------------------------------------------------------- store
  const listeners = new Set();
  const emit = (what) => listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } });
  const bus = (() => {
    let ch = null; try { ch = new BroadcastChannel("gari"); } catch {}
    if (ch) ch.onmessage = (e) => { if (e.data?.t === "clock") Clock.load(); if (e.data?.t === "db") Store.reload(); emit(e.data?.t || "db"); };
    return { post: (m) => { try { ch && ch.postMessage(m); } catch {} } };
  })();
  addEventListener("storage", (e) => {
    if (e.key === CLOCK_KEY) { Clock.load(); emit("clock"); }
    if (e.key === KEY) { Store.reload(); emit("db"); }
    if (e.key === LIVE_KEY) emit("live");
  });

  const fresh = () => ({ v: 1, bikes: seedBikes(), rides: [], users: {}, api: [], settings: { ...DEFAULT_SETTINGS },
    sim: { running: false, demand: 1, weather: "clear", event: "none" } });
  const Store = {
    db: null,
    reload() {
      try { this.db = JSON.parse(localStorage.getItem(KEY)); } catch { this.db = null; }
      if (!this.db || !this.db.bikes || !Object.keys(this.db.bikes).length) { this.db = fresh(); this.persist(); }
      this.db.settings = { ...DEFAULT_SETTINGS, ...(this.db.settings || {}) };
      return this.db;
    },
    get() { return this.db || this.reload(); },
    persist() {
      const db = this.db;
      if (db.rides.length > 500) db.rides = db.rides.slice(-500);
      if (db.api.length > 300) db.api = db.api.slice(-300);
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch { // quota: drop old photos and routes of simulated rides, then retry
        db.rides.forEach((r, i) => { if (i < db.rides.length - 40) { if (r.photo) r.photo.thumb = null; if (r.sim) r.route = []; } });
        try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn("storage full", e); }
      }
    },
    // read-modify-write from the latest saved copy, then notify every open page
    update(fn, { silent = false } = {}) {
      this.reload(); const out = fn(this.db); this.persist();
      if (!silent) { bus.post({ t: "db" }); emit("db"); }
      return out;
    },
    log(method, path, body) { this.db.api.push({ t: Clock.now(), method, path, body }); },
    reset() { this.db = fresh(); this.persist(); Clock.reset(); try { localStorage.removeItem(LIVE_KEY); } catch {} bus.post({ t: "db" }); emit("db"); },
  };

  // live positions of simulated riders (written by the admin simulator a few times per second)
  const Live = {
    write(list) { try { localStorage.setItem(LIVE_KEY, JSON.stringify({ t: Date.now(), list })); } catch {} bus.post({ t: "live" }); },
    read() { try { const v = JSON.parse(localStorage.getItem(LIVE_KEY)); return v && Date.now() - v.t < 15000 ? v.list : []; } catch { return []; } },
  };

  // ---------------------------------------------------------------- session (prototype sign-in)
  const SESSION_KEY = "gari.session.v1";
  const Session = {
    get() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } },
    set(u) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch {} },
    clear() { try { localStorage.removeItem(SESSION_KEY); } catch {} },
  };
  function signIn(provider, name, extra = {}) {
    const id = provider === "guest" ? "guest" : `u_${provider}_${(name || "rider").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "").slice(0, 16) || "rider"}`;
    const user = { id, name: name || "Rider", provider, joinedAt: Clock.now(), ...extra };
    Store.update((db) => { db.users[id] = { ...(db.users[id] || {}), ...user, payment: db.users[id]?.payment || null }; Store.log("POST", `/auth/${provider}`, { id, name: user.name }); });
    Session.set({ id, name: user.name, provider });
    return user;
  }

  // ---------------------------------------------------------------- ride API (what the app calls)
  const uid = () => "r_" + Math.random().toString(36).slice(2, 10);
  const LIVE_STATES = ["reserved", "riding", "locked"];
  const API = {
    activeRideFor(userId) { return Store.get().rides.find((r) => r.userId === userId && LIVE_STATES.includes(r.status)) || null; },
    reserve(user, bikeId, from) {
      return Store.update((db) => {
        const b = db.bikes[bikeId]; if (!b || b.status !== "available") throw new Error("bike_taken");
        const s = db.settings, now = Clock.now();
        const r = { id: uid(), userId: user.id, userName: user.name, bikeId, sim: false, status: "reserved", reservedAt: now, holdUntil: now + s.holdMin * 60000,
          startSpot: b.spot, from: from ? [from.lat, from.lng] : null, fees: { reserve: s.reserveFee, unlock: 0, time: 0, total: s.reserveFee }, route: [], events: [] };
        b.status = "reserved"; b.rideId = r.id; db.rides.push(r);
        Store.log("POST", "/rides", { bikeId, reserve: true, fee: s.reserveFee, userId: user.id });
        return r;
      });
    },
    cancel(rideId) {
      return Store.update((db) => {
        const r = db.rides.find((x) => x.id === rideId); if (!r) return;
        r.status = "cancelled"; r.endedAt = Clock.now();
        const b = db.bikes[r.bikeId]; if (b && b.rideId === r.id) { b.status = "available"; b.rideId = null; }
        Store.log("POST", `/rides/${rideId}/cancel`, { fee: r.fees.total });
      });
    },
    // open the smart lock (only the app can do this). Creates the ride if there was no booking.
    unlock(user, bikeId, rideId) {
      return Store.update((db) => {
        const s = db.settings, now = Clock.now(), b = db.bikes[bikeId];
        let r = rideId ? db.rides.find((x) => x.id === rideId) : null;
        if (!r) {
          if (!b || b.status !== "available") throw new Error("bike_taken");
          r = { id: uid(), userId: user.id, userName: user.name, bikeId, sim: false, startSpot: b.spot, fees: { reserve: 0, unlock: 0, time: 0, total: 0 }, route: [], events: [] };
          db.rides.push(r);
        }
        r.status = "riding"; r.unlockedAt = now; r.fees.unlock = s.unlockFee; r.fees.total = +(r.fees.reserve + s.unlockFee).toFixed(3);
        r.route = [[b.lat, b.lng, now]];
        b.status = "in_use"; b.lock = "unlocked"; b.rideId = r.id;
        Store.log("POST", `/rides/${r.id}/unlock`, { bikeId, lock: "unlocked", fee: s.unlockFee });
        return r;
      });
    },
    track(rideId, pts) { // append GPS points (batched)
      return Store.update((db) => {
        const r = db.rides.find((x) => x.id === rideId); if (!r) return;
        r.route.push(...pts);
        const b = db.bikes[r.bikeId], last = pts[pts.length - 1]; if (b && last) { b.lat = last[0]; b.lng = last[1]; }
      }, { silent: true });
    },
    // close the smart lock from the app. The meter keeps running until a photo is verified.
    lock(rideId, at) {
      return Store.update((db) => {
        const r = db.rides.find((x) => x.id === rideId); if (!r) return;
        const b = db.bikes[r.bikeId];
        r.status = "locked"; r.lockedAt = Clock.now(); r.lockAt = at ? [at.lat, at.lng] : null;
        if (b) { b.lock = "locked"; if (at) { b.lat = at.lat; b.lng = at.lng; } }
        Store.log("POST", `/rides/${rideId}/lock`, { lock: "locked", at: r.lockAt, meter: "running" });
        return r;
      });
    },
    unlockAgain(rideId) { // rider wants to keep riding after locking (photo not done yet)
      return Store.update((db) => {
        const r = db.rides.find((x) => x.id === rideId); if (!r) return;
        r.status = "riding"; const b = db.bikes[r.bikeId]; if (b) b.lock = "unlocked";
        Store.log("POST", `/rides/${rideId}/unlock`, { reopen: true });
        return r;
      });
    },
    photoAttempt(rideId, analysis, thumb) {
      return Store.update((db) => {
        const r = db.rides.find((x) => x.id === rideId); if (!r) return;
        r.attempts = (r.attempts || 0) + 1;
        r.photo = { thumb, analysis, at: Clock.now() };
        Store.log("POST", `/rides/${rideId}/photo`, { verdict: analysis.verdict, engine: analysis.engine, checks: analysis.checks.map((c) => [c.id, c.status]) });
        return r;
      });
    },
    // photo accepted: stop the meter, charge, free the bike at its new spot
    complete(rideId, payMethod) {
      return Store.update((db) => {
        const r = db.rides.find((x) => x.id === rideId); if (!r) return;
        const s = db.settings, now = Clock.now();
        const sec = Math.round((now - r.unlockedAt) / 1000), fee = rideFee(s, sec);
        const end = r.lockAt ? { lat: r.lockAt[0], lng: r.lockAt[1] } : (() => { const p = r.route[r.route.length - 1]; return { lat: p[0], lng: p[1] }; })();
        const ns = nearestSpot(end);
        r.status = "completed"; r.verifiedAt = now; r.endedAt = now; r.rideSec = sec;
        r.fees = { reserve: r.fees.reserve, unlock: fee.unlock, time: fee.time, total: +(r.fees.reserve + fee.unlock + fee.time).toFixed(3) };
        r.distanceM = Math.round(routeLen(r.route)); r.endSpot = ns.spot?.id; r.endDistM = Math.round(ns.d);
        r.payment = payMethod ? { method: payMethod, status: "paid", ref: "TX" + Math.random().toString(36).slice(2, 8).toUpperCase(), at: now } : { status: "pending" };
        const b = db.bikes[r.bikeId];
        if (b) { b.status = "available"; b.lock = "locked"; b.rideId = null; b.lat = end.lat; b.lng = end.lng; b.spot = ns.spot?.id; b.rides = (b.rides || 0) + 1; b.battery = Math.max(8, b.battery - Math.round(sec / 900)); }
        Store.log("POST", `/rides/${rideId}/complete`, { rideSec: sec, total: r.fees.total, meter: "stopped" });
        return r;
      });
    },
    markPaid(rideId, method) {
      return Store.update((db) => {
        const r = db.rides.find((x) => x.id === rideId); if (!r) return;
        r.payment = { method, status: "paid", ref: "TX" + Math.random().toString(36).slice(2, 8).toUpperCase(), at: Clock.now() };
        Store.log("POST", `/payments`, { rideId, method, amount: r.fees.total, ref: r.payment.ref });
        return r;
      });
    },
    rate(rideId, stars) { Store.update((db) => { const r = db.rides.find((x) => x.id === rideId); if (r) r.rating = stars; }); },
    expireHolds() { // release bookings that ran out
      const now = Clock.now(), db = Store.get();
      if (!db.rides.some((r) => r.status === "reserved" && r.holdUntil < now)) return;
      Store.update((db) => db.rides.forEach((r) => {
        if (r.status === "reserved" && r.holdUntil < now) { r.status = "expired"; r.endedAt = now; const b = db.bikes[r.bikeId]; if (b && b.rideId === r.id) { b.status = "available"; b.rideId = null; } }
      }));
    },
  };
  function routeLen(route) { let m = 0; for (let i = 1; i < route.length; i++) m += distM({ lat: route[i - 1][0], lng: route[i - 1][1] }, { lat: route[i][0], lng: route[i][1] }); return m; }

  Object.assign(G, { KD, rideFee, distM, SPOTS, spotName, nearestSpot, Clock, Store, Live, Session, signIn, API, routeLen,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, DEFAULT_SETTINGS });
  Clock.load(); Store.reload();
})();
