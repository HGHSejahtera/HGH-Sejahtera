# iOS Shortcut Handover

## What's Done
- API endpoint `api/share-awb.js` accepts **Staff ID** + PDF file (No more UUID Tokens).
- `PendingAWBUploads` table + `pending-awb` storage bucket is fully operational.
- Banner renamed to **TikTok Direct Share** with the native Apple Shortcuts icon to avoid confusion with "Add to Home Screen".
- **PWA Guard Enabled**: The setup banner is 100% hidden if accessed from Safari. Agents must Add to Home Screen and login from the PWA first, preventing the Double-Login issue.

## What You Need To Do (On iPhone)

### Create the Shortcut
1. Open **Shortcuts** app on iPhone
2. Tap **+** → Name it **HGH Sejahtera**
3. Tap **(i)** → Turn on **Show in Share Sheet** → Set to receive **PDFs** only
4. Add action: **Ask for Input** → Prompt: `Staff ID` → Type: Text
5. Add action: **Get Contents of URL**
   - URL: `https://www.hghsejahtera.my/api/share-awb`
   - Method: POST
   - Request Body: Form
   - Key: `staff_id` → Text → [Provided Input]
   - Key: `awb_file` → File → [Shortcut Input]
6. Tap **Done**

### Get the Link
1. Long press **HGH Sejahtera** shortcut → **Share** → **Copy iCloud Link**
2. Open `src/components/AgentPortal/IOSShortcutDialog.jsx`
3. Replace `const SHORTCUT_LINK = '#'` with your iCloud link
4. Commit and push

### Agent Flow After Setup
1. Agent opens HGH PWA → Upload AWB → Taps "Get iOS Shortcut" → Installs → Types Staff ID → Done
2. Daily: TikTok → Share → HGH Sejahtera → Done
