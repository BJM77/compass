#!/bin/bash
# Deploy Firestore security rules for the Compass project
# Ensure you have the required IAM permissions: roles/serviceusage.serviceUsageConsumer
# If you encounter a 403 error, grant the role at https://console.developers.google.com/iam-admin/iam?project=studio-5306701288-d19b1

# Exit on any error
set -e

# Use npx to run the latest firebase-tools without globally installing
npx -y firebase-tools deploy --only firestore:rules

echo "✅ Firestore security rules deployed successfully"
