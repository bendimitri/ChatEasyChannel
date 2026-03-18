FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npx nest build

FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]

