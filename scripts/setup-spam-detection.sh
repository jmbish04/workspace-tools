#!/bin/bash
# Setup script for spam detection and deduplication system

echo "🚀 Setting up Spam Detection & Deduplication System"

# Create spam detection D1 database
echo "📊 Creating spam detection D1 database..."
SPAM_DB_RESULT=$(wrangler d1 create workspace-tools-spam)
echo "$SPAM_DB_RESULT"

# Extract database IDs (you'll need to manually update wrangler.toml with these)
echo ""
echo "⚠️  IMPORTANT: Update your wrangler.toml with the database IDs shown above"
echo ""

# Run primary database migrations
echo "📋 Running primary database migrations..."
wrangler d1 migrations apply DB --local
wrangler d1 migrations apply DB --remote

# Run spam database migrations
echo "🛡️  Running spam database migrations..."
wrangler d1 execute workspace-tools-spam --file=./migrations/spam-detection.sql --local
wrangler d1 execute workspace-tools-spam --file=./migrations/spam-detection.sql --remote

# Seed initial spam patterns
echo "🌱 Seeding initial spam patterns..."
wrangler d1 execute workspace-tools-spam --command="
INSERT INTO spam_patterns (pattern_type, pattern, regex_pattern, weight, description) VALUES
('SUBJECT', 'urgent_action', '(urgent|act now|limited time)', 2.0, 'Urgency indicators'),
('SUBJECT', 'money_offers', '(free money|cash|lottery|winner)', 3.0, 'Financial scam indicators'),
('CONTENT', 'phishing_verify', '(verify.*account|update.*payment|confirm.*identity)', 4.0, 'Account verification phishing'),
('CONTENT', 'suspicious_links', '(bit\.ly|tinyurl|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})', 2.5, 'Suspicious URL patterns'),
('SENDER', 'suspicious_domains', '(\.tk$|\.ml$|\.ga$|\.cf$)', 3.0, 'Suspicious TLD domains');
" --remote

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update wrangler.toml with the correct database IDs"
echo "2. Deploy your worker: wrangler deploy"
echo "3. Test the system with sample emails"
echo ""
echo "🔍 Monitoring:"
echo "- Check spam stats: Use the getProcessingStatus() method"
echo "- View quarantined emails: Query the spam_messages table"
echo "- Monitor false positives: Review spam_learning table"
