# Gari: backend API + website in one small image (no npm dependencies).
#   docker build -t gari . && docker run -p 8000:8000 -e ADMIN_PASSWORD=choose-one -v gari-data:/data gari
FROM node:22-alpine
WORKDIR /app
COPY package.json index.html admin.html ./
COPY backend/server.js backend/server.js
COPY css css
COPY js js
COPY assets assets
COPY vendor vendor
COPY test-photos test-photos
ENV PORT=8000 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8000
CMD ["node", "backend/server.js"]
