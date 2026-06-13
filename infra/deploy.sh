#!/bin/bash
# Deploy backend to Google Cloud Run
# Usage: bash infra/deploy.sh

set -e

PROJECT_ID="district-hackathon"
REGION="us-central1"
SERVICE_NAME="district-api"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/district/api:latest"

echo "🏗️  Building Docker image..."
docker build -t $IMAGE ../backend/

echo "📦 Pushing to Artifact Registry..."
docker push $IMAGE

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=5 \
  --memory=1Gi \
  --cpu=1 \
  --service-account=district-backend@${PROJECT_ID}.iam.gserviceaccount.com \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},FRONTEND_URL=https://district.pages.dev"

echo "✅ Deployed! Getting URL..."
gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)'
