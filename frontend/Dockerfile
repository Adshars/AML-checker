# Use node 22 z Alpine Linux
FROM node:22-alpine

# Working directory inside the container
WORKDIR /app

# Copy configuration files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Vite uses port 5173 by default
EXPOSE 5173

# Start the development server
CMD ["npm", "run", "dev"]