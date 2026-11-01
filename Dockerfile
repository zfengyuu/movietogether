# Render compiles and serves React + Socket.IO from a single Node.js process.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm install reconciles pg with the pre-existing lockfile during Docker build.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    SERVE_STATIC=true
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/db ./db
COPY --from=build /app/scripts/migrate-db.mjs ./scripts/migrate-db.mjs
# Use Render preDeployCommand (npm run db:migrate) before the app starts.
USER node
EXPOSE 10000
CMD ["node","server/index.js"]
