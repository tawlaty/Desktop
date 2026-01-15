# Printing Debug Guide - Cash & Card Receipts

## Debug Logs Added

I've added comprehensive logging at every step of the printing flow to help identify where the issue is:

### 1. Frontend Print Service (`printService.js`)
```javascript
console.log(`🖨️ [PrintService] _printDirectly called with:`, { type, printerId, hasData, dataKeys });
console.log(`📄 [PrintService] Generated payload length:`, payload.length);
console.log(`📝 [PrintService] Payload preview (first 200 chars):`, payload.substring(0, 200));
console.log(`📤 [PrintService] Calling window.printer.printReceipt...`);
console.log(`✅ [PrintService] printReceipt result:`, result);
```

### 2. Electron Printer Bridge (`electronPrinter.js`)
```javascript
console.log(`🖨️ [ElectronPrinterBridge] printReceipt called:`, { htmlLength, htmlPreview, copies, isAvailable });
console.log(`📡 [ElectronPrinterBridge] Calling window.electronAPI.printReceipt...`);
console.log(`✅ [ElectronPrinterBridge] printReceipt result:`, result);
```

### 3. Preload Bridge (`electron/preload/index.js`)
```javascript
console.log(`🌉 [Preload] printReceipt called:`, { htmlLength, htmlPreview, copies });
```

### 4. Main IPC Handler (`electron/main/ipc/printers.js`)
```javascript
console.log(`🖨️ [IPC printers:printReceipt] Called with:`, { htmlLength, htmlPreview, copies, htmlType });
console.log(`⚙️ [IPC printers:printReceipt] Current settings:`, { mainPrinter, mainPrinter1, ... });
console.log(`📋 [IPC printers:printReceipt] Filtered main printers:`, mainPrinters);
console.log(`📤 [IPC printers:printReceipt] Printing to: ${printerName}`);
console.log(`📥 [IPC printers:printReceipt] Result from ${printerName}:`, result);
console.log(`✅ [IPC printers:printReceipt] Final result:`, { allSuccess, results });
```

## How to Test

### Step 1: Build & Run the Desktop App

```bash
cd Desktop
npm start
```

### Step 2: Open Browser DevTools

Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open DevTools in the Electron window.

### Step 3: Make a Test Payment

1. Navigate to POS
2. Add items to an order
3. Complete payment (cash or card)
4. Watch the console logs in DevTools

### Step 4: Check the Log Flow

You should see logs in this order:

```
🖨️ [PrintService] _printDirectly called with: { type: 'print_receipt', ... }
📄 [PrintService] Generated payload length: 5234
📝 [PrintService] Payload preview (first 200 chars): <html dir="rtl" lang="ar">...
📤 [PrintService] Calling window.printer.printReceipt...
🖨️ [ElectronPrinterBridge] printReceipt called: { htmlLength: 5234, ... }
📡 [ElectronPrinterBridge] Calling window.electronAPI.printReceipt...
🌉 [Preload] printReceipt called: { htmlLength: 5234, ... }

[In Main Process Console - check Terminal where you ran npm start]
🖨️ [IPC printers:printReceipt] Called with: { htmlLength: 5234, ... }
⚙️ [IPC printers:printReceipt] Current settings: { mainPrinter: 'Your Printer Name', ... }
📋 [IPC printers:printReceipt] Filtered main printers: ['Your Printer Name']
📤 [IPC printers:printReceipt] Printing to: Your Printer Name
📥 [IPC printers:printReceipt] Result from Your Printer Name: { success: true }
✅ [IPC printers:printReceipt] Final result: { allSuccess: true, ... }

[Back in Renderer Console]
✅ [ElectronPrinterBridge] printReceipt result: { success: true, ... }
✅ [PrintService] printReceipt result: { success: true }
```

## Common Issues & Solutions

### Issue 1: "Main printer not configured"

**Symptoms:**
```
❌ [IPC printers:printReceipt] No main printers configured!
```

**Solution:**
1. Open Printer Settings (needs route integration - temp solution below)
2. Configure at least one main printer
3. Click Save

**Temp Test (in DevTools Console):**
```javascript
// List available printers
await window.electronAPI.getPrinters()

// Set a printer manually
await window.electronAPI.setSettings({
  mainPrinter: 'YOUR_PRINTER_NAME_HERE'
})
```

### Issue 2: HTML payload is empty

**Symptoms:**
```
📄 [PrintService] Generated payload length: 0
📝 [PrintService] Payload preview (first 200 chars): 
```

**Solution:**
The template is not receiving proper data. Check:
```javascript
// In console during payment:
console.log('Payment data:', {
  items: data.items,
  total: data.total,
  storeName: data.storeName
});
```

### Issue 3: window.printer not available

**Symptoms:**
```
❌ [ElectronPrinter] Electron API not available!
```

**Solution:**
1. Check if running in Electron (not web browser)
2. Verify `main.jsx` has been updated with the fix
3. Restart the Desktop app

**Test:**
```javascript
// In DevTools console:
console.log('window.electronAPI:', window.electronAPI);
console.log('window.printer:', window.printer);
console.log('Is available:', window.printer?.isAvailable());
```

### Issue 4: Printer exists but won't print

**Symptoms:**
```
✅ [IPC printers:printReceipt] Final result: { allSuccess: false }
📥 [IPC printers:printReceipt] Result: { success: false, error: '...' }
```

**Check:**
1. Printer is online and ready
2. Printer driver is installed
3. Test print from Windows settings
4. Check printer name matches exactly (case-sensitive)

## Manual Test Script

Run this in DevTools Console to test printing directly:

```javascript
// Test HTML generation
const testData = {
  storeName: "Test Store",
  orderNumber: "TEST-001",
  tableNumber: "1",
  items: [
    {
      name: "Test Product",
      quantity: 2,
      price: 5.00,
      taxRate: 16,
      isTaxIncluded: true
    }
  ],
  total: 10.00,
  subtotal: 8.62,
  taxTotal: 1.38,
  discount: 0,
  paidAmount: 10.00,
  change: 0,
  paymentMethod: "cash"
};

// Import the template
import { cashReceiptTemplate } from './templates/printTemplates.js';

// Generate HTML
const html = cashReceiptTemplate(testData);
console.log('Generated HTML length:', html.length);
console.log('HTML preview:', html.substring(0, 300));

// Test print
const result = await window.printer.printReceipt(html, 1);
console.log('Print result:', result);
```

## Checking Printer Settings File

The settings are stored in: `{userData}/settings.json`

To check current settings:
```javascript
await window.electronAPI.getSettings()
```

Expected output:
```json
{
  "mainPrinter": "Your Printer Name",
  "mainPrinter1": "please select",
  "mainPrinter2": "please select",
  "orderPrinter1": "please select",
  "labelPrinter": "please select",
  "disableCashDrawer": false
}
```

## Comparison with Old App

### Old App Flow:
1. Frontend generates HTML via template
2. Sends to old desktop app via WebView message
3. Old app receives in `print-service.js`
4. Calls `printHTML()` with BrowserWindow
5. Loads HTML via `data:text/html`
6. Prints via `webContents.print()`

### New App Flow:
1. Frontend generates HTML via template
2. Calls `window.printer.printReceipt(html, copies)`
3. Bridge forwards to `window.electronAPI.printReceipt()`
4. Preload forwards to IPC `printers:printReceipt`
5. Main process receives in `printers.js`
6. Loads settings, gets printer name
7. Calls `printHTML()` helper function
8. Creates BrowserWindow, loads HTML
9. Prints via `webContents.print()`

**Both use the same printing mechanism! The only difference is the IPC transport layer.**

## Next Steps

1. **Run the app** with the new debug logging
2. **Make a payment** and observe console logs
3. **Report back** which step is failing:
   - Is HTML being generated? (check payload length)
   - Is window.printer available?
   - Is printer configured in settings?
   - Is the IPC call reaching the main process?
   - Is printHTML being called?
   - Is the printer accepting the job?

4. **Share the console output** so I can see exactly where it's breaking

The debug logs will tell us exactly what's happening! 🎯
