#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


# QBusiness Tools Deployment Script
# This script updates the API_BASE_URL and Cognito configuration, builds the React app, and deploys to S3

set -e  # Exit immediately if a command exits with a non-zero status

# Function to display usage information
usage() {
  echo "Usage: $0 [-u <api_base_url>] [-s <stack_name>] [-c <cognito_stack_name>] [-r <region>]"
  echo ""
  echo "Options:"
  echo "  -u, --url         API base URL to use in the deployment (optional, will use CloudFront distribution URL if not provided)"
  echo "  -s, --stack       CloudFront stack name (default: CloudfronStack)"
  echo "  -c, --cognito     Cognito stack name (default: CognitoStack)"
  echo "  -r, --region      AWS region (default: us-east-1)"
  echo "  -h, --help        Display this help message"
  echo ""
  echo "Example:"
  echo "  $0 -s CloudfronStack -c CognitoStack -r us-west-2"
  exit 1
}

# Default values
STACK_NAME="CloudfronStack"
COGNITO_STACK_NAME="CognitoStack"
REGION="us-east-1"
API_BASE_URL=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -u|--url)
      API_BASE_URL="$2"
      shift 2
      ;;
    -s|--stack)
      STACK_NAME="$2"
      shift 2
      ;;
    -c|--cognito)
      COGNITO_STACK_NAME="$2"
      shift 2
      ;;
    -r|--region)
      REGION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# If API_BASE_URL is not provided, get it from CloudFront distribution
if [ -z "$API_BASE_URL" ]; then
  echo "API base URL not provided, retrieving from CloudFront distribution..."
  
  # Get CloudFront distribution domain from CloudFormation stack
  DISTRIBUTION_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?ExportName=='Distribution'].OutputValue" \
    --output text)
  
  if [ -z "$DISTRIBUTION_DOMAIN" ]; then
    echo "Error: Failed to get CloudFront distribution domain from CloudFormation stack"
    exit 1
  fi
  
  # Use HTTPS version of the CloudFront distribution URL
  API_BASE_URL="https://$DISTRIBUTION_DOMAIN"
  echo "Using CloudFront distribution URL: $API_BASE_URL"
fi

# Project root directory (one level up from cdk-deployment)
PROJECT_ROOT="../frontend"
API_CONSTANTS_FILE="$PROJECT_ROOT/src/constants/apiConstants.ts"

echo "=== QBusiness Tools Deployment ==="
echo "API Base URL: $API_BASE_URL"
echo "CloudFront Stack: $STACK_NAME"
echo "AWS Region: $REGION"
echo "Project Root: $PROJECT_ROOT"
echo ""

# Step 1: Update API_BASE_URL in apiConstants.ts
echo "Step 1: Updating API_BASE_URL in apiConstants.ts..."
if [ ! -f "$API_CONSTANTS_FILE" ]; then
  echo "Error: API constants file not found at $API_CONSTANTS_FILE"
  exit 1
fi

# Create a backup of the original file
cp "$API_CONSTANTS_FILE" "${API_CONSTANTS_FILE}.bak"

# Replace the API_BASE_URL value
sed -i.tmp "s|export const API_BASE_URL = '.*';|export const API_BASE_URL = '$API_BASE_URL';|" "$API_CONSTANTS_FILE"
rm -f "${API_CONSTANTS_FILE}.tmp"

echo "Updated API_BASE_URL to: $API_BASE_URL"
echo ""

# Step 2: Build the React app
echo "Step 2: Building React app..."
cd "$PROJECT_ROOT"
npm run build
if [ $? -ne 0 ]; then
  echo "Error: Failed to build React app"
  # Restore the original apiConstants.ts file
  mv "${API_CONSTANTS_FILE}.bak" "$API_CONSTANTS_FILE"
  exit 1
fi
echo "React app built successfully"
echo ""

# Step 3: Get S3 bucket name from CloudFormation stack
echo "Step 4: Getting S3 bucket name from CloudFormation stack..."
S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?ExportName=='S3Bucket'].OutputValue" \
  --output text)

if [ -z "$S3_BUCKET" ]; then
  echo "Error: Failed to get S3 bucket name from CloudFormation stack"
  exit 1
fi

echo "S3 bucket name: $S3_BUCKET"
echo ""

# Step 4: Deploy to S3
echo "Step 4: Deploying to S3 bucket..."
aws s3 sync "$PROJECT_ROOT/build" "s3://$S3_BUCKET" --delete --region "$REGION"
if [ $? -ne 0 ]; then
  echo "Error: Failed to deploy to S3 bucket"
  exit 1
fi

echo "Deployment completed successfully!"
echo "Your application is now deployed with API_BASE_URL: $API_BASE_URL"
echo "CloudFront may take a few minutes to propagate the changes"

# Step 6: Get CloudFront distribution domain
DISTRIBUTION_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?ExportName=='Distribution'].OutputValue" \
  --output text)

if [ ! -z "$DISTRIBUTION_DOMAIN" ]; then
  echo ""
  echo "Your application is available at: https://$DISTRIBUTION_DOMAIN"
fi

# Cleanup: Remove the backup files
rm -f "${API_CONSTANTS_FILE}.bak"
rm -f "${COGNITO_CONFIG_FILE}.bak"

exit 0
