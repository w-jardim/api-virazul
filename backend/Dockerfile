FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY database ./database
EXPOSE 3000
CMD ["npm", "start"]
