# Rules for AI assistants working on Gari

Read this before changing anything. It applies to Claude, Codex, Cursor, Copilot or any other AI (AGENTS.md points here).

## The product is ~80% done. Do not break it.
Polishing, small fixes, small layout tweaks and **new** features are welcome. Removing or rewriting what exists is not.

**Never, unless the team explicitly asks in the request:**
- Remove, rename or "simplify away" any feature listed below, even if it looks unused or simulated.
- Change the visual identity: the brand green (`--brand` #049B6E light / #2BBE89 dark), the logo files in `assets/`, the font (IBM Plex Sans Arabic), or the light/dark token structure in `css/tokens.css`. Add new tokens instead of editing existing ones.
- Restyle the whole app or switch frameworks (no React/Vue/Tailwind/build step migration). It is plain HTML/CSS/JS on purpose so anyone can open it.
- Change the pricing logic or default prices in `js/core.js` (`DEFAULT_SETTINGS`, `rideFee`).
- Change the rule that **the meter only stops after the end-of-ride photo passes** (`js/app.js` `onPhoto`, `API.complete`).
- Make the lock openable/closable any way other than through the app.
- Delete or rewrite the map data in `js/map/` (OpenStreetMap streets, routing graph, real parking spots).
- Break Arabic (default, RTL) or English. Every new UI string goes into **both** `ar` and `en` in `js/i18n.js` (admin strings: the `A` object in `js/admin.js`).
- Put an API key or any secret in the website, the repo, logs or chat. Claude photo checks on a public site go through `server/` only; follow `server/README.md` and `docs/SECURE_API.md`.
- Rename localStorage keys (`gari.db.v1`, `gari.clock.v1`, ...) without a migration.

## Core features (must keep working)
Rider app `index.html`:
1. Sign-in: Apple / Google (simulated), username + password, faint "Skip"; 18+ and helmet consent; Terms and Privacy.
2. Map of the Capital Governorate opens first, nearest bike highlighted.
3. Booking a far bike (> 100 m) costs 0.250 KD and holds it 15 min; near bikes unlock directly.
4. Unlock only through the app (Bluetooth animation). Unlock 1.000 KD incl. first 10 min, then 0.100 KD per 10 min.
5. Ride on real streets to a parking zone; movement speed control (x1/x2/x10/x30) labelled as simulation.
6. Press-and-hold lock; meter keeps running; photo check (quality, bike, green lock, lock on wheel, lock closed, inside zone).
7. Payment: KNET, Visa, Apple Pay (simulated), receipt, rating.
8. AI forecast layer (traffic + demand), Arabic/English, light/dark/auto, ride history, wallet.

Admin `admin.html`: overview KPIs and chart, live map, AI forecast + rebalancing, rides with photo checks and API calls, fleet, simulator (clock x1-x600, presets, weather, events, rates), settings (prices, optional Claude API key), API log.

Photos: `test-photos/` holds sample upload photos with expected results; keep them and keep the analyzer passing them (`node tools/make_test_photos.js` prints each verdict).

## How to work
- Make the smallest change that does the job. Edit, don't rewrite files.
- Run it: `python3 -m http.server 8000`, open `/` and `/admin.html`. Check the browser console has no errors, in Arabic and English, light and dark, at phone width (390 px) and desktop.
- Walk the full ride once after any change to the rider flow: sign in → reserve → walk → unlock → pick destination → ride → hold to lock → upload `test-photos/03_fail_no_lock.jpg` (must fail) → upload `01_pass_locked_park.jpg` (must pass) → pay → receipt.
- If a test photo's verdict changes after your edit, you broke the photo check. Revert.
- Keep simulated things clearly marked as simulation in the UI.
- Commit small, with clear messages, on the team's working branch. Do not force-push or rewrite shared history.
- If a request would require breaking one of the rules above, stop and ask the team first.

## Map of the code
| File | Role |
|---|---|
| `js/core.js` | settings, pricing, simulation clock, shared store, ride API |
| `js/app.js`, `js/ui.js`, `css/app.css` | rider app |
| `js/admin.js`, `css/admin.css`, `js/sim.js` | admin + simulator |
| `js/forecast.js` | AI demand / congestion model |
| `js/vision.js` | photo check (on-device + optional Claude) |
| `js/i18n.js` | strings (ar/en), theme |
| `js/map/` | basemap, streets, routing graph, parking spots |
| `css/tokens.css` | shared colours (light + dark) |
| `server/` | Cloudflare Worker that keeps the Anthropic API key secret (read `server/README.md` before touching it) |
More detail: `README.md`, `docs/ARCHITECTURE.md`.
