# Use the official Node.js 23.7.0 image as the base image
FROM node:23-alpine3.20

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install


RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the NestJS application

# Command to run the application
CMD ["sh", "-c", "npm run db:resolve && npm run start"]