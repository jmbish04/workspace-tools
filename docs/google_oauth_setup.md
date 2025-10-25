# Obtaining Long-Lived Google OAuth 2.0 Credentials

This guide provides step-by-step instructions on how to create and configure OAuth 2.0 credentials in the Google Cloud Platform. These credentials will allow the Cloudflare Worker to access Google Workspace APIs on your behalf. By generating a **refresh token**, the worker can automatically obtain new access tokens without requiring you to re-authenticate for several months.

## Prerequisites

- A Google account.
- A Google Cloud Platform (GCP) project. If you don't have one, create one at the [GCP Console](https://console.cloud.google.com/).

---

## Step 1: Enable Required APIs

Before creating credentials, you must enable the Google Workspace APIs that this worker will use.

1.  Go to the [GCP API Library](https://console.cloud.google.com/apis/library).
2.  Make sure you have the correct GCP project selected.
3.  Search for and enable the following APIs one by one:
    -   **Google Drive API**
    -   **Gmail API**
    -   **Google Docs API**
    -   **Google Sheets API**
    -   **Google Slides API**
    -   **Google Apps Script API**

---

## Step 2: Configure the OAuth Consent Screen

The consent screen is what users see when they grant access to their Google account. You need to configure this before you can generate credentials.

1.  Navigate to the [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) page in the GCP Console.
2.  **User Type**: Choose **External** and click **Create**.
3.  **App Information**:
    -   **App name**: Give your application a descriptive name (e.g., "Cloudflare Workspace Worker").
    -   **User support email**: Select your email address.
    -   **Developer contact information**: Enter your email address.
4.  Click **Save and Continue**.
5.  **Scopes**: You can skip this section for now by clicking **Save and Continue**. The scopes will be determined by the authentication request.
6.  **Test Users**:
    -   Click **+ Add Users**.
    -   Enter the email address of the Google account you will use to authenticate. This is the account whose Google Workspace data the worker will access.
    -   You can add multiple test users if needed.
7.  Click **Save and Continue**.
8.  Review the summary and click **Back to Dashboard**.
9.  Under **Publishing status**, click **Publish App**. You will need to confirm this, which will make your app available to any Google user (though we will control access by only authorizing specific users). *Note: If you keep the app in "Testing" mode, the refresh token will expire after 7 days.*

---

## Step 3: Create OAuth 2.0 Credentials

Now you will create the `client_id` and `client_secret` that the worker needs.

1.  Go to the [Credentials](https://console.cloud.google.com/apis/credentials) page in the GCP Console.
2.  Click **+ Create Credentials** and select **OAuth client ID**.
3.  **Application type**: Select **Web application**.
4.  **Name**: Give it a name, like "Workspace Worker Web Client".
5.  **Authorized redirect URIs**:
    -   Click **+ Add URI**.
    -   Enter `https://developers.google.com/oauthplayground`. We will use the Google OAuth 2.0 Playground to get the initial refresh token.
6.  Click **Create**.
7.  A dialog box will appear with your **Client ID** and **Client secret**. **Copy both of these and save them securely.** You will need them in the next steps. You can download the credentials as a JSON file for safekeeping.

---

## Step 4: Obtain the Refresh Token

In this step, you will use the OAuth 2.0 Playground to authorize the necessary API scopes and exchange an authorization code for a long-lived refresh token.

1.  Open the [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2.  In the top right corner, click the gear icon (**OAuth 2.0 configuration**).
3.  Check the box for **Use your own OAuth credentials**.
4.  Paste your **OAuth Client ID** and **OAuth Client secret** that you saved from the previous step.
5.  On the left, in the "Step 1: Select & authorize APIs" section, find the input box for scopes. Paste all of the following scopes, separated by spaces:
    ```
    https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/script.projects
    ```
6.  Click **Authorize APIs**.
7.  A Google sign-in window will appear. **Choose the same Google account you added as a "Test User"** in Step 2.
8.  You will see a consent screen asking for permission to access your data. Click **Allow**.
9.  You will be redirected back to the OAuth Playground. In "Step 2: Exchange authorization code for tokens", you will see an **Authorization code**.
10. Click the **Exchange authorization code for tokens** button.
11. In "Step 3", the **Refresh token** and **Access token** will appear. **Copy the Refresh token and save it securely.** This is the long-lived token.

---

## Step 5: Configure the Cloudflare Worker

You now have the three credentials needed to configure the worker:
-   `GOOGLE_CLIENT_ID`
-   `GOOGLE_CLIENT_SECRET`
-   `GOOGLE_REFRESH_TOKEN`

You will use the provided script to configure your worker's secrets. See the `README.md` for instructions on using the configuration script.
