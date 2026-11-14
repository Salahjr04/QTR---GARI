/* Gari router: shortest bike route over real OpenStreetMap streets (graph.js).
 * A* on a compact graph (~13k junctions). Motorways and trunk roads are excluded at build time;
 * big roads cost more, cycleways and quiet streets cost less.
 */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const GR = window.Gari.GRAPH;
  if (!GR) return;
  const NN = GR.nodes.length / 2;
  const lat = new Float64Array(NN), lng = new Float64Array(NN);
  { let a = 0, b = 0; for (let i = 0; i < NN; i++) { a += GR.nodes[2 * i]; b += GR.nodes[2 * i + 1]; lat[i] = a / 1e5; lng[i] = b / 1e5; } }
  const KX = 111320 * Math.cos((29.35 * Math.PI) / 180), KY = 110574;
  const dist = (i, j) => Math.hypot((lat[i] - lat[j]) * KY, (lng[i] - lng[j]) * KX);

  // edges -> adjacency (each entry: neighbour, edge index, forward?)
  const E = GR.edges, edges = [];
  const adj = Array.from({ length: NN }, () => []);
  for (let p = 0; p < E.length;) {
    const a = E[p], b = E[p + 1], len = E[p + 2], flags = E[p + 3], n = E[p + 4];
    const mids = []; let la = Math.round(lat[a] * 1e5), lo = Math.round(lng[a] * 1e5);
    for (let k = 0; k < n; k++) { la += E[p + 5 + 2 * k]; lo += E[p + 6 + 2 * k]; mids.push([la / 1e5, lo / 1e5]); }
    const cost = len * ((flags >> 1) / 10), oneway = flags & 1;
    const id = edges.length; edges.push({ a, b, len, cost, mids });
    adj[a].push(b, id, 1);
    adj[b].push(a, id, oneway ? 0 : 2); // against a one-way: allowed (walk the bike) but costs 4x
    p += 5 + 2 * n;
  }

  // grid index for nearest-junction lookups
  const CELL = 0.004, grid = new Map();
  const key = (la, lo) => `${Math.floor(la / CELL)},${Math.floor(lo / CELL)}`;
  for (let i = 0; i < NN; i++) { const k = key(lat[i], lng[i]); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  function nearestNode(p) {
    let best = -1, bd = Infinity;
    for (let r = 0; r < 6 && best < 0; r++) {
      const cy = Math.floor(p.lat / CELL), cx = Math.floor(p.lng / CELL);
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        for (const i of grid.get(`${y},${x}`) || []) {
          const d = Math.hypot((lat[i] - p.lat) * KY, (lng[i] - p.lng) * KX);
          if (d < bd) { bd = d; best = i; }
        }
      }
    }
    return best < 0 ? null : { i: best, d: bd, lat: lat[best], lng: lng[best] };
  }

  // binary heap A*
  function astar(s, t) {
    const g = new Float64Array(NN).fill(Infinity), from = new Int32Array(NN).fill(-1), via = new Int32Array(NN).fill(-1), fwd = new Int8Array(NN);
    const heap = [], push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    g[s] = 0; push(dist(s, t) * 0.7, s);
    while (heap.length) {
      const [, u] = pop();
      if (u === t) break;
      const A = adj[u];
      for (let k = 0; k < A.length; k += 3) {
        const v = A[k], e = edges[A[k + 1]], nd = g[u] + (A[k + 2] === 0 ? e.cost * 4 : e.cost);
        if (nd < g[v]) { g[v] = nd; from[v] = u; via[v] = A[k + 1]; fwd[v] = A[k + 2] === 1 ? 1 : 0; push(nd + dist(v, t) * 0.7, v); }
      }
    }
    if (from[t] < 0 && s !== t) return null;
    const pts = [[lat[t], lng[t]]];
    for (let v = t; v !== s; v = from[v]) {
      const e = edges[via[v]], mids = fwd[v] ? e.mids.slice().reverse() : e.mids;
      for (const m of mids) pts.push(m);
      pts.push([lat[from[v]], lng[from[v]]]);
    }
    return pts.reverse();
  }

  const M = (a, b) => Math.hypot((a[0] - b[0]) * KY, (a[1] - b[1]) * KX);
  // route between two map points; returns { points: [[lat,lng]...], meters }
  function route(a, b) {
    const na = nearestNode(a), nb = nearestNode(b);
    if (!na || !nb) return null;
    const mid = astar(na.i, nb.i);
    if (!mid) return null;
    const points = [[a.lat, a.lng], ...mid, [b.lat, b.lng]];
    let meters = 0; for (let i = 1; i < points.length; i++) meters += M(points[i - 1], points[i]);
    return { points, meters };
  }
  // a point `m` metres along a polyline (used to move simulated riders)
  function along(points, m) {
    for (let i = 1; i < points.length; i++) {
      const d = M(points[i - 1], points[i]);
      if (m <= d) { const k = d ? m / d : 0; return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k, i]; }
      m -= d;
    }
    const l = points[points.length - 1]; return [l[0], l[1], points.length - 1];
  }
  Object.assign(window.Gari, { route, along, nearestNode });
})();
