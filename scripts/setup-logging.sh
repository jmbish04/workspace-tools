#!/bin/bash

# Setup Logging System Script
# This script sets up the enhanced logging system with D1 database storage

echo "🔧 Setting up Enhanced Logging System..."

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ wrangler.toml not found. Please run this script from the project root."
    exit 1
fi

echo "📊 Creating logs table in D1 database..."

# Run the migration
if wrangler d1 execute workspace-tools-db --file=./migrations/0002_create_logs_table.sql; then
    echo "✅ Logs table created successfully!"
else
    echo "❌ Failed to create logs table. Check your D1 database configuration."
    exit 1
fi

echo "🧪 Testing logging system..."

# Test the logging endpoints
WORKER_URL="https://workspace-tools.hacolby.workers.dev"

echo "Testing log statistics endpoint..."
curl -s "$WORKER_URL/logs/stats" | jq . || echo "Failed to get log stats"

echo -e "\nTesting recent logs endpoint..."
curl -s "$WORKER_URL/logs/recent?limit=5" | jq . || echo "Failed to get recent logs"

echo -e "\nTesting verbosity level endpoint..."
curl -s "$WORKER_URL/logs/verbosity" | jq . || echo "Failed to get verbosity level"

echo -e "\n🎉 Logging system setup complete!"
echo ""
echo "📋 Available logging endpoints:"
echo "  GET  /logs           - Query logs with filters"
echo "  GET  /logs/stats     - Get log statistics"
echo "  GET  /logs/recent    - Get recent logs (24h)"
echo "  GET  /logs/errors    - Get error logs only"
echo "  POST /logs/cleanup   - Clean up old logs"
echo "  POST /logs/verbosity - Set verbosity level"
echo "  GET  /logs/verbosity - Get current verbosity level"
echo "  POST /logs/flush     - Flush buffered logs"
echo ""
echo "🔧 Verbosity levels:"
echo "  QUIET   - Only FATAL and ERROR"
echo "  NORMAL  - WARN, ERROR, FATAL"
echo "  VERBOSE - INFO, WARN, ERROR, FATAL"
echo "  DEBUG   - DEBUG, INFO, WARN, ERROR, FATAL"
echo "  TRACE   - All levels including TRACE"
echo ""
echo "💡 Example usage:"
echo "  # Set verbosity to DEBUG"
echo "  curl -X POST '$WORKER_URL/logs/verbosity' -H 'Content-Type: application/json' -d '{\"level\": 3}'"
echo ""
echo "  # Query logs for a specific service"
echo "  curl '$WORKER_URL/logs?service=google-api&limit=10'"
echo ""
echo "  # Get error logs from last hour"
echo "  curl '$WORKER_URL/logs/errors?startDate=\$(date -u -d \"1 hour ago\" +%Y-%m-%dT%H:%M:%SZ)'"
