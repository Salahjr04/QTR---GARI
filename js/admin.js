/* Gari admin dashboard: overview, live map, AI forecast, rides (with photos and checks), fleet,
 * simulator controls, settings (pricing, AI photo engine) and the API log. */
(() => {
  "use strict";
  const G = window.Gari;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = (d) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const IC = {
    overview: P('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    map: P('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    forecast: P('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    rides: P('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h8"/>'),
    fleet: P('<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l4-7h6l3 7M9.5 9.5l-1.5-3H6M15.5 9.5l-3 7h-7"/>'),
    sim: P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
    settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
    api: P('<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>'),
    play: P('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'), pause: P('<path d="M8 4v16M16 4v16"/>'),
    phone: P('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'), check: P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), warn: P('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>'),
    arrow: P('<path d="M5 12h14M13 6l6 6-6 6"/>'), truck: P('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  };

  // ------------------------------------------------------------------ strings
  const A = {
    ar: { console: "لوحة التحكم", overview: "نظرة عامة", map: "الخريطة الحية", forecast: "توقعات الذكاء الاصطناعي", rides: "الرحلات", fleet: "الدراجات", sim: "المحاكي", settings: "الإعدادات", api: "سجل الـ API",
      riderApp: "تطبيق المستخدم", run: "شغّل المحاكاة", pause: "وقّف المحاكاة", running: "شغالة",
      revenue: "الإيراد اليوم", ridesToday: "رحلات اليوم", ridingNow: "يركبون الحين", available: "دراجات متاحة", avgRide: "متوسط الرحلة", passRate: "صور مقبولة من أول مرة", missed: "طلبات ضاعت (ما في دراجة)",
      perHour: "رحلات بالساعة: الفعلي مقابل توقع الذكاء الاصطناعي", actual: "الفعلي", predicted: "المتوقع", hour: "الساعة",
      activity: "آخر الأحداث", payMix: "طرق الدفع", noData: "ما في بيانات للحين. شغّل المحاكاة أو سوِّ رحلة من تطبيق المستخدم.",
      next12: "الطلب المتوقع للـ ١٢ ساعة الجاية", trafficIdx: "مؤشر زحمة الشوارع (١٢ ساعة)", zones: "مناطق الركن: الطلب مقابل الدراجات (الساعتين الجاية)",
      zone: "المنطقة", need: "الطلب المتوقع", bikes: "دراجات", status: "الحالة", shortage: "نقص", ok: "مضبوط", surplus: "زيادة",
      rebalance: "اقتراحات إعادة توزيع الدراجات", apply: "نفّذ", moved: "انتقلت {n} دراجات", noMoves: "التوزيع الحين مضبوط مع الطلب المتوقع",
      howModel: "كيف يتوقع النموذج", modelText: "النموذج يجمع: نمط الطلب بالساعة (أيام الدوام والويكند بتوقيت الكويت)، طبيعة كل منطقة (حدائق بالمسا، ساحات وواجهة بحرية بالويكند)، الطقس، الفعاليات، وتصحيح يتعلم من الرحلات الفعلية بآخر ٣ ساعات.",
      rider: "المستخدم", bike: "الدراجة", from: "من", to: "إلى", duration: "المدة", distance: "المسافة", total: "المجموع", payment: "الدفع", photo: "الصورة", time: "الوقت",
      all: "الكل", real: "حقيقية", simulated: "محاكاة", live: "شغالة", completed: "منتهية",
      st_available: "متاحة", st_reserved: "محجوزة", st_in_use: "مستخدمة", lock: "القفل", battery: "البطارية", lockedS: "مسكّر", unlockedS: "مفتوح", ridesCount: "رحلات",
      st_riding: "يركب", st_locked: "بانتظار الصورة", st_completed: "منتهية", st_cancelled: "ملغية", st_expired: "خلص الحجز",
      v_pass: "مقبولة", v_review: "مراجعة", v_fail: "مرفوضة",
      checks: "فحوصات الصورة", events: "طلبات الـ API لهذي الرحلة", fees: "التكلفة", attempts: "محاولات التصوير", engine: "المحرك",
      speed: "سرعة الوقت", speedHint: "×30 يعني كل ثانية حقيقية = ٣٠ ثانية بالمحاكاة", jump: "قدّم الوقت", setTime: "اضبط الوقت",
      morning: "الصبح ٧:٣٠", noon: "الظهر ١:٠٠", evening: "المسا ٧:٠٠", night: "الليل ١١:٠٠", weekend: "يوم جمعة", weekday: "يوم دوام",
      demandLvl: "مستوى الطلب", weather: "الطقس", event: "فعالية", failRate: "نسبة الصور المرفوضة", offZone: "نسبة الركن برا المنطقة", maxRiders: "أقصى عدد راكبين",
      activeRiders: "راكبين بالمحاكاة الحين", seed: "ولّد رحلات اليوم (أمثلة)", seeded: "انضافت {n} رحلة مثال", ev_seed: "انضافت رحلات أمثلة لليوم", simLog: "سجل المحاكاة", reset: "مسح كل البيانات", resetQ: "متأكد؟ بتنمسح كل الرحلات وترجع الدراجات لأماكنها.",
      pricing: "الأسعار", unlockFee: "فتح القفل (د.ك)", reserveFee: "حجز دراجة بعيدة (د.ك)", blockFee: "كل فترة (د.ك)", blockMin: "طول الفترة (دقيقة)", nearM: "مسافة «قريبة» بدون حجز (م)", holdMin: "مدة الحجز (دقيقة)", parkRadius: "نصف قطر منطقة الركن (م)",
      vision: "تحليل الصورة بالذكاء الاصطناعي", visionEngine: "المحرك", e_auto: "تلقائي (Claude إذا في مفتاح)", e_device: "على الجهاز فقط", e_claude: "Claude",
      apiKey: "مفتاح Anthropic API (اختياري)", apiKeyHint: "ينحفظ بهذا المتصفح بس. للنسخة التجريبية فقط؛ بالنسخة الحقيقية يكون على السيرفر.", model: "الموديل", save: "حفظ", saved: "انحفظ",
      ev_unlock: "{name} فتح {bike}", ev_lock: "قفل الدراجة", ev_photo_pass: "صورة مقبولة", ev_photo_fail: "صورة مرفوضة ({r})", ev_photo_review: "صورة للمراجعة", ev_done: "رحلة انتهت", ev_missed: "طلب ضاع بـ {zone}", ev_start: "بدأت المحاكاة", ev_stop: "وقفت المحاكاة",
      layers: "الطبقات", traffic: "زحمة الشوارع", demand: "الطلب المتوقع", legendBikes: "متاحة · محجوزة · مستخدمة", min: "د", km: "كم", openRider: "افتح تطبيق المستخدم", close: "إغلاق", noPhoto: "رحلة محاكاة (بدون صورة)" },
    en: { console: "Console", overview: "Overview", map: "Live map", forecast: "AI forecast", rides: "Rides", fleet: "Fleet", sim: "Simulator", settings: "Settings", api: "API log",
      riderApp: "Rider app", run: "Run simulation", pause: "Pause simulation", running: "Running",
      revenue: "Revenue today", ridesToday: "Rides today", ridingNow: "Riding now", available: "Bikes available", avgRide: "Average ride", passRate: "Photos passed first try", missed: "Missed demand (no bike)",
      perHour: "Rides per hour: actual vs AI forecast", actual: "Actual", predicted: "Forecast", hour: "Hour",
      activity: "Latest activity", payMix: "Payment methods", noData: "No data yet. Run the simulator or take a ride in the rider app.",
      next12: "Expected demand, next 12 hours", trafficIdx: "Street congestion index, next 12 hours", zones: "Parking zones: demand vs bikes (next 2 hours)",
      zone: "Zone", need: "Expected rides", bikes: "Bikes", status: "Status", shortage: "Shortage", ok: "Balanced", surplus: "Surplus",
      rebalance: "Rebalancing suggestions", apply: "Apply", moved: "Moved {n} bikes", noMoves: "Bikes are well matched to expected demand",
      howModel: "How the model predicts", modelText: "It combines the hourly demand pattern (workdays vs weekends, Kuwait time), each zone's character (parks in the evening, squares and the waterfront at weekends), weather, events, and a correction it learns from the rides actually seen in the last 3 hours.",
      rider: "Rider", bike: "Bike", from: "From", to: "To", duration: "Duration", distance: "Distance", total: "Total", payment: "Payment", photo: "Photo", time: "Time",
      all: "All", real: "Real", simulated: "Simulated", live: "Live", completed: "Completed",
      st_available: "Available", st_reserved: "Reserved", st_in_use: "In use", lock: "Lock", battery: "Battery", lockedS: "Locked", unlockedS: "Open", ridesCount: "Rides",
      st_riding: "Riding", st_locked: "Awaiting photo", st_completed: "Completed", st_cancelled: "Cancelled", st_expired: "Booking expired",
      v_pass: "Passed", v_review: "Review", v_fail: "Rejected",
      checks: "Photo checks", events: "API calls for this ride", fees: "Charges", attempts: "Photo attempts", engine: "Engine",
      speed: "Time speed", speedHint: "×30 means every real second is 30 simulated seconds", jump: "Skip ahead", setTime: "Set time",
      morning: "Morning 7:30", noon: "Noon 1:00", evening: "Evening 7:00", night: "Night 11:00", weekend: "A Friday", weekday: "A workday",
      demandLvl: "Demand level", weather: "Weather", event: "Event", failRate: "Rejected photos", offZone: "Parking outside zones", maxRiders: "Max riders",
      activeRiders: "Simulated riders now", seed: "Generate today's example rides", seeded: "Added {n} example rides", ev_seed: "Example rides added for today", simLog: "Simulation log", reset: "Reset all data", resetQ: "Sure? All rides are deleted and bikes go back to their zones.",
      pricing: "Pricing", unlockFee: "Unlock (KD)", reserveFee: "Book a far bike (KD)", blockFee: "Per block (KD)", blockMin: "Block length (min)", nearM: "“Near” distance, no booking (m)", holdMin: "Booking hold (min)", parkRadius: "Parking zone radius (m)",
      vision: "AI photo check", visionEngine: "Engine", e_auto: "Auto (Claude when a key is set)", e_device: "On-device only", e_claude: "Claude",
      apiKey: "Anthropic API key (optional)", apiKeyHint: "Stored in this browser only. Prototype only; in production this call runs on the server.", model: "Model", save: "Save", saved: "Saved",
      ev_unlock: "{name} unlocked {bike}", ev_lock: "Bike locked", ev_photo_pass: "Photo passed", ev_photo_fail: "Photo rejected ({r})", ev_photo_review: "Photo sent to review", ev_done: "Ride completed", ev_missed: "Missed demand at {zone}", ev_start: "Simulation started", ev_stop: "Simulation paused",
      layers: "Layers", traffic: "Street traffic", demand: "Expected demand", legendBikes: "Available · Reserved · In use", min: "min", km: "km", openRider: "Open rider app", close: "Close", noPhoto: "Simulated ride (no photo)" },
  };
  const a = (k, v) => { let s = A[G.getLang()][k] ?? A.en[k] ?? G.t(k); if (v) for (const [x, y] of Object.entries(v)) s = s.split(`{${x}}`).join(y); return s; };
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const spot = (id) => G.SPOTS.find((s) => s.id === id);
  const H = 3600000;
  const dayStart = (t) => { const k = t + 3 * H; return k - (k % (24 * H)) - 3 * H; }; // Kuwait midnight

  // ------------------------------------------------------------------ shell
  const VIEWS = ["overview", "map", "forecast", "rides", "fleet", "sim", "settings", "api"];
  let view = (location.hash.slice(1) && VIEWS.includes(location.hash.slice(1))) ? location.hash.slice(1) : "overview";
  function shell() {
    document.title = "Gari · " + a("console");
    $(".side-tag").textContent = a("console");
    $("#nav").innerHTML = VIEWS.map((v) => `<button data-v="${v}" class="${v === view ? "on" : ""}">${IC[v]}<span>${a(v)}</span></button>`).join("");
    $("#nav").querySelectorAll("button").forEach((b) => (b.onclick = () => go(b.dataset.v)));
    $("#riderLink").innerHTML = `${IC.phone}<span>${a("riderApp")}</span>`;
    $("#langBtn").textContent = G.getLang() === "ar" ? "English" : "العربية";
    $("#themeBtn").textContent = G.getTheme() === "dark" ? G.t("dark") : G.getTheme() === "light" ? G.t("light") : G.t("auto");
    $("#langBtn").onclick = () => { G.setLang(G.getLang() === "ar" ? "en" : "ar"); shell(); render(true); };
    $("#themeBtn").onclick = () => { const o = ["auto", "light", "dark"]; G.setTheme(o[(o.indexOf(G.getTheme()) + 1) % 3]); shell(); setTimeout(() => render(true), 30); };
    $("#speedSeg").innerHTML = [1, 10, 30, 60, 120].map((x) => `<button data-s="${x}" class="num ${G.Clock.speed === x ? "on" : ""}">×${x}</button>`).join("");
    $("#speedSeg").querySelectorAll("button").forEach((b) => (b.onclick = () => { G.Clock.setSpeed(+b.dataset.s); shell(); }));
    const run = G.Sim.running();
    $("#runBtn").className = "run-btn" + (run ? " on" : "");
    $("#runBtn").innerHTML = `${run ? IC.pause : IC.play}<span>${run ? a("pause") : a("run")}</span>`;
    $("#runBtn").onclick = () => { run ? G.Sim.stop() : G.Sim.start(); shell(); if (view === "sim") render(true); };
    $("#title").textContent = a(view);
  }
  function go(v) { view = v; history.replaceState(null, "", "#" + v); shell(); render(true); }
  function clockTick() {
    const n = G.Clock.now(), d = new Date(n + 3 * H);
    $("#simTime").textContent = G.hhmm(n);
    $("#simDay").textContent = d.toLocaleDateString(G.getLang() === "ar" ? "ar-KW" : "en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  }

  // ------------------------------------------------------------------ data helpers
  function stats() {
    const db = G.Store.get(), now = G.Clock.now(), d0 = dayStart(now);
    const today = db.rides.filter((r) => (r.unlockedAt || r.reservedAt || 0) >= d0);
    const done = today.filter((r) => r.status === "completed");
    const revenue = today.reduce((s, r) => s + (r.status === "completed" ? r.fees.total : ["cancelled", "expired"].includes(r.status) ? r.fees.reserve || 0 : 0), 0);
    const bikes = Object.values(db.bikes);
    const photos = done.filter((r) => r.photo);
    const first = photos.filter((r) => (r.attempts || 1) === 1).length;
    const perHour = Array(24).fill(0); today.forEach((r) => { if (r.unlockedAt) perHour[Math.floor(G.Forecast.kwHour(r.unlockedAt))]++; });
    const fc = Array.from({ length: 24 }, (_, h) => G.Forecast.cityDemand(d0 + h * H + H / 2));
    const pay = { applepay: 0, knet: 0, visa: 0 }; done.forEach((r) => { if (r.payment?.method in pay) pay[r.payment.method]++; });
    return {
      revenue, rides: done.length, riding: db.rides.filter((r) => ["riding", "locked"].includes(r.status)).length,
      avail: bikes.filter((b) => b.status === "available").length, total: bikes.length,
      avg: done.length ? done.reduce((s, r) => s + r.rideSec, 0) / done.length : 0,
      pass: photos.length ? first / photos.length : null, perHour, fc, pay, nowH: Math.floor(G.Forecast.kwHour(now)),
      missed: G.Sim.log.filter((e) => e.k === "missed" && e.t >= d0).length,
    };
  }
  const chip = (cls, txt) => `<span class="chip ${cls}">${txt}</span>`;
  const statusChip = (s) => chip({ riding: "brand", locked: "warn", completed: "good", cancelled: "", expired: "", reserved: "info" }[s] || "", a("st_" + s));
  const verdictChip = (v) => (v ? chip(v === "pass" ? "good" : v === "review" ? "warn" : "bad", a("v_" + v)) : "–");
  const fmtDur = (sec) => (sec ? `${Math.round(sec / 60)} ${a("min")}` : "–");

  // ------------------------------------------------------------------ charts (inline SVG, hover tooltips)
  const tip = $("#tip");
  function showTip(e, html) { tip.innerHTML = html; tip.hidden = false; const r = tip.getBoundingClientRect(); let x = e.clientX + 14, y = e.clientY - r.height - 10; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y < 8) y = e.clientY + 16; tip.style.left = x + "px"; tip.style.top = y + "px"; }
  function hideTip() { tip.hidden = true; }
  // bars (actual) + line (forecast) on one axis: same unit, rides per hour
  function barLine(el, { bars, line, labels, now, barName, lineName, unit }) {
    const W = 1000, Hh = 250, m = { l: 34, r: 10, t: 12, b: 26 }, iw = W - m.l - m.r, ih = Hh - m.t - m.b;
    const max = Math.max(1, ...bars, ...(line || [])) * 1.15, n = labels.length, bw = iw / n;
    const y = (v) => m.t + ih - (v / max) * ih, xC = (i) => m.l + bw * i + bw / 2;
    const ticks = niceTicks(max);
    let s = `<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" dir="ltr">`;
    ticks.forEach((tv) => (s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(tv)}" y2="${y(tv)}" class="grid"/><text x="${m.l - 6}" y="${y(tv) + 4}" class="axis" text-anchor="end">${tv}</text>`));
    bars.forEach((v, i) => { if (v > 0) { const h = Math.max(2, (v / max) * ih), x = m.l + bw * i + 2; s += `<path d="M${x},${m.t + ih} v${-h + 4} q0,-4 4,-4 h${bw - 12} q4,0 4,4 v${h - 4} z" class="bar ${i === now ? "now" : ""}"/>`; } });
    if (line) s += `<path d="${line.map((v, i) => `${i ? "L" : "M"}${xC(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" class="fline"/>`;
    if (now != null) s += `<line x1="${xC(now)}" x2="${xC(now)}" y1="${m.t}" y2="${m.t + ih}" class="nowline"/>`;
    labels.forEach((l, i) => { if (i % 3 === 0) s += `<text x="${xC(i)}" y="${Hh - 8}" class="axis" text-anchor="middle">${l}</text>`; });
    labels.forEach((l, i) => (s += `<rect x="${m.l + bw * i}" y="${m.t}" width="${bw}" height="${ih}" class="hit" data-i="${i}"/>`));
    el.innerHTML = s + "</svg>";
    el.querySelectorAll(".hit").forEach((r) => {
      r.onmousemove = (e) => { const i = +r.dataset.i; showTip(e, `<b>${labels[i]}:00</b><div><i class="sw s1"></i>${barName}<span class="num">${bars[i]}</span></div>${line ? `<div><i class="sw s2"></i>${lineName}<span class="num">${line[i].toFixed(1)}</span></div>` : ""}`); };
      r.onmouseleave = hideTip;
    });
  }
  function lineChart(el, { values, labels, name, fmt = (v) => v.toFixed(1), max: mx, area = true, cls = "" }) {
    const W = 520, Hh = 200, m = { l: 34, r: 10, t: 12, b: 26 }, iw = W - m.l - m.r, ih = Hh - m.t - m.b;
    const max = mx || Math.max(1, ...values) * 1.15, n = values.length;
    const x = (i) => m.l + (iw * i) / (n - 1), y = (v) => m.t + ih - (v / max) * ih;
    const ticks = mx === 1 ? [0, 0.5, 1] : niceTicks(max);
    let s = `<svg viewBox="0 0 ${W} ${Hh}" class="chart ${cls}" dir="ltr">`;
    ticks.forEach((tv) => (s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(tv)}" y2="${y(tv)}" class="grid"/><text x="${m.l - 6}" y="${y(tv) + 4}" class="axis" text-anchor="end">${mx === 1 ? Math.round(tv * 100) + "%" : tv}</text>`));
    const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    if (area) s += `<path d="${d}L${x(n - 1)},${m.t + ih}L${x(0)},${m.t + ih}Z" class="area"/>`;
    s += `<path d="${d}" class="sline"/>`;
    labels.forEach((l, i) => { if (i % 2 === 0) s += `<text x="${x(i)}" y="${Hh - 8}" class="axis" text-anchor="middle">${l}</text>`; });
    s += `<circle r="4.5" class="dot" id="hdot" cx="-10" cy="-10"/>`;
    s += `<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" class="hit"/>`;
    el.innerHTML = s + "</svg>";
    const svg = el.querySelector("svg"), dot = el.querySelector("#hdot");
    el.querySelector(".hit").onmousemove = (e) => {
      const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W, i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
      dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(values[i])); dot.classList.add("on");
      showTip(e, `<b>${labels[i]}</b><div><i class="sw s1"></i>${name}<span class="num">${fmt(values[i])}</span></div>`);
    };
    el.querySelector(".hit").onmouseleave = () => { hideTip(); dot.classList.remove("on"); };
  }
  function niceTicks(max) { const step = [1, 2, 5, 10, 20, 50, 100].find((s) => max / s <= 5) || 200; const out = []; for (let v = 0; v <= max; v += step) out.push(v); return out; }

  // ------------------------------------------------------------------ maps
  let lmap = null, lbase = null, layers = {}, mapOpts = { traffic: true, demand: true };
  function makeMap(el, zoom = 13) {
    if (lmap) { lmap.remove(); lmap = null; }
    lmap = L.map(el, { zoomControl: true, attributionControl: true, minZoom: 11, maxZoom: 18 }).setView([29.352, 47.985], zoom);
    lmap.attributionControl.setPrefix(false);
    lbase = G.addBaseMap(lmap);
    layers = { zones: L.layerGroup().addTo(lmap), demand: L.layerGroup().addTo(lmap), bikes: L.layerGroup().addTo(lmap), live: L.layerGroup().addTo(lmap) };
    drawMapData();
    return lmap;
  }
  function drawMapData() {
    if (!lmap) return;
    const db = G.Store.get();
    layers.zones.clearLayers(); layers.bikes.clearLayers(); layers.demand.clearLayers();
    G.SPOTS.forEach((s) => L.circle([s.lat, s.lng], { radius: db.settings.parkRadiusM, color: css("--brand"), weight: 1.2, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(layers.zones));
    if (mapOpts.demand) G.Forecast.zoneOutlook(G.Clock.now(), 2).forEach((z) => {
      const col = z.level === "high" ? css("--bad") : z.level === "medium" ? css("--warn") : css("--good");
      L.circle([z.spot.lat, z.spot.lng], { radius: 100 + Math.min(260, z.need * 60), stroke: false, fillColor: col, fillOpacity: 0.18 })
        .bindTooltip(`<b>${esc(G.spotName(z.spot))}</b><br>${a("need")}: ${z.need.toFixed(1)} · ${a("bikes")}: ${z.avail}`, { direction: "top" }).addTo(layers.demand);
    });
    Object.values(db.bikes).forEach((b) => {
      if (b.status === "in_use") return;
      const col = b.status === "available" ? css("--brand") : css("--info");
      L.circleMarker([b.lat, b.lng], { radius: 6, color: css("--surface"), weight: 2, fillColor: col, fillOpacity: 1 })
        .bindTooltip(`<b>${b.id}</b> · ${a("st_" + b.status)} · ${b.battery}%`, { direction: "top" }).addTo(layers.bikes);
    });
    lbase.setTraffic(mapOpts.traffic ? (pts, i) => G.Forecast.traffic(pts, i, G.Clock.now()) : null);
    drawLive();
  }
  function drawLive() {
    if (!lmap) return;
    layers.live.clearLayers();
    G.Live.read().forEach(([id, la, ln]) => L.circleMarker([la, ln], { radius: 6.5, color: css("--surface"), weight: 2, fillColor: css("--warn"), fillOpacity: 1 }).bindTooltip(id).addTo(layers.live));
    // the real rider's bike in use
    const db = G.Store.get();
    db.rides.filter((r) => !r.sim && r.status === "riding").forEach((r) => { const b = db.bikes[r.bikeId]; L.circleMarker([b.lat, b.lng], { radius: 8, color: css("--surface"), weight: 2.5, fillColor: css("--bad"), fillOpacity: 1 }).bindTooltip(`${esc(r.userName)} · ${b.id}`).addTo(layers.live); });
  }

  // ------------------------------------------------------------------ views
  const V = {};
  V.overview = (el) => {
    el.innerHTML = `
      <div class="tiles" id="tiles"></div>
      <div class="grid2">
        <section class="card span2"><div class="card-head"><h2>${a("perHour")}</h2><div class="legend"><span><i class="sw s1"></i>${a("actual")}</span><span><i class="sw s2 line"></i>${a("predicted")}</span></div></div><div id="ch1"></div></section>
        <section class="card"><div class="card-head"><h2>${a("map")}</h2><button class="link" data-go="map" aria-label="${a("map")}">${IC.arrow}</button></div><div class="mini-map" id="omap"></div></section>
        <section class="card"><div class="card-head"><h2>${a("activity")}</h2></div><ul class="feed" id="feed"></ul></section>
        <section class="card"><div class="card-head"><h2>${a("payMix")}</h2></div><div id="paymix"></div></section>
        <section class="card"><div class="card-head"><h2>${a("missed")}</h2></div><div class="big-num num" id="missed"></div><p class="muted small">${a("howModel")}: ${a("modelText")}</p></section>
      </div>`;
    makeMap($("#omap"), 12);
    el.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
    fillOverview();
  };
  function fillOverview() {
    if (!$("#tiles")) return;
    const s = stats();
    const tile = (k, v) => `<div class="tile"><small>${a(k)}</small><b class="num">${v}</b></div>`;
    $("#tiles").innerHTML = tile("revenue", G.money(s.revenue)) + tile("ridesToday", s.rides) + tile("ridingNow", s.riding) +
      tile("available", `${s.avail}<span class="of">/${s.total}</span>`) + tile("avgRide", fmtDur(s.avg)) + tile("passRate", s.pass == null ? "–" : Math.round(s.pass * 100) + "%");
    barLine($("#ch1"), { bars: s.perHour, line: s.fc, labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), now: s.nowH, barName: a("actual"), lineName: a("predicted") });
    feed($("#feed"));
    const tot = Object.values(s.pay).reduce((x, y) => x + y, 0) || 1;
    $("#paymix").innerHTML = Object.entries(s.pay).map(([k, v]) => `<div class="hbar"><span>${k === "applepay" ? "Apple Pay" : k === "knet" ? "KNET" : "Visa"}</span><div class="hbar-track"><i style="width:${(v / tot) * 100}%"></i></div><b class="num">${v}</b></div>`).join("");
    $("#missed").textContent = s.missed;
    drawMapData();
  }
  function feed(ul) {
    const db = G.Store.get();
    const items = G.Sim.log.slice(0, 14).map((e) => {
      const txt = e.k === "unlock" ? a("ev_unlock", { name: esc(e.name), bike: e.bike }) : e.k === "photo" ? a("ev_photo_" + e.verdict, { r: e.reason || "" }) : e.k === "missed" ? a("ev_missed", { zone: esc(G.spotName(spot(e.spot))) }) : a("ev_" + e.k);
      const cls = e.k === "missed" || (e.k === "photo" && e.verdict === "fail") ? "bad" : e.k === "done" || (e.k === "photo" && e.verdict === "pass") ? "good" : "";
      return { t: e.t, html: `<li class="${cls}"><span class="num">${G.hhmm(e.t)}</span><span>${txt}</span></li>` };
    });
    db.api.slice(-8).filter((x) => !x.body?.sim).forEach((x) => items.push({ t: x.t, html: `<li class="real"><span class="num">${G.hhmm(x.t)}</span><span><code>${x.method} ${esc(x.path)}</code></span></li>` }));
    items.sort((x, y) => y.t - x.t);
    ul.innerHTML = items.slice(0, 14).map((x) => x.html).join("") || `<li class="muted">${a("noData")}</li>`;
  }
  V.map = (el) => {
    el.innerHTML = `<div class="map-wrap"><div id="bigmap"></div>
      <div class="map-panel"><b>${a("layers")}</b>
        <label><input type="checkbox" id="lyT" ${mapOpts.traffic ? "checked" : ""}> ${a("traffic")}</label>
        <label><input type="checkbox" id="lyD" ${mapOpts.demand ? "checked" : ""}> ${a("demand")}</label>
        <div class="legend col"><span><i class="dotc" style="background:var(--brand)"></i>${a("st_available")}</span><span><i class="dotc" style="background:var(--info)"></i>${a("st_reserved")}</span><span><i class="dotc" style="background:var(--warn)"></i>${a("simulated")}</span><span><i class="dotc" style="background:var(--bad)"></i>${a("real")}</span></div>
        <div class="legend col"><span><i class="lg good"></i>${G.t("low")}</span><span><i class="lg warn"></i>${G.t("medium")}</span><span><i class="lg bad"></i>${G.t("high")}</span></div>
      </div></div>`;
    makeMap($("#bigmap"), 13);
    $("#lyT").onchange = (e) => { mapOpts.traffic = e.target.checked; drawMapData(); };
    $("#lyD").onchange = (e) => { mapOpts.demand = e.target.checked; drawMapData(); };
  };
  V.forecast = (el) => {
    const now = G.Clock.now(), hrs = Array.from({ length: 25 }, (_, i) => now + i * H / 2);
    const lab = hrs.map((t) => G.hhmm(t));
    const outlook = G.Forecast.zoneOutlook(now, 2).sort((x, y) => y.ratio - x.ratio);
    const moves = G.Forecast.rebalance(now);
    const sim = G.Store.get().sim, w = G.Forecast.WEATHER[sim.weather], ev = G.Forecast.EVENTS[sim.event];
    const li = G.getLang() === "ar" ? 0 : 1;
    el.innerHTML = `
      <div class="scenario">${IC.forecast}<span>${a("weather")}: <b>${w.label[li]}</b></span><span>${a("event")}: <b>${ev.label[li]}</b></span><span>${a("demandLvl")}: <b class="num">×${sim.demand}</b></span><span>${G.Forecast.isWeekend(now) ? a("weekend") : a("weekday")}</span></div>
      <div class="grid2">
        <section class="card"><div class="card-head"><h2>${a("next12")}</h2></div><div id="fc1"></div></section>
        <section class="card"><div class="card-head"><h2>${a("trafficIdx")}</h2></div><div id="fc2"></div></section>
        <section class="card span2"><div class="card-head"><h2>${a("rebalance")}</h2></div>
          ${moves.length ? `<div class="moves">${moves.map((m, i) => `<div class="move">${IC.truck}<span><b>${m.n}</b> × ${esc(G.spotName(m.from))} ${IC.arrow} ${esc(G.spotName(m.to))}</span><button class="btn btn-sm btn-primary" data-mv="${i}">${a("apply")}</button></div>`).join("")}</div>` : `<p class="muted">${IC.check} ${a("noMoves")}</p>`}
        </section>
        <section class="card span2"><div class="card-head"><h2>${a("zones")}</h2></div>
          <div class="table-wrap"><table><thead><tr><th>${a("zone")}</th><th class="n">${a("need")}</th><th class="n">${a("bikes")}</th><th>${a("status")}</th><th class="bar-col"></th></tr></thead><tbody>
          ${outlook.map((z) => `<tr><td>${esc(G.spotName(z.spot))}</td><td class="n num">${z.need.toFixed(1)}</td><td class="n num">${z.avail}</td><td>${z.level === "high" ? chip("bad", IC.warn + a("shortage")) : z.level === "medium" ? chip("warn", a("ok")) : chip("good", a("surplus"))}</td><td class="bar-col"><div class="hbar-track"><i style="width:${Math.min(100, z.ratio * 50)}%" class="${z.level}"></i></div></td></tr>`).join("")}
          </tbody></table></div></section>
        <section class="card span2"><div class="card-head"><h2>${a("howModel")}</h2></div><p class="muted">${a("modelText")}</p></section>
      </div>`;
    lineChart($("#fc1"), { values: hrs.map((t) => G.Forecast.cityDemand(t)), labels: lab, name: a("predicted") });
    lineChart($("#fc2"), { values: hrs.map((t) => G.Forecast.trafficLevel(t)), labels: lab, name: a("traffic"), fmt: (v) => Math.round(v * 100) + "%", max: 1, cls: "c2" });
    el.querySelectorAll("[data-mv]").forEach((b) => (b.onclick = () => { const m = moves[+b.dataset.mv]; G.Sim.moveBikes(m.from, m.to, m.n); flash(a("moved", { n: m.n })); render(true); }));
  };
  let rideFilter = "all";
  V.rides = (el) => {
    const db = G.Store.get();
    let rides = db.rides.slice().reverse();
    if (rideFilter === "real") rides = rides.filter((r) => !r.sim); if (rideFilter === "sim") rides = rides.filter((r) => r.sim);
    if (rideFilter === "live") rides = rides.filter((r) => ["reserved", "riding", "locked"].includes(r.status));
    rides = rides.slice(0, 150);
    el.innerHTML = `
      <div class="filters seg">${[["all", a("all")], ["real", a("real")], ["sim", a("simulated")], ["live", a("live")]].map(([k, l]) => `<button data-f="${k}" class="${rideFilter === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <section class="card"><div class="table-wrap"><table class="rows"><thead><tr><th>${a("time")}</th><th>${a("rider")}</th><th>${a("bike")}</th><th>${a("from")} → ${a("to")}</th><th class="n">${a("duration")}</th><th class="n">${a("distance")}</th><th class="n">${a("total")}</th><th>${a("photo")}</th><th>${a("status")}</th></tr></thead><tbody>
      ${rides.map((r) => `<tr data-r="${r.id}"><td class="num">${G.hhmm(r.unlockedAt || r.reservedAt)}</td><td>${esc(r.userName)}${r.sim ? "" : ` ${chip("info", a("real"))}`}</td><td class="num">${r.bikeId}</td><td class="trunc">${esc(G.spotName(spot(r.startSpot)))}${r.endSpot ? " → " + esc(G.spotName(spot(r.endSpot))) : ""}</td><td class="n num">${fmtDur(r.rideSec)}</td><td class="n num">${r.distanceM ? G.dist(r.distanceM) : "–"}</td><td class="n num">${r.status === "completed" ? G.KD(r.fees.total) : "–"}</td><td>${verdictChip(r.photo?.analysis?.verdict)}</td><td>${statusChip(r.status)}</td></tr>`).join("") || `<tr><td colspan="9" class="muted">${a("noData")}</td></tr>`}
      </tbody></table></div></section>`;
    el.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { rideFilter = b.dataset.f; render(true); }));
    el.querySelectorAll("[data-r]").forEach((tr) => (tr.onclick = () => openRide(tr.dataset.r)));
  };
  function openRide(id) {
    const db = G.Store.get(), r = db.rides.find((x) => x.id === id); if (!r) return;
    const an = r.photo?.analysis;
    const ev = db.api.filter((x) => x.path.includes(r.id) || (x.path === "/rides" && x.body?.bikeId === r.bikeId && Math.abs(x.t - (r.reservedAt || 0)) < 2000) || (x.path === "/payments" && x.body?.rideId === r.id));
    $("#detailBody").innerHTML = `
      <div class="dhead"><div><h2 class="num">${r.id}</h2><small class="muted">${esc(r.userName)} · ${r.bikeId}</small></div><button class="icon-btn" id="dclose">${IC.x}</button></div>
      <div class="dchips">${statusChip(r.status)} ${verdictChip(an?.verdict)} ${r.sim ? chip("", a("simulated")) : chip("info", a("real"))}</div>
      ${r.photo?.thumb ? `<div class="dphoto"><img src="${r.photo.thumb}" alt=""><svg viewBox="0 0 100 100" preserveAspectRatio="none">${(an.overlay?.wheels || []).map((w) => `<ellipse cx="${w.x * 100}" cy="${w.y * 100}" rx="${w.r * 100}" ry="${(w.r * 100) / an.overlay.aspect}" class="ov-wheel"/>`).join("")}${an.overlay?.lock ? `<rect x="${an.overlay.lock[0] * 100 - 1}" y="${an.overlay.lock[1] * 100 - 1}" width="${an.overlay.lock[2] * 100 + 2}" height="${an.overlay.lock[3] * 100 + 2}" class="ov-lock"/>` : ""}</svg></div>` : `<p class="muted small">${r.sim ? a("noPhoto") : ""}</p>`}
      ${an ? `<div class="dsec"><h3>${a("checks")} <small class="muted">· ${a("engine")}: ${an.engine} · ${a("attempts")}: ${r.attempts || 1}</small></h3><ul class="dchecks">${an.checks.map((c) => `<li class="${c.status}"><span>${c.status === "pass" ? IC.check : c.status === "fail" ? IC.x : c.status === "warn" ? IC.warn : "–"}</span>${G.t("ck_" + c.id)}${c.id === "zone" && c.detail != null ? ` <small class="num">(${c.detail} m)</small>` : ""}</li>`).join("")}</ul>${an.metrics ? `<p class="muted small num">brightness ${an.metrics.brightness} · sharpness ${an.metrics.sharpness} · lock area ${(an.metrics.lockFrac * 100).toFixed(2)}% · bike ${Math.round(an.metrics.bikeConfidence * 100)}%</p>` : ""}${an.ai ? `<p class="small">${esc(G.getLang() === "ar" ? an.ai.reason_ar : an.ai.reason_en)}</p>` : ""}</div>` : ""}
      ${r.route?.length > 1 ? `<div class="dmap" id="dmap"></div>` : ""}
      <div class="dsec"><h3>${a("fees")}</h3><div class="kv"><span>${G.t("reserveFee")}</span><b class="num">${G.KD(r.fees.reserve || 0)}</b><span>${G.t("unlockFee")}</span><b class="num">${G.KD(r.fees.unlock || 0)}</b><span>${a("time")}</span><b class="num">${G.KD(r.fees.time || 0)}</b><span>${a("total")}</span><b class="num">${G.KD(r.fees.total || 0)} KD</b><span>${a("payment")}</span><b>${r.payment?.method || "–"} <small class="num muted">${r.payment?.ref || ""}</small></b><span>${a("duration")}</span><b class="num">${fmtDur(r.rideSec)}</b><span>${a("distance")}</span><b class="num">${r.distanceM ? G.dist(r.distanceM) : "–"}</b></div></div>
      ${ev.length ? `<div class="dsec"><h3>${a("events")}</h3><pre class="code">${ev.map((x) => `${G.hhmm(x.t)}  ${x.method} ${x.path}\n      ${JSON.stringify(x.body)}`).map(esc).join("\n")}</pre></div>` : ""}`;
    $("#detail").hidden = false; requestAnimationFrame(() => $("#detail").classList.add("open"));
    $("#dclose").onclick = closeRide; $("#detail").onclick = (e) => { if (e.target.id === "detail") closeRide(); };
    if (r.route?.length > 1) {
      const m = L.map("dmap", { zoomControl: false, attributionControl: false }); G.addBaseMap(m);
      const pl = L.polyline(r.route.map((p) => [p[0], p[1]]), { color: css("--brand"), weight: 4 }).addTo(m);
      m.fitBounds(pl.getBounds().pad(0.2));
    }
  }
  function closeRide() { $("#detail").classList.remove("open"); setTimeout(() => ($("#detail").hidden = true), 200); }
  V.fleet = (el) => {
    const bikes = Object.values(G.Store.get().bikes).sort((x, y) => x.id.localeCompare(y.id));
    const cnt = (s) => bikes.filter((b) => b.status === s).length;
    el.innerHTML = `
      <div class="tiles three"><div class="tile"><small>${a("st_available")}</small><b class="num">${cnt("available")}</b></div><div class="tile"><small>${a("st_reserved")}</small><b class="num">${cnt("reserved")}</b></div><div class="tile"><small>${a("st_in_use")}</small><b class="num">${cnt("in_use")}</b></div></div>
      <section class="card"><div class="table-wrap"><table><thead><tr><th>${a("bike")}</th><th>${a("status")}</th><th>${a("zone")}</th><th>${a("lock")}</th><th>${a("battery")}</th><th class="n">${a("ridesCount")}</th></tr></thead><tbody>
      ${bikes.map((b) => `<tr><td class="num"><b>${b.id}</b></td><td>${chip(b.status === "available" ? "good" : b.status === "reserved" ? "info" : "warn", a("st_" + b.status))}</td><td>${esc(G.spotName(spot(b.spot)) || "–")}</td><td>${b.lock === "locked" ? a("lockedS") : `<span class="warn-text">${a("unlockedS")}</span>`}</td><td><div class="batt"><i style="width:${b.battery}%" class="${b.battery < 25 ? "low" : ""}"></i></div><span class="num small">${b.battery}%</span></td><td class="n num">${b.rides || 0}</td></tr>`).join("")}
      </tbody></table></div></section>`;
  };
  V.sim = (el) => {
    const sim = G.Store.get().sim, o = G.Sim.options(), li = G.getLang() === "ar" ? 0 : 1;
    const sel = (id, obj, cur) => `<select id="${id}">${Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${v.label[li]}</option>`).join("")}</select>`;
    el.innerHTML = `
      <div class="grid2">
        <section class="card"><div class="card-head"><h2>${a("speed")}</h2></div>
          <div class="speed big">${[1, 5, 10, 30, 60, 120].map((x) => `<button data-s="${x}" class="num ${G.Clock.speed === x ? "on" : ""}">×${x}</button>`).join("")}</div>
          <label class="frow"><span>${a("speed")} (×1–600)</span><input type="number" id="spCustom" min="1" max="600" value="${G.Clock.speed}" class="num"></label>
          <p class="muted small">${a("speedHint")}</p>
          <div class="card-head sub"><h3>${a("jump")}</h3></div>
          <div class="btn-row">${[["+15m", 0.25], ["+1h", 1], ["+3h", 3], ["+12h", 12]].map(([l, h]) => `<button class="btn btn-sm btn-secondary num" data-j="${h}">${l}</button>`).join("")}</div>
          <div class="card-head sub"><h3>${a("setTime")}</h3></div>
          <div class="btn-row">${[["morning", 7.5], ["noon", 13], ["evening", 19], ["night", 23]].map(([k, h]) => `<button class="btn btn-sm btn-secondary" data-h="${h}">${a(k)}</button>`).join("")}</div>
          <div class="btn-row">${[["weekday", 0], ["weekend", 1]].map(([k, w]) => `<button class="btn btn-sm btn-outline" data-w="${w}">${a(k)}</button>`).join("")}</div>
        </section>
        <section class="card"><div class="card-head"><h2>${a("sim")}</h2><span class="chip ${G.Sim.running() ? "good" : ""}">${G.Sim.running() ? a("running") : "—"}</span></div>
          <label class="frow"><span>${a("demandLvl")} <b class="num" id="dmV">×${sim.demand}</b></span><input type="range" id="dm" min="0.25" max="4" step="0.25" value="${sim.demand}"></label>
          <label class="frow"><span>${a("weather")}</span>${sel("wx", G.Forecast.WEATHER, sim.weather)}</label>
          <label class="frow"><span>${a("event")}</span>${sel("evt", G.Forecast.EVENTS, sim.event)}</label>
          <label class="frow"><span>${a("failRate")} <b class="num" id="frV">${Math.round(o.failRate * 100)}%</b></span><input type="range" id="fr" min="0" max="0.6" step="0.05" value="${o.failRate}"></label>
          <label class="frow"><span>${a("offZone")} <b class="num" id="ozV">${Math.round(o.offZoneRate * 100)}%</b></span><input type="range" id="oz" min="0" max="0.5" step="0.05" value="${o.offZoneRate}"></label>
          <label class="frow"><span>${a("maxRiders")}</span><input type="number" id="mx" min="1" max="80" value="${o.maxRiders}" class="num"></label>
          <button class="btn btn-block ${G.Sim.running() ? "btn-secondary" : "btn-primary"}" id="simRun">${G.Sim.running() ? IC.pause + a("pause") : IC.play + a("run")}</button>
        </section>
        <section class="card"><div class="card-head"><h2>${a("activeRiders")}</h2><b class="num">${G.Sim.active().length}</b></div><ul class="feed" id="actList"></ul></section>
        <section class="card"><div class="card-head"><h2>${a("simLog")}</h2></div><ul class="feed" id="feed"></ul>
          <div class="btn-row"><button class="btn btn-sm btn-secondary" id="seed">${a("seed")}</button><button class="btn btn-sm btn-danger" id="reset">${a("reset")}</button></div></section>
      </div>`;
    const setSim = (patch) => G.Store.update((db) => { db.sim = { ...db.sim, ...patch }; });
    const setOpt = (patch) => G.Store.update((db) => { db.sim.opts = { ...(db.sim.opts || {}), ...patch }; });
    el.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { G.Clock.setSpeed(+b.dataset.s); shell(); render(true); }));
    $("#spCustom").onchange = (e) => { G.Clock.setSpeed(+e.target.value); shell(); render(true); };
    el.querySelectorAll("[data-j]").forEach((b) => (b.onclick = () => { G.Clock.jump(+b.dataset.j * H); clockTick(); }));
    el.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { const n = G.Clock.now(), d0 = dayStart(n), target = d0 + +b.dataset.h * H; G.Clock.jump(target - n); clockTick(); render(true); }));
    el.querySelectorAll("[data-w]").forEach((b) => (b.onclick = () => {
      const n = G.Clock.now(), want = +b.dataset.w === 1; let k = 0;
      while (G.Forecast.isWeekend(n + k * 24 * H) !== want && k < 7) k++;
      G.Clock.jump(k * 24 * H); clockTick(); render(true);
    }));
    $("#dm").oninput = (e) => { $("#dmV").textContent = "×" + e.target.value; }; $("#dm").onchange = (e) => setSim({ demand: +e.target.value });
    $("#wx").onchange = (e) => setSim({ weather: e.target.value }); $("#evt").onchange = (e) => setSim({ event: e.target.value });
    $("#fr").oninput = (e) => ($("#frV").textContent = Math.round(e.target.value * 100) + "%"); $("#fr").onchange = (e) => setOpt({ failRate: +e.target.value });
    $("#oz").oninput = (e) => ($("#ozV").textContent = Math.round(e.target.value * 100) + "%"); $("#oz").onchange = (e) => setOpt({ offZoneRate: +e.target.value });
    $("#mx").onchange = (e) => setOpt({ maxRiders: +e.target.value });
    $("#simRun").onclick = () => { G.Sim.running() ? G.Sim.stop() : G.Sim.start(); shell(); render(true); };
    $("#seed").onclick = () => { const n = G.Sim.seedHistory(); flash(a("seeded", { n })); render(true); };
    $("#reset").onclick = () => { if (confirm(a("resetQ"))) { G.Sim.stop(); G.Store.reset(); G.Sim.log.length = 0; shell(); render(true); } };
    simLive();
  };
  function simLive() {
    const l = $("#actList"); if (!l) return;
    l.innerHTML = G.Sim.active().slice(0, 16).map((x) => `<li><span class="num">${x.bikeId}</span><span>${esc(G.spotName(x.dest))}</span><span class="chip ${x.phase === "riding" ? "brand" : "warn"}">${a(x.phase === "riding" ? "st_riding" : "st_locked")}</span></li>`).join("") || `<li class="muted">—</li>`;
    const f = $("#feed"); if (f) feed(f);
  }
  V.settings = (el) => {
    const s = G.Store.get().settings;
    const num = (k, lbl, step = "0.001") => `<label class="frow"><span>${a(lbl)}</span><input type="number" step="${step}" min="0" data-k="${k}" value="${s[k]}" class="num"></label>`;
    el.innerHTML = `
      <div class="grid2">
        <section class="card"><div class="card-head"><h2>${a("pricing")}</h2></div>
          ${num("unlockFee", "unlockFee")}${num("blockFee", "blockFee")}${num("blockMin", "blockMin", "1")}${num("reserveFee", "reserveFee")}${num("nearM", "nearM", "10")}${num("holdMin", "holdMin", "1")}${num("parkRadiusM", "parkRadius", "10")}
        </section>
        <section class="card"><div class="card-head"><h2>${a("vision")}</h2></div>
          <label class="frow"><span>${a("visionEngine")}</span><select data-k="visionEngine">${["auto", "device", "claude"].map((v) => `<option value="${v}" ${s.visionEngine === v ? "selected" : ""}>${a("e_" + v)}</option>`).join("")}</select></label>
          <label class="frow"><span>${a("apiKey")}</span><input type="password" data-k="claudeKey" value="${esc(s.claudeKey)}" placeholder="sk-ant-…" dir="ltr" autocomplete="off"></label>
          <label class="frow"><span>${a("model")}</span><input data-k="claudeModel" value="${esc(s.claudeModel)}" dir="ltr"></label>
          <p class="muted small">${a("apiKeyHint")}</p>
        </section>
      </div>
      <button class="btn btn-primary" id="saveSet">${a("save")}</button>`;
    $("#saveSet").onclick = () => {
      G.Store.update((db) => { el.querySelectorAll("[data-k]").forEach((i) => { db.settings[i.dataset.k] = i.type === "number" ? +i.value : i.value; }); G.Store.log("PUT", "/settings", { pricing: { unlock: db.settings.unlockFee, block: db.settings.blockFee, reserve: db.settings.reserveFee } }); });
      flash(a("saved"));
    };
  };
  V.api = (el) => {
    const log = G.Store.get().api.slice().reverse().slice(0, 200);
    el.innerHTML = `<section class="card"><pre class="code tall">${log.map((x) => `${G.hhmm(x.t)}  ${x.method.padEnd(4)} ${x.path}  ${JSON.stringify(x.body)}`).map(esc).join("\n") || a("noData")}</pre></section>`;
  };

  function flash(msg) { const d = document.createElement("div"); d.className = "flash"; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2000); }

  // ------------------------------------------------------------------ render loop
  let lastFull = 0, lastSlow = 0;
  function render(force) {
    const el = $("#view");
    if (force) { if (lmap) { lmap.remove(); lmap = null; } hideTip(); V[view](el); el.scrollTop = 0; lastFull = lastSlow = performance.now(); return; }
    const now = performance.now();
    if (view === "sim") return simLive();
    if (now - lastFull < 1500) return;
    lastFull = now;
    if (view === "overview") return fillOverview();
    if (view === "map") return drawMapData();
    if (view === "rides" || view === "fleet" || (view === "forecast" && now - lastSlow > 10000)) { lastSlow = now; const sc = el.scrollTop; V[view](el); el.scrollTop = sc; }
  }

  if (!G.Store.get().seeded && !G.Store.get().rides.length) G.Sim.seedHistory();
  shell(); clockTick(); render(true);
  if (G.Store.get().sim.running) { G.Sim.start(); shell(); }
  setInterval(clockTick, 500);
  G.on((w) => { if (w === "clock") { clockTick(); shell(); } if (w === "live") drawLive(); if (w === "db") render(false); });
  G.Sim.on(() => { if (view === "sim") simLive(); });
  setInterval(() => render(false), 3000);
})();
