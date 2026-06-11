FROM node:20-alpine AS builder-backend

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build


FROM node:20-alpine AS builder-frontend

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/index.html ./
COPY frontend/src ./src
RUN npm run build


FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=41234
ENV FRONTEND_URL=*

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=builder-backend /app/backend/dist ./dist
COPY --from=builder-backend /app/backend/data ./data
COPY --from=builder-frontend /app/frontend/dist ./public

RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 41234

CMD ["node", "dist/server.js"]
