/* Gari simulator (runs inside the admin page).
 * Spawns simulated riders from the AI demand forecast, moves them along real streets, locks the bike,
 * "takes" an end-of-ride photo (some fail and retry), stops the meter and charges them, all on the
 * shared simulation clock. At speed ×30 one real second is 30 simulated seconds.
 */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const G = window.Gari;
  const NAMES = ["عبدالله", "فهد", "نورة", "سارة", "محمد", "دانة", "يوسف", "مريم", "خالد", "حصة", "بدر", "لولوة", "Ahmad", "Fatma", "Omar", "Jana", "Hamad", "Shahad", "Ali", "Rawan"];
  const PAY = ["applepay", "knet", "visa", "knet", "applepay"];
  const active = new Map(); // rideId -> runtime state
  const log = [];
  let timer = 0, lastReal = 0, lastLive = 0, lastBeat = 0;
  const listeners = new Set();
  const emit = (e) => { log.unshift({ t: G.Clock.now(), ...e }); if (log.length > 120) log.pop(); listeners.forEach((f) => f(e)); };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const S = () => G.Store.get().sim;

  function options() { return { failRate: 0.15, offZoneRate: 0.1, maxRiders: 40, ...(S().opts || {}) }; }

  function start() {
    G.Store.update((db) => { db.sim.running = true; });
    adoptOrphans();
    if (!timer) { lastReal = performance.now(); timer = setInterval(tick, 250); }
    emit({ k: "start" });
  }
  function stop() {
    G.Store.update((db) => { db.sim.running = false; });
    clearInterval(timer); timer = 0; G.Live.write([]);
    emit({ k: "stop" });
  }
  // rides left "in progress" from an earlier session: finish them where the bike is
  function adoptOrphans() {
    const db = G.Store.get();
    const orphans = db.rides.filter((r) => r.sim && ["riding", "locked"].includes(r.status) && !active.has(r.id));
    if (!orphans.length) return;
    G.Store.update((db) => orphans.forEach((o) => {
      const r = db.rides.find((x) => x.id === o.id), b = db.bikes[r.bikeId]; if (!r) return;
      const now = G.Clock.now(), sec = Math.max(60, Math.round((now - r.unlockedAt) / 1000)), f = G.rideFee(db.settings, Math.min(sec, 3600));
      r.status = "completed"; r.endedAt = r.verifiedAt = now; r.rideSec = Math.min(sec, 3600); r.fees = { reserve: 0, unlock: f.unlock, time: f.time, total: +(f.unlock + f.time).toFixed(3) };
      r.payment = { method: "knet", status: "paid", ref: "SIM" }; r.note = "auto-closed";
      if (b) { b.status = "available"; b.lock = "locked"; b.rideId = null; }
    }));
  }

  function spawn(spot, now) {
    const db = G.Store.get();
    const bikes = Object.values(db.bikes).filter((b) => b.status === "available" && G.distM(b, spot) <= db.settings.parkRadiusM * 1.6);
    if (!bikes.length) { emit({ k: "missed", spot: spot.id }); return; } // demand with no bike = lost ride
    const bike = pick(bikes);
    // destination: another zone, preferring short local trips (about 0.8–2.5 km); a route may use main
    // roads only to cross between blocks (≤ 30% of its length), otherwise try another destination
    const cands = G.SPOTS.filter((s) => s.id !== spot.id).map((s) => ({ s, d: G.distM(spot, s) }));
    const w = cands.map((c) => Math.exp(-Math.abs(c.d - 1500) / 900));
    let dest = null, rt = null, end = null;
    const offZone = Math.random() < options().offZoneRate;
    for (let tries = 0; tries < 4 && !rt; tries++) {
      let x = Math.random() * w.reduce((a, b) => a + b, 0), d = cands[0].s;
      for (let i = 0; i < cands.length; i++) { x -= w[i]; if (x <= 0) { d = cands[i].s; break; } }
      let e = { lat: d.lat + (Math.random() - 0.5) * 0.0004, lng: d.lng + (Math.random() - 0.5) * 0.0004 };
      if (offZone) { const n = G.nearestNode({ lat: d.lat + 0.0016, lng: d.lng + 0.0012 }); if (n) e = { lat: n.lat, lng: n.lng }; } // stops on a real street, outside the zone
      const r = G.route ? G.route(bike, e) : null;
      if (r && r.mainM / Math.max(1, r.meters) <= 0.3) { dest = d; rt = r; end = e; }
    }
    if (!rt) return;
    const name = pick(NAMES), id = "s_" + Math.random().toString(36).slice(2, 9), userId = "sim_" + name;
    G.Store.update((db) => {
      const b = db.bikes[bike.id]; if (b.status !== "available") return;
      const reserved = Math.random() < 0.3;
      db.rides.push({ id, userId, userName: name, bikeId: bike.id, sim: true, status: "riding", reservedAt: reserved ? now - 6 * 60000 : undefined, unlockedAt: now, startSpot: spot.id,
        fees: { reserve: reserved ? db.settings.reserveFee : 0, unlock: db.settings.unlockFee, time: 0, total: 0 }, route: [[bike.lat, bike.lng, now]] });
      b.status = "in_use"; b.lock = "unlocked"; b.rideId = id;
      G.Store.log("POST", `/rides/${id}/unlock`, { bikeId: bike.id, sim: true });
    }, { silent: true });
    active.set(id, { id, bikeId: bike.id, pts: rt.points, len: rt.meters, m: 0, speed: 3.4 + Math.random() * 2, phase: "riding", dest, offZone, lastPt: 0, route: [] });
    emit({ k: "unlock", id, name, bike: bike.id, from: spot.id, to: dest.id });
  }

  function tick() {
    const nowR = performance.now(), dtReal = Math.min(1, (nowR - lastReal) / 1000); lastReal = nowR;
    const sp = G.Clock.speed, dt = dtReal * sp, now = G.Clock.now();
    let dirty = false;
    // spawn from the forecast (Poisson per zone)
    if (active.size < options().maxRiders) for (const s of G.SPOTS) {
      const rate = G.Forecast.demand(s, now) / 3600; // starts per second
      if (Math.random() < 1 - Math.exp(-rate * dt)) { spawn(s, now); dirty = true; }
    }
    for (const a of active.values()) {
      if (a.phase === "riding") {
        a.m += a.speed * dt;
        const [la, ln] = G.along(a.pts, a.m); a.pos = [la, ln];
        if (now - a.lastPt > 20000) { a.route.push([+la.toFixed(5), +ln.toFixed(5), Math.round(now)]); a.lastPt = now; }
        if (a.m >= a.len) {
          a.phase = "locked"; a.next = now + (20 + Math.random() * 60) * 1000;
          G.Store.update((db) => { const r = db.rides.find((x) => x.id === a.id); if (!r) return; r.route.push(...a.route); a.route = []; r.status = "locked"; r.lockedAt = now; r.lockAt = [la, ln]; const b = db.bikes[a.bikeId]; b.lock = "locked"; b.lat = la; b.lng = ln; G.Store.log("POST", `/rides/${a.id}/lock`, { sim: true }); }, { silent: true });
          emit({ k: "lock", id: a.id }); dirty = true;
        }
      } else if (a.phase === "locked" && now >= a.next) {
        // the photo: zone check is real (GPS); the image verdict is drawn from the configured fail rate
        const zone = G.nearestSpot({ lat: a.pos[0], lng: a.pos[1] }), inZone = zone.d <= G.Store.get().settings.parkRadiusM;
        const imgFail = Math.random() < options().failRate;
        const verdict = !inZone || imgFail ? "fail" : Math.random() < 0.08 ? "review" : "pass";
        const reason = !inZone ? "zone" : imgFail ? pick(["blurry", "lock", "dark", "onwheel"]) : null;
        G.Store.update((db) => {
          const r = db.rides.find((x) => x.id === a.id); if (!r) return;
          r.attempts = (r.attempts || 0) + 1;
          r.photo = { thumb: null, at: now, analysis: { engine: "sim", verdict, checks: [{ id: "quality", status: reason === "blurry" || reason === "dark" ? "fail" : "pass" }, { id: "lock", status: reason === "lock" ? "fail" : "pass" }, { id: "onwheel", status: reason === "onwheel" ? "fail" : "pass" }, { id: "zone", status: inZone ? "pass" : "fail", detail: Math.round(zone.d) }] } };
          G.Store.log("POST", `/rides/${a.id}/photo`, { verdict, sim: true });
        }, { silent: true });
        emit({ k: "photo", id: a.id, verdict, reason });
        if (verdict === "fail") {
          if (!inZone) { // ride on to the zone, then try again
            const rt = G.route({ lat: a.pos[0], lng: a.pos[1] }, zone.spot);
            a.pts = rt ? rt.points : [a.pos, [zone.spot.lat, zone.spot.lng]]; a.len = rt ? rt.meters : zone.d; a.m = 0; a.phase = "riding";
            G.Store.update((db) => { const r = db.rides.find((x) => x.id === a.id); if (r) r.status = "riding"; const b = db.bikes[a.bikeId]; if (b) b.lock = "unlocked"; }, { silent: true });
          } else a.next = now + (30 + Math.random() * 40) * 1000;
        } else {
          G.Store.update((db) => {
            const r = db.rides.find((x) => x.id === a.id); if (!r) return;
            const sec = Math.round((now - r.unlockedAt) / 1000), f = G.rideFee(db.settings, sec), b = db.bikes[a.bikeId];
            r.status = "completed"; r.verifiedAt = r.endedAt = now; r.rideSec = sec;
            r.fees = { reserve: r.fees.reserve, unlock: f.unlock, time: f.time, total: +(r.fees.reserve + f.unlock + f.time).toFixed(3) };
            r.distanceM = Math.round(G.routeLen(r.route)); r.endSpot = zone.spot.id; r.endDistM = Math.round(zone.d);
            r.payment = { method: pick(PAY), status: "paid", ref: "TX" + Math.random().toString(36).slice(2, 8).toUpperCase(), at: now };
            if (b) { b.status = "available"; b.lock = "locked"; b.rideId = null; b.lat = a.pos[0]; b.lng = a.pos[1]; b.spot = zone.spot.id; b.rides = (b.rides || 0) + 1; b.battery = Math.max(8, b.battery - Math.max(1, Math.round(sec / 900))); }
            G.Store.log("POST", `/rides/${a.id}/complete`, { total: r.fees.total, sim: true });
          }, { silent: true });
          active.delete(a.id); emit({ k: "done", id: a.id }); dirty = true;
        }
      }
    }
    if (dirty || nowR - lastBeat > 3000) { lastBeat = nowR; G.Store.update(() => {}); } // one broadcast for the batch
    if (nowR - lastLive > 400) { lastLive = nowR; G.Live.write([...active.values()].filter((a) => a.phase === "riding" && a.pos).map((a) => [a.bikeId, a.pos[0], a.pos[1]])); }
  }

  // rebalancing: move n available bikes between zones (a service van in real life)
  function moveBikes(from, to, n) {
    G.Store.update((db) => {
      const pool = Object.values(db.bikes).filter((b) => b.status === "available" && G.distM(b, from) <= db.settings.parkRadiusM * 1.6).slice(0, n);
      pool.forEach((b, i) => { const a = i * 2.1 + 0.5; b.lat = to.lat + Math.sin(a) * 0.00012; b.lng = to.lng + Math.cos(a) * 0.00012; b.spot = to.id; });
      G.Store.log("POST", "/ops/rebalance", { from: from.id, to: to.id, n: pool.length });
    });
  }

  // fill today (Kuwait time, midnight → now) with completed example rides drawn from the forecast
  function seedHistory() {
    const now = G.Clock.now(), k = now + 3 * 3600000, d0 = k - (k % 86400000) - 3 * 3600000;
    const out = [];
    for (let t = d0; t < now - 20 * 60000; t += 15 * 60000) {
      for (const s of G.SPOTS) {
        const n = G.Forecast.demand(s, t) / 4; let c = 0; for (let x = Math.random(); x < n; x += Math.random() * 1.2 + 0.4) c++;
        for (let i = 0; i < c && out.length < 260; i++) out.push({ t: t + Math.random() * 15 * 60000, s });
      }
    }
    G.Store.update((db) => {
      for (const { t, s } of out) {
        const cands = G.SPOTS.filter((x) => x.id !== s.id && G.distM(s, x) < 3000), dest = cands[Math.floor(Math.random() * cands.length)];
        if (!dest) continue;
        const rt = G.route(s, dest); if (!rt || rt.mainM / Math.max(1, rt.meters) > 0.3) continue;
        const speed = 3.4 + Math.random() * 2, sec = Math.round(rt.meters / speed + 60 + Math.random() * 90), f = G.rideFee(db.settings, sec);
        const route = rt.points.filter((_, i) => i % 4 === 0).map((p, i, arr) => [+p[0].toFixed(5), +p[1].toFixed(5), Math.round(t + (sec * 1000 * i) / arr.length)]);
        const fail = Math.random() < 0.12, reserved = Math.random() < 0.3, name = pick(NAMES);
        db.rides.push({ id: "h_" + Math.random().toString(36).slice(2, 9), userId: "sim_" + name, userName: name, bikeId: pick(Object.keys(db.bikes)), sim: true, example: true,
          status: "completed", reservedAt: reserved ? t - 5 * 60000 : undefined, unlockedAt: t, lockedAt: t + sec * 1000 - 60000, verifiedAt: t + sec * 1000, endedAt: t + sec * 1000, rideSec: sec,
          startSpot: s.id, endSpot: dest.id, distanceM: Math.round(rt.meters), route, attempts: fail ? 2 : 1,
          fees: { reserve: reserved ? db.settings.reserveFee : 0, unlock: f.unlock, time: f.time, total: +((reserved ? db.settings.reserveFee : 0) + f.unlock + f.time).toFixed(3) },
          photo: { thumb: null, at: t + sec * 1000, analysis: { engine: "sim", verdict: Math.random() < 0.06 ? "review" : "pass", checks: [{ id: "quality", status: "pass" }, { id: "lock", status: "pass" }, { id: "onwheel", status: "pass" }, { id: "zone", status: "pass" }] } },
          payment: { method: pick(PAY), status: "paid", ref: "TX" + Math.random().toString(36).slice(2, 8).toUpperCase(), at: t + sec * 1000 } });
      }
      db.rides.sort((x, y) => (x.unlockedAt || x.reservedAt || 0) - (y.unlockedAt || y.reservedAt || 0));
      db.seeded = true;
      G.Store.log("POST", "/ops/seed-history", { rides: out.length });
    });
    emit({ k: "seed", n: out.length });
    return out.length;
  }

  G.Sim = { seedHistory, start, stop, running: () => !!timer, active: () => [...active.values()], log, on: (f) => (listeners.add(f), () => listeners.delete(f)), moveBikes, options, NAMES };
})();
