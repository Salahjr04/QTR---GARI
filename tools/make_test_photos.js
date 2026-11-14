// Renders the sample end-of-ride photos into ../test-photos and runs the on-device photo check on each.
// Usage: node tools/make_test_photos.js   (needs Playwright + Chromium)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const out = path.join(root, "test-photos");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.join(__dirname, "test-photos.html"));
  const names = await page.evaluate(() => window.SCENES);
  for (const n of names) {
    const url = await page.evaluate((n) => window.render(n), n);
    fs.writeFileSync(path.join(out, n + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
  }
  // check every photo with the same analyzer the app uses
  await page.addScriptTag({ path: path.join(root, "js/vision.js") });
  const settings = { parkRadiusM: 80, visionEngine: "device", claudeKey: "" };
  for (const n of names) {
    const b64 = fs.readFileSync(path.join(out, n + ".jpg")).toString("base64");
    const r = await page.evaluate(async ([b64, settings]) => {
      const a = await window.Gari.Vision.analyze("data:image/jpeg;base64," + b64, { settings, lockState: "locked" });
      return { verdict: a.verdict, checks: a.checks.map((c) => `${c.id}:${c.status}`).join(" "), m: a.metrics, wheels: a.overlay.wheels.map((w) => [w.x.toFixed(2), w.y.toFixed(2), w.r.toFixed(2)].join(",")).join(" | ") };
    }, [b64, settings]);
    console.log(n.padEnd(28), r.verdict.padEnd(7), r.checks, JSON.stringify(r.m), r.wheels);
  }
  await browser.close();
})();
