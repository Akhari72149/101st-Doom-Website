FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

COPY ./Auto\ Server /app/AutoServer

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]