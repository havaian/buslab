FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && ls -la dist/

RUN mkdir -p /app/uploads

EXPOSE 10161

CMD ["node", "dist/main"]