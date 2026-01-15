# Auto-Update with Red Notification - Integration Guide

## ✅ What's Set Up:

### Backend (Electron Main Process):
1. **Auto-updater** checks for updates on startup
2. **Tray menu** has "Check for Updates" option
3. **Red notification badge** system via IPC
4. **System notifications** when update available

### Frontend Integration Needed:

Add this to your main app component (Frontend):

```javascript
// In your main app.jsx or index.html
import { createUpdateBadge } from './update-badge.js';

// Initialize on app load
if (window.electronAPI) {
  // Create the red badge
  const badge = document.createElement('div');
  badge.id = 'update-badge';
  badge.innerHTML = '🔴 Update Available';
  badge.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff0000;
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    z-index: 99999;
    display: none;
    box-shadow: 0 2px 10px rgba(255,0,0,0.5);
  `;
  
  badge.onclick = () => {
    window.electronAPI.checkForUpdates();
  };
  
  document.body.appendChild(badge);
  
  // Listen for update notifications
  window.electronAPI.onUpdateNotification((available) => {
    badge.style.display = available ? 'block' : 'none';
  });
}
```

## 🎨 How It Works:

### 1. Automatic Check (on app start):
- App starts → checks GitHub after 3 seconds
- If update found → Shows dialog + red badge + system notification

### 2. Manual Check (from tray):
- Right-click tray icon → "Check for Updates"
- Shows "Checking..." dialog
- If update found → Shows dialog + red badge
- If no update → Shows "You're up to date" message

### 3. Red Badge:
- Appears in top-right corner
- Pulsing animation
- Click to trigger update check
- Disappears when:
  - No update available
  - Update is downloading
  - Update is downloaded

### 4. System Notification:
- OS-level notification (Windows notification center)
- Click notification → Opens app and triggers update dialog

## 📦 To Publish Update:

```bash
# 1. Update version
npm version patch  # 1.0.0 → 1.0.1

# 2. Build
npm run build-production

# 3. Publish to GitHub
set GITHUB_TOKEN=your_token_here
npm run publish
```

## 🔍 Testing:

1. Build current version (1.0.0)
2. Install on test machine
3. Update version to 1.0.1 in package.json
4. Publish to GitHub
5. Open installed app → Should see red badge + notification

## 🎯 User Experience:

```
User opens app
    ↓
🔴 Red badge appears (top-right)
    ↓
System notification pops up
    ↓
User clicks badge or notification
    ↓
Dialog: "Version 1.0.1 available, download?"
    ↓
User clicks "Download"
    ↓
Badge disappears, download starts
    ↓
Dialog: "Update ready, restart now?"
    ↓
User clicks "Restart Now"
    ↓
App updates and restarts
```

Done! 🎉
