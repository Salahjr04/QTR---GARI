/* Gari base map (adapted from the `gari` branch of Iron-Reins).
 * Draws the Capital Governorate (Kuwait) as vectors from the embedded OpenStreetMap data in streets.js:
 * sea, land, parks, minor / mid / major streets, plus area names in Arabic and English.
 * No tile server is needed, so the map works offline and inside sandboxes. Colors follow the theme tokens.
 * Outside the capital, Kuwait's coastline is approximate (Natural Earth, public domain).
 */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const KUWAIT = [[[29.99476,47.94708],[29.885,47.97948],[29.78031,48.02268],[29.74316,48.08028],[29.60132,48.16308],[29.54222,48.17748],[29.55404,48.11268],[29.58443,48.02268],[29.55404,47.93628],[29.50169,47.84988],[29.4122,47.76348],[29.36323,47.70588],[29.36829,47.76348],[29.38687,47.83908],[29.36323,47.82108],[29.3379,47.81748],[29.3227,47.85708],[29.33452,47.90028],[29.36,47.928],[29.37,47.953],[29.382,47.981],[29.3905,48.002],[29.38,48.012],[29.356,48.0255],[29.34296,48.06228],[29.34972,48.10188],[29.25854,48.09468],[29.17411,48.12708],[29.01707,48.15948],[28.91744,48.22428],[28.8938,48.27828],[28.78573,48.31428],[28.74352,48.39348],[28.5392,48.43308],[28.53414,47.66988],[28.69117,47.55828],[28.90393,47.49347],[29.0711,46.75547],[29.09643,46.53227],[29.36323,46.77347],[29.61989,46.95707],[29.77186,47.02547],[30.0032,47.14427],[30.09776,47.41427],[30.08932,47.73108],[29.99476,47.94708]]];
  // [arabic, english, lat, lng] (approximate centres)
  const AREAS = [
    ["الشرق", "Sharq", 29.3815, 47.9915], ["القبلة", "Qibla", 29.3705, 47.9660], ["المرقاب", "Mirqab", 29.3640, 47.9790],
    ["دسمان", "Dasman", 29.3850, 48.0040], ["الدسمة", "Dasma", 29.3625, 48.0080], ["بنيد القار", "Bneid Al-Gar", 29.3735, 48.0110],
    ["الدعية", "Daiya", 29.3565, 48.0075], ["المنصورية", "Mansouriya", 29.3555, 47.9880], ["القادسية", "Qadsiya", 29.3470, 48.0010],
    ["الفيحاء", "Faiha", 29.3410, 47.9790], ["النزهة", "Nuzha", 29.3405, 47.9935], ["كيفان", "Kaifan", 29.3355, 47.9560],
    ["الشامية", "Shamiya", 29.3480, 47.9660], ["الشويخ", "Shuwaikh", 29.3505, 47.9470], ["الروضة", "Rawda", 29.3300, 47.9930],
    ["العديلية", "Adailiya", 29.3255, 47.9810], ["الخالدية", "Khaldiya", 29.3240, 47.9645], ["اليرموك", "Yarmouk", 29.3125, 47.9555],
    ["قرطبة", "Qurtuba", 29.3110, 47.9790], ["السرة", "Surra", 29.3135, 48.0020],
  ];
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const dec = (a) => { const out = []; let la = 0, ln = 0; for (let i = 0; i < a.length; i += 2) { la += a[i]; ln += a[i + 1]; out.push([la / 1e5, ln / 1e5]); } return out; };
  window.Gari.decodeLine = dec;
  window.Gari.AREAS = AREAS;

  window.Gari.addBaseMap = function (map) {
    const pane = map.createPane("land"); pane.style.zIndex = 150;
    const traffic = map.createPane("traffic"); traffic.style.zIndex = 160; traffic.style.pointerEvents = "none";
    const labels = map.createPane("areas"); labels.style.zIndex = 390; labels.style.pointerEvents = "none";
    const r = L.canvas({ padding: 0.3, pane: "land" });
    const styled = [];
    const add = (layer, fn) => { layer.setStyle(fn()); styled.push([layer, fn]); return layer; };
    add(L.polygon(KUWAIT, { renderer: r, pane: "land", weight: 1, fillOpacity: 1, interactive: false }), () => ({ color: css("--coast"), fillColor: css("--land") })).addTo(map);
    const ST = window.Gari.STREETS;
    let lines = [];
    if (ST) {
      add(L.polygon(ST.sea.map((p) => p.map(dec)), { renderer: r, pane: "land", stroke: false, fillOpacity: 1, interactive: false }), () => ({ fillColor: css("--sea") })).addTo(map);
      add(L.polygon(ST.land.map((p) => p.map(dec)), { renderer: r, pane: "land", weight: 1.2, fillOpacity: 1, interactive: false }), () => ({ color: css("--coast"), fillColor: css("--land") })).addTo(map);
      add(L.polygon(ST.parks.map(dec), { renderer: r, pane: "land", stroke: false, fillOpacity: 1, interactive: false }), () => ({ fillColor: css("--park") })).addTo(map);
      const line = (arr, w, tok) => add(L.polyline(arr.map(dec), { renderer: r, pane: "land", interactive: false, lineCap: "round", lineJoin: "round" }), () => ({ weight: w(), color: css(tok) }));
      const z = () => map.getZoom();
      const minorCase = line(ST.roads.minor, () => (z() >= 16 ? 5 : 3.6), "--road-casing");
      const minor = line(ST.roads.minor, () => (z() >= 16 ? 3.4 : z() >= 15 ? 2.4 : 1.6), "--road");
      const midCase = line(ST.roads.mid, () => (z() >= 15 ? 6.5 : 4.4), "--road-casing");
      const mid = line(ST.roads.mid, () => (z() >= 15 ? 4.5 : 2.8), "--road");
      const majCase = line(ST.roads.major, () => (z() >= 15 ? 9.5 : 6.5), "--road-major-casing");
      const maj = line(ST.roads.major, () => (z() >= 15 ? 7 : 4.4), "--road-major");
      lines = [minorCase, minor, midCase, mid, majCase, maj];
      const byZoom = () => {
        const want = z() >= 15 ? lines : z() >= 14 ? [minor, midCase, mid, majCase, maj] : z() >= 13 ? [midCase, mid, majCase, maj] : [majCase, maj];
        lines.forEach((l) => { const on = want.includes(l); if (on && !map.hasLayer(l)) l.addTo(map); if (!on && map.hasLayer(l)) l.remove(); });
        [minorCase, midCase, majCase, minor, mid, maj].forEach((l) => { if (map.hasLayer(l)) { l.setStyle({ weight: styled.find((s) => s[0] === l)[1]().weight }); l.bringToFront(); } });
      };
      map.on("zoomend", byZoom); byZoom();
      map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>');
    }

    const group = L.layerGroup().addTo(map);
    const drawLabels = () => {
      group.clearLayers();
      const en = document.documentElement.lang === "en";
      AREAS.forEach(([ar, e, lat, lng]) => L.marker([lat, lng], { pane: "areas", interactive: false, keyboard: false,
        icon: L.divIcon({ className: "area-label", html: en ? e : ar, iconSize: [110, 16], iconAnchor: [55, 8] }) }).addTo(group));
    };
    drawLabels();
    const toggleLabels = () => map.getContainer().classList.toggle("hide-areas", map.getZoom() < 13 || map.getZoom() > 16);
    map.on("zoomend", toggleLabels); toggleLabels();

    const recolor = () => styled.forEach(([l, fn]) => l.setStyle(fn()));
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", recolor);
    new MutationObserver(() => { recolor(); drawLabels(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "lang"] });

    // ---- AI traffic layer: major streets coloured by predicted congestion ----
    let trafficLayer = null;
    const majorSegs = ST ? ST.roads.major.map(dec) : [];
    return {
      recolor,
      setTraffic(fn) { // fn(points, index) -> 0..1 congestion, or null to hide
        if (trafficLayer) { trafficLayer.remove(); trafficLayer = null; }
        if (!fn) return;
        const tr = L.canvas({ padding: 0.3, pane: "traffic" });
        trafficLayer = L.layerGroup(majorSegs.map((pts, i) => {
          const v = fn(pts, i);
          const color = v > 0.72 ? css("--bad") : v > 0.45 ? css("--warn") : css("--good");
          return L.polyline(pts, { renderer: tr, pane: "traffic", interactive: false, weight: map.getZoom() >= 15 ? 4 : map.getZoom() >= 13 ? 3 : 2, color, opacity: 0.85, lineCap: "round" });
        })).addTo(map);
      },
    };
  };
})();
