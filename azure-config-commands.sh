# Azure CLI commands to set DATABASE_URL
# (Run these in Azure Cloud Shell or local Azure CLI)

# Replace YOUR_PASSWORD with the actual database password
az webapp config appsettings set \
  --name golf-club-poc-2024 \
  --resource-group golf-club-resources \
  --settings DATABASE_URL="postgresql://golfadmin%40golf-club-db-server:YOUR_PASSWORD@golf-club-db-server.postgres.database.azure.com:5432/golf_club_db?sslmode=require"

# Restart the app to apply the new environment variable
az webapp restart \
  --name golf-club-poc-2024 \
  --resource-group golf-club-resources