# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the project
RUN npm run build

# Expose ports defined in your environment file
EXPOSE 4000 4001

# Set environment variables
ENV NODE_ENV=production

# Command to run the server in production mode
CMD ["npm", "run", "server:prod"]
