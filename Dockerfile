FROM node:alpine

WORKDIR /app
COPY server.js /app/server.js
COPY package.json /app/package.json
COPY public /app/public
COPY src /app/src

RUN npm install
EXPOSE 3000
ENTRYPOINT ["npm","run","start"]
