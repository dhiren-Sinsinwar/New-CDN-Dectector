FROM ghcr.io/puppeteer/puppeteer:22.8.2
USER root
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server.js ./
COPY public/ ./public/
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
