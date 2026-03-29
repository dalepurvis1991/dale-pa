FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source
COPY . .

# Build Next.js
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# tsx handles TypeScript server at runtime
CMD ["npx", "tsx", "server.ts"]
