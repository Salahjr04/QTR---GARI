# AGENTS.md

All AI coding assistants: read and follow **[CLAUDE.md](CLAUDE.md)** before making any change. It has the hard rules (the "Never" list) and the soft rules (advice and habits).

Short version: the app works end to end. Polish, fix and add features, but never remove or rewrite existing features, never change the brand colours, logo, font or theme structure, never change pricing or the "meter stops only after the photo is accepted" rule, keep admin separate from the rider app, and always keep Arabic + English and light + dark working. It must run both with the backend (`node backend/server.js`) and as plain static files. Test the full ride flow, then find that ride in the admin, before committing.

Secrets and servers: read [`backend/README.md`](backend/README.md), [`server/README.md`](server/README.md) and [`docs/SECURE_API.md`](docs/SECURE_API.md). Never put a key or password in the website, the repo or chat.
