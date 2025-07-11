FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (for better layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 8000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8000/ || exit 1

# Command to run the application
CMD ["node", "dist/main"]
