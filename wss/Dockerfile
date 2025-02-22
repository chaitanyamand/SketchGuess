FROM node:21-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

RUN npm install -g typescript

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc -b

EXPOSE ${PORT}

CMD ["sh", "-c", "node dist/index.js"]
