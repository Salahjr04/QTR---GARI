/* Gari photo check: decides whether a ride may end.
 * The meter only stops after the rider uploads a photo of the parked bike and it passes.
 *
 * Two engines:
 *  - on-device (default, works offline): image quality (brightness, sharpness), bicycle detection
 *    (two wheels found with a gradient Hough circle search), the green Gari smart lock (colour blob),
 *    and whether that lock sits on a wheel.
 *  - Claude vision (optional): when an Anthropic API key is set in Admin > Settings, the photo is also
 *    sent to Claude, which answers in a fixed JSON shape. Browser key use is for the prototype only;
 *    in production this call belongs on the server.
 * Both engines are combined with the facts the app already knows: the lock state reported by the
 * smart lock, and whether the GPS position is inside a Gari parking zone.
 */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const G = window.Gari;

  async function loadBitmap(file) {
    if (typeof file === "string") { const img = new Image(); img.src = file; await img.decode(); return img; }
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {} }
    const url = URL.createObjectURL(file); const img = new Image(); img.src = url; await img.decode(); return img;
  }
  function draw(bmp, w) {
    const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(bmp, 0, 0, w, h);
    return { c, x, w, h, d: x.getImageData(0, 0, w, h).data };
  }
  const grayOf = (d, n) => { const g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]; return g; };

  // ---------- 1. quality
  function quality(img) {
    const { w, h, d } = img, g = grayOf(d, w * h);
    let sum = 0; for (const v of g) sum += v; const mean = sum / g.length;
    let lm = 0, lv = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; lm += l; lv += l * l; n++; }
    lm /= n; const sharp = lv / n - lm * lm;
    return { brightness: Math.round(mean), sharpness: Math.round(sharp), tooDark: mean < 50, tooBright: mean > 230, blurry: sharp < 60 };
  }

  // ---------- 2. Gari smart lock (brand-green housing)
  function findLock(img) {
    const { w, h, d } = img, n = w * h, mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = d[4 * i] / 255, g = d[4 * i + 1] / 255, b = d[4 * i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
      if (mx < 0.28 || c / mx < 0.5) continue;
      let hue = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; hue *= 60; if (hue < 0) hue += 360;
      if (hue >= 145 && hue <= 175) mask[i] = 1;
    }
    // largest 4-connected blob
    const seen = new Uint8Array(n), stack = []; let best = null;
    for (let i = 0; i < n; i++) {
      if (!mask[i] || seen[i]) continue;
      let area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, sx = 0, sy = 0; stack.push(i); seen[i] = 1;
      while (stack.length) {
        const p = stack.pop(), x = p % w, y = (p / w) | 0; area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const nb = [p - 1, p + 1, p - w, p + w];
        for (let k = 0; k < 4; k++) { const q = nb[k]; if (q < 0 || q >= n || seen[q] || !mask[q]) continue; if ((k === 0 && x === 0) || (k === 1 && x === w - 1)) continue; seen[q] = 1; stack.push(q); }
      }
      if (!best || area > best.area) best = { area, x0, y0, x1, y1, cx: sx / area, cy: sy / area };
    }
    if (!best) return { found: false, frac: 0 };
    const frac = best.area / n, bw = best.x1 - best.x0 + 1, bh = best.y1 - best.y0 + 1, fill = best.area / (bw * bh);
    const found = frac > 0.0012 && frac < 0.09 && fill > 0.35 && bw / bh < 4.5 && bh / bw < 4.5;
    return { found, frac, fill, box: [best.x0 / w, best.y0 / h, bw / w, bh / h], cx: best.cx / w, cy: best.cy / h };
  }

  // ---------- 3. bicycle: two similar circles side by side (gradient Hough transform)
  function findWheels(img) {
    const { w, h, d } = img, g = grayOf(d, w * h);
    const mag = new Float32Array(w * h), gx = new Float32Array(w * h), gy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const sx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      const sy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
      gx[i] = sx; gy[i] = sy; mag[i] = Math.hypot(sx, sy);
    }
    const sorted = Array.from(mag).sort((a, b) => b - a), thr = Math.max(70, sorted[Math.floor(sorted.length * 0.1)]);
    const S = Math.min(w, h), rMin = Math.max(6, Math.round(S * 0.12)), rMax = Math.round(S * 0.46), nR = rMax - rMin + 1;
    const acc = new Float32Array(w * h * nR);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (mag[i] < thr) continue;
      const ux = gx[i] / mag[i], uy = gy[i] / mag[i];
      for (let ri = 0; ri < nR; ri++) {
        const r = rMin + ri;
        for (const s of [1, -1]) {
          const cx = Math.round(x + s * ux * r), cy = Math.round(y + s * uy * r);
          if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
          acc[(ri * h + cy) * w + cx] += 1;
        }
      }
    }
    // score = votes in a 3x3 window / circumference; keep local maxima
    const cands = [];
    for (let ri = 0; ri < nR; ri += 1) {
      const r = rMin + ri, circ = 2 * Math.PI * r, base = ri * h * w;
      for (let y = 2; y < h - 2; y += 1) for (let x = 2; x < w - 2; x += 1) {
        let v = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += acc[base + (y + dy) * w + x + dx];
        const sc = v / circ; if (sc > 0.32) cands.push({ x, y, r, sc });
      }
    }
    cands.sort((a, b) => b.sc - a.sc);
    const peaks = [];
    for (const c of cands) { if (peaks.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > Math.max(p.r, c.r) * 0.6)) peaks.push(c); if (peaks.length >= 10) break; }
    let pair = null;
    for (let a = 0; a < peaks.length; a++) for (let b = a + 1; b < peaks.length; b++) {
      const A = peaks[a], B = peaks[b], rr = A.r / B.r, rm = (A.r + B.r) / 2, dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
      if (rr < 0.78 || rr > 1.28 || dy > 0.4 * rm || dx < 1.45 * rm || dx > 4.2 * rm) continue;
      const sc = Math.min(A.sc, B.sc); if (!pair || sc > pair.sc) pair = { A, B, sc };
    }
    const wheels = pair ? [pair.A, pair.B].map((c) => ({ x: c.x / w, y: c.y / h, r: c.r / w, sc: c.sc })) : [];
    return { found: !!pair, confidence: pair ? Math.min(0.99, 0.5 + pair.sc * 0.6) : 0, wheels };
  }

  // ---------- optional Claude vision
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";
  const SCHEMA = {
    type: "object", additionalProperties: false,
    required: ["is_bicycle", "smart_lock_visible", "lock_on_wheel", "bike_upright", "blocking_path", "parked_properly", "confidence", "reason_en", "reason_ar"],
    properties: {
      is_bicycle: { type: "boolean" }, smart_lock_visible: { type: "boolean" }, lock_on_wheel: { type: "boolean" },
      bike_upright: { type: "boolean" }, blocking_path: { type: "boolean" }, parked_properly: { type: "boolean" },
      confidence: { type: "number" }, reason_en: { type: "string" }, reason_ar: { type: "string" },
    },
  };
  async function askClaude(dataUrl, settings) {
    const { default: Anthropic } = await import(SDK_URL);
    const client = new Anthropic({ apiKey: settings.claudeKey, dangerouslyAllowBrowser: true });
    const res = await client.beta.messages.create({
      model: settings.claudeModel || "claude-opus-5-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } },
        { type: "text", text: "You check end-of-ride photos for Gari, a bike-sharing service in Kuwait. Every Gari bike has a smart lock with a green housing mounted on the rear wheel; when locked its bolt passes through the wheel. Look at the photo and report: is there a bicycle; is the green smart lock visible; is the lock on a wheel (not lying loose); is the bike upright; is it blocking a walkway, door or road; and overall is it parked properly. Give a short reason in English and in Kuwaiti Arabic." },
      ] }],
    });
    if (res.stop_reason === "refusal") throw new Error("refusal");
    const txt = res.content.find((b) => b.type === "text")?.text || "{}";
    return JSON.parse(txt);
  }

  // ---------- main
  async function analyze(file, ctx = {}) {
    const t0 = performance.now();
    const bmp = await loadBitmap(file);
    const big = draw(bmp, 320), small = draw(bmp, 200);
    const thumbC = draw(bmp, 480).c, thumb = thumbC.toDataURL("image/jpeg", 0.72);
    const q = quality(big), lock = findLock(big), bike = findWheels(small);
    const settings = ctx.settings || G.Store.get().settings;
    let ai = null, engine = "device";
    const wantClaude = settings.claudeKey && settings.visionEngine !== "device";
    if (wantClaude) { try { ai = await askClaude(draw(bmp, 1024).c.toDataURL("image/jpeg", 0.85), settings); engine = "claude"; } catch (e) { console.warn("Claude vision unavailable, using on-device result", e); ai = null; } }

    // is the lock on a wheel? (lock centre within ~1.35 wheel radii of a wheel centre; aspect-corrected)
    const aspect = big.h / big.w;
    let onWheel = false;
    if (lock.found && bike.found) onWheel = bike.wheels.some((wh) => Math.hypot(lock.cx - wh.x, (lock.cy - wh.y) * aspect) < wh.r * 1.35);

    const checks = [];
    const add = (id, status, detail) => checks.push({ id, status, detail });
    add("quality", q.tooDark || q.tooBright || q.blurry ? "fail" : "pass", q.tooDark ? "dark" : q.tooBright ? "bright" : q.blurry ? "blurry" : "ok");
    const qOk = checks[0].status === "pass";
    if (ai) {
      add("bike", ai.is_bicycle ? "pass" : "fail", ai.is_bicycle ? "ok" : "none");
      add("lock", ai.smart_lock_visible ? "pass" : "fail", ai.smart_lock_visible ? "ok" : "none");
      add("onwheel", ai.lock_on_wheel ? "pass" : "fail", ai.lock_on_wheel ? "ok" : "loose");
      add("upright", ai.bike_upright && !ai.blocking_path ? "pass" : "warn", ai.blocking_path ? "blocking" : ai.bike_upright ? "ok" : "fallen");
    } else {
      add("bike", !qOk ? "skip" : bike.found ? "pass" : "warn", bike.found ? "ok" : "unsure");
      add("lock", !qOk ? "skip" : lock.found ? "pass" : "fail", lock.found ? "ok" : "none");
      add("onwheel", !qOk || !lock.found ? "skip" : !bike.found ? "warn" : onWheel ? "pass" : "fail", onWheel ? "ok" : bike.found ? "loose" : "unsure");
    }
    add("lockstate", ctx.lockState === "locked" ? "pass" : "fail", ctx.lockState === "locked" ? "ok" : "open");
    let zone = null;
    if (ctx.at) { zone = G.nearestSpot(ctx.at); add("zone", zone.d <= settings.parkRadiusM ? "pass" : "fail", Math.round(zone.d)); }

    const anyFail = checks.some((c) => c.status === "fail");
    const anyWarn = checks.some((c) => c.status === "warn");
    const verdict = anyFail ? "fail" : anyWarn ? "review" : "pass";
    return {
      engine, verdict, checks, ms: Math.round(performance.now() - t0), thumb,
      metrics: { ...q, lockFrac: +(lock.frac || 0).toFixed(4), bikeConfidence: +bike.confidence.toFixed(2) },
      overlay: { wheels: bike.wheels, lock: lock.found ? lock.box : null, aspect },
      ai, zone: zone ? { spot: zone.spot?.id, d: Math.round(zone.d) } : null,
    };
  }

  G.Vision = { analyze };
})();
