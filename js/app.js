/* Gari rider app: sign in → map with the nearest bike → reserve (if far) → unlock in the app →
 * ride (simulated GPS along real streets) → lock in the app → photo checked by AI → meter stops → pay → receipt. */
(() => {
  "use strict";
  const G = window.Gari, { I, $, esc, toast, modal } = G.UI, t = (...a) => G.t(...a);
  const S = () => G.Store.get().settings;
  const CAPITAL = L.latLngBounds([29.285, 47.90], [29.405, 48.06]);
  const DEFAULT_ME = { lat: 29.3446, lng: 47.9742 };

  const st = {
    user: null, me: loadMe(), selected: null, ride: null, receipt: null,
    walk: null, move: null, dest: null, ai: false, aiOffsetH: 0, pendingPts: [],
  };
  function loadMe() { try { return JSON.parse(localStorage.getItem("gari.me")) || { ...DEFAULT_ME }; } catch { return { ...DEFAULT_ME }; } }
  function saveMe() { try { localStorage.setItem("gari.me", JSON.stringify(st.me)); } catch {} }

  // ------------------------------------------------------------------ boot
  function i18nStatic(root = document) { root.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t))); }
  function boot() {
    i18nStatic();
    const sess = G.Session.get();
    setTimeout(() => {
      $("#splash").classList.add("hide"); setTimeout(() => $("#splash").remove(), 500);
      if (sess) { st.user = sess; startApp(); } else showAuth();
    }, 1100);
  }

  // ------------------------------------------------------------------ auth
  function showAuth() {
    $("#auth").hidden = false; $("#app").hidden = true;
    const paint = () => { i18nStatic($("#auth")); $("#authLang").textContent = G.getLang() === "ar" ? "English" : "العربية"; $("#authTheme").innerHTML = themeIcon(); };
    paint();
    $("#authLang").onclick = () => { G.setLang(G.getLang() === "ar" ? "en" : "ar"); paint(); };
    $("#authTheme").onclick = () => { cycleTheme(); paint(); };
    document.querySelectorAll("[data-legal]").forEach((b) => (b.onclick = () => showLegal(b.dataset.legal)));
    const consentOk = () => { const ok = $("#c18").checked && $("#cHelmet").checked; $("#consentErr").textContent = ok ? "" : t("needConsent"); if (!ok) $(".consent").classList.add("shake"), setTimeout(() => $(".consent").classList.remove("shake"), 400); return ok; };
    document.querySelectorAll("[data-sso]").forEach((b) => (b.onclick = () => {
      if (!consentOk()) return;
      const p = b.dataset.sso, name = p === "apple" ? "Apple ID" : "Google";
      b.innerHTML = `<span class="spinner dark"></span>`;
      setTimeout(() => { toast(t("providerSoon", { p: p === "apple" ? "Apple" : "Google" })); finishAuth(G.signIn(p, G.getLang() === "ar" ? "مستخدم " + name : name + " user")); }, 900);
    }));
    $("#authForm").onsubmit = (e) => {
      e.preventDefault(); const u = $("#authUser").value.trim(), p = $("#authPass").value;
      const err = !u ? t("needUser") : p.length < 4 ? t("needPass") : "";
      $("#authErr").textContent = err; if (err || !consentOk()) return;
      finishAuth(G.signIn("password", u));
    };
    $("#authSkip").onclick = () => consentOk() && finishAuth(G.signIn("guest", t("guest")));
  }
  function showLegal(k) {
    modal.open(`<div class="modal-head"><h3>${t(k === "terms" ? "termsT" : "privacyT")}</h3><button class="icon-btn" data-close>${I.x}</button></div><div class="legal-body">${t(k === "terms" ? "termsBody" : "privacyBody")}</div>`);
  }
  function finishAuth(user) {
    st.user = G.Session.get();
    $("#auth").classList.add("leave");
    setTimeout(() => { $("#auth").hidden = true; $("#auth").classList.remove("leave"); startApp(); toast(t("welcome", { name: user.name })); }, 260);
  }
  const themeIcon = () => (G.getTheme() === "dark" ? I.moon : G.getTheme() === "light" ? I.sun : `<span class="auto-ico">A</span>`);
  function cycleTheme() { const order = ["auto", "light", "dark"]; G.setTheme(order[(order.indexOf(G.getTheme()) + 1) % 3]); }

  // ------------------------------------------------------------------ map
  let map, base, zonesLayer, bikesLayer, liveLayer, meMarker, pathLine, trailLine, demandLayer, destMarker;
  function startApp() {
    $("#app").hidden = false;
    if (map) { refreshAll(); return; }
    map = L.map("map", { zoomControl: false, minZoom: 12, maxZoom: 18, maxBounds: CAPITAL.pad(0.4), maxBoundsViscosity: 0.8, preferCanvas: false, attributionControl: true })
      .setView([st.me.lat, st.me.lng], 15);
    map.attributionControl.setPrefix(false);
    base = G.addBaseMap(map);
    const zp = map.createPane("zones"); zp.style.zIndex = 380;
    zonesLayer = L.layerGroup().addTo(map); demandLayer = L.layerGroup().addTo(map); liveLayer = L.layerGroup().addTo(map); bikesLayer = L.layerGroup().addTo(map);
    meMarker = L.marker([st.me.lat, st.me.lng], { icon: L.divIcon({ className: "me-ico", html: "<i></i>", iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 900, keyboard: false }).addTo(map);
    map.on("contextmenu", (e) => { if (st.ride && st.ride.status !== "reserved") return; setMe(e.latlng.lat, e.latlng.lng); toast(t("locSet")); render(); });
    map.on("click", () => { if (st.selected && !st.ride) { st.selected = null; render(); } });

    $("#menuBtn").onclick = openDrawer;
    $("#locateBtn").onclick = locate;
    $("#aiBtn").onclick = () => { st.ai = !st.ai; $("#aiBtn").setAttribute("aria-pressed", st.ai); drawAI(); };
    $("#photoInput").onchange = onPhoto;

    G.on((what) => {
      if (what === "clock") { updateSimBadge(); return; }
      if (what === "live") { drawLive(); return; }
      if (what === "db") { syncRide(); drawBikes(); if (!st.walk && !st.move) render(); }
    });
    const sheet = $("#sheet");
    new ResizeObserver(() => document.documentElement.style.setProperty("--sheet-h", sheet.offsetHeight + "px")).observe(sheet);
    syncRide(); drawZones(); drawBikes(); drawLive(); updateSimBadge(); render(true);
    setInterval(tick, 200);
    setInterval(() => { G.API.expireHolds(); if (st.ai) drawAI(); }, 4000);
  }
  function refreshAll() { i18nStatic(); drawZones(); drawBikes(); render(); }
  function setMe(lat, lng) { st.me = { lat, lng }; meMarker.setLatLng([lat, lng]); saveMe(); }
  function locate() {
    if (!navigator.geolocation) return map.flyTo([st.me.lat, st.me.lng], 16);
    navigator.geolocation.getCurrentPosition((p) => {
      const ll = L.latLng(p.coords.latitude, p.coords.longitude);
      if (CAPITAL.contains(ll) && !st.ride) { setMe(ll.lat, ll.lng); render(); }
      map.flyTo([st.me.lat, st.me.lng], 16, { duration: 0.8 });
    }, () => map.flyTo([st.me.lat, st.me.lng], 16, { duration: 0.8 }), { timeout: 4000, maximumAge: 60000 });
  }
  function updateSimBadge() { const sp = G.Clock.speed, b = $("#simBadge"); b.hidden = sp === 1; b.innerHTML = `${I.clock}<span>${t("simBadge", { n: sp })} · ${G.hhmm(G.Clock.now())}</span>`; }

  function drawZones() {
    zonesLayer.clearLayers();
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    for (const s of G.SPOTS) {
      L.circle([s.lat, s.lng], { radius: S().parkRadiusM, color: css("--brand"), weight: 1.5, dashArray: "4 5", fillColor: css("--brand"), fillOpacity: 0.07, interactive: false, pane: "zones" }).addTo(zonesLayer);
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "zone-ico", html: "P", iconSize: [18, 18], iconAnchor: [9, 9] }), keyboard: false, pane: "zones", zIndexOffset: -500 })
        .on("click", (e) => { L.DomEvent.stop(e); if (st.ride?.status === "riding") setDest(s); else toast(`${t("parkingZone")} · ${G.spotName(s)}`); })
        .addTo(zonesLayer);
    }
  }

  // bikes available to this rider (plus the one in their ride)
  function bikesList() {
    const db = G.Store.get();
    return Object.values(db.bikes).filter((b) => b.status === "available" || (st.ride && b.id === st.ride.bikeId));
  }
  function nearestBikes(n = 1) { return bikesList().filter((b) => b.status === "available").map((b) => ({ b, d: G.distM(st.me, b) })).sort((a, b) => a.d - b.d).slice(0, n); }
  function drawBikes() {
    if (!bikesLayer) return;
    bikesLayer.clearLayers();
    const near = nearestBikes(1)[0]?.b.id;
    for (const b of bikesList()) {
      const mine = st.ride && b.id === st.ride.bikeId;
      if (mine && st.ride.status !== "reserved") continue; // shown by the rider marker
      const cls = ["bike-ico", b.id === near && !st.ride ? "nearest" : "", b.id === st.selected ? "sel" : "", mine ? "mine" : ""].join(" ");
      L.marker([b.lat, b.lng], { icon: L.divIcon({ className: cls, html: `<span>${I.bike}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: b.id === near ? 500 : 0, keyboard: false })
        .on("click", (e) => { L.DomEvent.stop(e); if (st.ride) return; st.selected = b.id; drawBikes(); render(); })
        .addTo(bikesLayer);
    }
  }
  function drawLive() {
    if (!liveLayer) return;
    liveLayer.clearLayers();
    for (const [id, lat, lng] of G.Live.read()) L.marker([lat, lng], { icon: L.divIcon({ className: "live-ico", html: "", iconSize: [12, 12], iconAnchor: [6, 6] }), interactive: false, keyboard: false }).addTo(liveLayer);
  }
  function setPath(points, kind) {
    if (pathLine) { pathLine.remove(); pathLine = null; }
    if (!points) return;
    pathLine = L.polyline(points, { className: "path-" + kind, weight: kind === "walk" ? 4 : 5, dashArray: kind === "walk" ? "1 8" : null, lineCap: "round", interactive: false }).addTo(map);
  }

  // ------------------------------------------------------------------ ride state
  function syncRide() {
    if (!st.user) return;
    const r = G.API.activeRideFor(st.user.id);
    if (st.ride && !r && !st.receipt) {
      const old = G.Store.get().rides.find((x) => x.id === st.ride.id);
      if (old?.status === "expired") toast(t("resExpired"), "warn");
      st.walk = null; st.move = null; setPath(null);
    }
    st.ride = r;
  }

  // ------------------------------------------------------------------ sheet rendering
  function render(first) {
    const body = $("#sheetBody"); if (!body) return;
    let html = "";
    if (st.receipt) html = receiptView();
    else if (!st.ride) html = browseView();
    else if (st.ride.status === "reserved") html = reservedView();
    else if (st.ride.status === "riding") html = ridingView();
    else if (st.ride.status === "locked") html = lockedView();
    body.innerHTML = html;
    bindSheet(body);
    if (first && !st.ride) { const n = nearestBikes(1)[0]; if (n) map.fitBounds(L.latLngBounds([[st.me.lat, st.me.lng], [n.b.lat, n.b.lng]]).pad(0.6), { maxZoom: 16, paddingBottomRight: [0, 200] }); }
  }

  // movement speed for the demo: speeds up the shared simulation clock (walking, riding and the meter)
  const speedCtl = () => `<div class="simspeed"><span>${I.clock}${t("simSpeed")}</span><div class="seg mini" role="group">${[1, 2, 10, 30].map((x) => `<button data-spd="${x}" class="num ${G.Clock.speed === x ? "on" : ""}">×${x}</button>`).join("")}</div></div>
      <p class="sim-note">${t("simNote")}</p>`;
  const fmtMin = (m) => Math.max(1, Math.round(m / 80)); // walking ~80 m/min
  function browseView() {
    const s = S();
    let b, d;
    if (st.selected) { b = G.Store.get().bikes[st.selected]; d = b ? G.distM(st.me, b) : 0; if (!b || b.status !== "available") st.selected = null; }
    if (!st.selected) { const n = nearestBikes(1)[0]; if (!n) return `<div class="empty">${I.bike}<p>${t("noBikes")}</p></div>`; b = n.b; d = n.d; }
    const near = d <= s.nearM, spot = G.SPOTS.find((x) => x.id === b.spot);
    if (st.walk) return `<div class="sheet-head"><span class="eyebrow">${I.walk}${t("walking")}</span><span class="chip num">${b.id}</span></div>
      <div class="stat-row"><div class="stat"><small>${t("distance")}</small><b class="num" data-live="walkb">${G.dist(d)}</b></div></div>${speedCtl()}`;
    const bat = b.battery;
    return `
      <div class="sheet-head">
        <span class="eyebrow">${st.selected ? t("bike") : t("nearest")}</span>
        <button class="link-btn" data-act="pricing">${I.tag}<span>${t("pricing")}</span></button>
      </div>
      <div class="bike-card">
        <div class="bike-thumb">${I.bike}</div>
        <div class="bike-info">
          <div class="bike-id num">${b.id}</div>
          <div class="bike-sub">${esc(G.spotName(spot) || t("parkingZone"))}</div>
          <div class="bike-meta">
            <span class="chip brand">${I.walk}<span class="num">${t("walk", { n: fmtMin(d) })}</span></span>
            <span class="chip">${I.pin}<span class="num">${G.dist(d)}</span></span>
            <span class="chip ${bat < 25 ? "warn" : ""}" title="${t("battery")}">${I.battery}<span class="num">${bat}%</span></span>
          </div>
        </div>
      </div>
      <p class="hint-line">${near ? I.check : I.info}<span>${near ? t("nearHint") : t("farHint", { n: s.holdMin })}</span></p>
      ${near
        ? `<button class="btn btn-primary btn-block big" data-act="unlock" data-bike="${b.id}">${I.unlock}<span>${t("unlockApp")}</span></button>`
        : `<button class="btn btn-primary btn-block big" data-act="reserve" data-bike="${b.id}">${I.lock}<span>${t("reserve", { fee: G.money(s.reserveFee) })}</span></button>
           <button class="btn btn-ghost btn-block" data-act="walknobook" data-bike="${b.id}">${I.walk}<span>${t("navigate")}</span></button>`}
      <p class="price-line num">${t("priceLine", { unlock: G.money(s.unlockFee), block: G.money(s.blockFee), m: s.blockMin })}</p>`;
  }
  function reservedView() {
    const r = st.ride, b = G.Store.get().bikes[r.bikeId], d = G.distM(st.me, b), at = d <= 30;
    return `
      <div class="sheet-head"><span class="eyebrow good">${I.lock}${t("reservedTitle")}</span><span class="chip num">${b.id}</span></div>
      <div class="stat-row">
        <div class="stat"><small>${t("holdLeft")}</small><b class="num" data-live="hold">--:--</b></div>
        <div class="stat"><small>${t("distance")}</small><b class="num" data-live="walkd">${G.dist(d)}</b></div>
        <div class="stat"><small>${t("reserveFee")}</small><b class="num">${G.money(r.fees.reserve)}</b></div>
      </div>
      ${at ? `<button class="btn btn-primary btn-block big" data-act="unlock" data-bike="${b.id}">${I.unlock}<span>${t("unlockApp")}</span></button>`
           : st.walk ? `<button class="btn btn-secondary btn-block big" disabled><span class="spinner dark"></span><span>${t("walking")}</span></button>`
           : `<button class="btn btn-primary btn-block big" data-act="walk">${I.walk}<span>${t("walkThere")}</span></button>
              <button class="btn btn-ghost btn-block" data-act="imhere">${t("imHere")}</button>`}
      ${speedCtl()}
      <button class="btn btn-ghost btn-block danger-text" data-act="cancelres">${t("cancelRes")}</button>`;
  }
  function ridingView() {
    const s = S();
    const dests = G.SPOTS.map((sp) => ({ sp, d: G.distM(st.me, sp) })).sort((a, b) => a.d - b.d).slice(0, 6);
    const ns = G.nearestSpot(st.me), inZone = ns.d <= s.parkRadiusM;
    return `
      <div class="sheet-head"><span class="eyebrow good"><i class="live-dot"></i>${t("riding")}</span><span class="chip num">${st.ride.bikeId}</span></div>
      <div class="stat-row four">
        <div class="stat"><small>${t("time")}</small><b class="num" data-live="time">0:00</b></div>
        <div class="stat"><small>${t("cost")} <span class="unit">${t("kd")}</span></small><b class="num" data-live="costn">-</b></div>
        <div class="stat"><small>${t("distance")}</small><b class="num" data-live="dist">0 m</b></div>
        <div class="stat"><small>${t("speed")} <span class="unit">${t("kmh")}</span></small><b class="num" data-live="speed">0</b></div>
      </div>
      <div class="dest">
        <div class="dest-title">${I.pin}<span>${st.dest ? t("rideTo", { name: esc(G.spotName(st.dest)) }) : t("destination")}</span></div>
        ${st.dest ? "" : `<div class="dest-list">${dests.map(({ sp, d }) => `<button class="dest-btn" data-dest="${sp.id}"><b>${esc(G.spotName(sp))}</b><small class="num">${G.dist(d)}</small></button>`).join("")}</div>`}
      </div>
      ${!inZone && !st.move ? `<p class="hint-line warn">${I.warn}<span>${t("outOfZone", { d: G.dist(ns.d) })}</span></p>` : ""}
      <button class="hold-btn" data-act="hold" ${st.move ? "disabled" : ""}><span class="hold-fill"></span>${I.lock}<span>${t("holdToLock")}</span></button>
      <p class="price-line">${I.bluetooth}<span>${t("lockOnlyApp")}</span></p>
      ${speedCtl()}`;
  }
  function lockedView() {
    return `
      <div class="sheet-head"><span class="eyebrow">${I.lock}${t("lockedTitle")}</span><span class="chip num">${st.ride.bikeId}</span></div>
      <div class="meter-warn">${I.clock}<div><b>${t("meterRunning")}</b><div class="stat-inline num"><span data-live="time">0:00</span> · <span data-live="cost">-</span></div></div></div>
      <div class="photo-guide">
        <svg viewBox="0 0 160 90" class="guide-art" aria-hidden="true"><rect x="2" y="2" width="156" height="86" rx="12" fill="none" stroke="currentColor" stroke-dasharray="5 5" opacity=".5"/><circle cx="48" cy="58" r="20" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="112" cy="58" r="20" fill="none" stroke="currentColor" stroke-width="4"/><path d="M48 58l20-28h26l18 28M68 58L80 30" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><rect x="34" y="28" width="24" height="14" rx="5" fill="var(--brand)"/></svg>
        <p>${t("photoHint")}</p>
      </div>
      <button class="btn btn-primary btn-block big" data-act="photo">${I.camera}<span>${t("takePhoto")}</span></button>
      <button class="btn btn-ghost btn-block" data-act="reopen">${t("reopen")}</button>`;
  }
  function receiptView() {
    const r = G.Store.get().rides.find((x) => x.id === st.receipt); if (!r) { st.receipt = null; return browseView(); }
    const s = S(), sp = G.SPOTS.find((x) => x.id === r.endSpot), f = r.fees, blocks = Math.round(f.time / s.blockFee);
    return `
      <div class="receipt">
        <div class="receipt-top"><div class="ok-badge">${I.check}</div><h2>${t("receipt")}</h2><p class="muted">${t("thanks")}</p></div>
        <div class="stat-row">
          <div class="stat"><small>${t("time")}</small><b class="num">${G.clock(r.rideSec * 1000)}</b></div>
          <div class="stat"><small>${t("distance")}</small><b class="num">${G.dist(r.distanceM || 0)}</b></div>
          <div class="stat"><small>${t("parkedAt")}</small><b class="small">${esc(G.spotName(sp))}</b></div>
        </div>
        <div class="bill">
          ${f.reserve ? `<div><span>${t("reserveFee")}</span><span class="num">${G.money(f.reserve)}</span></div>` : ""}
          <div><span>${t("unlockFee")}</span><span class="num">${G.money(f.unlock)}</span></div>
          <div><span>${t("timeFee", { n: blocks, m: s.blockMin })}</span><span class="num">${G.money(f.time)}</span></div>
          <div class="tot"><span>${t("total")}</span><span class="num">${G.money(f.total)}</span></div>
          <div class="paid-by">${G.UI.METHOD_ICON[r.payment?.method] || ""}<span>${t("paid")} · <span class="num">${r.payment?.ref || ""}</span></span></div>
        </div>
        <div class="rate"><span>${t("rate")}</span><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${(r.rating || 0) >= n ? "on" : ""}" aria-label="${n}">${I.star}</button>`).join("")}</div></div>
        <button class="btn btn-primary btn-block big" data-act="done">${t("done")}</button>
      </div>`;
  }

  function bindSheet(body) {
    body.querySelectorAll("[data-act]").forEach((el) => {
      const a = el.dataset.act;
      if (a === "hold") return bindHold(el);
      el.onclick = () => actions[a]?.(el.dataset);
    });
    body.querySelectorAll("[data-dest]").forEach((el) => (el.onclick = () => setDest(G.SPOTS.find((s) => s.id === el.dataset.dest))));
    body.querySelectorAll("[data-spd]").forEach((el) => (el.onclick = () => { G.Clock.setSpeed(+el.dataset.spd); updateSimBadge(); render(); }));
    body.querySelectorAll("[data-star]").forEach((el) => (el.onclick = () => { G.API.rate(st.receipt, +el.dataset.star); render(); }));
    tick();
  }

  // ------------------------------------------------------------------ actions
  async function ensurePayment() { return G.UI.getPM(st.user) || (await G.UI.choosePayment(st.user)); }
  const actions = {
    pricing: showPricing,
    async reserve({ bike }) {
      if (!(await ensurePayment())) return toast(t("payFirst"), "warn");
      try { st.ride = G.API.reserve(st.user, bike, st.me); } catch { toast(t("bikeTaken"), "warn"); return render(); }
      st.selected = null; drawBikes(); showWalkPath(); render();
    },
    walknobook({ bike }) { st.selected = bike; const b = G.Store.get().bikes[bike]; startWalk(b); },
    walk() { startWalk(G.Store.get().bikes[st.ride.bikeId]); },
    imhere() { const b = G.Store.get().bikes[st.ride.bikeId]; setMe(b.lat + 0.00008, b.lng); setPath(null); render(); },
    cancelres() {
      const b = modal.open(`<div class="modal-head"><h3>${t("cancelRes")}</h3><span></span></div><p>${t("cancelResQ")}</p><div class="row2"><button class="btn btn-secondary" data-close>${t("back")}</button><button class="btn btn-danger" id="yesCancel">${t("cancelRes")}</button></div>`);
      $("#yesCancel", b).onclick = () => { G.API.cancel(st.ride.id); st.ride = null; st.walk = null; setPath(null); modal.close(); toast(t("resCancelled")); drawBikes(); render(); };
    },
    async unlock({ bike }) {
      if (!(await ensurePayment())) return toast(t("payFirst"), "warn");
      const ok = await bleSequence("unlock"); if (!ok) return;
      try { st.ride = G.API.unlock(st.user, bike, st.ride?.id); } catch { toast(t("bikeTaken"), "warn"); return render(); }
      st.selected = null; st.dest = null; st.walk = null; setPath(null);
      trailLine?.remove(); trailLine = L.polyline([[st.me.lat, st.me.lng]], { className: "path-trail", weight: 5, lineCap: "round", interactive: false }).addTo(map);
      drawBikes(); render();
      meMarker.setIcon(L.divIcon({ className: "me-ico riding", html: `<i>${I.bike}</i>`, iconSize: [36, 36], iconAnchor: [18, 18] }));
    },
    async reopen() { await bleSequence("unlock", true); G.API.unlockAgain(st.ride.id); syncRide(); render(); },
    photo() { $("#photoInput").value = ""; $("#photoInput").click(); },
    done() { st.receipt = null; trailLine?.remove(); trailLine = null; setPath(null); destMarker?.remove(); meMarker.setIcon(L.divIcon({ className: "me-ico", html: "<i></i>", iconSize: [22, 22], iconAnchor: [11, 11] })); drawBikes(); render(true); },
  };

  function showWalkPath() {
    const b = G.Store.get().bikes[st.ride?.bikeId || st.selected]; if (!b) return;
    const rt = G.route ? G.route(st.me, b) : null;
    setPath(rt ? rt.points : [[st.me.lat, st.me.lng], [b.lat, b.lng]], "walk");
    map.fitBounds(pathLine.getBounds().pad(0.35), { maxZoom: 17 });
  }
  function startWalk(b) {
    const rt = G.route ? G.route(st.me, b) : null;
    const pts = rt ? rt.points : [[st.me.lat, st.me.lng], [b.lat, b.lng]];
    setPath(pts, "walk"); map.fitBounds(pathLine.getBounds().pad(0.35), { maxZoom: 17 });
    st.walk = { pts, m: 0, len: rt ? rt.meters : G.distM(st.me, b), speed: 1.4 };
    render();
  }
  function setDest(sp) {
    st.dest = sp;
    const b = G.Store.get().bikes[st.ride.bikeId];
    const rt = G.route ? G.route(st.me, sp) : null;
    const pts = rt ? rt.points : [[st.me.lat, st.me.lng], [sp.lat, sp.lng]];
    setPath(pts, "ride");
    destMarker?.remove(); destMarker = L.marker([sp.lat, sp.lng], { icon: L.divIcon({ className: "dest-ico", html: I.pin, iconSize: [34, 34], iconAnchor: [17, 32] }), interactive: false }).addTo(map);
    map.fitBounds(pathLine.getBounds().pad(0.25), { maxZoom: 17 });
    st.move = { pts, m: 0, len: rt ? rt.meters : G.distM(st.me, sp), speed: 4.4, lastT: 0, lastPt: null, kmh: 0 };
    render();
  }

  // press-and-hold to lock
  function bindHold(el) {
    let raf = 0, t0 = 0;
    const fill = el.querySelector(".hold-fill");
    const stop = () => { cancelAnimationFrame(raf); el.classList.remove("holding"); fill.style.transform = "scaleX(0)"; };
    const step = () => { const k = Math.min(1, (performance.now() - t0) / 900); fill.style.transform = `scaleX(${k})`; if (k >= 1) { stop(); doLock(); } else raf = requestAnimationFrame(step); };
    el.onpointerdown = (e) => { if (el.disabled) return; e.preventDefault(); el.setPointerCapture?.(e.pointerId); t0 = performance.now(); el.classList.add("holding"); raf = requestAnimationFrame(step); navigator.vibrate?.(15); };
    el.onpointerup = el.onpointercancel = el.onpointerleave = stop;
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doLock(); } };
  }
  async function doLock() {
    const ok = await bleSequence("lock"); if (!ok) return;
    flushTrack();
    G.API.lock(st.ride.id, st.me); syncRide(); navigator.vibrate?.([20, 40, 20]); render();
    G.Vision.warmup?.().catch(() => {}); // load the on-device bike detector while the rider frames the photo
  }

  // Bluetooth smart-lock animation (simulated)
  function bleSequence(kind, quick) {
    return new Promise((resolve) => {
      const steps = kind === "unlock" ? [t("bleConnecting"), t("bleAuth"), t("bleOpen")] : [t("bleConnecting"), t("bleLocking"), t("bleLocked")];
      const b = modal.open(`<div class="ble">
        <div class="ble-lock ${kind}"><svg viewBox="0 0 64 64" width="88" height="88"><path class="shackle" d="M20 30V20a12 12 0 0 1 24 0v10" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><rect x="12" y="28" width="40" height="30" rx="9" fill="var(--brand)"/><circle cx="32" cy="43" r="4" fill="var(--brand-ink)"/></svg><span class="ble-waves"></span></div>
        <p class="ble-step" id="bleStep">${steps[0]}</p>
        ${kind === "unlock" && !quick ? `<p class="muted small num">${t("unlockFee")} · ${G.money(S().unlockFee)}</p><p class="helmet-note">${I.helmet}<span>${t("helmetReminder")}</span></p>` : ""}
      </div>`, { cls: "center-modal", onClose: () => resolve(false) });
      const box = b.querySelector(".ble-lock"), stepEl = $("#bleStep", b);
      setTimeout(() => (stepEl.textContent = steps[1]), 700);
      setTimeout(() => { stepEl.textContent = steps[2]; box.classList.add("done"); navigator.vibrate?.(30); }, 1450);
      setTimeout(() => { modal.onClose = null; modal.close(); resolve(true); }, 2200);
    });
  }

  // ------------------------------------------------------------------ photo → AI → meter stops → pay
  async function onPhoto(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    const order = ["quality", "bike", "lock", "onwheel", "upright", "lockstate", "zone"];
    const b = modal.open(`<div class="ai-check">
      <div class="ai-photo"><img src="${url}" alt=""><div class="scan"></div><svg class="ai-overlay" id="aiOv" viewBox="0 0 100 100" preserveAspectRatio="none"></svg></div>
      <div class="ai-status" id="aiStatus"><span class="spinner"></span><span>${t("analyzing")}</span></div>
      <ul class="checks" id="aiChecks"></ul>
      <div id="aiFoot"></div></div>`, { cls: "tall" });
    const ride = st.ride;
    const [res] = await Promise.all([G.Vision.analyze(file, { lockState: G.Store.get().bikes[ride.bikeId]?.lock, at: st.me }), new Promise((r) => setTimeout(r, 1300))]);
    const list = $("#aiChecks", b), checks = res.checks.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    for (const c of checks) {
      await new Promise((r) => setTimeout(r, 260));
      const detail = c.status === "pass" ? "" : c.id === "zone" ? t("d_m", { n: c.detail }) : c.status === "skip" ? "" : t("d_" + c.detail);
      list.insertAdjacentHTML("beforeend", `<li class="ck ${c.status}"><span class="ck-ico">${c.status === "pass" ? I.check : c.status === "fail" ? I.x : c.status === "warn" ? I.warn : "–"}</span><span>${t("ck_" + c.id)}</span>${detail ? `<small>${detail}</small>` : ""}</li>`);
    }
    // overlay: wheels and lock as the analyzer saw them
    const ov = $("#aiOv", b); let svg = "";
    for (const w of res.overlay.wheels) svg += `<ellipse cx="${w.x * 100}" cy="${w.y * 100}" rx="${w.r * 100}" ry="${(w.r * 100) / res.overlay.aspect}" class="ov-wheel"/>`;
    if (res.overlay.lock) { const [x, y, w, h] = res.overlay.lock; svg += `<rect x="${x * 100 - 1}" y="${y * 100 - 1}" width="${w * 100 + 2}" height="${h * 100 + 2}" rx="2" class="ov-lock"/>`; }
    ov.innerHTML = svg; b.querySelector(".scan").remove();
    G.API.photoAttempt(ride.id, res, res.thumb);
    const ok = res.verdict !== "fail";
    $("#aiStatus", b).className = "ai-status " + (ok ? (res.verdict === "pass" ? "good" : "warn") : "bad");
    $("#aiStatus", b).innerHTML = `${ok ? I.check : I.x}<div><b>${t(res.verdict === "pass" ? "vPass" : res.verdict === "review" ? "vReview" : "vFail")}</b><small>${t(res.verdict === "pass" ? "vPassSub" : res.verdict === "review" ? "vReviewSub" : "vFailSub")} · ${t(res.engine === "claude" ? "engineClaude" : "engineDevice")}</small></div>`;
    if (!ok) {
      const zoneFail = res.checks.find((c) => c.id === "zone" && c.status === "fail");
      $("#aiFoot", b).innerHTML = `<button class="btn btn-primary btn-block" id="retake">${I.camera}<span>${t("retake")}</span></button>${zoneFail ? `<button class="btn btn-ghost btn-block" id="goZone">${t("goNearestZone")}</button>` : ""}`;
      $("#retake", b).onclick = () => { modal.close(); actions.photo(); };
      if (zoneFail) $("#goZone", b).onclick = async () => { modal.close(); await actions.reopen(); setDest(G.nearestSpot(st.me).spot); };
      return;
    }
    // meter stops now
    const done = G.API.complete(ride.id);
    $("#aiFoot", b).innerHTML = `<div class="bill compact"><div class="tot"><span>${t("total")}</span><span class="num">${G.money(done.fees.total)}</span></div></div>
      <button class="btn btn-primary btn-block big" id="payBtn">${t("payNow", { total: G.money(done.fees.total) })}</button>
      <p class="pay-with">${t("paywith")} ${G.UI.METHOD_ICON[(G.UI.getPM(st.user) || { type: "applepay" }).type]}</p>`;
    $("#payBtn", b).onclick = async () => {
      modal.onClose = null; modal.close();
      await new Promise((r) => setTimeout(r, 220));
      let paid = false; while (!paid) paid = await G.UI.pay(st.user, done.fees.total);
      G.API.markPaid(ride.id, (G.UI.getPM(st.user) || { type: "applepay" }).type);
      st.receipt = ride.id; st.ride = null; st.move = null; st.dest = null; destMarker?.remove(); setPath(null);
      render();
      const rr = G.Store.get().rides.find((x) => x.id === ride.id);
      if (rr?.route?.length > 1) { trailLine?.setLatLngs(rr.route.map((p) => [p[0], p[1]])); map.fitBounds(trailLine.getBounds().pad(0.3), { maxZoom: 16, paddingBottomRight: [0, 260] }); }
    };
  }

  // ------------------------------------------------------------------ live loop
  let lastTick = performance.now(), lastTrack = 0;
  function tick() {
    const now = performance.now(), dt = Math.min(0.5, (now - lastTick) / 1000) * G.Clock.speed; lastTick = now;
    // walking simulation
    if (st.walk) {
      st.walk.m += st.walk.speed * dt;
      const [la, ln] = G.along(st.walk.pts, st.walk.m); setMe(la, ln);
      if (st.walk.m >= st.walk.len) { st.walk = null; setPath(null); if (!st.ride) { const b = G.Store.get().bikes[st.selected]; if (b) setMe(b.lat + 0.00006, b.lng); } render(); }
    }
    // riding simulation (GPS along the street route)
    if (st.move && st.ride?.status === "riding") {
      st.move.m += st.move.speed * dt;
      const [la, ln] = G.along(st.move.pts, st.move.m); setMe(la, ln);
      trailLine?.addLatLng([la, ln]);
      const tnow = G.Clock.now();
      st.pendingPts.push([+la.toFixed(6), +ln.toFixed(6), Math.round(tnow)]);
      st.move.kmh = dt > 0 ? st.move.speed * 3.6 * (0.9 + Math.random() * 0.2) : 0;
      if (now - lastTrack > 2000) { lastTrack = now; flushTrack(); }
      if (!map.getBounds().pad(-0.25).contains([la, ln])) map.panTo([la, ln], { animate: true });
      if (st.move.m >= st.move.len) { st.move = null; flushTrack(); setPath(null); destMarker?.remove(); render(); }
    }
    // live numbers in the sheet
    const r = st.ride;
    document.querySelectorAll("[data-live]").forEach((el) => {
      const k = el.dataset.live;
      if (k === "hold" && r?.holdUntil) { const left = r.holdUntil - G.Clock.now(); el.textContent = G.clock(left); el.classList.toggle("warn-text", left < 3 * 60000); }
      if (k === "walkb" && st.selected) el.textContent = G.dist(G.distM(st.me, G.Store.get().bikes[st.selected]));
      if (k === "walkd" && r) el.textContent = G.dist(G.distM(st.me, G.Store.get().bikes[r.bikeId]));
      if ((k === "time" || k === "cost" || k === "costn") && r?.unlockedAt) {
        const ms = G.Clock.now() - r.unlockedAt;
        if (k === "time") el.textContent = G.clock(ms);
        else { const f = G.rideFee(S(), ms / 1000), v = r.fees.reserve + f.unlock + f.time; el.textContent = k === "cost" ? G.money(v) : G.KD(v); }
      }
      if (k === "dist" && r) el.textContent = G.dist(G.routeLen(r.route || []) + G.routeLen(st.pendingPts));
      if (k === "speed") el.textContent = Math.round(st.move?.kmh || 0);
    });
    if (G.Clock.speed !== 1) { const b = $("#simBadge span"); if (b) b.textContent = `${t("simBadge", { n: G.Clock.speed })} · ${G.hhmm(G.Clock.now())}`; }
  }
  function flushTrack() { if (st.pendingPts.length && st.ride) { const pts = st.pendingPts; st.pendingPts = []; G.API.track(st.ride.id, pts); const r = G.Store.get().rides.find((x) => x.id === st.ride.id); if (r) st.ride = r; } }

  // ------------------------------------------------------------------ AI forecast layer
  function drawAI() {
    $("#aiCard").hidden = !st.ai;
    demandLayer.clearLayers();
    if (!st.ai) { base.setTraffic(null); return; }
    const tt = G.Clock.now() + st.aiOffsetH * 3600000;
    base.setTraffic((pts, i) => G.Forecast.traffic(pts, i, tt));
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const outlook = G.Forecast.zoneOutlook(tt, 2);
    for (const z of outlook) {
      const col = z.level === "high" ? css("--bad") : z.level === "medium" ? css("--warn") : css("--good");
      L.circle([z.spot.lat, z.spot.lng], { radius: 100 + Math.min(160, z.need * 40), stroke: false, fillColor: col, fillOpacity: 0.18, interactive: false }).addTo(demandLayer);
    }
    const lvl = G.Forecast.trafficLevel(tt), lk = lvl > 0.7 ? "high" : lvl > 0.42 ? "medium" : "low";
    const best = G.Forecast.bestTime(G.Clock.now());
    const near = outlook.map((z) => ({ ...z, d: G.distM(st.me, z.spot) })).sort((a, b) => a.d - b.d)[0];
    const risk = outlook.filter((z) => G.distM(st.me, z.spot) < 3000 && z.level === "high").sort((a, b) => b.ratio - a.ratio)[0];
    const chip = (k) => `<span class="chip ${k === "high" ? "bad" : k === "medium" ? "warn" : "good"}">${t(k)}</span>`;
    $("#aiCard").innerHTML = `
      <div class="ai-head">${I.spark}<b>${t("aiTitle")}</b><span class="muted small num">${G.hhmm(tt)}</span></div>
      <div class="ai-row"><span>${t("trafficNow")}</span>${chip(lk)}</div>
      <div class="ai-row"><span>${t("demandHere")}</span>${chip(near.level)}</div>
      <div class="ai-row"><span>${t("bestTime")}</span><b class="num">${G.hhmm(best.t)}</b></div>
      ${risk ? `<p class="ai-warn">${I.warn}<span>${t("mayRunOut", { name: esc(G.spotName(risk.spot)) })}</span></p>` : ""}
      <div class="seg" role="group">${[0, 1, 2, 3].map((h) => `<button data-h="${h}" class="${st.aiOffsetH === h ? "on" : ""}">${h ? t("plus", { n: h }) : t("now")}</button>`).join("")}</div>
      <div class="ai-legend"><span><i class="lg good"></i>${t("low")}</span><span><i class="lg warn"></i>${t("medium")}</span><span><i class="lg bad"></i>${t("high")}</span></div>`;
    $("#aiCard").querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { st.aiOffsetH = +b.dataset.h; drawAI(); }));
  }

  // ------------------------------------------------------------------ drawer, pricing, history
  function openDrawer() {
    const u = st.user, pm = G.UI.getPM(u), d = $("#drawer");
    const initials = (u.name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${cur === v ? "on" : ""}">${l}</button>`).join("")}</div>`;
    d.innerHTML = `
      <div class="drawer-head"><div class="avatar">${esc(initials)}</div><div><b>${esc(u.name)}</b><small class="muted">${u.provider === "guest" ? t("guest") : u.provider === "password" ? "@" + esc(u.name) : u.provider === "apple" ? "Apple" : "Google"}</small></div></div>
      <nav class="drawer-nav">
        <button data-d="history">${I.history}<span>${t("history")}</span>${I.chevron}</button>
        <button data-d="wallet">${I.card}<span>${t("wallet")}</span><small class="muted">${pm ? esc(G.UI.methodLabel(pm)) : ""}</small>${I.chevron}</button>
        <button data-d="pricing">${I.tag}<span>${t("pricing")}</span>${I.chevron}</button>
        <button data-d="how">${I.help}<span>${t("howItWorks")}</span>${I.chevron}</button>
      </nav>
      <div class="drawer-sec"><div class="sec-label">${I.globe}${t("language")}</div>${seg("lang", [["ar", "العربية"], ["en", "English"]], G.getLang())}</div>
      <div class="drawer-sec"><div class="sec-label">${I.moon}${t("theme")}</div>${seg("theme", [["light", t("light")], ["dark", t("dark")], ["auto", t("auto")]], G.getTheme())}</div>
      <div class="drawer-foot">
        <a class="drawer-link" href="admin.html">${I.chart}<span>${t("admin")}</span></a>
        <p class="legal"><button type="button" data-d="terms">${t("termsT")}</button><span>·</span><button type="button" data-d="privacy">${t("privacyT")}</button></p>
        <button class="drawer-link danger-text" data-d="signout">${I.logout}<span>${t("signOut")}</span></button>
      </div>`;
    d.hidden = false; $("#scrim").hidden = false; requestAnimationFrame(() => { d.classList.add("open"); $("#scrim").classList.add("open"); });
    $("#scrim").onclick = closeDrawer;
    d.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.d; closeDrawer();
      if (k === "history") showHistory(); if (k === "wallet") G.UI.choosePayment(st.user); if (k === "pricing") showPricing(); if (k === "how") showHow(); if (k === "terms" || k === "privacy") showLegal(k);
      if (k === "signout") { G.Session.clear(); st.user = null; $("#app").hidden = true; showAuth(); }
    }));
    d.querySelectorAll("[data-seg]").forEach((g) => g.querySelectorAll("button").forEach((b) => (b.onclick = () => {
      if (g.dataset.seg === "lang") { G.setLang(b.dataset.v); refreshAll(); if (st.ai) drawAI(); updateSimBadge(); }
      else { G.setTheme(b.dataset.v); setTimeout(() => { drawZones(); if (st.ai) drawAI(); }, 30); }
      openDrawer();
    })));
  }
  function closeDrawer() { const d = $("#drawer"); d.classList.remove("open"); $("#scrim").classList.remove("open"); setTimeout(() => { d.hidden = true; $("#scrim").hidden = true; }, 220); }
  function showPricing() {
    const s = S();
    modal.open(`<div class="modal-head"><h3>${t("pricing")}</h3><button class="icon-btn" data-close>${I.x}</button></div>
      <div class="price-list">
        <div class="price-item"><span class="pi-ico">${I.unlock}</span><div><b>${t("pUnlock")}</b><small>${t("pUnlockSub", { m: s.blockMin })}</small></div><b class="num">${G.money(s.unlockFee)}</b></div>
        <div class="price-item"><span class="pi-ico">${I.clock}</span><div><b>${t("pBlock", { m: s.blockMin })}</b><small>&nbsp;</small></div><b class="num">${G.money(s.blockFee)}</b></div>
        <div class="price-item"><span class="pi-ico">${I.lock}</span><div><b>${t("pReserve")}</b><small>${t("pReserveSub", { n: s.holdMin })}</small></div><b class="num">${G.money(s.reserveFee)}</b></div>
      </div>`);
  }
  function showHow() {
    modal.open(`<div class="modal-head"><h3>${t("howItWorks")}</h3><button class="icon-btn" data-close>${I.x}</button></div>
      <ol class="how">${[["pin", "step1"], ["unlock", "step2"], ["bike", "step3"], ["camera", "step4"]].map(([i, k], n) => `<li><span class="how-n">${I[i]}</span><span>${t(k)}</span></li>`).join("")}</ol>`);
  }
  function showHistory() {
    const rides = G.Store.get().rides.filter((r) => r.userId === st.user.id && r.status === "completed").reverse();
    modal.open(`<div class="modal-head"><h3>${t("history")}</h3><button class="icon-btn" data-close>${I.x}</button></div>
      ${rides.length ? `<div class="hist">${rides.map((r) => { const a = G.SPOTS.find((s) => s.id === r.startSpot), b = G.SPOTS.find((s) => s.id === r.endSpot);
        return `<div class="hist-row">${r.photo?.thumb ? `<img src="${r.photo.thumb}" alt="">` : `<span class="hist-ico">${I.bike}</span>`}<div><b>${esc(G.spotName(a))} → ${esc(G.spotName(b))}</b><small class="muted num">${new Date(r.endedAt).toLocaleDateString(G.getLang() === "ar" ? "ar-KW" : "en-GB", { day: "numeric", month: "short" })} · ${G.hhmm(r.unlockedAt)} · ${G.clock(r.rideSec * 1000)} · ${G.dist(r.distanceM || 0)}</small></div><b class="num">${G.money(r.fees.total)}</b></div>`; }).join("")}</div>` : `<div class="empty">${I.history}<p>${t("noRides")}</p></div>`}`);
  }

  boot();
})();
