# Puppeteer + Chrome on Fly.io
FROM ghcr.io/puppeteer/puppeteer:22.8.2

# Run as root
USER root

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.js ./
COPY public/ ./public/

# Fly.io uses PORT env var (default 8080, but we set 3000)
ENV PORT=3000
EXPOSE 3000

# Limit Node.js memory to reduce costs on Fly.io
CMD ["node", "--max-old-space-size=512", "server.js"]
