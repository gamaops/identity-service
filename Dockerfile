FROM node:12-stretch-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --loglevel verbose

COPY . .

RUN npm run build

EXPOSE 32001

CMD [ "node", "build/index.js" ]