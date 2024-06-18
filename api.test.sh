#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

BASE_URL=${WORDSMITH_BASE_URL:-"http://localhost:3000"}
MASTER_KEY=${WORDSMITH_MASTER_KEY:-"your_master_key_here"}

# Function to check if a request is forbidden
function check_forbidden() {
  if [[ $1 == *"Forbidden"* ]]; then
    echo "Request forbidden as expected"
  else
    echo "Request was not forbidden"
    exit 1
  fi
}

# Create API key
CREATE_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/create-key" -H "x-master-key: $MASTER_KEY")
API_KEY=$(echo $CREATE_KEY_RESPONSE | grep -o '"apiKey":"[^"]*' | grep -o '[^"]*$')

if [ -z "$API_KEY" ]; then
  echo "Failed to create API key"
  exit 1
fi

echo "Created API key: $API_KEY"

# Perform requests with the created API key
RESPONSE_DOMAINS=$(curl -s -X GET "$BASE_URL/domains?domain=example.com" -H "x-api-key: $API_KEY")
RESPONSE_RANKED=$(curl -s -X GET "$BASE_URL/ranked?searchQuery=web%20development" -H "x-api-key: $API_KEY")
RESPONSE_KEYWORDS=$(curl -s -X GET "$BASE_URL/keywords?url=https://example.com" -H "x-api-key: $API_KEY")
RESPONSE_SYN=$(curl -s -X GET "$BASE_URL/syn?word=example" -H "x-api-key: $API_KEY")
RESPONSE_GOOGLED=$(curl -s -X GET "$BASE_URL/googled?phrase=example" -H "x-api-key: $API_KEY")

# Print first 200 characters of each response
echo "Response Domains: ${RESPONSE_DOMAINS:0:200}"
echo "Response Ranked: ${RESPONSE_RANKED:0:200}"
echo "Response Keywords: ${RESPONSE_KEYWORDS:0:200}"
echo "Response Syn: ${RESPONSE_SYN:0:200}"
echo "Response Googled: ${RESPONSE_GOOGLED:0:200}"

# Check HTTP status codes
HTTP_STATUS_DOMAINS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/domains?domain=example.com" -H "x-api-key: $API_KEY")
HTTP_STATUS_RANKED=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/ranked?searchQuery=web%20development" -H "x-api-key: $API_KEY")
HTTP_STATUS_KEYWORDS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/keywords?url=https://example.com" -H "x-api-key: $API_KEY")
HTTP_STATUS_SYN=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/syn?word=example" -H "x-api-key: $API_KEY")
HTTP_STATUS_GOOGLED=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/googled?phrase=example" -H "x-api-key: $API_KEY")

if [ "$HTTP_STATUS_DOMAINS" -ne 200 ] || [ "$HTTP_STATUS_RANKED" -ne 200 ] || [ "$HTTP_STATUS_KEYWORDS" -ne 200 ] || [ "$HTTP_STATUS_SYN" -ne 200 ] || [ "$HTTP_STATUS_GOOGLED" -ne 200 ]; then
  echo "API requests failed with the created key"
  exit 1
fi

echo "API requests succeeded with the created key"

# Revoke API key
REVOKE_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/revoke-key" -H "x-master-key: $MASTER_KEY" -H "Content-Type: application/json" -d "{\"apiKey\": \"$API_KEY\"}")
REVOKE_MESSAGE=$(echo $REVOKE_KEY_RESPONSE | grep -o '"message":"[^"]*' | grep -o '[^"]*$')

if [ "$REVOKE_MESSAGE" != "API key revoked" ]; then
  echo "Failed to revoke API key"
  exit 1
fi

echo "Revoked API key: $API_KEY"

# Perform requests with the revoked API key
RESPONSE_DOMAINS_FORBIDDEN=$(curl -s "$BASE_URL/domains?domain=example.com" -H "x-api-key: $API_KEY")
RESPONSE_RANKED_FORBIDDEN=$(curl -s "$BASE_URL/ranked?searchQuery=web%20development" -H "x-api-key: $API_KEY")
RESPONSE_KEYWORDS_FORBIDDEN=$(curl -s "$BASE_URL/keywords?url=https://example.com" -H "x-api-key: $API_KEY")
RESPONSE_SYN_FORBIDDEN=$(curl -s "$BASE_URL/syn?word=example" -H "x-api-key: $API_KEY")
RESPONSE_GOOGLED_FORBIDDEN=$(curl -s "$BASE_URL/googled?phrase=example" -H "x-api-key: $API_KEY")

# Print first 200 characters of each forbidden response
echo "Response Domains Forbidden: ${RESPONSE_DOMAINS_FORBIDDEN:0:200}"
echo "Response Ranked Forbidden: ${RESPONSE_RANKED_FORBIDDEN:0:200}"
echo "Response Keywords Forbidden: ${RESPONSE_KEYWORDS_FORBIDDEN:0:200}"
echo "Response Syn Forbidden: ${RESPONSE_SYN_FORBIDDEN:0:200}"
echo "Response Googled Forbidden: ${RESPONSE_GOOGLED_FORBIDDEN:0:200}"

check_forbidden "$RESPONSE_DOMAINS_FORBIDDEN"
check_forbidden "$RESPONSE_RANKED_FORBIDDEN"
check_forbidden "$RESPONSE_KEYWORDS_FORBIDDEN"
check_forbidden "$RESPONSE_SYN_FORBIDDEN"
check_forbidden "$RESPONSE_GOOGLED_FORBIDDEN"

echo "Test completed successfully"