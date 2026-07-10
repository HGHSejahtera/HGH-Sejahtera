# 📱 iOS Direct Share (Shortcut) Handover

**Date**: 10 July 2026 (Version 0.6.5)
**Status**: Codebase updated, ready for final physical iOS device setup.

## 🎯 What Has Been Done
We have successfully replaced the Android-only PWA Web Share Target banner with a comprehensive iOS Shortcut solution.
- **Migration `048_iOSShortcutUpload.sql`**: Created the `PendingAWBUploads` table, `UploadToken` column for `Users`, and configured the `pending-awb` Storage bucket. *(Already committed)*.
- **API Endpoint (`api/share-awb.js`)**: Serverless function created to receive AWB PDFs via POST requests from the iOS Shortcuts app. *(Already committed)*.
- **Frontend Sync (`pendingUploads.js` & `AgentOrderCreate.jsx`)**: When an Agent opens the Upload AWB page, the system now automatically fetches, parses, and clears their pending Shortcut uploads from the server. *(Already committed)*.
- **UI (`IOSShortcutDialog.jsx`)**: Created the "iPhone User? Get iOS Shortcut" banner with step-by-step instructions and a Token copier. *(Already committed)*.

## ⚠️ What Needs To Be Done on the New Device

When you switch devices and pull the latest code, follow these exact steps to complete the feature:

### 1. Apply Supabase Migration
Run the SQL script `048_iOSShortcutUpload.sql` in your Supabase SQL Editor. 
*(If you run into any errors, they have already been fixed in the repo—just run the latest version).*

### 2. Create the Apple Shortcut (On an iPhone)
You must physically create the Shortcut once on your iPhone to get an iCloud link to share with your Agents.
1. Open the **Shortcuts** app on iPhone.
2. Tap **+** to create a new Shortcut. Name it **HGH Upload**.
3. Tap the **(i)** Info button at the bottom and turn on **Show in Share Sheet**.
4. Set it to only receive **PDFs** (tap "Any" next to "Receive" and uncheck everything except PDFs).
5. **Add Action 1**: `Ask for Input`
   - Prompt: `Sila masukkan Upload Token anda:`
   - Type: `Text`
6. **Add Action 2**: `Get Contents of URL`
   - URL: `https://www.hghsejahtera.my/api/share-awb`
   - Method: `POST`
   - Request Body: `Form`
   - **Item 1**: Key = `token`, Type = `Text`, Text = `[Provided Input]` (from Action 1)
   - **Item 2**: Key = `awb_file`, Type = `File`, File = `[Shortcut Input]` (from Share Sheet)
7. Tap **Done**.

### 3. Link the Shortcut to the UI
1. Long press the "HGH Upload" shortcut you just created and tap **Share** -> **Copy iCloud Link**.
2. Open `src/components/AgentPortal/IOSShortcutDialog.jsx` in the code editor.
3. Find the "Download HGH Shortcut" `<a href="#">` link (around line 52).
4. Replace `#` with the iCloud link you just copied.
5. Commit and push the code!

Your Agents can now click that button to install the Shortcut, paste their token, and share AWBs directly from TikTok Seller to HGH in 3 taps.
