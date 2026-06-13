#!/bin/bash
# Push secrets to Google Cloud Secret Manager
# Usage: source .env && bash infra/secrets.sh

set -e

echo "🔐 Pushing secrets to Secret Manager..."

gcloud secrets create SUPABASE_URL --data-file=<(echo -n "$SUPABASE_URL") 2>/dev/null || \
  echo -n "$SUPABASE_URL" | gcloud secrets versions add SUPABASE_URL --data-file=-

gcloud secrets create SUPABASE_SERVICE_KEY --data-file=<(echo -n "$SUPABASE_SERVICE_KEY") 2>/dev/null || \
  echo -n "$SUPABASE_SERVICE_KEY" | gcloud secrets versions add SUPABASE_SERVICE_KEY --data-file=-

gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=<(echo -n "$GOOGLE_CLIENT_SECRET") 2>/dev/null || \
  echo -n "$GOOGLE_CLIENT_SECRET" | gcloud secrets versions add GOOGLE_CLIENT_SECRET --data-file=-

gcloud secrets create GOOGLE_CLIENT_ID --data-file=<(echo -n "$GOOGLE_CLIENT_ID") 2>/dev/null || \
  echo -n "$GOOGLE_CLIENT_ID" | gcloud secrets versions add GOOGLE_CLIENT_ID --data-file=-

echo "✅ Secrets pushed successfully"

# Grant Cloud Run service account access
gcloud projects add-iam-policy-binding district-hackathon \
  --member="serviceAccount:district-backend@district-hackathon.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

echo "✅ IAM binding set"
