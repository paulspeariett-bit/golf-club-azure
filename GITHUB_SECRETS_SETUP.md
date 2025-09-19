# GitHub Repository Secrets Setup Instructions

## Required GitHub Secret:

### AZURE_CREDENTIALS
You need to get the Azure service principal credentials from the PowerShell output above.
The credentials were generated using the Azure CLI command and should be added as a GitHub secret.

## How to add this secret to GitHub:

1. Go to your GitHub repository: https://github.com/paulspeariett-bit/golf-club-azure
2. Click on Settings tab
3. Click on "Secrets and variables" in the left sidebar
4. Click on "Actions"
5. Click "New repository secret"
6. Name: AZURE_CREDENTIALS
7. Value: Paste the entire JSON object above
8. Click "Add secret"

## Security Note:
These credentials grant access to your Azure resources. Keep them secure and never commit them to your repository.