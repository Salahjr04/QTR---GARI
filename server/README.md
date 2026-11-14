# Gari vision proxy: guide for humans and AI agents

Read this fully before deploying or changing anything in `server/`. Also follow the repo rules in `../CLAUDE.md`.

## What it is
A Cloudflare Worker that lets the public Gari website use Claude to check end-of-ride photos **without the Anthropic API key ever reaching the browser, the repo or chat**.

```
browser (index.html) --POST {image}--> Worker /check --(secret key, fixed prompt)--> Anthropic Messages API
                     <-- photo-check JSON --
```

The website only uses it when Admin → Settings → "Vision server URL" (`settings.visionProxy`) is set. Without it, the app falls back to the on-device check (works offline, no key needed). Nothing in the app breaks if the proxy is down: `js/vision.js` catches the error and uses the on-device result.

## Files
| File | Purpose |
|---|---|
| `src/index.js` | The worker: CORS allow-list, rate limit, input validation, Claude call, JSON response |
| `wrangler.toml` | Name, entry point, non-secret config vars |
| `package.json` | `@anthropic-ai/sdk` (pinned 1.3.0) and `wrangler` |

## Security rules (do not weaken)
1. **Never** write the API key into any file, commit, log, response, issue, PR or chat. It exists only as the Worker secret `ANTHROPIC_API_KEY`. For local dev it may live in `server/.dev.vars`, which is git-ignored. Never remove that `.gitignore` entry.
2. Keep the **fixed prompt and model on the server**. Do not add a field that lets the client send its own prompt, model, `max_tokens`, tools or messages. The proxy must only ever do "check this bike photo".
3. Keep `ALLOWED_ORIGINS` to the team's real sites only. Never set it to `*`.
4. Keep the size limit (`MAX_BYTES`), the base64 check and the per-IP limit (`RATE_PER_HOUR`).
5. Never return the key, raw upstream errors or request headers in responses.
6. Use a **dedicated Anthropic workspace with a monthly spend limit** and a key made only for this project. Revoke it after the event.
7. Do not put the key in `js/` or in the browser `claudeKey` setting on a public site. That setting is only for a private demo on the key owner's own laptop.

## API contract
`POST {WORKER_URL}/check`
- Headers: `Content-Type: application/json`. The request `Origin` must be in `ALLOWED_ORIGINS`.
- Body: `{ "image": "<base64 JPEG, no data: prefix, ≤ ~1.5 MB>" }`. The app sends the photo resized to 1024 px wide, JPEG quality 0.85.

`200` response (exactly this shape; the app reads these fields):
```json
{
  "is_bicycle": true,
  "smart_lock_visible": true,
  "lock_on_wheel": true,
  "bike_upright": true,
  "blocking_path": false,
  "parked_properly": true,
  "confidence": 0.93,
  "reason_en": "Bike upright, green lock on the rear wheel.",
  "reason_ar": "الدراجة واقفة والقفل الأخضر على العجلة الخلفية."
}
```
If you change this shape, update `SCHEMA` in **both** `server/src/index.js` and `js/vision.js`, and the mapping in `analyze()` in `js/vision.js`.

Errors (JSON `{ "error": "<code>" }`):
| Status | code | Meaning |
|---|---|---|
| 403 | `origin_not_allowed` | Calling site not in `ALLOWED_ORIGINS` |
| 404 | `not_found` | Wrong method or path |
| 400 | `bad_json` / `bad_image` | Body not JSON, image missing, too big or not base64 |
| 429 | `rate_limited` | Too many checks from this IP this hour |
| 422 | `refused` | Claude declined the request (`stop_reason: "refusal"`) |
| 503 | `busy` | Anthropic rate limit |
| 502 | `upstream` | Other Anthropic API error (`status` included) |
| 500 | `server` | Anything else (e.g. unparsable model output) |

On any non-200 the app silently uses the on-device result.

## Config (`wrangler.toml` `[vars]`, not secret)
| Var | Default | Notes |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://salahjr04.github.io,http://localhost:8000` | Comma-separated exact origins (scheme + host + port, no path) |
| `MODEL` | `claude-opus-5-5` | Change only if the team asks |
| `RATE_PER_HOUR` | `30` | Per IP, per worker instance (best effort) |

Secret (never in the toml): `ANTHROPIC_API_KEY`.

The Claude call uses: `client.beta.messages.create`, `output_config: { effort: "low", format: { type: "json_schema", schema } }`, `max_tokens: 1024`, and server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`).

## Deploy (done by the key owner on their own machine)
```bash
cd server
npm install
npx wrangler login                            # Cloudflare account (free plan is fine)
npx wrangler secret put ANTHROPIC_API_KEY     # paste the key at the prompt; it is stored encrypted by Cloudflare
# edit wrangler.toml → ALLOWED_ORIGINS = your real site(s)
npx wrangler deploy                           # prints https://gari-vision-proxy.<account>.workers.dev
```
Then share **only the URL** with the team. In the website: Admin → Settings → Vision server URL → paste → Save. Leave the "Anthropic API key" box empty.

Optional hard limit: in the Cloudflare dashboard add a Rate Limiting rule for the worker route (e.g. 60 requests / 10 min per IP). The in-code limit is per instance and best effort.

## Local development
```bash
cd server
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .dev.vars   # git-ignored, never commit
npx wrangler dev                                  # http://localhost:8787
```
Serve the site from the repo root with `python3 -m http.server 8000` and set the Vision server URL to `http://localhost:8787`.

## Testing
```bash
# should be 403 (origin not allowed)
curl -s -X POST https://<worker>/check -H 'Content-Type: application/json' -d '{"image":"AAAA"}'

# real check with a sample photo (origin must be allowed)
IMG=$(base64 -w0 ../test-photos/01_pass_locked_park.jpg)
curl -s -X POST https://<worker>/check -H 'Origin: http://localhost:8000' \
  -H 'Content-Type: application/json' -d "{\"image\":\"$IMG\"}"
```
Expected with the sample photos: `01_*` and `02_*` → `is_bicycle`, `smart_lock_visible`, `lock_on_wheel` all true. `03_fail_no_lock` → `smart_lock_visible: false`. `04_fail_lock_not_on_wheel` → `lock_on_wheel: false`. `07_fail_no_bike` → `is_bicycle: false`.
The sample photos are ~0.5 MB JPEGs, under the limit. In the app they are resized before sending anyway.

End-to-end in the app: Admin → Settings → set the URL → rider app → do a ride → upload a photo → the result panel should say "Claude analysis" (تحليل Claude) instead of "On-device analysis".

## Troubleshooting
| Symptom | Fix |
|---|---|
| App always says "On-device analysis" | URL not saved in Admin settings, wrong URL (no `/check` needed, the app adds it), or origin not allowed. Check the browser console network tab |
| 403 `origin_not_allowed` | Add the exact site origin to `ALLOWED_ORIGINS`, redeploy |
| 502 with `status: 401` | Secret missing or wrong: `npx wrangler secret put ANTHROPIC_API_KEY` again |
| 502 with `status: 400` | Model name wrong or API shape changed. Check `MODEL` and the SDK version |
| 503 `busy` | Anthropic rate limit; wait, or raise the workspace limits |
| Works locally, not on the site | The site's origin (e.g. `https://<user>.github.io`) missing from `ALLOWED_ORIGINS` |

## Future (see `../docs/ROADMAP.md`)
When admin and rider are split and a real backend exists, this worker can become one route of that backend. Keep the same contract and the same security rules.
