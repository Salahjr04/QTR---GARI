# Gari backend: guide for humans and AI agents

One Node.js file, `server.js`, with **no npm dependencies** (only Node's built-in `http`, `fs`, `crypto`). It serves the website and the API from the same address, so one link gives judges and riders everything.

```bash
ADMIN_PASSWORD=choose-one node backend/server.js     # http://localhost:8000  (rider /, admin /admin.html)
```

## What it contains
| Part | What it does |
|---|---|
| Website server | Serves `index.html`, `admin.html`, `css/`, `js/`, `assets/`, `vendor/`, `test-photos/` and nothing else (no `backend/`, `server/`, `docs/`, dot-files) |
| REST API (`/api`) | Sign-in, shared rides, bikes, settings, live rider positions, API log |
| Accounts | Username + password accounts (scrypt-hashed passwords). Apple / Google / guest stay simulated and belong to the device |
| Sessions | HMAC-SHA256 signed tokens, valid 7 days, sent as `Authorization: Bearer` |
| Roles | Rider: reads and writes only their own rides. Admin: everything, plus settings and reset |
| Pricing authority | The total of a finished ride is recalculated on the server from its own settings |
| Database | One JSON file (`DATA_DIR/db.json`), written atomically. Every record has a revision number so pages fetch only what changed |
| Protection | Rate limits per IP (stricter on sign-in), 3 MB request limit, input validation, CSP and other security headers, CORS allow-list |

## API
| Method and path | Who | Purpose |
|---|---|---|
| `GET /api/health` | anyone | Is the backend there |
| `POST /api/auth/rider` | anyone | `{provider:"password", username, password}` creates the account or checks the password; `{provider:"guest"\|"apple"\|"google", id, name}` for simulated sign-in. Returns `{token, user}` |
| `POST /api/auth/admin` | anyone | `{password}` → `{token}` (8 tries a minute per IP) |
| `GET /api/state?since=N&epoch=E` | signed in | Everything that changed after revision `N`: rides (own for riders, all for admin), bikes, settings, live positions; admin also gets users and the API log |
| `POST /api/sync` | signed in | Batch of changed `rides`, `bikes`, `users`, `log`; admin may also send `settings`, `live`, `seeded`. Returns the ids it refused |
| `POST /api/admin/reset` | admin | Wipes rides and bikes (accounts with passwords are kept) |

The browser side is `js/sync.js`: it pushes local changes and pulls others' every 1.5 s. With no backend it does nothing and the app runs on localStorage.

## Configuration (environment variables)
| Name | Default | Notes |
|---|---|---|
| `PORT` | `8000` | Hosts set this themselves |
| `ADMIN_PASSWORD` | random, printed in the log at start | **Set it.** Never commit it |
| `GARI_SECRET` | random, saved in `DATA_DIR/secret` | Signs tokens. Changing it signs everyone out |
| `DATA_DIR` | `backend/data` (git-ignored) | Where `db.json` lives. Use a persistent disk in production |
| `ALLOWED_ORIGINS` | empty | Other sites allowed to call the API (comma-separated). Same-origin needs nothing |

## Put it online (HTTPS link for judges)
The connection is encrypted by the host: Render, Railway, Fly and similar give every service an `https://` address with a certificate, and the server adds HSTS so browsers stay on HTTPS.

**Render (free):** New → Blueprint → choose this repository and branch → type an `ADMIN_PASSWORD` → Apply. `render.yaml` does the rest. Or New → Web Service: build `npm install`, start `node backend/server.js`, add `ADMIN_PASSWORD`.
On the free plan the service sleeps after about 15 minutes without visitors (the first visit then takes up to a minute) and the disk is cleared on restart, so open the link shortly before a demo.

**Docker:** see `Dockerfile`.

## Security rules (do not weaken)
1. No password, token secret or API key in the repository, logs, responses or chat. The Anthropic key stays in `server/` (Cloudflare Worker) as before; this backend never accepts or stores it.
2. Riders must never receive other riders' rides, names or photos. Keep the `admin || r.userId === who.uid` filter.
3. Keep server-side price calculation, the rate limits, the size limits and input validation.
4. Keep `PUBLIC` as an allow-list. Do not serve the repository root.
5. Apple / Google sign-in is simulated. Before real users, replace it with real provider checks.

## Known limits (prototype)
- One JSON file and one process: fine for a demo, replace with PostgreSQL before real traffic (`docs/ARCHITECTURE.md`).
- Sync is last-write-wins per record every 1.5 s, not a transaction per action.
- Each browser has its own simulation clock; the admin clock speed does not move riders' clocks on other devices.
