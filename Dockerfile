FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3001
ENV SERVE_STATIC=true
EXPOSE 3001
CMD ["node", "server/index.js"]
