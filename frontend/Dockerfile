FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build step is usually for production, for a portfolio we can run dev or build
# RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
