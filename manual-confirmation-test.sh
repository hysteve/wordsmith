#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

BASE_URL=${WORDSMITH_BASE_URL:-"http://localhost:3000"}
MASTER_KEY=${WORDSMITH_MASTER_KEY:-"your_master_key_here"}

# Create API key
CREATE_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/create-key" -H "x-master-key: $MASTER_KEY" -H "Content-Type: application/json" -d '{"email": "test@example.com"}')
API_KEY=$(echo $CREATE_KEY_RESPONSE | grep -o '"apiKey":"[^"]*' | grep -o '[^"]*$')
CONFIRMATION_LINK=$(echo $CREATE_KEY_RESPONSE | grep -o '"confirmationLink":"[^"]*' | grep -o '[^"]*$')

if [ -z "$API_KEY" ]; then
  echo "Failed to create API key"
  exit 1
fi

echo "Created API key: $API_KEY"

HTML_LINK="${BASE_URL}/email?token=$(echo $CONFIRMATION_LINK | grep -o 'token=[^"]*' | cut -d '=' -f 2)"

echo "Please confirm your API key by visiting the following link in your browser:"
echo "$HTML_LINK"

read -p "Press Enter after confirming your API key..."

# Check if the API key is activated
CHECK_KEY_RESPONSE=$(curl -s "$BASE_URL/check-key-status?apiKey=$API_KEY")
echo $CHECK_KEY_RESPONSE
STATUS=$(echo $CHECK_KEY_RESPONSE | grep -o '"status":[^,}]*' | grep -o '[^:]*$')

if [ "$STATUS" == "1" ]; then
  echo "API key has been successfully activated."
else
  echo "API key activation failed."
  exit 1
fi