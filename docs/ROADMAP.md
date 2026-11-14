# Roadmap · الخطوات الجاية

## Next
- [ ] **Separate admin from rider · فصل الأدمن عن المستخدم**: admin as its own site/deployment with real sign-in (team accounts only); the rider site should not link to it or ship admin code. Needs a shared backend (database + API) so both see the same rides instead of each browser's localStorage.
- [ ] Public website: deploy the rider app (GitHub Pages or similar) + `server/` vision proxy (see `docs/SECURE_API.md`).

## Later
- [ ] Real backend (rides, users, payments) replacing localStorage; see `docs/ARCHITECTURE.md`.
- [ ] Real sign-in with Apple / Google, real KNET / Apple Pay gateway, real smart-lock integration.
