FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 7845

# Use a simple HTTP server to serve the built files
RUN npm install -g serve
CMD ["serve", "-s", "dist", "-l", "7845"]