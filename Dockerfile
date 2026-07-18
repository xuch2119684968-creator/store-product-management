FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/
RUN npm ci && npm ci --prefix server && npm ci --prefix client
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run db:generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 10000
CMD ["sh", "-c", "npm run db:deploy && npm run start:cloud"]
