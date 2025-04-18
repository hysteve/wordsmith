# Use the official Node.js 20 image as the base image
FROM node:20

# Install SQLite and Redis dependencies
RUN apt-get update && apt-get install -y redis-server sqlite3

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the project dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .
COPY .env .env

# Expose the port your app runs on
EXPOSE 3000

# Start Redis server in the background
RUN redis-server --daemonize yes

# Expose Redis port
EXPOSE 6379

# Define the command to start your Node.js API
CMD ["npm", "start"]