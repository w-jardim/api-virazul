FROM node:20-bullseye-slim AS deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	fonts-liberation \
	libasound2 \
	libatk1.0-0 \
	libc6 \
	libcairo2 \
	libcups2 \
	libdbus-1-3 \
	libexpat1 \
	libfontconfig1 \
	libgcc1 \
	libgconf-2-4 \
	libgdk-pixbuf2.0-0 \
	libglib2.0-0 \
	libgtk-3-0 \
	libnspr4 \
	libnss3 \
	libpango-1.0-0 \
	libx11-6 \
	libx11-xcb1 \
	libxcb1 \
	libxcomposite1 \
	libxcursor1 \
	libxdamage1 \
	libxext6 \
	libxfixes3 \
	libxi6 \
	libxrandr2 \
	libxrender1 \
	libxss1 \
	libxtst6 \
	wget \
	&& rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY database ./database
EXPOSE 3000
CMD ["npm", "start"]
