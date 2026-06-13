FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --from=builder /app/dist ./dist
COPY api ./api
COPY backend ./backend
COPY public ./public
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY nodemon.json ./

RUN mkdir -p backend/data

EXPOSE 3001 4173

COPY <<'EOF' /app/start.sh
#!/bin/sh
cd /app
npx tsx api/server.ts &
npx vite preview --host 0.0.0.0 --port 4173 &
wait
EOF
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
