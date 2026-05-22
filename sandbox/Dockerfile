FROM node:20-alpine
WORKDIR /sandbox
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev", "--", "--port", "3001"]
