# GitHub Actions Deployment Fix

## Required GitHub Secret: AZURE_CREDENTIALS

You need to add a GitHub secret with the service principal credentials.

### How to add the secret:

1. Go to: https://github.com/paulspeariett-bit/golf-club-azure/settings/secrets/actions
2. Click "New repository secret"
3. Name: `AZURE_CREDENTIALS`
4. Value: (The complete JSON from when I ran the Azure CLI command earlier)

The JSON should look like this format:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

Note: Use the credentials from the PowerShell output when I created the service principal earlier in our session.