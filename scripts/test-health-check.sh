#!/bin/bash

# Test script for health check functionality
# This script tests the health check endpoints

set -e

echo "Testing Health Check System..."
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

WORKER_URL="${WORKER_URL:-http://localhost:8787}"

echo -e "${YELLOW}Worker URL: $WORKER_URL${NC}"
echo ""

# Test 1: Run health check
echo "Test 1: Running health check..."
HEALTH_RESPONSE=$(curl -s "$WORKER_URL/health-check/run")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Health check endpoint is accessible${NC}"
    echo "Response: $HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Failed to run health check${NC}"
fi
echo ""

# Test 2: Get latest report
echo "Test 2: Getting latest health check report..."
LATEST_RESPONSE=$(curl -s "$WORKER_URL/health-check/latest")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Latest report endpoint is accessible${NC}"
    echo "Response: $LATEST_RESPONSE" | jq '.' 2>/dev/null || echo "$LATEST_RESPONSE"
else
    echo -e "${RED}✗ Failed to get latest report${NC}"
fi
echo ""

# Test 3: Get all reports
echo "Test 3: Getting all health check reports..."
REPORTS_RESPONSE=$(curl -s "$WORKER_URL/health-check/reports")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Reports endpoint is accessible${NC}"
    echo "Response: $REPORTS_RESPONSE" | jq '.' 2>/dev/null || echo "$REPORTS_RESPONSE"
else
    echo -e "${RED}✗ Failed to get reports${NC}"
fi
echo ""

# Test 4: Get health check history
echo "Test 4: Getting health check history..."
HISTORY_RESPONSE=$(curl -s "$WORKER_URL/health-check/history")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ History endpoint is accessible${NC}"
    echo "Response: $HISTORY_RESPONSE" | jq '.' 2>/dev/null || echo "$HISTORY_RESPONSE"
else
    echo -e "${RED}✗ Failed to get history${NC}"
fi
echo ""

echo "Health Check System Tests Complete!"
echo "===================================="

