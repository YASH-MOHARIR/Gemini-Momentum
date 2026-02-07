# Quick Google Setup Checklist

Follow these links in order. Each step takes 30-60 seconds.

## ☐ Step 1: Create Project (30 sec)

1. Click: https://console.cloud.google.com/projectcreate
2. Type name: `Momentum`
3. Click blue "CREATE" button
4. Wait for confirmation

## ☐ Step 2: Enable Gmail API (15 sec)

1. Click: https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Click blue "ENABLE" button

## ☐ Step 3: Enable Sheets API (15 sec)

1. Click: https://console.cloud.google.com/apis/library/sheets.googleapis.com
2. Click blue "ENABLE" button

## ☐ Step 4: Enable Drive API (15 sec)

1. Click: https://console.cloud.google.com/apis/library/drive.googleapis.com
2. Click blue "ENABLE" button

## ☐ Step 5: Configure OAuth Consent (90 sec)

1. Click: https://console.cloud.google.com/apis/credentials/consent
2. Select "External"
3. Click "CREATE"
4. Fill in:
   - App name: `Momentum`
   - User support email: (your email)
   - Developer contact: (your email)
5. Click "SAVE AND CONTINUE" (3 times)
6. On "Test users" page, click "+ ADD USERS"
7. Add your email
8. Click "SAVE AND CONTINUE"
9. Click "BACK TO DASHBOARD"

## ☐ Step 6: Create Credentials (30 sec)

1. Click: https://console.cloud.google.com/apis/credentials
2. Click "+ CREATE CREDENTIALS"
3. Select "OAuth client ID"
4. Application type: "Desktop app"
5. Name: `Momentum Desktop`
6. Click "CREATE"
7. **KEEP THE POPUP OPEN!**

## ☐ Step 7: Copy to .env (60 sec)

1. Copy the Client ID and Client Secret from the popup
2. Open your Momentum project folder
3. Create/edit `.env` file
4. Add:

```
GEMINI_API_KEY=your-existing-key

GOOGLE_CLIENT_ID=paste-here
GOOGLE_CLIENT_SECRET=paste-here
```

5. Save the file

## ☐ Step 8: Restart & Test

1. Close Momentum
2. Open Momentum
3. Click "Connect Google"
4. Sign in when browser opens
5. Click "Continue" on the warning (this is normal!)
6. Done!

---

**Total Time:** 3-5 minutes
**Cost:** $0
**Frequency:** One time only
