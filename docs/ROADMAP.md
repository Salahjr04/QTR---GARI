# Roadmap · الخطوات الجاية

## Next
- [x] **Separate admin from rider · فصل الأدمن عن المستخدم**: admin has its own sign-in checked by the server and the rider app does not link to it; both share rides through `backend/` (see `backend/README.md`). Still to do: per-person admin accounts, and shipping admin as its own deployment.
- [x] Distance milestones (2 / 5 / 10 / 25 / 50 / 100 km).
- [ ] Rewards for milestones (for example a free unlock): must be calculated on the server.
- [ ] Public website: deploy the rider app (GitHub Pages or similar) + `server/` vision proxy (see `docs/SECURE_API.md`).

## Later
- [ ] Replace the JSON file with PostgreSQL + PostGIS and move from sync to one transaction per action; see `docs/ARCHITECTURE.md`.
- [ ] Share the simulation clock between devices.
- [ ] Real sign-in with Apple / Google, real KNET / Apple Pay gateway, real smart-lock integration.
