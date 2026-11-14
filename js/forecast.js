/* Gari AI forecast: predicts bike demand per parking zone and road congestion on the main streets.
 *
 * Prototype model (runs in the browser, no server):
 *   demand(zone, t) = base hourly profile (weekday / weekend, Kuwait time)
 *                     x zone character (parks busy in the evening, squares and the waterfront at weekends)
 *                     x weather factor (summer midday heat, dust, rain)
 *                     x event boost (scenario set in the admin simulator)
 *                     x learned correction from the rides actually observed in the last 3 hours
 *   traffic(street, t) = rush-hour profile x street weight (downtown and ring roads) x weather.
 * The learned correction is an exponentially-weighted ratio of observed / predicted starts per zone,
 * so the forecast adapts as the simulator (or real riders) generate rides.
 */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const G = window.Gari;
  const H = 3600000;
  const kwHour = (t) => (((t / H) + 3) % 24 + 24) % 24;                 // Asia/Kuwait = UTC+3, no DST
  const kwDay = (t) => new Date(t + 3 * H).getUTCDay();                  // 5 = Friday, 6 = Saturday
  const isWeekend = (t) => { const d = kwDay(t); return d === 5 || d === 6; };
  const smooth = (pts, h) => { // piecewise-linear profile over 24h
    for (let i = 1; i < pts.length; i++) if (h <= pts[i][0]) { const [h0, v0] = pts[i - 1], [h1, v1] = pts[i]; return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0); }
    return pts[pts.length - 1][1];
  };
  // rides started per hour across the whole fleet at demand level 1
  const WEEKDAY = [[0, 4], [2, 2], [5, 3], [6.5, 12], [7.5, 18], [9, 10], [12, 8], [14, 7], [16.5, 16], [18, 26], [20, 28], [22, 18], [24, 4]];
  const WEEKEND = [[0, 10], [3, 4], [7, 4], [9, 8], [12, 10], [15, 12], [17, 24], [19.5, 34], [22, 30], [24, 10]];
  const TRAFFIC_WD = [[0, .12], [5.5, .15], [6.5, .55], [7.3, .92], [8.5, .7], [10, .45], [12.5, .6], [13.8, .82], [15, .55], [16.5, .62], [18, .85], [20, .7], [22, .45], [24, .12]];
  const TRAFFIC_WE = [[0, .3], [3, .12], [9, .2], [12, .35], [16, .5], [19, .78], [22, .7], [24, .3]];

  const WEATHER = {
    clear: { label: ["صحو", "Clear"], f: (h) => 1 },
    hot:   { label: ["حر شديد", "Very hot"], f: (h) => (h > 10 && h < 17 ? 0.35 : 0.9) },
    dusty: { label: ["غبار", "Dusty"], f: () => 0.5 },
    rain:  { label: ["مطر", "Rain"], f: () => 0.55 },
    cool:  { label: ["جو حلو", "Nice & cool"], f: () => 1.3 },
  };
  const EVENTS = {
    none:     { label: ["بدون", "None"] },
    shaheed:  { label: ["فعالية بحديقة الشهيد", "Festival at Al-Shaheed Park"], spot: "P12", from: 16, to: 23, boost: 3.2 },
    towers:   { label: ["احتفال عند أبراج الكويت", "Celebration at Kuwait Towers"], spot: "P01", from: 17, to: 24, boost: 3.6 },
    seif:     { label: ["مهرجان ساحة السيف", "Al-Seif Square festival"], spot: "P17", from: 15, to: 22, boost: 2.8 },
  };

  // zone character: share of city demand by time band
  function zoneWeight(spot, h, weekend) {
    const evening = h >= 16 && h <= 23;
    let w = 1;
    if (spot.kind === "park") w *= evening ? 1.35 : 0.8;
    if (spot.kind === "square") w *= weekend ? 1.5 : (h >= 6 && h <= 9) || (h >= 13 && h <= 15) ? 1.6 : 1.05;
    if (spot.kind === "bicycle_parking") w *= weekend ? 2.1 : 1.3; // waterfront
    if (spot.id === "P12" || spot.id === "P16") w *= 1.25;           // Al-Shaheed Park, Green Island
    return w;
  }
  const totalW = (h, we) => G.SPOTS.reduce((a, s) => a + zoneWeight(s, h, we), 0);

  // learned correction (observed vs predicted starts, last 3h)
  let learned = { at: 0, k: {} };
  function learn(t) {
    if (Math.abs(t - learned.at) < 5 * 60000) return learned.k;
    const rides = G.Store.get().rides, k = {};
    const obs = {}; for (const r of rides) { const t0 = r.unlockedAt || r.reservedAt; if (t0 && t0 > t - 3 * H && t0 <= t && r.startSpot) obs[r.startSpot] = (obs[r.startSpot] || 0) + 1; }
    for (const s of G.SPOTS) {
      let pred = 0; for (let m = 0; m < 3; m++) pred += base(s, t - (m + 0.5) * H);
      const o = obs[s.id] || 0;
      k[s.id] = Math.max(0.6, Math.min(1.7, (o + 2) / (pred + 2)));
    }
    learned = { at: t, k };
    return k;
  }
  function base(spot, t) {
    const sim = G.Store.get().sim || {}, h = kwHour(t), we = isWeekend(t);
    const city = smooth(we ? WEEKEND : WEEKDAY, h) * (sim.demand || 1) * (WEATHER[sim.weather] || WEATHER.clear).f(h);
    let v = (city * zoneWeight(spot, h, we)) / totalW(h, we);
    const ev = EVENTS[sim.event];
    if (ev && ev.spot === spot.id && h >= ev.from && h < ev.to) v *= ev.boost;
    return v;
  }
  // expected ride starts per hour at a zone at time t
  function demand(spot, t) { return base(spot, t) * (learn(G.Clock.now())[spot.id] || 1); }
  function cityDemand(t) { return G.SPOTS.reduce((a, s) => a + demand(s, t), 0); }

  // road congestion 0..1 for a major-street polyline
  const DOWNTOWN = { lat: 29.373, lng: 47.985 };
  function traffic(pts, i, t) {
    const sim = G.Store.get().sim || {}, h = kwHour(t), we = isWeekend(t);
    let v = smooth(we ? TRAFFIC_WE : TRAFFIC_WD, h);
    const mid = pts[Math.floor(pts.length / 2)];
    const dd = G.distM({ lat: mid[0], lng: mid[1] }, DOWNTOWN);
    v *= 0.75 + 0.45 * Math.max(0, 1 - dd / 6000);                  // busier near downtown
    v *= 0.8 + 0.4 * (((i * 2654435761) >>> 0) % 1000) / 1000;      // fixed per-street character
    if (sim.weather === "rain") v *= 1.3;
    if (sim.weather === "dusty") v *= 1.1;
    const ev = EVENTS[sim.event];
    if (ev && ev.spot && h >= ev.from - 1 && h < ev.to) { const sp = G.SPOTS.find((s) => s.id === ev.spot); if (sp && G.distM({ lat: mid[0], lng: mid[1] }, sp) < 2500) v *= 1.35; }
    return Math.max(0, Math.min(1, v));
  }
  function trafficLevel(t) { // overall city level
    const h = kwHour(t), we = isWeekend(t), sim = G.Store.get().sim || {};
    let v = smooth(we ? TRAFFIC_WE : TRAFFIC_WD, h) * (sim.weather === "rain" ? 1.3 : 1);
    return Math.max(0, Math.min(1, v));
  }

  // supply vs predicted demand per zone for the next `hours`
  function zoneOutlook(t, hours = 2) {
    const db = G.Store.get(), bikes = Object.values(db.bikes);
    return G.SPOTS.map((s) => {
      let need = 0; for (let m = 0; m < hours * 2; m++) need += demand(s, t + (m + 0.5) * H / 2) / 2;
      const avail = bikes.filter((b) => b.status === "available" && G.distM(b, s) <= db.settings.parkRadiusM * 1.6).length;
      const ratio = need / Math.max(0.5, avail);
      const level = ratio > 1.2 ? "high" : ratio > 0.6 ? "medium" : "low";
      return { spot: s, need, avail, ratio, level };
    });
  }
  // admin: rebalancing moves from surplus zones to shortage zones
  function rebalance(t) {
    const z = zoneOutlook(t, 3);
    const short = z.filter((x) => x.need - x.avail > 0.5).sort((a, b) => (b.need - b.avail) - (a.need - a.avail));
    const extra = z.filter((x) => x.avail - x.need > 1.5).sort((a, b) => (b.avail - b.need) - (a.avail - a.need));
    const moves = [];
    for (const s of short) {
      const src = extra.filter((e) => e.avail - e.need > 1.5).sort((a, b) => G.distM(a.spot, s.spot) - G.distM(b.spot, s.spot))[0];
      if (!src) break;
      const n = Math.max(1, Math.min(Math.round(s.need - s.avail), Math.floor(src.avail - src.need - 1)));
      if (n <= 0) continue;
      moves.push({ from: src.spot, to: s.spot, n }); src.avail -= n;
      if (moves.length >= 5) break;
    }
    return moves;
  }
  // rider tip: the quietest hour to ride in the next 6h (by traffic)
  function bestTime(t) {
    let best = t, bv = Infinity; const t0 = Math.ceil(t / (H / 2)) * (H / 2);
    for (let m = 0; m <= 12; m++) { const tt = m === 0 ? t : t0 + (m - 1) * H / 2; const v = trafficLevel(tt); if (v < bv - 0.02) { bv = v; best = tt; } }
    return { t: best, level: bv };
  }

  G.Forecast = { demand, cityDemand, traffic, trafficLevel, zoneOutlook, rebalance, bestTime, kwHour, isWeekend, WEATHER, EVENTS };
})();
