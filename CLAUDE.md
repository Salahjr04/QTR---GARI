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
- Put an API key, password or any secret in the website, the repo, logs or chat. Claude photo checks on a public site go through `server/` only; follow `server/README.md` and `docs/SECURE_API.md`. The admin password and token secret are environment variables of `backend/` (`backend/README.md`).
- Weaken the backend's security rules (`backend/README.md`): riders only get their own rides, prices are recalculated on the server, rate and size limits stay, only the public folders are served.
- Link the admin dashboard from the rider app or remove the admin sign-in gate. Admin and rider are separate on purpose.
- Rename localStorage keys (`gari.db.v1`, `gari.clock.v1`, ...) without a migration.

## Core features (must keep working)
Rider app `index.html`:
1. Sign-in: Apple / Google (simulated), username + password, faint "Skip"; 18+ and helmet consent; Terms and Privacy.
2. Map of the Capital Governorate opens first, nearest bike highlighted.
3. Booking a far bike (> 100 m) costs 0.250 KD and holds it 15 min; near bikes unlock directly.
4. Unlock only through the app (Bluetooth animation). Unlock 1.000 KD incl. first 10 min, then 0.100 KD per 10 min.
5. Ride on real streets to a parking zone; movement speed control (x1/x2/x10/x30) labelled as simulation.
6. Press-and-hold lock; meter keeps running; photo check (quality, bike, green lock, lock on wheel, lock closed, inside zone). Default is lenient (team decision for the prototype): a photo is refused only when there is no bicycle in it, the other photo findings are warnings and the ride is accepted under review. Lock state and parking zone stay hard rules. Admin → Settings can switch the strict rules back on.
7. Payment: KNET, Visa, Apple Pay (simulated), receipt, rating.
8. AI forecast layer (traffic + demand), Arabic/English, light/dark/auto, ride history, wallet.
9. Distance milestones at 2, 5, 10, 25, 50 and 100 km (receipt progress bar, "My milestones" in the menu).

Full stack: with `backend/server.js` running, every phone and the admin share rides, bikes and settings through the API (`js/sync.js`); a ride finished on a phone appears on the admin dashboard within seconds. Without a backend the app must still work from localStorage.

Admin `admin.html` (separate page, own sign-in): overview KPIs and chart, live map, AI forecast + rebalancing, rides with photo checks and API calls, fleet, simulator (clock x1-x600, presets, weather, events, rates), settings (prices, optional Claude API key), API log.

Photos: `test-photos/` holds sample upload photos with expected results for both modes (`test-photos/README.md`); keep them and keep the analyzer giving those results (`node tools/make_test_photos.js` prints each strict verdict).

## How to work
- Make the smallest change that does the job. Edit, don't rewrite files.
- Run it: `ADMIN_PASSWORD=dev node backend/server.js` (full stack) and also `python3 -m http.server 8000` (static, no backend; admin demo password `gari-admin`). Open `/` and `/admin.html` in both. Check the browser console has no errors, in Arabic and English, light and dark, at phone width (390 px) and desktop.
- Walk the full ride once after any change to the rider flow: sign in → reserve → walk → unlock → pick destination → ride → hold to lock → upload `test-photos/07_fail_no_bike.jpg` (must be refused) → upload `01_pass_locked_park.jpg` (must pass) → pay → receipt. With the backend running, sign in to `/admin.html` in another browser profile and check the ride is there with its photo.
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
| `js/sync.js` | talks to the backend: pushes local changes, pulls everyone else's |
| `backend/` | Node.js server: website + REST API + JSON database (read `backend/README.md` before touching it) |
| `server/` | Cloudflare Worker that keeps the Anthropic API key secret (read `server/README.md` before touching it) |
| `vendor/` | Leaflet, TensorFlow.js and the COCO-SSD bike detector (third-party; do not edit) |
| `render.yaml`, `Dockerfile`, `package.json` | deployment |
More detail: `README.md`, `docs/ARCHITECTURE.md`.

## Soft rules: advice for any AI working here
These are habits, not laws. Follow them by default; when one clearly doesn't fit the task, use judgment and say in your summary what you did instead and why. The "Never" list above is different: those stay hard.

**Before you change anything**
- Read the file you are about to edit and the two or three functions around your change. Most of the UI is built from template strings, so one missing key or wrong selector breaks a screen without any error at load.
- Find out whether something is simulated or real before "fixing" it. Sign-in with Apple/Google, Bluetooth, payments, GPS movement and the clock speed are simulated on purpose and labelled so.
- If the request is vague ("make it better"), pick the smallest useful reading, do it, and list what else you would do. Don't redesign on a guess.

**While you work**
- Prefer adding to changing, and changing to rewriting. New CSS goes at the end of the file with a comment; new strings go next to their neighbours in both languages.
- Keep it dependency-free: no build step, no npm packages in the website, no CDN scripts for core features. If a library is really needed, put a pinned copy in `vendor/` with its source and license written down.
- The app must work in three places: with the backend, on plain static hosting, and opened in two tabs. Anything new that needs the server should fall back quietly when there isn't one.
- Local-first: the page updates its own copy immediately and `js/sync.js` shares it. Don't make the rider wait on the network for a tap.
- Money and permissions are decided on the server. If you add a fee, discount or reward, calculate it in `backend/server.js` too, never only in the browser.
- Never send one rider's data to another rider. When you add an API field, ask "who can read this?" first.
- Every text a person sees needs Arabic (Kuwaiti dialect, short and friendly) and English, and has to read correctly right-to-left. Numbers stay Western digits.
- Test at 320 px wide, 390 px, a landscape phone and a desktop. Check light and dark.
- Don't use a browser `alert`/`prompt` for flows; use the existing modal and toast in `js/ui.js`.
- Keep comments short and about why. Match the style already in the file.

**Before you say it's done**
- Run the full ride yourself (see "How to work") and look at the screen, not only the console. Then open the admin and find that ride.
- Run both modes: with `node backend/server.js` and with a plain static server.
- If you could not test something (real phone camera, real deployment), say so plainly. Don't report it as working.
- Say what you changed, what you left alone, and anything a teammate must do by hand (set a password, deploy, share a link).

**Things that went wrong before, so avoid them**
- A grid row holding an `overflow: hidden` element collapsed to zero height inside a scrolling panel (the admin photo disappeared). Use `grid-auto-rows: max-content` or `min-height` in scrolling grids.
- A Leaflet base map was added before the map had a view, which threw and left a blank map. Call `setView` first.
- Long unbroken text (JSON, ids) stretched a panel. Give grid children `min-width: 0` and let code blocks scroll.
- Accounts shared one id across devices (`guest`), so two phones would have shared one ride. Simulated accounts now carry a device id; keep that.
- Photo checks that are too strict fail honest riders in a demo; checks that are too loose stop the meter for a photo of the floor. Change thresholds only with photos that prove it, and add those cases to `test-photos/README.md`.

**Avoid**
- Large refactors, renames or reformatting mixed into a feature commit.
- Deleting code because it "looks unused" without searching both pages and the simulator for it.
- Adding analytics, trackers, external fonts or scripts, or anything that phones home.
- Storing secrets, real card numbers or full-size photos. Thumbnails only.
- Force-pushing, rewriting history, or committing straight to `main` without the team asking.
- Promising security the prototype does not have. Say "simulated" where it is.

**Commits**
- One topic per commit, a clear sentence as the title, and the reason in the body. Commit and push after each finished piece so there is always a working checkpoint to go back to.
