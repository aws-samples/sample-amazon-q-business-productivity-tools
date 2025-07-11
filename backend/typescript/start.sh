#!/bin/bash

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start the server in development mode
echo "Starting QBusiness Tools backend server..."
npm run start:dev
