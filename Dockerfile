# Use the latest Node.js image from Docker Hub
FROM node:latest

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Copy the rest of the application code to the container
COPY . .

# Copy the existing node_modules folder into the container
COPY node_modules ./node_modules

# Expose the port on which the Node.js application listens (assuming it is 3000)
EXPOSE 3000

# Start the Node.js application
CMD ["npm", "start"]
