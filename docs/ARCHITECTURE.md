# Gari architecture

## Prototype (this repository)
Static HTML/CSS/JS, no build step, no server.

```
index.html (rider) ─┐                       ┌─ js/forecast.js  AI demand + congestion
admin.html (admin) ─┼─ js/core.js ──────────┼─ js/vision.js    photo check (on-device / Claude)
                    │  settings, pricing,   └─ js/sim.js       simulated riders (admin page)
                    │  sim clock, ride API
                    └─ localStorage + BroadcastChannel (both tabs see the same data live)
```

Ride lifecycle (each step is logged as the API call it stands for, see Admin → API log):

| Step | Call | Meter |
|---|---|---|
| Book a far bike | `POST /rides` (fee 0.250) | – |
| Unlock in the app | `POST /rides/:id/unlock` (fee 1.000) | starts |
| GPS points | batched track updates | running |
| Press-and-hold lock | `POST /rides/:id/lock` | **still running** |
| Photo | `POST /rides/:id/photo` (verdict + checks) | stops only on pass / review |
| Complete | `POST /rides/:id/complete` | stopped |
| Pay | `POST /payments` (KNET / Visa / Apple Pay) | – |

Simulation clock: `now = baseSim + (realNow − baseReal) × speed`, stored in localStorage so the rider app and the admin share it. Speed ×30 means one real second is thirty simulated seconds.

## Full stack (this repository, `backend/`)
```
[rider phone]  index.html ─┐                                   ┌─ rides, bikes, users, settings, API log
[rider phone]  index.html ─┼─ js/sync.js ──HTTPS──▶ backend/server.js ──▶ db.json
[admin laptop] admin.html ─┘   push changes,         REST API + website,
                               pull every 1.5 s      roles, server-side pricing
```
Each page keeps working from its local copy and `js/sync.js` shares it: riders send and receive only their own rides, the admin receives everything, and the server recalculates every finished ride's total. Without a backend the same pages run on localStorage alone.

## Production (proposed)
```
[iOS / Android / web app] ──HTTPS──▶ [API server] ──▶ [PostgreSQL + PostGIS]
        │ Bluetooth                      ├─▶ [photo storage]
        ▼                                ├─▶ [payments: KNET / Visa / Apple Pay gateway]
   [smart lock] ──LTE──▶ [lock IoT service]
                                         ├─▶ [Claude vision for photo checks]
                                         └─▶ [forecast job: demand per zone, rebalancing]
```
- The lock only accepts signed commands from the server, relayed by the app over Bluetooth (or LTE).
- The photo check runs server-side; the API key never reaches the phone.
- The forecast is retrained on real ride history; the simulator stays as a what-if tool for operations.
