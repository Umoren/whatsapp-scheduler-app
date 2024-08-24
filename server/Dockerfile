FROM node:20

WORKDIR /app

# Copy server package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the server code
COPY . .

# Install system dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 \
    libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
    libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
    libappindicator1 libnss3 lsb-release xdg-utils wget

COPY prod_start.sh .
RUN chmod +x prod_start.sh

CMD ["./prod_start.sh"]