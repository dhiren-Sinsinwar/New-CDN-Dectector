# Uses the official Puppeteer Docker image — Chrome + all libs pre-installed
FROM ghcr.io/puppeteer/puppeteer:22.8.2

# Run as root to avoid permission issues on Railway
USER root

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy server and frontend
COPY server.js ./
COPY public/ ./public/

# Railway assigns PORT dynamically
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
