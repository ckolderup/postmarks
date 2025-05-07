FROM node:alpine

WORKDIR /app
COPY package.json /app/package.json
RUN npm install

COPY public /app/public
COPY server.js /app/server.js
COPY src /app/src

RUN npm install
EXPOSE 3000
ENTRYPOINT ["npm","run","start"]
