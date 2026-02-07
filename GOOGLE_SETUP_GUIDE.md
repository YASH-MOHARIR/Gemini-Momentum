# Google Integration Setup Guide

**Time Required:** 3-5 minutes
**Cost:** FREE (no credit card required)
**One-time setup:** You only need to do this once

---

## What You'll Get

After setup, you can:

- Search and download Gmail attachments
- Create Google Sheets from processed data
- Export expense reports automatically

---

## Step-by-Step Instructions

### Step 1: Create a Google Cloud Project

1. Go to: https://console.cloud.google.com/projectcreate
2. You'll see a form with "Project name"
3. Type: `Momentum` (or any name you like)
4. Click the blue **"CREATE"** button
5. Wait 10-15 seconds for the project to be created

✅ **You should see:** "Momentum" in the top navigation bar

---

### Step 2: Enable Gmail API

1. Go to: https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Make sure "Momentum" is selected in the top dropdown
3. Click the blue **"ENABLE"** button
4. Wait 5 seconds

✅ **You should see:** "API enabled" message

---

### Step 3: Enable Google Sheets API

1. Go to: https://console.cloud.google.com/apis/library/sheets.googleapis.com
2. Click the blue **"ENABLE"** button
3. Wait 5 seconds

✅ **You should see:** "API enabled" message

---

### Step 4: Enable Google Drive API

1. Go to: https://console.cloud.google.com/apis/library/drive.googleapis.com
2. Click the blue **"ENABLE"** button
3. Wait 5 seconds

✅ **You should see:** "API enabled" message

---

### Step 5: Configure OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select **"External"** (the only option available)
3. Click **"CREATE"**
4. Fill in the form:
   - **App name:** `Momentum`
   - **User support email:** (select your email from dropdown)
   - **Developer contact email:** (type your email)
5. Click **"SAVE AND CONTINUE"** (bottom of page)
6. On "Scopes" page, click **"SAVE AND CONTINUE"** (don't add anything)
7. On "Test users" page, click **"+ ADD USERS"**
8. Type your Gmail address and click **"ADD"**
9. Click **"SAVE AND CONTINUE"**
10. Click **"BACK TO DASHBOARD"**

✅ **You should see:** OAuth consent screen configured

---

### Step 6: Create OAuth Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** (top of page)
3. Select **"OAuth client ID"**
4. For "Application type", select **"Desktop app"**
5. For "Name", type: `Momentum Desktop`
6. Click **"CREATE"**

✅ **You should see:** A popup with "Client ID" and "Client secret"

---

### Step 7: Copy Your Credentials

**IMPORTANT:** Keep this popup open!

You'll see something like:

```
Client ID: 123456789-abcdefg.apps.googleusercontent.com
Client secret: GOCSPX-abc123def456
```

---

### Step 8: Add Credentials to Momentum

1. Open your Momentum project folder in File Explorer/Finder
2. Look for a file named `.env` in the root folder
   - **If it exists:** Open it with Notepad/TextEdit
   - **If it doesn't exist:** Create a new file named `.env`

3. Add these lines (replace with YOUR credentials from Step 7):

```env
GEMINI_API_KEY=your-gemini-key-here

# Google Integration
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456
```

4. **Save the file**

---

### Step 9: Restart Momentum

1. Close Momentum completely
2. Open Momentum again
3. Look for the **"Connect Google"** button in the top bar
4. Click it
5. Your browser will open asking you to sign in
6. Sign in with your Google account
7. Click **"Continue"** when it says "Google hasn't verified this app" (this is normal for personal use)
8. Allow all permissions
9. You should see "✓ Signed in to Google" in your browser
10. Return to Momentum

✅ **Done!** You should now see your Google account connected in Momentum

---

## Troubleshooting

### "Google hasn't verified this app" warning

- **This is normal!** You're using your own app, so verification isn't needed
- Click **"Continue"** to proceed

### Can't find .env file

- Make sure you're in the project root folder (where package.json is)
- On Windows: Enable "Show hidden files" in File Explorer
- On Mac: Press `Cmd + Shift + .` to show hidden files

### "Access blocked" error

- Make sure you added yourself as a test user in Step 5
- Go back to Step 5 and add your email address

### Still not working?

- Double-check that you copied the ENTIRE Client ID and Client Secret
- Make sure there are no extra spaces in the .env file
- Restart Momentum after saving .env

---

## Privacy & Security

- ✅ Your credentials stay on YOUR computer
- ✅ Only YOU can access your Google data
- ✅ No third-party servers involved
- ✅ You can revoke access anytime at: https://myaccount.google.com/permissions

---

## Need Help?

If you get stuck, check:

1. Make sure all 3 APIs are enabled (Gmail, Sheets, Drive)
2. Make sure you added yourself as a test user
3. Make sure the .env file is saved in the correct location
4. Try restarting Momentum
